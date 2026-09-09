---
title: Explore the example architectures
description: Open three reproducible platform families, compare their states, and trace the declared facts behind each connection.
---

Use these examples to explore larger architectures after the
[first render](../getting-started/first-architecture.md). Each
[Playground](https://docs.rootform.dev/playground/?mode=architecture&scenario=commerce-platform)
family comes from a complete public Terraform source pair and vendored
Dialects. No cloud account, provider execution, or deployed resource is needed.
These are architecture examples, not apply-ready infrastructure recipes.

## Open a family

Clone the public
[Playground source](https://github.com/rootform-dev/rootform/tree/dev/examples/playground),
choose one family, and run the explorer from its `head` directory:

<!-- docs-check:visual-run -->
```sh
rootform run . --locked --no-input
```

The vendored Dialects and lock make the run independent of an index lookup.
Use **Survey** for the major boundaries, **Plan** for full detail, and **Focus**
to trace one subject and its established connections.

### Commerce platform

[Open the Commerce platform](https://docs.rootform.dev/playground/?mode=architecture&scenario=commerce-platform)
to inspect an Azure hub-and-spoke system. Resource groups divide lifecycle
ownership. The production virtual network contains AKS, Function integration,
and private data paths; AKS contains namespaces and their workloads.

In Plan, focus `evgs-media-processor`. Its path reaches the media system topic
and `func-commerce-media-processor`; the Function runs in the integration
subnet on its service plan and reports through Application Insights. The
commerce Diff adds private Redis and Cosmos paths, splits payments into its own
namespace, changes message routing, and moves runtime and observability
contexts.

### Shared data platform

[Open the Shared data platform](https://docs.rootform.dev/playground/?mode=architecture&scenario=shared-data-platform)
to inspect a Google Cloud data system. A Shared VPC carries GKE, serverless
egress, Cloud NAT, Cloud SQL private access, and Memorystore. Workloads and
managed services belong to the service project; Kubernetes resources sit
inside cluster and namespace scopes.

Focus `events-raw-enrichment` to follow a Pub/Sub subscription from
`events-raw` to `enrichment-streaming`. The service routes through the VPC
connector and runs as its dedicated service account. The Diff replaces GKE pull
consumers with Cloud Run push consumers, adds dead-letter delivery, moves the
feature store to the analytics namespace, and changes serverless network
placement.

### Event-driven claims platform

[Open the Event-driven claims platform](https://docs.rootform.dev/playground/?mode=architecture&scenario=event-driven-platform)
to inspect Event Grid fan-out to Functions, Service Bus, Event Hubs, and Azure
Storage. Container Apps and Functions share network and observability
boundaries while Cosmos DB, storage, Key Vault, and Service Bus use private
endpoints.

Focus `evgs-docs-fraud-scoring`. The subscription connects the document
system topic to the fraud Function; the Function runs in the delegated subnet
on its own plan and reports through Application Insights. The Diff removes the
poller, adds direct event routes and Container Apps workloads, changes the
review queue and workspace targets, and retires public archive storage.

## Compare family states

From any family directory, build both sides and compare them:

<!-- docs-check:visual-diff -->
```sh
rootform build base --locked --offline --no-input --output before.json
rootform build head --locked --offline --no-input --output after.json
rootform diff before.json after.json
```

The Diff view strictly derives changes from the two Architecture IR documents.
A move appears when the same subject loses one context and gains another.
Removed and added relations show retargeted destinations without claiming that
infrastructure was deployed.

Open a family directly in Diff mode:

- [Commerce Diff](https://docs.rootform.dev/playground/?mode=diff&scenario=commerce-platform)
- [Shared data Diff](https://docs.rootform.dev/playground/?mode=diff&scenario=shared-data-platform)
- [Event-driven claims Diff](https://docs.rootform.dev/playground/?mode=diff&scenario=event-driven-platform)
