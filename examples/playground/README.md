# Architecture scenarios

These Terraform configurations are architecture examples, not deployment
recipes. Each family keeps a real `base` and `head` project. Rootform builds
both projects into Architecture IR and compares the two documents into a Diff,
with no hand-written architecture facts anywhere in the result.

```sh
rootform build ./examples/playground/commerce-platform/base \
  --output commerce-base.json
rootform build ./examples/playground/commerce-platform/head \
  --output commerce-head.json

rootform diff commerce-base.json commerce-head.json \
  --format json --output commerce-diff.json
```

Nothing has to be acquired before these commands run. The configurations use
only the embedded RF Vocabulary and the Dialects supplied in the Rootform
release set, so all six sides build offline with no installation, index, or
registry lookup. Each project also carries a `rootform.lock` with an empty
selection, so the scenarios behave exactly like a locked project; a project
that uses supplied content only does not need one.

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
