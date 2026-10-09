# Shared data platform

The `base` directory holds the existing shared data platform configuration planned against its state, with no changes. The `head` directory holds the proposed change planned against the same state: the raw stream subscription switches to push delivery into a new Cloud Run consumer, with a dead-letter topic, an inspector subscription, and dead-letter policies on the enrichment and warehouse subscriptions. Each directory contains a synthetic Terraform configuration; `plan.tfplan` and `plan.json` are a verified pair, `.terraform.lock.hcl` fixes provider packages, and `rootform.lock` fixes Rootform selection.

From the repository root, inspect the head architecture and compare it with the base:

```sh
rootform run examples/playground/shared-data-platform/head/plan.json --plan-file examples/playground/shared-data-platform/head/plan.tfplan --project examples/playground/shared-data-platform/head --no-serve -o shared-data-platform-analysis.json
rootform run examples/playground/shared-data-platform/base/plan.json --diff examples/playground/shared-data-platform/head/plan.json --plan-file examples/playground/shared-data-platform/base/plan.tfplan --diff-plan-file examples/playground/shared-data-platform/head/plan.tfplan --project examples/playground/shared-data-platform/head --no-serve -o shared-data-platform-comparison.json
```

The analysis is a Rootform `plan` document. The second command creates a `comparison` document whose `cross` comparison is not drift. Facts cite a Rule, emission, closure, and value or traversal evidence. Unknown values remain unresolved; a missing drift record does not establish that drift was absent.
