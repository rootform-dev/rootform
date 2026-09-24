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

const ansiSgr = new RegExp(String.fromCharCode(27) + String.raw`\[[0-9;]*m`, "gu");

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Docs project configuration: ${message}`);
}

function titledBlock(page: string, language: string, title: string): string {
  const languages = language === "text" ? ["text", "ansi"] : [language];
  const blocks = languages.flatMap((candidate) => {
    const parts = page.split(`\`\`\`${candidate} title="${title}"\n`);
    return parts.length === 2 ? [parts[1]?.split("\n```")[0]] : [];
  });
  assert(blocks.length === 1, `expected one ${language} block: ${title}`);
  const body = blocks[0];
  assert(body, `empty ${language} block: ${title}`);
  return language === "text" ? body.replace(ansiSgr, "") : body;
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

  const policyGuide = page("guides/check-architecture.md");
  const tutorialDigest = "sha256:3f301eea6cfe95b1c66ba3c768d3d57613c847ca245cdb5ad3838e6604a19e9e";
  function writeTutorialPack(project: string): void {
    mkdirSync(join(project, "policies"), { recursive: true });
    for (const file of ["pack.rf.hcl", "subnet-network-context.rf.hcl"]) {
      writeFileSync(
        join(project, "policies", file),
        configuration(policyGuide, `policies/${file}`),
      );
    }
  }
  // The documented payments Dialect is a copy of the smallest official
  // Dialect under a new owner, so it is external rather than embedded.
  function writePaymentsDialect(project: string): void {
    const destination = join(project, "dialects/payments");
    mkdirSync(destination, { recursive: true });
    cpSync(
      join(root, "dialects/secrets/presentation.json"),
      join(destination, "presentation.json"),
    );
    const declaration = readFileSync(join(root, "dialects/secrets/dialect.rf.hcl"), "utf8");
    assert(declaration.includes('dialect "secrets"'), "secrets Dialect declaration moved");
    writeFileSync(
      join(destination, "dialect.rf.hcl"),
      declaration.replace('dialect "secrets"', 'dialect "payments"'),
    );
  }
  const lockOf = (project: string) => readFileSync(join(project, "rootform.lock"));

  const policyProject = join(suiteRoot, "policy-project");
  mkdirSync(policyProject);
  writeFileSync(join(policyProject, "main.tf"), main);
  writeTutorialPack(policyProject);
  assert(
    run([binary, "check", ".", "--policy-pack", "./policies"], policyProject).stdout.includes(
      "Policies compliant",
    ) && !existsSync(join(policyProject, "rootform.lock")),
    "explicit local Policy Pack did not stay lock-free",
  );
  const adopted = marked("guides/external-content.md", "external-add-local-pack", policyProject);
  const adoptedLock = JSON.parse(lockOf(policyProject).toString("utf8"));
  assert(
    adopted.stdout.includes("rootform.lock updated") &&
      adopted.stdout.includes("Project prepared") &&
      /^tutorial\s+0\.1\.0\s+1$/mu.test(adopted.stdout) &&
      adoptedLock.policy_packs?.length === 1 &&
      adoptedLock.policy_packs[0].name === "tutorial" &&
      adoptedLock.policy_packs[0].content_digest === tutorialDigest &&
      adoptedLock.policy_packs[0].source?.local?.path === "policies",
    `documented add did not record the local Policy Pack\n${adopted.stdout}${adopted.stderr}`,
  );
  const localLock = lockOf(policyProject);
  const repeated = run([binary, "add", "policy-packs", "./policies"], policyProject);
  assert(
    repeated.stdout.includes("rootform.lock already matches; nothing changed") &&
      lockOf(policyProject).equals(localLock),
    "repeated add changed an unchanged selection",
  );

  const missingProject = join(suiteRoot, "missing-selected-content");
  mkdirSync(missingProject);
  writeFileSync(join(missingProject, "main.tf"), main);
  writeFileSync(join(missingProject, "rootform.lock"), localLock);
  const missingList = run([binary, "list", "policies", "-o", "json"], missingProject, 3);
  const missingInit = run(
    [binary, "init", ".", "--locked", "--offline", "--no-input"],
    missingProject,
    3,
  );
  assert(
    missingList.stderr.includes("selected Policy Pack tutorial is unavailable locally") &&
      missingInit.stderr.includes("local source is unavailable") &&
      lockOf(missingProject).equals(localLock),
    "missing selected content did not block list/init while preserving the lock",
  );
  const lockedPolicyCheck = run([binary, "check", ".", "--locked"], policyProject).stdout;
  marked("reference/cli/explain/policy.md", "cli-explain-policy", policyProject);
  assert(
    lockedPolicyCheck.includes("Policies compliant") &&
      /Results\s+1 passed/u.test(lockedPolicyCheck),
    "locked local Policy Pack did not evaluate its selected policy",
  );

  const policyFile = join(policyProject, "policies/subnet-network-context.rf.hcl");
  const policySource = readFileSync(policyFile, "utf8");
  writeFileSync(policyFile, policySource.replace("Subnets must", "Every subnet must"));
  const drifted = run([binary, "check", ".", "--locked"], policyProject, 3);
  assert(
    drifted.stderr.includes("rootform update policy-pack tutorial") &&
      lockOf(policyProject).equals(localLock),
    `edited local Policy Pack did not point to update\n${drifted.stderr}`,
  );
  const triedPack = marked("guides/external-content.md", "external-try-local", policyProject);
  assert(
    triedPack.stderr.includes("for this command only") && lockOf(policyProject).equals(localLock),
    `documented override did not use the edited pack alone\n${triedPack.stderr}`,
  );
  marked("guides/external-content.md", "external-update-local", policyProject);
  const updatedLock = JSON.parse(lockOf(policyProject).toString("utf8"));
  assert(
    updatedLock.policy_packs?.[0]?.content_digest !== tutorialDigest &&
      updatedLock.policy_packs?.[0]?.source?.local?.path === "policies",
    "documented update did not record edited local content",
  );
  writeFileSync(policyFile, policySource);
  run([binary, "update", "policy-pack", "tutorial"], policyProject);
  assert(lockOf(policyProject).equals(localLock), "restored content did not restore lock bytes");

  const badProject = join(suiteRoot, "bad-policy-project");
  cpSync(policyProject, badProject, { recursive: true });
  const badLock = localLock.toString("utf8").replace(tutorialDigest, `sha256:${"0".repeat(64)}`);
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
  const badCIOutput = join(suiteRoot, "bad-policy-ci-output");
  run(["sh", join(root, "docs/integrations/ci/rootform-ci.sh")], suiteRoot, 3, {
    ROOTFORM_BIN: binary,
    ROOTFORM_CHECK: "1",
    ROOTFORM_OFFLINE: "1",
    ROOTFORM_OUTPUT_DIR: badCIOutput,
    ROOTFORM_PROJECT: badProject,
  });
  assert(
    !existsSync(join(badCIOutput, "check.status")) &&
      readFileSync(join(badCIOutput, "init.stderr"), "utf8").includes(
        "content differs from rootform.lock",
      ) &&
      readFileSync(join(badProject, "rootform.lock"), "utf8") === badLock,
    "CI invalid lock was mislabeled as a Policy result or changed the lock",
  );
  run([binary, "vendor", "policy-packs", "--offline"], policyProject);
  assert(
    existsSync(join(policyProject, ".rootform/policy-packs/tutorial/.rootform-vendor.json")),
    "selected Policy Pack was not vendored in its project",
  );
  const policyCopy = join(suiteRoot, "selected-policy-copy");
  run([binary, "vendor", "policy-packs", "--offline", "--to", policyCopy], policyProject);
  assert(
    existsSync(join(policyCopy, "tutorial/.rootform-vendor.json")) &&
      lockOf(policyProject).equals(localLock),
    "Policy Pack --to changed project selection or lock",
  );
  const removedProject = join(suiteRoot, "removed-policy-project");
  cpSync(policyProject, removedProject, { recursive: true });
  marked("guides/external-content.md", "external-remove", removedProject);
  const removedLock = JSON.parse(lockOf(removedProject).toString("utf8"));
  assert(
    removedLock.policy_packs?.length === 0 &&
      existsSync(join(removedProject, "policies/pack.rf.hcl")) &&
      !existsSync(join(removedProject, ".rootform/policy-packs/tutorial")),
    "documented remove kept the selection or its vendored copy, or deleted the source",
  );
  checks.push(
    "tutorial Policy Pack is added, updated, vendored, and removed by the documented commands",
  );

  const dialectProject = join(suiteRoot, "dialect-project");
  mkdirSync(dialectProject);
  writeFileSync(join(dialectProject, "main.tf"), main);
  writePaymentsDialect(dialectProject);
  const localDialectGuide = page("guides/local-dialect.md");
  const tried = marked("guides/local-dialect.md", "local-dialect-1", dialectProject);
  assert(
    tried.stderr.startsWith(
      titledBlock(localDialectGuide, "text", "Standard error from the example").trim(),
    ) && !existsSync(join(dialectProject, "rootform.lock")),
    `--dialect trial changed the lock or lost its notice\n${tried.stderr}`,
  );
  marked("guides/local-dialect.md", "local-dialect-2", dialectProject);
  const added = marked("guides/local-dialect.md", "local-dialect-3", dialectProject);
  assert(
    added.stdout.trim() === titledBlock(localDialectGuide, "text", "Example result").trim(),
    `local Dialect add differs from displayed output\n${added.stdout}${added.stderr}`,
  );
  const localDialectLockBytes = lockOf(dialectProject);
  const localDialectLock = JSON.parse(localDialectLockBytes.toString("utf8"));
  assert(
    localDialectLock.dialects?.[0]?.owner === "payments" &&
      localDialectLock.dialects[0].source?.local?.path === "dialects/payments",
    "local Dialect add did not record its project-relative path",
  );
  run([binary, "init", ".", "--locked", "--offline", "--no-input"], dialectProject);
  assert(
    lockOf(dialectProject).equals(localDialectLockBytes),
    "local Dialect preparation modified lock",
  );
  const dialectCopy = join(suiteRoot, "selected-dialect-copy");
  run([binary, "vendor", "dialects", "--offline", "--to", dialectCopy], dialectProject);
  assert(
    existsSync(join(dialectCopy, "payments/.rootform-vendor.json")) &&
      lockOf(dialectProject).equals(localDialectLockBytes),
    "Dialect --to changed project selection or lock",
  );
  const dialectCIOutput = join(suiteRoot, "dialect-only-ci-output");
  run(["sh", join(root, "docs/integrations/ci/rootform-ci.sh")], suiteRoot, 0, {
    ROOTFORM_BIN: binary,
    ROOTFORM_CHECK: "0",
    ROOTFORM_OFFLINE: "1",
    ROOTFORM_OUTPUT_DIR: dialectCIOutput,
    ROOTFORM_PROJECT: dialectProject,
  });
  assert(
    existsSync(join(dialectCIOutput, "init.json")) &&
      existsSync(join(dialectCIOutput, "architecture.json")) &&
      !existsSync(join(dialectCIOutput, "check.status")) &&
      lockOf(dialectProject).equals(localDialectLockBytes),
    "CI dialect-only lock started a check or changed the lock",
  );
  checks.push(
    "portable CI script builds a Dialects-only lock without a Policy gate and rejects invalid or missing content",
  );

  const ociProject = join(suiteRoot, "oci-project");
  mkdirSync(ociProject);
  writeFileSync(join(ociProject, "main.tf"), main);
  const offlineTag = run(
    [binary, "add", "dialects", "registry.example.com/acme/rootform/payments:0.1.0"],
    ociProject,
    2,
    { ROOTFORM_OFFLINE: "1" },
  );
  assert(
    offlineTag.stderr.includes("cannot be resolved offline") &&
      !existsSync(join(ociProject, "rootform.lock")),
    "offline tag add did not stop before writing a lock",
  );

  const replaceProject = join(suiteRoot, "replace-project");
  mkdirSync(join(replaceProject, "dialects"), { recursive: true });
  writeFileSync(join(replaceProject, "main.tf"), main);
  cpSync(join(root, "dialects/aws"), join(replaceProject, "dialects/aws"), { recursive: true });
  run([binary, "add", "dialects", "./dialects/aws"], replaceProject, 1);
  assert(
    !existsSync(join(replaceProject, "rootform.lock")),
    "embedded owner collision wrote a lock without --replace",
  );
  const selectedOwners = () => {
    const lock = JSON.parse(lockOf(replaceProject).toString("utf8"));
    return {
      excluded: JSON.stringify(lock.excluded_owners),
      replaced: JSON.stringify(lock.replacements),
    };
  };
  marked("guides/external-content.md", "external-replace", replaceProject);
  assert(selectedOwners().replaced === '["aws"]', "documented --replace did not replace aws");
  marked("guides/external-content.md", "external-restore", replaceProject);
  assert(
    selectedOwners().replaced === "[]" && selectedOwners().excluded === "[]",
    "removing the replacement did not restore embedded aws",
  );
  const excluded = run([binary, "remove", "dialects", "aws", "--embedded"], replaceProject);
  assert(
    excluded.stdout.includes("rootform.lock updated") && selectedOwners().excluded === '["aws"]',
    "remove --embedded did not exclude aws",
  );
  run([binary, "add", "dialects", "aws"], replaceProject);
  assert(selectedOwners().excluded === "[]", "bare owner add did not include aws again");
  marked("guides/external-content.md", "external-exclude", replaceProject);
  assert(
    selectedOwners().excluded === "[]" && selectedOwners().replaced === "[]",
    "documented exclude and include sequence did not end with embedded aws",
  );
  checks.push(
    "local Dialect trial, add, offline tag refusal, replacement, and exclusion follow the guides",
  );

  const externalSource = join(suiteRoot, "external-source");
  const externalReplay = join(suiteRoot, "external-replay");
  const externalEvidence = join(suiteRoot, "external-evidence");
  mkdirSync(externalSource);
  writeFileSync(join(externalSource, "main.tf"), main);
  writePaymentsDialect(externalSource);
  writeTutorialPack(externalSource);
  marked("guides/reproduce-build.md", "offline-evidence-directory", externalSource, {
    "/path/to/evidence": externalEvidence,
  });
  assert(existsSync(externalEvidence), "external report directory was not created by guide");
  marked("guides/reproduce-build.md", "offline-add-dialect", externalSource, {
    "/path/to/source-project": externalSource,
  });
  const externalLockBytes = lockOf(externalSource);
  marked("guides/reproduce-build.md", "offline-vendor-dialects", externalSource, {
    "/path/to/source-project": externalSource,
  });
  assert(
    existsSync(join(externalSource, ".rootform/dialects/payments/.rootform-vendor.json")) &&
      lockOf(externalSource).equals(externalLockBytes) &&
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
  rmSync(join(externalReplay, "dialects"), { recursive: true });
  rmSync(join(externalReplay, "policies"), { recursive: true });
  assert(
    !existsSync(join(externalReplay, "dialects")) && !existsSync(join(externalReplay, "policies")),
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

  const damagedLock = lockOf(externalReplay);
  const vendoredDeclaration = join(externalReplay, ".rootform/dialects/payments/dialect.rf.hcl");
  const declaration = readFileSync(vendoredDeclaration, "utf8");
  assert(declaration.includes(">= 3.0.0"), "vendored payments declaration moved");
  writeFileSync(vendoredDeclaration, declaration.replace(">= 3.0.0", ">= 3.1.0"));
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
      lockOf(externalReplay).equals(damagedLock),
    "damaged vendor did not fail closed before fallback or lock mutation",
  );
  const damagedCIOutput = join(suiteRoot, "damaged-ci-output");
  run(["sh", join(root, "docs/integrations/ci/rootform-ci.sh")], suiteRoot, 3, {
    ROOTFORM_BIN: binary,
    ROOTFORM_CHECK: "1",
    ROOTFORM_HOME: damagedHome,
    ROOTFORM_OFFLINE: "1",
    ROOTFORM_OUTPUT_DIR: damagedCIOutput,
    ROOTFORM_PROJECT: externalReplay,
  });
  const damagedCIDiagnostic = ["init.stderr", "build.stderr"]
    .filter((name) => existsSync(join(damagedCIOutput, name)))
    .map((name) => readFileSync(join(damagedCIOutput, name), "utf8"))
    .join("\n");
  assert(
    !existsSync(join(damagedCIOutput, "check.status")) &&
      damagedCIDiagnostic.includes("differs from rootform.lock") &&
      lockOf(externalReplay).equals(damagedLock),
    `CI damaged content did not fail before Policy verdict: ${damagedCIDiagnostic}`,
  );
  writePaymentsDialect(externalReplay);
  marked("guides/reproduce-build.md", "offline-vendor-dialects", externalReplay, {
    "/path/to/source-project": externalReplay,
  });
  rmSync(join(externalReplay, "dialects"), { recursive: true });
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
