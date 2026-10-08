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

The saved result is a [Form](../../docs/concepts/forms.md). Reopen `analysis.json`
without the original plan, or use it with `rootform check` and a reviewed
[Policy Pack](../../policy-packs/README.md). These examples use embedded Dialects;
[project selection](../../docs/cli.md) also supports local source and OCI content.

`forms/` holds what the [Rootform Playground](https://rootform.dev/playground/)
shows: the analysis and comparison Forms compiled from these plans, the
presentation catalog, and a manifest of the binary and input digests that
produced them. With `ROOTFORM_BIN` naming a Rootform binary,
`bun scripts/playground-forms.ts --generate` regenerates them, and
`bun scripts/playground-forms.ts` verifies that a binary of the recorded version
reproduces every byte.
