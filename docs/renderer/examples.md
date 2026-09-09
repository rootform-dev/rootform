---
title: Explore the example architectures
description: Open reproducible Azure and multicloud examples, then compare views and trace the facts behind their connections.
---

Use these examples to explore larger architectures after the
[first render](../getting-started/first-architecture.md). Each
[Playground](https://docs.rootform.dev/playground/?mode=architecture&scenario=commerce-platform)
scenario comes from a complete, public Terraform source pair and published
Dialects. No cloud account, provider execution, or deployed resource is needed.
These are architecture examples, not apply-ready infrastructure recipes.

## Commerce platform

Clone the public
[Commerce platform source](https://github.com/rootform-dev/rootform/tree/dev/examples/playground/commerce-platform),
then open its `head` directory in a terminal and run:

<!-- docs-check:visual-run -->
```sh
rootform run . --locked --no-input
```

The first run may need network access to download locked Dialects that are not
already available locally. It then opens the local explorer without downloading
Terraform providers. You should see production and staging networks, shared
edge, messaging, identity, secrets, observability, and Kubernetes workloads.

Use **Plan** to expose the databases, DNS zones and storage accounts. Select
`production_analytics`: Inspector shows its network and resource group contexts
and the worker node pool that contributes to it. Focus the production network
to read that area without losing its boundary connections.

The [view guide](views.md) shows this sequence. The complete input produces
28 entities, 22 scopes and 2 details. Details contribute evidence rather than
adding independent canvas tiles.

## Shared data platform

Open the public
[Shared data platform source](https://github.com/rootform-dev/rootform/tree/dev/examples/playground/shared-data-platform)
and run the same command from its `head` directory. This input combines five
providers: Azure, Google Cloud, Kubernetes, Vault and Grafana.

![The multicloud architecture in Network dimension shows Azure AKS and Google GKE in their networks, Kubernetes workloads, Vault authentication and Grafana data sources.](../assets/renderer/multicloud-plan-light.png#gh-light-mode-only)
![The multicloud architecture in Network dimension shows Azure AKS and Google GKE in their networks, Kubernetes workloads, Vault authentication and Grafana data sources.](../assets/renderer/multicloud-plan-dark.png#gh-dark-mode-only)

In **Plan**, the Network dimension places AKS and GKE within their established
network contexts. The Vault integration has a relation to the AKS cluster and
another to the Vault authentication method. Both come from declared references
interpreted by Vault rules.

Switch the dimension to **Ownership**:

![Ownership groups Kubernetes workloads within namespaces, Grafana data sources within an organization and Vault authentication within a Vault namespace.](../assets/renderer/multicloud-ownership-light.png#gh-light-mode-only)
![Ownership groups Kubernetes workloads within namespaces, Grafana data sources within an organization and Vault authentication within a Vault namespace.](../assets/renderer/multicloud-ownership-dark.png#gh-dark-mode-only)

The same facts now emphasize namespace, organization and resource group
boundaries. Grafana data sources and Vault authentication are architectural
subjects alongside cloud infrastructure.

Select a Kubernetes workload and inspect **Where**. Its runtime context points
to the relevant cluster, while its ownership context points to a namespace.
The cluster is an entity, so that runtime fact does not become another nested
scope on the canvas. A relation is also not inferred between a Service and a
Deployment merely because both appear in the same namespace.

Azure and Kubernetes identities use technology-specific icons. Other subjects
use the renderer's generic symbols where no service icon is available.
An icon does not add semantic evidence or certify coverage. See
[Dialects](../concepts/dialects.md) for how the meaning is established.

## Compare the Commerce platform states

From the cloned `commerce-platform` directory, run:

<!-- docs-check:visual-diff -->
```sh
rootform build base --locked --no-input --output before.json
rootform build head --locked --no-input --output after.json
rootform diff before.json after.json
```

The release adds a recommendations workload, moves the analytics cluster from
the applications subnet to the edge subnet, and replaces the staging archive
storage and private endpoint. No deployment operation occurs.

The [Diff view illustrations](diff.md#read-the-diff-view) use the architecture and
comparison outputs from these commands. `rootform diff` provides text, JSON,
and Markdown reports; the
[Diff Playground](https://docs.rootform.dev/playground/?mode=diff&scenario=commerce-rollout)
shows the same facts visually.
