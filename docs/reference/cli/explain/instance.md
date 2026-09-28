---
title: "rootform explain instance"
description: "Explain one instance: its interpretation, facts, closures, and evidence."
---

Pass an instance address and `--input` to see how one instance was interpreted
at one stage. The explanation names its Rule and Concept, facts and evidence,
closure outcomes, dependencies, and diagnostics. A declaration address covers
every instance of that declaration. Evidence records an interpretation; it
does not establish a cause.

The input is read as `run` reads it: plan JSON and state JSON are compiled
with the project's Dialects, a saved Form is loaded, and `-` reads standard
input. `--stage` selects `planned`, `refreshed`, or `recorded`; the default is
Planned for a plan and Recorded for a state. A comparison Form requires
`--side before` or `--side after`. The selected side's recorded stage applies
unless `--stage` names another.

<!-- BEGIN GENERATED CLI: rootform explain instance -->

## Usage

```text
rootform explain instance <address> --input <input> [options]
```

## Options

### Input

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --input ` | ` string ` | ` "" ` | read `input`: a plan JSON, a state JSON, a saved Form, or `-` for standard input |
| ` --side ` | ` string ` | ` "" ` | side of a comparison Form to explain: `before\|after`; required for a comparison Form |
| ` --stage ` | ` string ` | ` "" ` | stage to explain: `planned\|refreshed\|recorded`; default: Planned for a plan, Recorded for a state, or the stage selected in the saved comparison for a side |

### Output

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --details ` | ` bool ` | ` false ` | also show diagnostic codes |
| ` --format ` | ` string ` | ` "" ` | output format: `text\|json`; default: text |

### Rootform project

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --dialect ` | ` stringArray ` | ` [] ` | use Dialect source `dir` for this command only; repeatable |
| ` --locked ` | ` bool ` | ` false ` | refuse to run unless rootform.lock is valid |
| ` --project ` | ` string ` | ` "" ` | read rootform.lock from project `dir`; paths stay relative to the working directory; default: the working directory |

### Advanced evidence settings

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --plan-complete ` | ` string ` | ` "" ` | declare the plan complete; the only `value` is attested |
| ` --plan-file ` | ` string ` | ` "" ` | pair the plan JSON with the saved plan `file` it was exported from, to enrich it; pairing compares version, timestamp, and configuration shape |
| ` --producer ` | ` string ` | ` "" ` | declare the tool that produced the input: `terraform\|opentofu` |
| ` --provider-map ` | ` stringArray ` | ` [] ` | map an observed provider to a binding, as `observed=binding`; repeatable |
| ` --require-enrichment ` | ` bool ` | ` false ` | refuse the input when its saved plan file does not pair with the plan JSON |

### Global options

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform explain instance |
| ` --color ` | ` mode ` | ` auto ` | color human output: `auto\|always\|never`; default: auto |
| ` --no-pager ` | ` bool ` | ` false ` | print a long report in full instead of opening it in less |

<!-- END GENERATED CLI -->

From the commerce plan, save a Form and explain one subnet instance:

<!-- docs-check:cli-explain-instance -->
```sh
rootform run examples/playground/commerce-platform/head/plan.json \
  --plan-file examples/playground/commerce-platform/head/plan.tfplan \
  --no-serve -o analysis.json
rootform explain instance azurerm_subnet.prod_data \
  --input analysis.json --color always
```

<!-- docs-output:cli-explain-instance -->
```ansi title="Instance explanation, excerpt"
[1mInstance explained[0m
[1m[38;5;208mazurerm_subnet.prod_data[0m
  [2mInterpretation[0m  applied azure.rule.subnet as subnet
  [2mConclusion[0m      Interpreted as subnet by azure.rule.subnet: ownership context
                  to azurerm_resource_group.prod; network context to
                  azurerm_virtual_network.prod; network context from
                  azurerm_private_endpoint.backups,
                  azurerm_private_endpoint.cosmos,
                  azurerm_private_endpoint.media, and 3 more.
  [1mFacts[0m
    -> context network
      azurerm_virtual_network.prod
      [2mevidence: both[0m
```

Text is the default output; `--format json` serves tools. The explanation
goes to standard output, while progress and errors go to standard error.
Status `0` means the instance was explained; `1` means no instance has that
address at the selected stage; `2` means incorrect usage; `3` means the input
was refused, `rootform.lock` is invalid, or the stage or side is unavailable;
`4` means the input could not be read. For the same evidence in the interface,
see [Explore an architecture](../../../guides/explore-architecture.md).
