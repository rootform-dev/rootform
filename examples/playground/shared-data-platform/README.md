# Shared data platform

A production data platform on Google Cloud: a Shared VPC host project and a
service project containing a private GKE cluster, Cloud Run services, Pub/Sub
topics and subscriptions, a private Cloud SQL instance, Memorystore, Secret
Manager, and Cloud Monitoring.
`head` is the Architecture scenario shown in the Playground; the Diff scenario
compares `base` with `head`.

Both sides build statically. No Google Cloud account, credentials, provider
process, plan, or state is required.

## What the scenario models

- Ownership: `plt-shared-net` is the Shared VPC host project and
  `plt-data-prod` owns workloads and managed data services. Every Google
  resource with a project argument references one of those project resources.
- Network: `vpc-data-shared` holds `snet-gke` with its `pods` and `services`
  secondary ranges, `snet-data`, and the `/28` connector subnet
  `snet-serverless`. Cloud Router `cr-data-shared` owns Cloud NAT
  `nat-data-shared`. Two firewall rules
  admit internal traffic and Google health checks. A reserved range and the
  service networking connection give Cloud SQL and Memorystore private services
  access. The Serverless VPC Access connector `vac-data-prod` sits in the
  connector subnet.
- Compute: the private GKE cluster `gke-data-prod` runs in `snet-gke` with the
  `np-workloads` node pool. The Kubernetes provider is bound to the cluster
  endpoint, so every namespace and workload gets a runtime context inside the
  cluster. Namespaces `batch`, `analytics`, `streaming`, and `observability`
  own deployments, stateful sets, a daemon set, service accounts, services, an
  internal ingress, network policies, and an autoscaler. Streaming service
  accounts map to the `sa-streaming` Google identity through Workload Identity.
- Serverless: Cloud Run services `ingest-api`, `enrichment`, and
  `warehouse-loader` run as their own service accounts and reach the VPC
  through `vac-data-prod`. The Cloud Run job `legacy-warehouse-sync` reads the
  legacy warehouse credentials from Secret Manager.
- Messaging: `events-raw` and `events-enriched` topics. Push subscriptions
  deliver raw events to `enrichment` and enriched events to
  `warehouse-loader`; pull subscriptions feed the `stream-consumer` and
  `session-windower` deployments in the `streaming` namespace.
- Data: `sql-data-prod` (PostgreSQL 16, private IP only) reaches the VPC
  through private services access; `redis-data-prod` is placed in the VPC.
  Secret Manager holds the ingest HMAC key, the warehouse database password,
  and the legacy warehouse credentials, each with one version.
- Identity: one service account per workload with project IAM bindings
  contributing to it.
- Observability: the custom Cloud Monitoring service `ingest-api` with a
  28-day availability objective, and an alert policy on subscription backlog
  age.

## What to look at

- Survey: the project, the VPC with its subnets, and the cluster with its
  namespaces are visible at once.
- Plan: `vpc-data-shared` shows the cluster in `snet-gke`, the connector in
  `snet-serverless`, the Cloud Router with its NAT, the firewall rules, and
  Memorystore. Cloud SQL sits outside the network with a private-reachability
  relation to it.
- Focus on `events-raw-enrichment`: the subscription subscribes to
  `events-raw` and delivers to `enrichment`, which routes to `vac-data-prod`
  and runs as `sa-enrichment`, whose IAM bindings contribute to it.
- Focus on any deployment: it runs as its own service account, inside its
  namespace, inside the cluster.

## Diff: streaming re-architecture

`head` is one release that:

- replaces the GKE pull consumers with Cloud Run: removes the
  `stream-consumer` and `session-windower` deployments, their service
  accounts, and their pull subscriptions; adds the `stream-processor` and
  `session-windower` services with push subscriptions delivering to them; keeps
  one `replay-worker` deployment pulling `events-raw-replay`;
- adds the `events-dlq` topic, a dead-letter policy on every push
  subscription, and the `events-dlq-inspector` pull subscription;
- replaces `enrichment` with `enrichment-streaming` and points the
  `events-raw-enrichment` push subscription at it;
- moves the `feature-store` stateful set, its service account, and its
  headless service from `batch` to `analytics`;
- renumbers the connector subnet: `snet-serverless` is removed,
  `snet-serverless-apps` is added, and `vac-data-prod` moves to it;
- switches `warehouse-loader` from the connector to Direct VPC egress on the
  new `snet-run-egress` subnet;
- removes the `legacy-warehouse-credentials` secret, its version, and the
  `legacy-warehouse-sync` job that consumed it.

Rootform reports the namespace and subnet moves as ownership and network
context changes, the push endpoint switch as a removed and an added
`delivers-to` relation, and the egress switch as a removed `routes-to` relation
plus new network contexts.

## Modeling notes

Every context and relation in the generated documents comes from a Dialect
rule with a direct Terraform reference. Facts the Dialects do not express yet
are absent rather than approximated: the VPC, its subnets, the Cloud Router,
the connector, and firewall rules carry no project ownership context, so
`plt-shared-net` is an empty scope even though each relevant Terraform
resource directly names that project; Kubernetes services and ingresses carry
no relation to the workloads behind them; Workload Identity annotations,
Secret Manager references in container environments, and IAM roles are
declarations without a relation.
Cloud Storage buckets and Artifact Registry repositories are entities without
any fact in this Dialect version, so the scenario leaves them out.

## Dialects and build

Dialect sources vendored from
rootform-dev/dialects@22be31dc38fb4402b1ec47af604f77f84c31b0af (semantics not
yet published to the official index). Each project keeps the `core`, `google`,
and `kubernetes` sources under
`.rootform/dialects/` with the MPL-2.0 license, and `rootform.lock` pins their
digests.

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

The Terraform variables `org_id`, `billing_account`, `ingest_hmac_key`,
`warehouse_db_password`, and (in `base`) `legacy_warehouse_credentials` have no
defaults on purpose. Neither `terraform validate` nor `rootform build` needs
their values.
