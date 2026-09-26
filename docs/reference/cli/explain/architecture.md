---
title: "rootform explain architecture"
description: "Explain one instance: its interpretation, facts, closures, and evidence."
---

Pass an instance address, such as `google_compute_subnetwork.data`, and the
required `--input`: a plan JSON, a state JSON, a saved Rootform document, or
`-` for standard input. This command explains an instance, not a Dialect Rule
definition, and never analyzes a configuration directory. A document saved by
`run --plan-file` keeps the traversal evidence of the saved plan.

<!-- BEGIN GENERATED CLI: rootform explain architecture -->

## Usage

```text
rootform explain architecture <address> [flags]
```

## Flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --dialect ` | ` stringArray ` | ` [] ` | use dialect source `dir`; repeatable |
| ` --format ` | ` string ` | ` text ` | output `format`: text or json |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform explain architecture |
| ` --input ` | ` string ` | ` "" ` | read `path`: a plan, state or Rootform document, or `-` |
| ` --stage ` | ` string ` | ` "" ` | explain the `stage`: planned, refreshed or recorded |

## Inherited flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --color ` | ` mode ` | ` auto ` | color human output: auto, always, never |

<!-- END GENERATED CLI -->

From a checkout of the repository, save the reviewed commerce plan as a
Rootform document. Then explain one subnet instance in that document. The
saved plan verifies the JSON and preserves its traversal evidence.

<!-- docs-check:cli-explain-architecture -->
```sh
rootform run examples/playground/commerce-platform/head/plan.json \
  --plan-file examples/playground/commerce-platform/head/plan.tfplan \
  --no-serve -o analysis.json
rootform explain architecture azurerm_subnet.prod_data \
  --input analysis.json --color always
rootform explain architecture azurerm_subnet.prod_data \
  --input analysis.json --format json
```

<!-- docs-output:cli-explain-architecture -->
```ansi title="Instance explanation, excerpt"
[1mazurerm_subnet.prod_data  [2mat the planned stage[0m[0m
[2mInterpretation[0m  applied azure.rule.subnet as subnet

[1m[38;5;208mFacts[0m
  → context network  azurerm_virtual_network.prod  [2mevidence: both[0m
```

The Context names architectural placement, not network reachability. `both`
means the evaluated value and verified traversal agree. Text is the default;
JSON is available for tools. Status `0` means explained, `1`
means address not found, `2` means incorrect command use, and `3` means no
explanation could be decided. See [Explore an architecture](../../../guides/explore-architecture.md)
for the same evidence in the interface.
