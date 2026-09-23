import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { configuration, markedCommand } from "./docs-core-examples.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Docs project configuration: ${message}`);
}

function titledBlock(page: string, language: string, title: string): string {
  const opening = `\`\`\`${language} title="${title}"\n`;
  const parts = page.split(opening);
  assert(parts.length === 2, `expected one ${language} block: ${title}`);
  const body = parts[1]?.split("\n```")[0];
  assert(body, `empty ${language} block: ${title}`);
  return body;
}

export function verifyProjectConfigurationExamples(
  binary: string,
  root: string,
  workspace: string,
  home: string,
): string[] {
  const checks: string[] = [];
  const suiteRoot = join(realpathSync(workspace), "project-configuration");
  const page = (path: string) => readFileSync(join(root, "docs", path), "utf8");
  const main = readFileSync(join(root, "examples/aws-vpc/main.tf"));
  const environment = {
    ...process.env,
    ROOTFORM_HOME: home,
    ROOTFORM_INPUT: "0",
    DOCKER_CONFIG: join(home, "docker"),
    PATH: `${dirname(binary)}:${process.env.PATH ?? ""}`,
    TMPDIR: suiteRoot,
  };

  function run(
    command: string[],
    cwd: string,
    expected = 0,
    environmentOverrides: Record<string, string> = {},
  ) {
    const result = Bun.spawnSync(command, {
      cwd,
      env: { ...environment, ...environmentOverrides },
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe",
    });
    assert(
      result.exitCode === expected,
      `${command.join(" ")}: exit ${result.exitCode}, expected ${expected}\n${result.stderr}`,
    );
    return { stdout: result.stdout.toString(), stderr: result.stderr.toString() };
  }

  function marked(
    document: string,
    marker: string,
    cwd: string,
    replacements: Record<string, string> = {},
    expected = 0,
    environmentOverrides: Record<string, string> = {},
  ) {
    let command = markedCommand(page(document), marker);
    for (const [from, to] of Object.entries(replacements)) command = command.replaceAll(from, to);
    return run(["sh", "-eu", "-c", command], cwd, expected, environmentOverrides);
  }

  mkdirSync(suiteRoot);

  const embeddedSource = join(suiteRoot, "embedded-source");
  const embeddedReplay = join(suiteRoot, "embedded-replay");
  const embeddedEvidence = join(suiteRoot, "embedded-evidence");
  mkdirSync(embeddedSource);
  mkdirSync(embeddedReplay);
  writeFileSync(join(embeddedSource, "main.tf"), main);
  writeFileSync(join(embeddedReplay, "main.tf"), main);

  marked("guides/reproduce-build.md", "offline-evidence-directory", embeddedSource, {
    "/path/to/evidence": embeddedEvidence,
  });
  assert(existsSync(embeddedEvidence), "documented setup did not create evidence directory");

  const embeddedBuild = marked("cli.md", "selection-embedded-build", embeddedSource);
  assert(!existsSync(join(embeddedSource, "rootform.lock")), "embedded build created a lock");
  assert(embeddedBuild.stderr.includes("Architecture built"), "embedded build did not complete");
  const embeddedList = marked("cli.md", "selection-embedded-list", embeddedSource).stdout.trim();
  assert(
    embeddedList === titledBlock(page("cli.md"), "text", "Embedded Dialect").trim(),
    "embedded Dialect listing differs from displayed output",
  );
  assert(
    run([binary, "list", "policy-packs", "-o", "json"], embeddedSource).stdout.trim() === "[]" &&
      run([binary, "list", "policies", "-o", "json"], embeddedSource).stdout.trim() === "[]",
    "supplied-only project unexpectedly selected policies",
  );

  marked("guides/reproduce-build.md", "offline-embedded-source", embeddedSource, {
    "/path/to/source-project": embeddedSource,
    "/path/to/evidence": embeddedEvidence,
  });
  const embeddedReplayResult = marked(
    "guides/reproduce-build.md",
    "offline-embedded-replay",
    embeddedReplay,
    {
      "/path/to/replay-project": embeddedReplay,
      "/path/to/evidence": embeddedEvidence,
    },
  );
  assert(
    embeddedReplayResult.stdout.includes("Architecture unchanged") &&
      readFileSync(join(embeddedEvidence, "before.json")).equals(
        readFileSync(join(embeddedEvidence, "after.json")),
      ),
    "embedded replay was not architecture-unchanged and byte-identical",
  );
  checks.push("embedded selection needs no lock and replays from an independent path and home");

  const policyProject = join(suiteRoot, "policy-project");
  mkdirSync(join(policyProject, "policies"), { recursive: true });
  writeFileSync(join(policyProject, "main.tf"), main);
  const policyGuide = page("guides/check-architecture.md");
  writeFileSync(
    join(policyProject, "policies/pack.rf.hcl"),
    configuration(policyGuide, "policies/pack.rf.hcl"),
  );
  writeFileSync(
    join(policyProject, "policies/subnet-network-context.rf.hcl"),
    configuration(policyGuide, "policies/subnet-network-context.rf.hcl"),
  );
  const identityResult = marked(
    "guides/external-content.md",
    "external-local-policy-identity",
    policyProject,
  ).stdout.trim();
  assert(
    identityResult ===
      titledBlock(page("guides/external-content.md"), "json", "Local Policy Pack identity").trim(),
    "local Policy Pack identity differs from displayed output",
  );
  assert(
    run([binary, "check", ".", "--policy-pack", "./policies"], policyProject).stdout.includes(
      "Policies compliant",
    ) && !existsSync(join(policyProject, "rootform.lock")),
    "explicit local Policy Pack did not stay lock-free",
  );

  const localLock = `${titledBlock(
    page("guides/external-content.md"),
    "json",
    "rootform.lock (local Policy Pack)",
  )}\n`;
  writeFileSync(join(policyProject, "rootform.lock"), localLock);
  const preparedLock = readFileSync(join(policyProject, "rootform.lock"));
  const localPreparation = marked(
    "guides/external-content.md",
    "external-local-policy-init",
    policyProject,
  );
  assert(
    localPreparation.stdout.includes('"content_digest": "sha256:3f301eea') &&
      readFileSync(join(policyProject, "rootform.lock")).equals(preparedLock),
    "local Policy Pack preparation changed lock or lost identity",
  );
  const lockedPolicyCheck = marked(
    "guides/external-content.md",
    "external-local-policy-check",
    policyProject,
  ).stdout.trim();
  assert(
    lockedPolicyCheck ===
      titledBlock(page("guides/external-content.md"), "text", "Locked Policy check").trim(),
    "locked local Policy Pack did not evaluate to displayed result",
  );

  const badProject = join(suiteRoot, "bad-policy-project");
  cpSync(policyProject, badProject, { recursive: true });
  const badLock = localLock.replace(
    "sha256:3f301eea6cfe95b1c66ba3c768d3d57613c847ca245cdb5ad3838e6604a19e9e",
    `sha256:${"0".repeat(64)}`,
  );
  writeFileSync(join(badProject, "rootform.lock"), badLock);
  const badSelection = run(
    [binary, "init", ".", "--locked", "--offline", "--no-input"],
    badProject,
    3,
  );
  assert(
    badSelection.stderr.includes("content differs from rootform.lock") &&
      readFileSync(join(badProject, "rootform.lock"), "utf8") === badLock,
    "bad local identity was not rejected without lock mutation",
  );
  run([binary, "vendor", "policy-packs", "--offline"], policyProject);
  assert(
    existsSync(join(policyProject, ".rootform/policy-packs/tutorial/.rootform-vendor.json")),
    "selected Policy Pack was not vendored in its project",
  );
  checks.push(
    "tutorial Policy Pack stays lock-free when explicit, evaluates when locked, and rejects drift",
  );

  const identityProject = join(suiteRoot, "dialect-project");
  const identityTemp = join(suiteRoot, "dialect-identity-temp");
  mkdirSync(join(identityProject, "third-party"), { recursive: true });
  mkdirSync(identityTemp);
  writeFileSync(join(identityProject, "main.tf"), main);
  cpSync(join(root, "dialects/confluent"), join(identityProject, "third-party/confluent"), {
    recursive: true,
  });
  const displayedDialectIdentity = JSON.parse(
    titledBlock(page("guides/external-content.md"), "json", "Extracted Dialect identity"),
  );
  const jq = Bun.which("jq");
  if (!jq) {
    checks.push("local Dialect identity shell block: NOT RUN because jq is unavailable");
  } else {
    assert(
      readdirSync(identityTemp).length === 0,
      "identity temp directory was not initially empty",
    );
    const shellIdentity = marked(
      "guides/external-content.md",
      "external-local-dialect-identity",
      identityProject,
      {},
      0,
      { TMPDIR: identityTemp },
    ).stdout.trim();
    assert(
      shellIdentity ===
        titledBlock(
          page("guides/external-content.md"),
          "json",
          "Extracted Dialect identity",
        ).trim(),
      "published jq identity extraction differs from displayed identity",
    );
    const generated = readdirSync(identityTemp);
    assert(
      generated.length === 1 && generated[0]?.startsWith("rootform-identity."),
      "mktemp did not create one parent with documented template",
    );
    const identityLayout = join(identityTemp, generated[0] ?? "", "layout");
    assert(existsSync(identityLayout), "Rootform did not create absent layout destination");
    const index = JSON.parse(readFileSync(join(identityLayout, "index.json"), "utf8"));
    const manifestDigest = String(index.manifests?.[0]?.digest ?? "");
    const manifest = JSON.parse(
      readFileSync(
        join(identityLayout, "blobs/sha256", manifestDigest.replace("sha256:", "")),
        "utf8",
      ),
    );
    const configDigest = String(manifest.config?.digest ?? "");
    const config = JSON.parse(
      readFileSync(
        join(identityLayout, "blobs/sha256", configDigest.replace("sha256:", "")),
        "utf8",
      ),
    );
    assert(
      config.owner === displayedDialectIdentity.owner &&
        config.version === displayedDialectIdentity.version &&
        config.content_digest === displayedDialectIdentity.content_digest,
      "independent OCI config reading differs from published jq extraction",
    );
    checks.push("published jq block extracts the displayed local Dialect identity");
  }

  const localDialectLock = `${titledBlock(
    page("guides/external-content.md"),
    "json",
    "rootform.lock (local Dialect)",
  )}\n`;
  writeFileSync(join(identityProject, "rootform.lock"), localDialectLock);
  const localDialectLockBytes = readFileSync(join(identityProject, "rootform.lock"));
  const localDialectPreparation = marked(
    "guides/external-content.md",
    "external-local-dialect-init",
    identityProject,
  );
  const displayedSelection = titledBlock(
    page("guides/external-content.md"),
    "text",
    "Selected local Dialect",
  ).trim();
  const localDialectOutput = [
    localDialectPreparation.stderr.trim(),
    localDialectPreparation.stdout.trim(),
  ]
    .filter(Boolean)
    .join("\n\n");
  assert(
    localDialectOutput === displayedSelection &&
      readFileSync(join(identityProject, "rootform.lock")).equals(localDialectLockBytes),
    `local Dialect selection output changed or preparation modified lock\n${localDialectPreparation.stderr}${localDialectPreparation.stdout}`,
  );

  const ociProject = join(suiteRoot, "oci-project");
  const ociHome = join(suiteRoot, "oci-home");
  mkdirSync(ociProject);
  mkdirSync(ociHome);
  writeFileSync(join(ociProject, "main.tf"), main);
  const ociLock = `${titledBlock(
    page("guides/external-content.md"),
    "json",
    "rootform.lock (OCI template)",
  )}\n`;
  writeFileSync(join(ociProject, "rootform.lock"), ociLock);
  const ociResult = Bun.spawnSync([binary, "init", ".", "--locked", "--offline", "--no-input"], {
    cwd: ociProject,
    env: { ...environment, ROOTFORM_HOME: ociHome },
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
  });
  assert(
    ociResult.exitCode === 3 &&
      !ociResult.stderr.toString().includes("rootform.lock is invalid") &&
      readFileSync(join(ociProject, "rootform.lock"), "utf8") === ociLock,
    "OCI template was not accepted as a valid unavailable offline selection",
  );
  checks.push("local Dialect selection prepares unchanged and OCI template satisfies lock parser");

  const externalSource = join(suiteRoot, "external-source");
  const externalReplay = join(suiteRoot, "external-replay");
  const externalEvidence = join(suiteRoot, "external-evidence");
  mkdirSync(join(externalSource, "third-party"), { recursive: true });
  mkdirSync(join(externalSource, "policies"), { recursive: true });
  writeFileSync(join(externalSource, "main.tf"), main);
  cpSync(join(root, "dialects/confluent"), join(externalSource, "third-party/confluent"), {
    recursive: true,
  });
  writeFileSync(
    join(externalSource, "policies/pack.rf.hcl"),
    configuration(policyGuide, "policies/pack.rf.hcl"),
  );
  writeFileSync(
    join(externalSource, "policies/subnet-network-context.rf.hcl"),
    configuration(policyGuide, "policies/subnet-network-context.rf.hcl"),
  );
  marked("guides/reproduce-build.md", "offline-evidence-directory", externalSource, {
    "/path/to/evidence": externalEvidence,
  });
  assert(existsSync(externalEvidence), "external report directory was not created by guide");
  const combinedLock = `${titledBlock(
    page("guides/external-content.md"),
    "json",
    "rootform.lock (combined replay selection)",
  )}\n`;
  writeFileSync(join(externalSource, "rootform.lock"), combinedLock);
  run([binary, "init", ".", "--locked", "--offline", "--no-input"], externalSource);
  const externalLockBytes = readFileSync(join(externalSource, "rootform.lock"));
  marked("guides/reproduce-build.md", "offline-vendor-dialects", externalSource, {
    "/path/to/source-project": externalSource,
  });
  assert(
    existsSync(join(externalSource, ".rootform/dialects/confluent/.rootform-vendor.json")) &&
      readFileSync(join(externalSource, "rootform.lock")).equals(externalLockBytes) &&
      !existsSync(join(suiteRoot, ".rootform")),
    "vendoring did not act on the selected project only",
  );
  marked("guides/reproduce-build.md", "offline-external-source", externalSource, {
    "/path/to/source-project": externalSource,
    "/path/to/evidence": externalEvidence,
  });
  assert(
    !existsSync(join(externalEvidence, "before-check.json")) &&
      !existsSync(join(externalEvidence, "before-check.status")),
    "build-only source path created governance evidence",
  );
  marked("guides/reproduce-build.md", "offline-vendor-policy-packs", externalSource, {
    "/path/to/source-project": externalSource,
  });
  assert(
    existsSync(join(externalSource, ".rootform/policy-packs/tutorial/.rootform-vendor.json")),
    "optional governance family was not vendored",
  );
  marked("guides/reproduce-build.md", "offline-governance-source", externalSource, {
    "/path/to/source-project": externalSource,
    "/path/to/evidence": externalEvidence,
  });
  const sourcePolicy = JSON.parse(
    readFileSync(join(externalEvidence, "before-check.json"), "utf8"),
  );
  assert(
    sourcePolicy.summary?.evaluations === 1 &&
      sourcePolicy.summary?.passed === 1 &&
      readFileSync(join(externalEvidence, "before-check.status"), "utf8") === "0\n",
    "source governance evidence did not record one passed evaluation and status 0",
  );
  cpSync(externalSource, externalReplay, { recursive: true });
  rmSync(join(externalReplay, "third-party"), { recursive: true });
  rmSync(join(externalReplay, "policies"), { recursive: true });
  assert(
    !existsSync(join(externalReplay, "third-party")) &&
      !existsSync(join(externalReplay, "policies")),
    "replay retained original external source directories",
  );
  const replayHomesBefore = new Set(
    readdirSync(suiteRoot).filter((entry) => entry.startsWith("rootform-home.")),
  );
  const replayResult = marked(
    "guides/reproduce-build.md",
    "offline-external-replay",
    externalReplay,
    {
      "/path/to/replay-project": externalReplay,
      "/path/to/evidence": externalEvidence,
    },
  );
  const replayHomesAfter = readdirSync(suiteRoot).filter(
    (entry) => entry.startsWith("rootform-home.") && !replayHomesBefore.has(entry),
  );
  assert(
    replayHomesAfter.length === 1 &&
      replayResult.stdout.includes("Architecture unchanged") &&
      readFileSync(join(externalEvidence, "before.json")).equals(
        readFileSync(join(externalEvidence, "after.json")),
      ) &&
      !existsSync(join(externalEvidence, "after-check.json")) &&
      !existsSync(join(externalEvidence, "after-check.status")),
    "build-only replay created governance evidence or changed architecture bytes",
  );
  const governanceHomesBefore = new Set(readdirSync(suiteRoot));
  marked("guides/reproduce-build.md", "offline-governance-replay", externalReplay, {
    "/path/to/replay-project": externalReplay,
    "/path/to/evidence": externalEvidence,
  });
  const governanceHomesAfter = readdirSync(suiteRoot).filter(
    (entry) => entry.startsWith("rootform-home.") && !governanceHomesBefore.has(entry),
  );
  assert(
    governanceHomesAfter.length === 1 &&
      readFileSync(join(externalEvidence, "before-check.json")).equals(
        readFileSync(join(externalEvidence, "after-check.json")),
      ) &&
      readFileSync(join(externalEvidence, "before-check.status")).equals(
        readFileSync(join(externalEvidence, "after-check.status")),
      ),
    "optional governance replay did not preserve Policy result, status, or fresh home",
  );

  const damagedLock = readFileSync(join(externalReplay, "rootform.lock"));
  rmSync(join(externalReplay, ".rootform/dialects/confluent/stream-processing/flink.rf.hcl"));
  const damagedHome = join(suiteRoot, "damaged-home");
  mkdirSync(damagedHome);
  const damaged = Bun.spawnSync([binary, "build", ".", "--locked", "--output", "broken.json"], {
    cwd: externalReplay,
    env: { ...environment, ROOTFORM_HOME: damagedHome },
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
  });
  assert(
    damaged.exitCode === 3 &&
      damaged.stderr.toString().includes("differs from rootform.lock") &&
      !existsSync(join(externalReplay, "broken.json")) &&
      readFileSync(join(externalReplay, "rootform.lock")).equals(damagedLock),
    "damaged vendor did not fail closed before fallback or lock mutation",
  );
  mkdirSync(join(externalReplay, "third-party"));
  cpSync(join(root, "dialects/confluent"), join(externalReplay, "third-party/confluent"), {
    recursive: true,
  });
  marked("guides/reproduce-build.md", "offline-vendor-dialects", externalReplay, {
    "/path/to/source-project": externalReplay,
  });
  rmSync(join(externalReplay, "third-party"), { recursive: true });
  run([binary, "build", ".", "--locked", "--output", "repaired.json"], externalReplay);
  assert(
    readFileSync(join(externalReplay, "repaired.json")).equals(
      readFileSync(join(externalEvidence, "before.json")),
    ),
    "explicit vendor repair did not restore byte-identical build",
  );
  checks.push(
    "build-only replay stays independent, optional governance preserves result and status, and damage fails closed",
  );

  return checks;
}
