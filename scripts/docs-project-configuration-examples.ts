import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { markedCommand } from "./docs-core-examples.ts";

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

  function run(command: string[], cwd: string, expected = 0) {
    const result = Bun.spawnSync(command, {
      cwd,
      env: environment,
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
  ) {
    let command = markedCommand(page(document), marker);
    for (const [from, to] of Object.entries(replacements)) command = command.replaceAll(from, to);
    return run(["sh", "-eu", "-c", command], cwd, expected);
  }

  mkdirSync(suiteRoot);

  const embeddedSource = join(suiteRoot, "embedded-source");
  const embeddedReplay = join(suiteRoot, "embedded-replay");
  const embeddedEvidence = join(suiteRoot, "embedded-evidence");
  mkdirSync(embeddedSource);
  mkdirSync(embeddedReplay);
  mkdirSync(embeddedEvidence);
  writeFileSync(join(embeddedSource, "main.tf"), main);
  writeFileSync(join(embeddedReplay, "main.tf"), main);

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
  cpSync(join(root, "policy-packs/baseline"), join(policyProject, "policies/baseline"), {
    recursive: true,
  });
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
    run(
      [binary, "check", ".", "--policy-pack", "./policies/baseline"],
      policyProject,
      3,
    ).stdout.includes("Policies not evaluated") &&
      !existsSync(join(policyProject, "rootform.lock")),
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
    localPreparation.stdout.includes('"content_digest": "sha256:252d152a') &&
      readFileSync(join(policyProject, "rootform.lock")).equals(preparedLock),
    "local Policy Pack preparation changed lock or lost identity",
  );

  const badProject = join(suiteRoot, "bad-policy-project");
  cpSync(policyProject, badProject, { recursive: true });
  const badLock = localLock.replace(
    "sha256:252d152ab845848c50f1ecccee7da5b6ee8e0cedeac34e0cd7f820de5246aa47",
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
    existsSync(join(policyProject, ".rootform/policy-packs/baseline/.rootform-vendor.json")),
    "selected Policy Pack was not vendored in its project",
  );
  checks.push("explicit and locked local Policy Pack paths preserve identity and reject drift");

  const identityLayout = join(suiteRoot, "dialect-identity");
  run(
    [binary, "package", "dialects", join(root, "dialects/confluent"), "--to", identityLayout],
    root,
  );
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
    readFileSync(join(identityLayout, "blobs/sha256", configDigest.replace("sha256:", "")), "utf8"),
  );
  const displayedDialectIdentity = JSON.parse(
    titledBlock(page("guides/external-content.md"), "json", "Extracted Dialect identity"),
  );
  assert(
    config.owner === displayedDialectIdentity.owner &&
      config.version === displayedDialectIdentity.version &&
      config.content_digest === displayedDialectIdentity.content_digest,
    "packaged Dialect config differs from displayed local identity",
  );
  const identityCommands = markedCommand(
    page("guides/external-content.md"),
    "external-local-dialect-identity",
  );
  for (const fragment of ["index.json", ".config.digest", "content_digest"]) {
    assert(identityCommands.includes(fragment), `Dialect identity extraction omits ${fragment}`);
  }

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
  checks.push("local packaging exposes content identity and OCI template satisfies lock parser");

  const externalSource = join(suiteRoot, "external-source");
  const externalReplay = join(suiteRoot, "external-replay");
  const externalEvidence = join(suiteRoot, "external-evidence");
  mkdirSync(join(externalSource, "dialects"), { recursive: true });
  mkdirSync(externalEvidence);
  writeFileSync(join(externalSource, "main.tf"), main);
  cpSync(join(root, "dialects/confluent"), join(externalSource, "dialects/confluent"), {
    recursive: true,
  });
  const dialectLock = `${JSON.stringify(
    {
      format_version: "1",
      dialects: [
        {
          owner: config.owner,
          version: config.version,
          content_digest: config.content_digest,
          source: { local: { path: "dialects/confluent" } },
        },
      ],
      policy_packs: [],
      excluded_owners: [],
      replacements: ["confluent"],
    },
    null,
    2,
  )}\n`;
  writeFileSync(join(externalSource, "rootform.lock"), dialectLock);
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
  cpSync(externalSource, externalReplay, { recursive: true });
  const replayResult = marked(
    "guides/reproduce-build.md",
    "offline-external-replay",
    externalReplay,
    {
      "/path/to/replay-project": externalReplay,
      "/path/to/evidence": externalEvidence,
    },
  );
  assert(
    replayResult.stdout.includes("Architecture unchanged") &&
      readFileSync(join(externalEvidence, "before.json")).equals(
        readFileSync(join(externalEvidence, "after.json")),
      ),
    "external replay was not architecture-unchanged and byte-identical",
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
  marked("guides/reproduce-build.md", "offline-vendor-dialects", externalReplay, {
    "/path/to/source-project": externalReplay,
  });
  run([binary, "build", ".", "--locked", "--output", "repaired.json"], externalReplay);
  assert(
    readFileSync(join(externalReplay, "repaired.json")).equals(
      readFileSync(join(externalEvidence, "before.json")),
    ),
    "explicit vendor repair did not restore byte-identical build",
  );
  checks.push(
    "external selection vendors the intended project, replays with a fresh home, and fails closed on damage",
  );

  return checks;
}
