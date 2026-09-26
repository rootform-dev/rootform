# Commerce platform

The `base` and `head` directories contain synthetic Terraform configurations and saved plan evidence for payment and private data paths. `main.tf` describes the intended configuration; `plan.tfplan` and `plan.json` are a verified pair. `.terraform.lock.hcl` fixes provider packages and `rootform.lock` fixes Rootform selection.

From the repository root, inspect the head architecture and compare the two planned stages:

```sh
rootform run examples/playground/commerce-platform/head/plan.json --plan-file examples/playground/commerce-platform/head/plan.tfplan --project examples/playground/commerce-platform/head --no-serve -o commerce-platform-analysis.json
rootform run examples/playground/commerce-platform/base/plan.json --diff examples/playground/commerce-platform/head/plan.json --plan-file examples/playground/commerce-platform/base/plan.tfplan --diff-plan-file examples/playground/commerce-platform/head/plan.tfplan --project examples/playground/commerce-platform/head --no-serve -o commerce-platform-comparison.json
```

The analysis is a Rootform `plan` document. The second command creates a `comparison` document whose `cross` comparison is not drift. Facts cite a Rule, emission, closure, and value or traversal evidence. Unknown values remain unresolved; a missing drift record does not establish that drift was absent.
