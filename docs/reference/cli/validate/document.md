---
title: "rootform validate document"
description: "Check a saved Rootform document's structure and internal consistency."
---

`validate document` reads a saved Rootform document; `-` reads
document JSON from standard input. It checks structural validity and internal
consistency, not Policy compliance or live cloud state.

<!-- BEGIN GENERATED CLI: rootform validate document -->

## Usage

```text
rootform validate document <file> [flags]
```

## Flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --format ` | ` string ` | ` text ` | output `format`: text or json |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform validate document |

## Inherited flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --color ` | ` mode ` | ` auto ` | color human output: auto, always, never |

<!-- END GENERATED CLI -->

From a checkout of the repository, save the reviewed commerce plan, then
check that its Rootform document is structurally valid.
Validation does not reanalyze the plan or evaluate Policies.

<!-- docs-check:cli-validate-document -->
```sh
rootform run examples/playground/commerce-platform/head/plan.json \
  --plan-file examples/playground/commerce-platform/head/plan.tfplan \
  --no-serve -o analysis.json
rootform validate document analysis.json --color always
rootform validate document analysis.json --format json
```

<!-- docs-output:cli-validate-document -->
```ansi title="Validation result"
[1m[32mDocument valid[0m
```

Text is the default result; JSON is also available. The result goes to
standard output and diagnostics to standard error. Status `0` means valid,
`1` means invalid, `2` means incorrect command use, and `3` means validation
could not be completed. Use [`run`](../run.md) to evaluate Policies and
[Forms and Rootform documents](../../../concepts/forms.md) for document meaning.
