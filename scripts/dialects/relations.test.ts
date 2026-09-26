import { expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "../../dialects");

// Slice goldens are the analyses of Terraform plans recorded offline by the
// fixture generator. Each test reads the default stage of an analysis: one
// representation per instance, named by its Terraform address; facts whose
// provenance names the emission, rule and closure that produced them and the
// evidence that established the endpoint; and one closure per
// representation and emission, stating why a fact was or was not produced.

type Provenance = {
  emission: string;
  rule: string;
  closure: string;
  evidence: "value" | "traversal" | "both";
};

type Representation = {
  id: string;
  kind: "managed" | "data" | "external";
  address: string;
  rule?: string;
  concept?: string;
};

type Fact = {
  id: string;
  from: string;
  to: string;
  dimension?: string;
  predicate?: string;
  provenance: Provenance[];
};

type Closure = {
  id: string;
  representation: string;
  emission: string;
  outcome: "resolved" | "absent" | "indeterminate";
  reason?: string;
  facts: string[];
};

type Emission = { id: string; rule: string; kind: string; via?: string };

type Form = {
  representations: Representation[];
  contexts: Fact[];
  contributions: Fact[];
  relations: Fact[];
  closures: Closure[];
};

type Analysis = {
  default_stage: string;
  forms: Record<string, Form | undefined>;
  semantics: { emissions: Emission[] };
};

const SLICES = [
  ["azure-aks", "azurerm_kubernetes_cluster.workloads"],
  ["azure-database", "azurerm_postgresql_flexible_server.records"],
  ["azure-network", "azurerm_virtual_network_peering.platform"],
  ["azure-ownership-sweep", "azurerm_arc_kubernetes_cluster.owned"],
  ["cloud-sql", "google_sql_database_instance.db"],
  ["eks", "aws_eks_cluster.workloads"],
  ["gke", "google_container_cluster.cluster"],
  ["google-cloud-run", "google_cloud_run_v2_service.connector"],
] as const;

function golden(name: string): string {
  return join(root, "fixtures/slice", name, "analysis.golden");
}

function analysis(name: string): Analysis {
  return JSON.parse(readFileSync(golden(name), "utf8")) as Analysis;
}

function stage(doc: Analysis): Form {
  const selected = doc.forms[doc.default_stage];
  if (!selected) throw new Error(`the analysis has no ${doc.default_stage} stage`);
  return selected;
}

function representation(doc: Analysis, address: string): Representation | undefined {
  return stage(doc).representations.find((entry) => entry.address === address);
}

function factsFrom(doc: Analysis, address: string): Fact[] {
  const from = representation(doc, address)?.id;
  const architecture = stage(doc);
  return [
    ...architecture.contexts,
    ...architecture.contributions,
    ...architecture.relations,
  ].filter((fact) => fact.from === from);
}

function closure(doc: Analysis, address: string, emission: string): Closure | undefined {
  const from = representation(doc, address)?.id;
  return stage(doc).closures.find(
    (entry) => entry.representation === from && entry.emission === emission,
  );
}

// A fact is backed by a closure that resolved to it and by an emission of the
// rule its provenance names.
function expectBacked(doc: Analysis, fact: Fact | undefined, rule: string): void {
  expect(fact).toBeDefined();
  const provenance = fact?.provenance[0];
  expect(provenance?.rule).toBe(rule);
  const backing = stage(doc).closures.find((entry) => entry.id === provenance?.closure);
  expect(backing?.outcome).toBe("resolved");
  expect(backing?.facts).toContain(fact?.id ?? "");
  expect(
    doc.semantics.emissions.some(
      (entry) => entry.id === provenance?.emission && entry.rule === rule,
    ),
  ).toBe(true);
}

test("slice behavior goldens are present", () => {
  for (const [name] of SLICES) {
    expect(existsSync(golden(name))).toBeTrue();
  }
});

test("kubernetes clusters get one uniform rf.concept.kubernetes-cluster representation", () => {
  for (const [name, address] of SLICES) {
    if (!address.includes("kubernetes_cluster")) continue;
    const entry = representation(analysis(name), address);
    expect(entry).toBeDefined();
    expect(entry?.concept).toBe("rf.concept.kubernetes-cluster");
    expect(entry?.rule).toMatch(/^[a-z0-9-]+\.rule\./u);
  }
});

test("cloud-sql keeps its managed-database classification and a closure-backed network context", () => {
  const doc = analysis("cloud-sql");
  const instance = representation(doc, "google_sql_database_instance.db");
  const network = representation(doc, "google_compute_network.vpc");
  expect(instance?.concept).toBe("rf.concept.managed-database");
  expect(instance?.rule).toBe("google.rule.cloud-sql-instance");
  expect(network?.concept).toBe("rf.concept.virtual-network");

  const fact = stage(doc).contexts.find(
    (entry) => entry.from === instance?.id && entry.to === network?.id,
  );
  expect(fact?.dimension).toBe("rf.context.network");
  expectBacked(doc, fact, "google.rule.cloud-sql-instance");
  expect(JSON.stringify(doc)).not.toContain("private-reachability");
});

test("delegated subnet injection is network placement, not a relation", () => {
  const doc = analysis("azure-database");
  const server = representation(doc, "azurerm_postgresql_flexible_server.records");
  const subnet = representation(doc, "azurerm_subnet.database");
  expect(server).toBeDefined();
  expect(subnet).toBeDefined();
  expect(
    stage(doc).contexts.some(
      (entry) =>
        entry.from === server?.id &&
        entry.to === subnet?.id &&
        entry.dimension === "rf.context.network",
    ),
  ).toBe(true);
  expect(
    stage(doc).relations.some((entry) => entry.from === server?.id && entry.to === subnet?.id),
  ).toBe(false);
});

test("a local relation retains its emission, rule and closure provenance", () => {
  const doc = analysis("google-cloud-run");
  const connector = representation(doc, "google_cloud_run_v2_service.connector");
  const fact = stage(doc).relations.find(
    (entry) => entry.from === connector?.id && entry.predicate === "google.relation.routes-to",
  );
  expect(stage(doc).representations.find((entry) => entry.id === fact?.to)?.address).toBe(
    "google_vpc_access_connector.runtime",
  );
  expectBacked(doc, fact, "google.rule.cloud-run-service");
});

test("an empty optional route, an unknown route and a literal route close differently", () => {
  const doc = analysis("google-cloud-run");
  const emission = doc.semantics.emissions.find(
    (entry) =>
      entry.rule === "google.rule.cloud-run-service" &&
      entry.kind === "relation" &&
      entry.via?.includes("connector"),
  );
  expect(emission).toBeDefined();
  const id = emission?.id ?? "";

  // "api" reaches its network through network interfaces: no connector.
  expect(closure(doc, "google_cloud_run_v2_service.api", id)?.outcome).toBe("absent");

  // "unknown" names a connector known only after apply.
  const unknown = closure(doc, "google_cloud_run_v2_service.unknown", id);
  expect(unknown?.outcome).toBe("indeterminate");
  expect(unknown?.reason).toBe("unknown_until_apply");

  // "literal" names a connector no represented instance is known to be.
  const literal = closure(doc, "google_cloud_run_v2_service.literal", id);
  expect(literal?.outcome).toBe("indeterminate");
  expect(literal?.facts).toEqual([]);

  for (const address of [
    "google_cloud_run_v2_service.unknown",
    "google_cloud_run_v2_service.literal",
  ]) {
    expect(
      factsFrom(doc, address).some((fact) => fact.predicate === "google.relation.routes-to"),
    ).toBe(false);
  }
});

test("network peerings keep containment distinct from remote connectivity", () => {
  const doc = analysis("azure-network");
  const peerings = [
    ["platform", "platform", "remote"],
    ["remote_to_platform", "remote", "platform"],
  ] as const;
  for (const [peeringName, localName, remoteName] of peerings) {
    const peering = representation(doc, `azurerm_virtual_network_peering.${peeringName}`);
    const local = representation(doc, `azurerm_virtual_network.${localName}`);
    const remote = representation(doc, `azurerm_virtual_network.${remoteName}`);
    expect(peering).toBeDefined();
    expect(local).toBeDefined();
    expect(remote).toBeDefined();
    expect(
      stage(doc).contexts.some(
        (entry) =>
          entry.from === peering?.id &&
          entry.to === local?.id &&
          entry.dimension === "rf.context.network",
      ),
    ).toBe(true);
    expect(
      stage(doc).relations.some(
        (entry) =>
          entry.from === peering?.id &&
          entry.to === remote?.id &&
          entry.predicate === "azure.relation.peers-with",
      ),
    ).toBe(true);
  }
  // A peering whose remote network is known only after apply claims no remote.
  expect(
    factsFrom(doc, "azurerm_virtual_network_peering.unknown").some(
      (fact) => fact.predicate === "azure.relation.peers-with",
    ),
  ).toBe(false);
});

test("Azure subscriptions keep topic placement separate from subscription relations", () => {
  const serviceBus = analysis("azure-service-bus");
  const serviceBusSubscription = representation(
    serviceBus,
    "azurerm_servicebus_subscription.worker",
  );
  const serviceBusTopic = representation(serviceBus, "azurerm_servicebus_topic.events");
  expect(serviceBusSubscription?.concept).toBe("azure.concept.message-subscription");
  expect(serviceBusTopic?.concept).toBe("azure.concept.service-bus-topic");
  expectBacked(
    serviceBus,
    stage(serviceBus).contexts.find(
      (entry) =>
        entry.from === serviceBusSubscription?.id &&
        entry.to === serviceBusTopic?.id &&
        entry.dimension === "azure.context.ownership",
    ),
    "azure.rule.service-bus-subscription",
  );
  expectBacked(
    serviceBus,
    stage(serviceBus).relations.find(
      (entry) =>
        entry.from === serviceBusSubscription?.id &&
        entry.to === serviceBusTopic?.id &&
        entry.predicate === "azure.relation.subscribes-to",
    ),
    "azure.rule.service-bus-subscription",
  );

  const eventGrid = analysis("azure-event-grid");
  const systemTopic = representation(eventGrid, "azurerm_eventgrid_system_topic.storage");
  const deliveryTargets = {
    eventhub: "azurerm_eventhub.handler",
    function: "azurerm_linux_function_app.handler",
    queue: "azurerm_servicebus_queue.handler",
    storage: "azurerm_storage_account.handler",
    topic: "azurerm_servicebus_topic.handler",
  } as const;
  for (const [name, targetAddress] of Object.entries(deliveryTargets)) {
    const subscription = representation(
      eventGrid,
      `azurerm_eventgrid_system_topic_event_subscription.${name}`,
    );
    const target = representation(eventGrid, targetAddress);
    expect(subscription?.concept).toBe("azure.concept.message-subscription");
    expectBacked(
      eventGrid,
      stage(eventGrid).contexts.find(
        (entry) =>
          entry.from === subscription?.id &&
          entry.to === systemTopic?.id &&
          entry.dimension === "azure.context.ownership",
      ),
      "azure.rule.event-grid-system-topic-subscription",
    );
    expectBacked(
      eventGrid,
      stage(eventGrid).relations.find(
        (entry) =>
          entry.from === subscription?.id &&
          entry.to === systemTopic?.id &&
          entry.predicate === "azure.relation.subscribes-to",
      ),
      "azure.rule.event-grid-system-topic-subscription",
    );
    expect(
      stage(eventGrid).relations.some(
        (entry) =>
          entry.from === subscription?.id &&
          entry.to === target?.id &&
          entry.predicate === "azure.relation.delivers-to",
      ),
    ).toBe(true);
  }

  // A subscription whose topic is known only after apply claims no topic.
  for (const [document, address] of [
    [serviceBus, "azurerm_servicebus_subscription.unknown"],
    [eventGrid, "azurerm_eventgrid_system_topic_event_subscription.unknown"],
  ] as const) {
    expect(representation(document, address)).toBeDefined();
    expect(factsFrom(document, address)).toEqual([]);
  }
});

test("every fact is closed over representations, emissions and closures", () => {
  for (const directory of readdirSync(join(root, "fixtures/slice"), { withFileTypes: true })) {
    if (!directory.isDirectory() || !existsSync(golden(directory.name))) continue;
    const doc = analysis(directory.name);
    const architecture = stage(doc);
    const representations = new Set(architecture.representations.map((entry) => entry.id));
    const emissions = new Set(doc.semantics.emissions.map((entry) => entry.id));
    const closures = new Map(architecture.closures.map((entry) => [entry.id, entry]));
    for (const fact of [
      ...architecture.contexts,
      ...architecture.contributions,
      ...architecture.relations,
    ]) {
      expect(representations.has(fact.from)).toBe(true);
      expect(representations.has(fact.to)).toBe(true);
      expect(fact.provenance.length).toBeGreaterThan(0);
      for (const provenance of fact.provenance) {
        expect(emissions.has(provenance.emission)).toBe(true);
        const backing = closures.get(provenance.closure);
        expect(backing?.outcome).toBe("resolved");
        expect(backing?.emission).toBe(provenance.emission);
        expect(backing?.facts).toContain(fact.id);
      }
    }
  }
});
