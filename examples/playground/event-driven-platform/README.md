# Event-driven platform

The `base` and `head` directories contain synthetic Terraform configurations and saved plan evidence for event subscriptions and delivery. `main.tf` describes the intended configuration; `plan.tfplan` and `plan.json` are a verified pair. `.terraform.lock.hcl` fixes provider packages and `rootform.lock` fixes Rootform selection.

From the repository root, inspect the head architecture and compare the two planned stages:

```sh
rootform run examples/playground/event-driven-platform/head/plan.json --plan-file examples/playground/event-driven-platform/head/plan.tfplan --project examples/playground/event-driven-platform/head --no-serve -o event-driven-platform-analysis.json
rootform run examples/playground/event-driven-platform/base/plan.json --diff examples/playground/event-driven-platform/head/plan.json --plan-file examples/playground/event-driven-platform/base/plan.tfplan --diff-plan-file examples/playground/event-driven-platform/head/plan.tfplan --project examples/playground/event-driven-platform/head --no-serve -o event-driven-platform-comparison.json
```

The analysis is a format-1 `plan` document. The second command creates a `comparison` document whose `cross` comparison is not drift. Facts cite a Rule, emission, closure, and value or traversal evidence. Unknown values remain unresolved; a missing drift record does not establish that drift was absent.
