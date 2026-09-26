---
title: "rootform validate form"
description: "Check a saved Form's structure and internal consistency."
---

`validate form` reads a saved Form; `-` reads the Form's JSON from
standard input. It checks structural validity and internal consistency, not
Policy compliance or live cloud state.

<!-- BEGIN GENERATED CLI: rootform validate form -->

## Usage

```text
rootform validate form <file> [flags]
```

## Flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --format ` | ` string ` | ` text ` | output `format`: text or json |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform validate form |

## Inherited flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --color ` | ` mode ` | ` auto ` | color human output: auto, always, never |

<!-- END GENERATED CLI -->

From a checkout of the repository, save the reviewed commerce plan as a Form,
then check that the saved Form is structurally valid.
Validation does not reanalyze the plan or evaluate Policies.

<!-- docs-check:cli-validate-form -->
```sh
rootform run examples/playground/commerce-platform/head/plan.json \
  --plan-file examples/playground/commerce-platform/head/plan.tfplan \
  --no-serve -o analysis.json
rootform validate form analysis.json --color always
rootform validate form analysis.json --format json
```

<!-- docs-output:cli-validate-form -->
```ansi title="Validation result"
[1m[32mForm valid[0m
```

Text is the default result; JSON is also available. The result goes to
standard output and diagnostics to standard error. Status `0` means valid,
`1` means invalid, `2` means incorrect command use, and `3` means validation
could not be completed. Use [`run`](../run.md) to evaluate Policies and
[Forms](../../../concepts/forms.md) for what a Form contains.
