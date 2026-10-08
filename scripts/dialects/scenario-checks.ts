// Reviewed expectations for official Dialect fixtures live in
// dialects/evidence/<dialect>/scenarios.json. Each scenario names a fixture
// and states what its recorded analysis MUST and MUST NOT contain at the
// default stage; verification checks every statement against analysis.golden.

type FactCollection = "contexts" | "contributions" | "relations";

export type RequiredFact = {
  collection: FactCollection;
  from: string;
  to: string;
  rule?: string;
  type?: string;
  dimension?: string;
};

export type Scenario = {
  id: string;
  fixture: string;
  required_rules?: string[];
  required_outcomes?: Record<string, "representation-present" | "no-rule" | "composition-member">;
  required_facts?: RequiredFact[];
  minimum?: Partial<Record<"representations" | FactCollection, number>>;
  maximum_facts?: Partial<Record<FactCollection, number>>;
  forbid_cross_provider_facts?: boolean;
  forbidden_output?: string[];
  limitations?: string[];
};

type Provenance = { rule?: string };
type Fact = {
  from: string;
  to: string;
  predicate?: string;
  dimension?: string;
  provenance?: Provenance[];
};
type Representation = {
  id: string;
  address?: string;
  rule?: string;
  provider?: { address?: string };
  interpretation?: { status?: string };
  implementation?: { kind?: string; members?: Array<{ representation?: string }> };
};
type Stage = Record<FactCollection, Fact[]> & { representations: Representation[] };
type AnalysisDocument = { default_stage: string; stages: Record<string, Stage | undefined> };

// Scenario endpoints name a Terraform address as
// "representation:1:root:<mode>:<address>".
export function scenarioAddress(endpoint: string): string {
  const match = /^representation:1:root:(resource|data):(.+)$/u.exec(endpoint);
  if (!match) throw new Error(`unsupported scenario endpoint: ${endpoint}`);
  return match[1] === "data" ? `data.${match[2]}` : (match[2] ?? "");
}

function describeExpectedFact(expected: RequiredFact, from: string, to: string): string {
  const label = expected.type ?? expected.dimension ?? expected.collection;
  const origin = expected.rule ? ` from ${expected.rule}` : "";
  return `missing ${label} ${from} -> ${to}${origin}`;
}

function matchesFact(fact: Fact, expected: RequiredFact): boolean {
  const type = fact.predicate ?? fact.dimension ?? "";
  if (expected.type && type !== expected.type && !type.endsWith(`.relation.${expected.type}`)) {
    return false;
  }
  if (expected.dimension && type !== expected.dimension) return false;
  if (expected.rule && !(fact.provenance ?? []).some(({ rule }) => rule === expected.rule)) {
    return false;
  }
  return true;
}

export function scenarioProblems(scenario: Scenario, golden: string): string[] {
  const document = JSON.parse(golden) as AnalysisDocument;
  const stage = document.stages[document.default_stage];
  if (!stage) return [`${scenario.id}: the analysis has no ${document.default_stage} stage`];
  const problems: string[] = [];
  const say = (text: string): void => {
    problems.push(`${scenario.id}: ${text}`);
  };
  const byAddress = new Map<string, Representation>();
  const byId = new Map<string, Representation>();
  for (const representation of stage.representations) {
    byId.set(representation.id, representation);
    if (representation.address) byAddress.set(representation.address, representation);
  }
  const addressOf = (id: string): string => byId.get(id)?.address ?? id;

  const applied = new Set(stage.representations.map(({ rule }) => rule).filter(Boolean));
  for (const rule of scenario.required_rules ?? []) {
    if (!applied.has(rule)) say(`rule ${rule} applies to no instance`);
  }

  const members = new Set(
    stage.representations.flatMap(({ implementation }) =>
      implementation?.kind === "composition"
        ? (implementation.members ?? []).map(({ representation }) => representation ?? "")
        : [],
    ),
  );
  for (const [address, outcome] of Object.entries(scenario.required_outcomes ?? {})) {
    const representation = byAddress.get(address);
    if (!representation) {
      say(`${address} is absent`);
      continue;
    }
    if (outcome === "no-rule" && representation.interpretation?.status !== "none") {
      say(`${address} is interpreted, expected no rule`);
    }
    if (outcome === "composition-member" && !members.has(representation.id)) {
      say(`${address} is no composition member`);
    }
  }

  for (const expected of scenario.required_facts ?? []) {
    const from = scenarioAddress(expected.from);
    const to = scenarioAddress(expected.to);
    const found = (stage[expected.collection] ?? []).some(
      (fact) =>
        addressOf(fact.from) === from && addressOf(fact.to) === to && matchesFact(fact, expected),
    );
    if (!found) say(describeExpectedFact(expected, from, to));
  }

  const counts: Record<string, number> = {
    representations: stage.representations.length,
    contexts: stage.contexts.length,
    contributions: stage.contributions.length,
    relations: stage.relations.length,
  };
  for (const [collection, minimum] of Object.entries(scenario.minimum ?? {})) {
    const actual = counts[collection] ?? 0;
    if (minimum !== undefined && actual < minimum) {
      say(`${collection}: ${actual}, expected at least ${minimum}`);
    }
  }
  for (const [collection, maximum] of Object.entries(scenario.maximum_facts ?? {})) {
    const actual = counts[collection] ?? 0;
    if (maximum !== undefined && actual > maximum) {
      say(`${collection}: ${actual}, expected at most ${maximum}`);
    }
  }

  if (scenario.forbid_cross_provider_facts) {
    for (const collection of ["contexts", "contributions", "relations"] as const) {
      for (const fact of stage[collection]) {
        const from = byId.get(fact.from)?.provider?.address;
        const to = byId.get(fact.to)?.provider?.address;
        if (from && to && from !== to) {
          say(`cross-provider fact ${addressOf(fact.from)} -> ${addressOf(fact.to)}`);
        }
      }
    }
  }
  return problems;
}

// A forbidden payload proves something only when the fixture input carries
// it, and it must reach no output.
export function sentinelProblems(
  fixture: string,
  sentinels: string[],
  inputs: string[],
  outputs: string[],
): string[] {
  const problems: string[] = [];
  for (const sentinel of sentinels) {
    if (!inputs.some((input) => input.includes(sentinel))) {
      problems.push(`${fixture}: forbidden payload ${sentinel} is absent from the input`);
    }
    if (outputs.some((output) => output.includes(sentinel))) {
      problems.push(`${fixture}: forbidden payload ${sentinel} reached an output`);
    }
  }
  return problems;
}
