# Playground scenarios

These Terraform configurations generate scenarios shown in the
[Rootform Playground](https://docs.rootform.dev/playground/). They are
architecture examples, not deployment recipes.

Each family keeps a real `base` and `head` project. Rootform builds both
projects into Architecture IR and compares them into Diff IR. The Playground
renders generated documents without hand-edited architecture facts.

```sh
rootform init ./examples/playground/commerce-platform/base --locked --no-input
rootform init ./examples/playground/commerce-platform/head --locked --no-input

rootform build ./examples/playground/commerce-platform/base \
  --locked --offline --no-input --output commerce-base.json
rootform build ./examples/playground/commerce-platform/head \
  --locked --offline --no-input --output commerce-head.json

rootform diff commerce-base.json commerce-head.json \
  --format json --output commerce-diff.json
```

Run `rootform init` once for each project before using `--offline`. Each
project vendors the exact Dialect sources pinned by its lock, so the six sides
remain reproducible without an index lookup.

## Families

- [`commerce-platform`](commerce-platform/): Azure hub-and-spoke commerce
  platform with AKS workloads, private data services, messaging, Functions,
  identity, secrets, and observability.
- [`shared-data-platform`](shared-data-platform/): Google Cloud Shared VPC
  data platform with GKE, Cloud Run, Pub/Sub, private data services, identities,
  and Cloud Monitoring.
- [`event-driven-platform`](event-driven-platform/): Azure claims platform
  with Event Grid, Service Bus, Functions, Container Apps, private data
  services, and observability.
