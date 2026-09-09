# Playground scenarios

These Terraform configurations generate scenarios shown in the
[Rootform Playground](https://docs.rootform.dev/playground/). They are
architecture examples, not deployment recipes.

Each scenario keeps a real `base` and `head` project. Rootform builds both
projects into Architecture IR and compares them into Diff IR. The Playground
renders those generated documents without hand-edited architecture facts.

```sh
rootform init ./examples/playground/commerce-platform/base --locked --no-input
rootform init ./examples/playground/commerce-platform/head --locked --no-input

rootform build ./examples/playground/commerce-platform/base \
  --locked --offline --no-input --output commerce-base.json
rootform build ./examples/playground/commerce-platform/head \
  --locked --offline --no-input --output commerce-head.json

rootform diff commerce-base.json commerce-head.json \
  --format json --output diff.json
```

Run `rootform init` once for each project before using `--offline`. Locks pin
the exact Dialect artifacts used by the reviewed Playground output.

## Scenarios

- [`commerce-platform`](commerce-platform/): Azure commerce platform with
  production and staging networks, AKS workloads, edge, data, messaging,
  secrets, identity, and observability.
- [`shared-data-platform`](shared-data-platform/): Azure and Google Cloud
  platform with Kubernetes workloads, Vault authentication, Pub/Sub, and
  shared Grafana observability.
