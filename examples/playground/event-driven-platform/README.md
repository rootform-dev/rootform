# Event-driven claims platform

An insurance claims platform on Azure uses Event Grid, Service Bus, Functions,
Container Apps, Cosmos DB, private storage, and shared observability.
Both `base` and `head` build into Architecture IR, and the Diff compares the
two documents.

Both sides build statically. No Azure account, credentials, provider
process, plan, or state is required.

## What the scenario models

- Ownership: `rg-claims-prod`, `rg-claims-data`, and `rg-claims-ops`
  separate runtime, data, and observability lifecycles.
- Network: `vnet-claims-prod` owns delegated subnets for Functions and
  Container Apps plus `snet-private` for private endpoints. The Function and
  Container Apps subnets use `natgw-claims-prod`, including its public IP
  association. Private DNS zones connect storage blob and queue endpoints,
  Cosmos DB, Key Vault, and Service Bus to the virtual network.
- Data: `cosmos-claims-prod` owns the `claims` database and two containers.
  `stclaimsdocs` owns incoming and processed containers plus the
  `document-scans` queue. Key Vault holds the OCR and notification
  credentials supplied through sensitive variables.
- Messaging: `sb-claims-prod` owns review and notification queues plus the
  `claims-events` topic and its subscriptions. `evhns-claims-prod` owns the
  claims telemetry stream and its fraud-scoring consumer group.
- Compute: three Function Apps run on an Elastic Premium plan, use
  `snet-functions`, and report to Application Insights. `cae-claims-prod`
  runs the claims API and, in `head`, an event processor and document OCR job.
- Eventing: `evgd-claims-prod` owns submitted, scored, and processed domain
  topics. The system topic on `stclaimsdocs` fans blob events out through
  separate subscriptions to Functions, Service Bus, Event Hubs, and the
  storage queue.
- Edge and observability: API Management is the public entry point.
  Application Insights sends telemetry to `log-claims-prod`; the Container
  Apps environment uses its own workspace in `head`.

## Reading the facts

The generated documents are the source of truth for this scenario, and each
entry can be checked against the Terraform source and the Dialect Rule that
produced it.

- Ownership context: resources point to their Azure resource groups, topics
  point to namespaces or domains, and subscriptions point to exact topics.
- Network and runtime context: `func-fraud-scoring` points to
  `snet-functions` and `asp-claims-fraud`.
- Relation: system topic subscriptions point to their topic and to Function,
  Service Bus, Event Hubs, or storage-queue destinations;
  `evgs-docs-fraud-scoring` subscribes to the document system topic and
  delivers to `func-fraud-scoring`.
- Provenance: every entry derives from a Dialect Rule and a Terraform
  reference, so any fact can be traced back to the source that produced it.

## Diff: from polling to events

`head` is one release that:

- removes `func-claims-poller` and its `claims-intake-poll` queue;
- adds domain and system-topic subscriptions for direct event delivery to
  Functions, Service Bus, Event Hubs, and the document scan queue;
- adds `asp-claims-fraud` and moves `func-fraud-scoring` to that plan;
- adds `claims-review-priority` and retargets
  `evgs-claims-scored-review` to it;
- adds the `caj-document-ocr` job and `ca-claims-events` application inside
  the existing Container Apps environment;
- removes the public `stclaimsarchive` account and its `closed-claims`
  container;
- adds `log-claims-apps` and switches the Container Apps environment to it.

Rootform derives the Function plan move from runtime context changes. It
reports the queue and workspace switches as removed and added facts.

## Modeling notes

Every fact comes from a Dialect Rule and direct Terraform evidence. These
scenarios establish no composition memberships. Event Grid domain topics,
system topics, Service Bus topics, queues, and subscriptions use ownership
contexts instead.

A system topic subscription has an ownership context pointing to its exact
topic and relations for source and supported destinations. Generic Event Grid
subscriptions expose destination relations but no source-topic relation because
source field can identify several Azure resource types while one emission
target must be typed explicitly. API Management carries no backend relation to
a workload here.

## Dialects and build

The `azure` Dialect belongs to the Rootform release set and is embedded in the
binary. Shared definitions come from the embedded RF Vocabulary, not another
Dialect. Supplied units are never vendored, installed, or indexed separately,
so this scenario needs no preparation command and no lock to build.

From each project directory:

```sh
terraform init -backend=false && terraform validate
rootform build . --output architecture.json
```

Then compare the two documents:

```sh
rootform diff base/architecture.json head/architecture.json --format json
```

The Terraform variables `entra_tenant_id`, `ocr_api_key`, and
`notifications_smtp_password` have no defaults on purpose. Validation and
static Rootform builds do not need their values.
