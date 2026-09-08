---
title: Explore the example architectures
description: Open reproducible Azure and multicloud examples, then compare views and trace the facts behind their connections.
---

Use these examples to explore a larger architecture after the
[first render](../getting-started/first-architecture.md). They use synthetic
Terraform source and published Dialects. No cloud account, provider execution,
or deployed resource is needed. The source teaches Rootform; it is not an
apply-ready infrastructure recipe.

The figures were captured with the documentation verification build of
Rootform `0.1.1`. The [verification record](../../reference/README.md) identifies
that edition. Public releases with the same version can contain an earlier
renderer.

## Azure platform

Download [main.tf](../assets/examples/azure-platform/main.tf) and
[rootform.lock](../assets/examples/azure-platform/rootform.lock) into one empty
directory. Open a terminal there and run:

<!-- docs-check:visual-run -->
```sh
rootform run . --locked --no-input
```

The first run downloads the exact Dialects in the lock, then opens the local
explorer. It does not download Terraform providers. You should see production
and staging virtual networks, each with three subnets. AKS clusters use the
applications subnet; private endpoints use the data subnet.

Use **Plan** to expose the databases, DNS zones and storage accounts. Select
`production_analytics`: Inspector shows its network and resource group contexts
and the worker node pool that contributes to it. Focus the production network
to read that area without losing its boundary connections.

The [view guide](views.md) shows this sequence. The complete input produces
12 entities, 16 scopes and 2 details. Details contribute evidence rather than
adding independent canvas tiles.

## Cloud, workloads and platform services

Put the multicloud [main.tf](../assets/examples/multicloud/main.tf) and
[rootform.lock](../assets/examples/multicloud/rootform.lock) in another empty
directory. Run the same command there. This input combines five providers:
Azure, Google Cloud, Kubernetes, Vault and Grafana.

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

Azure and Kubernetes identities use approved technology icons. Other subjects
use the renderer's generic symbols where no approved service icon is available.
An icon does not add semantic evidence or certify coverage. See
[Dialects](../concepts/dialects.md) for how the meaning is established.

## Compare the Azure variants

Save the first Azure directory as `azure-platform` and the
[second source](../assets/examples/azure-platform-next/main.tf) with its
[lock](../assets/examples/azure-platform-next/rootform.lock) as
`azure-platform-next`. From their parent directory, run:

<!-- docs-check:visual-diff -->
```sh
rootform build azure-platform --locked --no-input --output before.json
rootform build azure-platform-next --locked --no-input --output after.json
rootform diff before.json after.json
```

The analytics cluster changes its network context from the applications subnet
to the edge subnet. The staging storage account and its private endpoint change
declaration identity from `staging_archive` to `staging_backup`, producing
additions and removals. No deployment operation occurs.

The [Delta illustrations](diff.md#read-a-delta) use the real architecture and
comparison outputs from these commands. They show the implemented comparison
renderer as a preview; the current CLI provides text, JSON and Markdown Diff
outputs, without an interactive Delta entry point.
