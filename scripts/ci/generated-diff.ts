import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "../..");
const diagnostics: string[] = [];
for (const script of [
  "generate-cli-reference.ts",
  "generate-action-reference.ts",
  "generate-provider-coverage.ts",
]) {
  const result = Bun.spawnSync(["bun", `scripts/${script}`], {
    cwd: root,
    stdout: "pipe",
    stderr: "pipe",
  });
  if (result.exitCode !== 0) diagnostics.push(`${script}: ${result.stderr.toString().trim()}`);
}
const diff = Bun.spawnSync(["git", "diff", "--", "docs", "contracts/reference"], {
  cwd: root,
  stdout: "pipe",
  stderr: "pipe",
});
mkdirSync(resolve(root, "artifacts/generated-references"), { recursive: true });
writeFileSync(resolve(root, "artifacts/generated-references/expected.patch"), diff.stdout);
writeFileSync(
  resolve(root, "artifacts/generated-references/README.txt"),
  `Expected generated output from this exact PR source. Review and regenerate locally; this runner does not publish or commit it.\n${diagnostics.join("\n")}\n`,
);
if (diff.exitCode !== 0) throw new Error("Cannot produce generated reference diff");
