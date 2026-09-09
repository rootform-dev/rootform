# Commerce platform

`brightcart.io` runs a production commerce platform on Azure. The scenario
models one environment: a hub virtual network fronting a spoke that hosts an
AKS cluster, a private data tier, Service Bus and Event Grid messaging, Azure
Functions, and shared observability. `head` is the Architecture scenario shown
in the Playground; the Diff scenario compares `base` with `head`.

Both projects build statically. No Azure account, credentials, provider
process, plan, or state is required.

## What the scenario models

- Ownership: `rg-commerce-hub`, `rg-commerce-prod`, `rg-commerce-data`, and
  `rg-commerce-ops` split the platform by lifecycle.
- Network: `vnet-commerce-hub` holds `snet-appgw` (Application Gateway WAF v2
  with its public IP and identity) and `snet-shared` (private endpoints for the
  container registry and Key Vault). It is peered both ways with
  `vnet-commerce-prod`, which holds `snet-aks`, `snet-data` (private endpoints
  for SQL, storage, and Service Bus), `snet-integration` (Function App VNet
  integration), and the delegated `snet-postgres`. A NAT gateway is associated
  with the AKS and integration subnets. One private DNS zone per private-link
  service is linked to both virtual networks.
- Compute: `aks-commerce-prod` runs in `snet-aks` with a system pool, an
  `apps` node pool, a user-assigned identity, and an OMS agent sending logs to
  `log-commerce-prod`. The Kubernetes provider is bound to the cluster host, so
  every Kubernetes object gets a runtime context inside the cluster. Namespaces
  `platform-ingress`, `checkout`, `catalog`, `orders`, and `observability`
  own deployments, stateful sets, a daemon set, service accounts, services,
  ingresses, network policies, autoscalers, and a persistent volume claim.
- Data: `sql-commerce-prod` with `sqldb-commerce-orders`, `psql-commerce-prod`
  on the delegated subnet with its private DNS zone, `redis-commerce-prod`,
  `cosmos-commerce-catalog`, and the `stcommercemedia` and
  `stcommercebackups` storage accounts.
- Messaging: `sb-commerce-prod` with the `orders` and `payments` topics, their
  subscriptions, and the `notifications` queue. Event Grid subscriptions on the
  media storage account deliver blob events to `func-commerce-media-processor`
  and to the `notifications` queue.
- Serverless: `func-commerce-media-processor` and `func-commerce-legacy-webhooks`
  run on `asp-commerce-functions`, integrate with `snet-integration`, and report
  to `appi-commerce-prod`, which sends its telemetry to `log-commerce-prod`.
- Identity and secrets: `kv-commerce-prod` behind a private endpoint and one
  user-assigned identity per platform role.

## What to look at

- Survey: the hub and spoke networks, the resource groups, and the cluster with
  its namespaces are all visible at once as nested scopes.
- Plan: follow `snet-data` to see every private endpoint that terminates the
  data tier inside the spoke.
- Focus on `evgs-media-processor`: the Event Grid subscription delivers to
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
- adds `func-commerce-order-notifications` with an Event Grid subscription on
  the Service Bus namespace that delivers to it;
- retires `stcommercepublic`, `func-commerce-legacy-webhooks`, its Event Grid
  subscription, and `snet-legacy`;
- adds the `orders-v2` topic and points the `fulfillment` subscription at it;
- replaces `asp-commerce-functions` with the Elastic Premium plan
  `asp-commerce-functions-ep1` and moves the functions to it;
- adds `log-commerce-platform` and switches the AKS OMS agent to it.

Rootform reports the namespace and plan moves as ownership and runtime context
changes, and the subscription and workspace switches as removed and added
relations.

## Modeling notes

Every context and relation in the generated documents comes from a Dialect
rule with a direct Terraform reference. Facts the Dialects do not express yet
are absent rather than approximated: private endpoints are placed in their
subnet but carry no relation to the resource they expose, Kubernetes services
and ingresses carry no relation to the workloads behind them, and storage
accounts, Key Vault, Cosmos DB, Log Analytics, and private DNS zones appear as
scopes without members.

`azurerm_nat_gateway_public_ip_association` is not covered by the Azure Dialect
at this commit. It is kept because the NAT gateway is not functional without a
public IP, so each project reports exactly one unsupported declaration.

## Dialects and build

Dialect sources vendored from
rootform-dev/dialects@a901fdc167d96c43fc99c66052bb2ab051fdc6fb (semantics not
yet published to the official index). Each project keeps the `azure`, `core`,
and `kubernetes` sources under `.rootform/dialects/` with the MPL-2.0 license,
and `rootform.lock` pins their digests.

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

The Terraform variables `entra_tenant_id` and `dba_group_object_id` have no
defaults on purpose. Neither `terraform validate` nor `rootform build` needs
their values.
