# Event-driven claims platform

An insurance claims platform on Azure uses Event Grid, Service Bus, Functions,
Container Apps, Cosmos DB, private storage, and shared observability.
`head` is the Architecture scenario shown in the Playground. The Diff scenario
compares `base` with `head`.

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
- Edge and observability: API Management is the public entry entity.
  Application Insights sends telemetry to `log-claims-prod`; the Container
  Apps environment uses its own workspace in `head`.

## What to look at

- Survey: compare resource-group, virtual-network, messaging-namespace,
  Event Grid domain, service-plan, and Container Apps environment scopes.
- Plan: follow the system topic subscriptions to their Function, queue, topic,
  event-stream, and storage destinations.
- Focus on `evgs-docs-fraud-scoring`: it subscribes to the document system
  topic and delivers to `func-fraud-scoring`, which runs in
  `snet-functions` on `asp-claims-fraud` and reports through Application
  Insights.

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

Every context and relation comes from a Dialect rule and a direct Terraform
reference. Event Grid domain topics and system topics are scopes. A system
topic subscription is owned by its exact system topic and exposes both that
source and supported destinations. Generic Event Grid subscriptions expose
destination relations but no source-topic relation because `scope` accepts
multiple Azure resource kinds while the language requires one target concept.
Storage queue delivery resolves to the storage account represented by the
rule; the queue remains owned by that account. Service Bus topics are scopes
owned by their namespace, and subscriptions are owned by their exact topic.
API Management does not expose a backend relation here, so it remains an owned
entry entity.

## Dialects and build

Dialect sources vendored from
rootform-dev/dialects@40957e81b5c4606c03325c3c014642b0dcf62f83 (semantics not
yet published to the official index). Each project keeps the `azure` and
`core` sources under `.rootform/dialects/` with the MPL-2.0 license, and
`rootform.lock` pins their digests.

From each project directory:

```sh
terraform init -backend=false && terraform validate
rootform init . --locked --no-input
rootform build . --locked --offline --no-input --output architecture.json
```

Then compare the two documents:

```sh
rootform diff base/architecture.json head/architecture.json --format json
```

The Terraform variables `entra_tenant_id`, `ocr_api_key`, and
`notifications_smtp_password` have no defaults on purpose. Validation and
static Rootform builds do not need their values.
