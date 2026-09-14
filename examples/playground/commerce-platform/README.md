# Commerce platform

`brightcart.io` runs a production commerce platform on Azure. The scenario
models one environment: a hub virtual network fronting a spoke that hosts an
AKS cluster, a private data tier, Service Bus and Event Grid messaging, Azure
Functions, and shared observability. Both `base` and `head` build into
Architecture IR, and the Diff compares the two documents.

Both sides build statically. No Azure account, credentials, provider
process, plan, or state is required.

## What the scenario models

- Ownership: `azure.context.ownership` places resources relative to
  `rg-commerce-hub`, `rg-commerce-prod`, `rg-commerce-data`, and
  `rg-commerce-ops` by lifecycle.
- Network: `vnet-commerce-hub` holds `snet-appgw` (Application Gateway with WAF
  with its public IP and identity) and `snet-shared` (private endpoints for the
  container registry and Key Vault). It is peered both ways with
  `vnet-commerce-prod`, which holds `snet-aks-system`, `snet-aks-user`,
  `snet-data` (private endpoints for SQL, storage, and Service Bus),
  `snet-integration` (Function App VNet integration), and the delegated
  `snet-postgres`. A NAT gateway with its public IP is associated with both
  AKS subnets and the integration subnet. One private
  DNS zone per private-link service is linked to both virtual networks, and the
  public zone `brightcart.io` holds the apex alias record for the Application
  Gateway public IP and the `www` alias.
- Compute: `aks-commerce-prod` runs its system pool in `snet-aks-system`
  and its `apps` node pool in `snet-aks-user`, with a user-assigned identity
  and an OMS agent sending logs to
  `log-commerce-prod`, where the ContainerInsights solution is installed. The
  Kubernetes provider is bound to the cluster host, so every Kubernetes object
  carries a runtime context pointing at the cluster. The namespaces
  `platform-ingress`, `checkout`, `catalog`, `orders`, and `observability`
  provide ownership context for deployments, stateful sets, a daemon set,
  service accounts, services, ingresses, network policies, autoscalers, and a
  persistent volume claim.
- Data: `sql-commerce-prod` with `sqldb-commerce-orders`, `psql-commerce-prod`
  on the delegated subnet with its private DNS zone, `redis-commerce-prod`,
  `cosmos-commerce-catalog` with the `catalog` SQL database and its `products`
  container, and the `stcommercemedia` (`uploads`, `renditions`) and
  `stcommercebackups` (`database-exports`) storage accounts with their blob
  containers.
- Messaging: `sb-commerce-prod` with the `orders` and `payments` topics, their
  subscriptions, and the `notifications` queue. The Event Grid system topic on
  the media storage account has subscriptions delivering blob events to
  `func-commerce-media-processor` and to the `notifications` queue.
- Serverless: `func-commerce-media-processor` and `func-commerce-legacy-webhooks`
  run on `asp-commerce-functions`, integrate with `snet-integration`, and report
  to `appi-commerce-prod`, which sends its telemetry to `log-commerce-prod`.
- Identity and secrets: `kv-commerce-prod` behind a private endpoint holds the
  payment provider API key, the e-mail relay password, and the token signing
  key; one user-assigned identity exists per platform role.

## Reading the facts

The generated documents are the source of truth for this scenario, and each
entry can be checked against the Terraform source and the Dialect Rule that
produced it.

- Ownership context: resources point to their Azure resource groups, storage
  containers and secrets point to their owning resources, and Kubernetes
  workloads point to their namespaces.
- Network and runtime context: private endpoints point to `snet-data`; that
  subnet points to `vnet-commerce-prod`; Functions point to their integration
  subnet and service plan; Kubernetes objects point to the AKS cluster.
- Relation: the subscription on `evgst-stcommercemedia` relates to
  `func-commerce-media-processor`. The Function and Application Insights have
  `observed-by` facts leading to `log-commerce-prod`.
- Service identity: each deployment relates to its own service account, and
  both are placed relative to a namespace and the cluster through contexts.

## Diff: private data path and payments split

`head` is one release that:

- adds private endpoints for Redis and Cosmos DB, their private DNS zones, and
  the zone links to both networks, and disables public access on both services;
- adds the `payments` namespace with its network policy and moves the
  `payments-api` and `payments-worker` deployments, their service accounts, and
  the `payments-api` service there from `checkout`;
- adds `func-commerce-order-notifications` with an Event Grid system topic on
  the Service Bus namespace and a subscription that delivers to it;
- retires `stcommercepublic` with its `assets` container and system topic,
  `func-commerce-legacy-webhooks` and its subscription, and `snet-legacy`;
- adds the `orders-enriched` topic and points the `fulfillment` subscription at it;
- replaces `asp-commerce-functions` with the Elastic Premium plan
  `asp-commerce-functions-ep1` and moves the functions to it;
- adds `log-commerce-platform`, switches the AKS OMS agent to it, and moves the
  ContainerInsights solution with it.

Rootform reports the namespace and plan moves as removed and added contexts,
and the subscription and workspace switches as removed and added relations.

## Modeling notes

Every context, relation, and contribution in generated documents comes from a
Dialect Rule with direct Terraform evidence. These scenarios establish no
composition memberships. Ownership is represented by named context facts.

No relation connects private endpoints to exposed resources, Kubernetes
services or ingresses to workloads, or Application Gateway to a subnet. This
describes facts established in these documents, not deployed infrastructure.
Service Bus subscriptions have ownership context pointing to exact topics
named by `topic_id`. Private DNS links and records are contributions, as are
ContainerInsights and NAT gateway associations.

## Dialects and build

The `azure` and `kubernetes` Dialects belong to the Rootform release set and are
embedded in the binary. Shared definitions come from the embedded RF
Vocabulary, not another Dialect. Supplied units are never installed, vendored,
or indexed separately, so this scenario needs no preparation command and no
lock to build.

From each project directory:

```sh
terraform init -backend=false && terraform validate
rootform build . --output architecture.json
```

Then compare the two documents:

```sh
rootform diff base/architecture.json head/architecture.json --format json
```

The Terraform variables `entra_tenant_id`, `dba_group_object_id`,
`payments_psp_api_key`, and `notifications_smtp_password` have no defaults on
purpose. Neither `terraform validate` nor `rootform build` needs their values.
