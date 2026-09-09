# Commerce platform

`brightcart.io` runs a production commerce platform on Azure. The scenario
models one environment: a hub virtual network fronting a spoke that hosts an
AKS cluster, a private data tier, Service Bus and Event Grid messaging, Azure
Functions, and shared observability. `head` is the Architecture scenario shown
in the Playground; the Diff scenario compares `base` with `head`.

Both sides build statically. No Azure account, credentials, provider
process, plan, or state is required.

## What the scenario models

- Ownership: `rg-commerce-hub`, `rg-commerce-prod`, `rg-commerce-data`, and
  `rg-commerce-ops` split the platform by lifecycle.
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
  gets a runtime context inside the cluster. Namespaces `platform-ingress`,
  `checkout`, `catalog`, `orders`, and `observability` own deployments,
  stateful sets, a daemon set, service accounts, services, ingresses, network
  policies, autoscalers, and a persistent volume claim.
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

## What to look at

- Survey: the hub and spoke networks, the resource groups, and the cluster with
  its namespaces are all visible at once as nested scopes.
- Plan: follow `snet-data` to see every private endpoint that terminates the
  data tier inside the spoke, then open `stcommercemedia`, `kv-commerce-prod`,
  and `cosmos-commerce-catalog` to see their containers, secrets, and database.
- Focus on `evgs-media-processor`: the subscription subscribes to the
  `evgst-stcommercemedia` system topic and delivers to
  `func-commerce-media-processor`, which is observed by `appi-commerce-prod`,
  which is observed by `log-commerce-prod`. The same workspace observes the AKS
  cluster.
- Focus on any deployment: it runs as its own service account, inside its
  namespace, inside the cluster.

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

Rootform reports the namespace and plan moves as ownership and runtime context
changes, and the subscription and workspace switches as removed and added
relations.

## Modeling notes

Every context and relation in the generated documents comes from a Dialect
rule with a direct Terraform reference. Facts the Dialects do not express yet
are absent rather than approximated: private endpoints are placed in their
subnet but carry no relation to the resource they expose, Kubernetes services
and ingresses carry no relation to the workloads behind them, Service Bus
subscriptions reference their topic but not the namespace that owns it, and the
Application Gateway is owned by its resource group without a subnet placement.
Private DNS zones and the public zone appear as scopes whose links and records
are contributions. Log Analytics workspaces are scopes without members; the
ContainerInsights solution contributes to its workspace. The NAT gateway
associations contribute to the gateway, its public IP, and the subnets.

## Dialects and build

Dialect sources vendored from
rootform-dev/dialects@22be31dc38fb4402b1ec47af604f77f84c31b0af (semantics not
yet published to the official index). Each project keeps the `azure`, `core`,
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

The Terraform variables `entra_tenant_id`, `dba_group_object_id`,
`payments_psp_api_key`, and `notifications_smtp_password` have no defaults on
purpose. Neither `terraform validate` nor `rootform build` needs their values.
