import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fenced } from "./docs-language-examples.ts";

type Member = { name: string; representation?: string; evidence?: string; reason?: string };
type Representation = {
  id: string;
  rule?: string;
  concept?: string;
  implementation: { kind: string; members?: Member[]; unresolved?: Member[] };
};
type Fact = { from: string; to: string; provenance: { evidence: string }[] };
type Architecture = {
  representations: Representation[];
  contexts: Fact[];
  closures: { representation: string; outcome: string; reason?: string }[];
};
type Form = { stages: { planned: Architecture } };

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(`Language learning: ${message}`);
}

export async function verifyLearningExamples(binary: string, root: string): Promise<string> {
  const workspace = mkdtempSync(join(tmpdir(), "rf-docs-learning-"));
  const transcripts: { args: string[]; exit: number | null; stdout: string; stderr: string }[] = [];
  const page = (name: string) => readFileSync(join(root, "docs/language", name), "utf8");
  const source = (name: string) => readFileSync(join(root, "dialects", name), "utf8");
  const write = (name: string, content: string) => {
    const folder = join(workspace, name);
    mkdirSync(folder, { recursive: true });
    writeFileSync(join(folder, "source.rf.hcl"), content);
    return folder;
  };
  const run = (args: string[]) => {
    const result = Bun.spawnSync([binary, ...args], {
      cwd: workspace,
      env: { ...process.env, ROOTFORM_HOME: join(workspace, "home") },
      stdout: "pipe",
      stderr: "pipe",
    });
    const stdout = result.stdout.toString();
    const stderr = result.stderr.toString();
    transcripts.push({ args, exit: result.exitCode, stdout, stderr });
    assert(
      result.exitCode === 0,
      `${args.join(" ")} exited ${result.exitCode}: ${stdout}${stderr}`,
    );
    return stdout;
  };
  const analyze = (fixture: string, dialect?: string, paired = false): Form => {
    const args = ["run", join(root, fixture, "plan.json"), "--no-serve", "--format", "json"];
    if (dialect) args.push("--dialect", dialect);
    if (paired)
      args.push("--plan-file", join(root, fixture, "plan.tfplan"), "--require-enrichment");
    return JSON.parse(run(args)) as Form;
  };

  const subnet = fenced(page("learn/read-a-rule.md"), "rf", "aws/network/vpc.rf.hcl");
  const aws = source("aws/network/vpc.rf.hcl");
  assert(aws.includes(subnet.trim()), "Rule walkthrough differs from official subnet Rule");
  const vpc = aws.slice(0, aws.indexOf('rule "subnet"'));
  const declarations = fenced(
    page("learn/read-a-rule.md"),
    "rf",
    "VPC target declarations, excerpt",
  );
  const normalized = (text: string) =>
    text
      .split("\n")
      .map((line) => line.trim())
      .join("\n")
      .trim();
  assert(
    normalized(vpc).includes(normalized(declarations)),
    "VPC target excerpt differs from official Rule",
  );
  const awsDialect = write("aws", source("aws/dialect.rf.hcl") + vpc + subnet);
  run(["validate", "dialects", awsDialect]);

  const fixture = "scripts/fixtures/docs/first-architecture";
  const plain = analyze(fixture, awsDialect).stages.planned;
  const paired = analyze(fixture, awsDialect, true).stages.planned;
  const from = "representation:1:aws_subnet.application";
  const to = "representation:1:aws_vpc.main";
  const context = paired.contexts.find((fact) => fact.from === from && fact.to === to);
  assert(
    context?.provenance.every((proof) => proof.evidence === "traversal"),
    "unknown VPC ID lacks traversal proof",
  );
  assert(
    paired.closures.some(
      (closure) => closure.representation === from && closure.outcome === "resolved",
    ),
    "paired subnet closure not resolved",
  );
  assert(
    plain.contexts.length === 0 &&
      plain.closures.some(
        (closure) => closure.representation === from && closure.reason === "unknown_until_apply",
      ),
    "plan-only unknown became a fact or absence",
  );

  const loadBalancer = fenced(
    page("learn/composition.md"),
    "rf",
    "google/load-balancing/application-load-balancer.rf.hcl",
  );
  assert(
    loadBalancer === source("google/load-balancing/application-load-balancer.rf.hcl"),
    "composition walkthrough differs from official Rule",
  );
  const google = write(
    "google",
    `${source("google/dialect.rf.hcl")}concept "load-balancer" {}\n${loadBalancer}`,
  );
  run(["validate", "dialects", google]);
  const compositeFixture = "dialects/fixtures/slice/load-balancer";
  for (const enriched of [false, true]) {
    const stage = analyze(compositeFixture, google, enriched).stages.planned;
    const rootRepresentation = stage.representations.find(
      (rep) => rep.rule === "google.rule.application-load-balancer",
    );
    assert(
      rootRepresentation?.concept === "google.concept.load-balancer",
      "unresolved composition lost root classification",
    );
    const members = enriched
      ? rootRepresentation.implementation.members
      : rootRepresentation.implementation.unresolved;
    assert(members?.length === 3, "composition lost required member records");
    if (enriched) {
      assert(
        members.every((member) => member.representation && member.evidence === "traversal"),
        "uninterpreted composition members lack traversal proof",
      );
      for (const member of members) {
        const representation = stage.representations.find(
          (rep) => rep.id === member.representation,
        );
        assert(
          representation && !representation.rule && !representation.concept,
          "member lost base or inherited root semantics",
        );
      }
    } else {
      assert(
        members.every((member) => !member.representation && member.reason),
        "plan-only unknown composition guessed members",
      );
      assert(
        members
          .filter((member) => member.name !== "target-https-proxy")
          .every((member) => member.reason === "unavailable"),
        "dependent unresolved members lost unavailable reason",
      );
    }
  }

  const formPath = join(workspace, "analysis.json");
  writeFileSync(
    formPath,
    JSON.stringify(analyze("examples/playground/commerce-platform/head", undefined, true)),
  );
  const policy = write(
    "policy",
    fenced(page("tour.md"), "rf", "policies/pack.rf.hcl") +
      fenced(page("learn/policies.md"), "rf", "policies/subnet-network-context.rf.hcl"),
  );
  run([
    "compile",
    "policy-pack",
    policy,
    "--semantics",
    formPath,
    "--output",
    join(workspace, "policy.json"),
  ]);
  const target = fenced(page("write-policy-pack.md"), "rf", "AWS-only target variant");
  const targetPack = write(
    "target",
    `policy_pack "target-example" { version = "0.1.0" }\npolicy "cluster" {\n${target}\nassert = true\nmessage = "Cluster target must be selected."\n}\n`,
  );
  run([
    "compile",
    "policy-pack",
    targetPack,
    "--semantics",
    formPath,
    "--output",
    join(workspace, "target.json"),
  ]);

  if (process.env.ROOTFORM_DOCS_EVIDENCE_DIR) {
    mkdirSync(process.env.ROOTFORM_DOCS_EVIDENCE_DIR, { recursive: true });
    writeFileSync(
      join(process.env.ROOTFORM_DOCS_EVIDENCE_DIR, "learning-examples.json"),
      JSON.stringify(transcripts, null, 2),
    );
  }
  return "learning examples: exact official Rules, target declarations, plan-only/paired closures, retained composition roots/members, Policy and target compilation verified";
}
