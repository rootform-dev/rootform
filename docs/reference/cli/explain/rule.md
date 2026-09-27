---
title: "rootform explain rule"
description: "Explain how one Rule applied in an input."
---

Pass a qualified Rule name or an unambiguous bare name with `--input` to see
how that Rule applied in a Form. The explanation covers matches, emissions,
interpreted instances, undecided candidates, closure outcomes, and facts with
their evidence. To read the Rule definition without an input, use
[`show`](../show.md). For one resource address, use [`explain
instance`](instance.md).

The input is read as `run` reads it: plan JSON and state JSON are compiled
with the project's Dialects, a saved Form is loaded, and `-` reads standard
input. `--stage` selects a stage; the default is Planned for a plan and
Recorded for a state. A comparison Form requires `--side before` or
`--side after`. The selected side's recorded stage applies unless `--stage`
names another.

<!-- BEGIN GENERATED CLI: rootform explain rule -->

## Usage

```text
rootform explain rule <rule> --input <input> [options]
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
| ` --details ` | ` bool ` | ` false ` | list every entry and diagnostic code instead of the first ten entries |
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
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform explain rule |
| ` --color ` | ` mode ` | ` auto ` | color human output: `auto\|always\|never`; default: auto |

<!-- END GENERATED CLI -->

From the commerce plan, save a Form and inspect how the subnet Rule applied:

<!-- docs-check:cli-explain-rule -->
```sh
rootform run examples/playground/commerce-platform/head/plan.json \
  --plan-file examples/playground/commerce-platform/head/plan.tfplan \
  --no-serve -o analysis.json
rootform explain rule azure.rule.subnet --input analysis.json --color always
```

<!-- docs-output:cli-explain-rule -->
```ansi title="Rule application, excerpt"
[1mRule explained[0m
[2mRule[0m        azure.rule.subnet
[2mMatches[0m     resource azurerm_subnet
[2mConcept[0m     rf.concept.subnet
[2mApplied to[0m  7 instances
```

Text is the default output; `--format json` serves tools. The explanation
goes to standard output, while progress and errors go to standard error.
Status `0` means the Rule was explained; `1` means the input's semantics have
no Rule with that name; `2` means incorrect usage; `3` means the input was
refused, `rootform.lock` is invalid, the stage or side is unavailable, or the
name is ambiguous; `4` means the input could not be read. For Rule meaning,
see [Dialects and RF Vocabulary](../../../concepts/dialects.md).
