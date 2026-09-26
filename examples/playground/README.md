# Rootform Playground examples

Each family has a `base` and `head` Terraform configuration, a saved plan, its JSON export, a provider lock, and a Rootform selection lock. These synthetic plans let the Playground show architecture and a comparison without contacting cloud services.

| Family | Change illustrated |
| --- | --- |
| [Commerce platform](commerce-platform/README.md) | Payment and private data paths. |
| [Event-driven platform](event-driven-platform/README.md) | Event subscriptions and delivery. |
| [Shared data platform](shared-data-platform/README.md) | Streaming data architecture. |

From the repository root, analyze the head plan and compare the two sides:

```sh
rootform run examples/playground/commerce-platform/head/plan.json --plan-file examples/playground/commerce-platform/head/plan.tfplan --project examples/playground/commerce-platform/head --no-serve -o analysis.json
rootform run examples/playground/commerce-platform/base/plan.json --diff examples/playground/commerce-platform/head/plan.json --plan-file examples/playground/commerce-platform/base/plan.tfplan --diff-plan-file examples/playground/commerce-platform/head/plan.tfplan --project examples/playground/commerce-platform/head --no-serve -o comparison.json
```

The saved plans supply verified traversal evidence. Plan exports can contain cleartext placeholder values; treat real producer exports as sensitive. Rootform output masks sensitive values and reports unresolved evidence.
