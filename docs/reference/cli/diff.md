---
title: "rootform diff"
description: "Compare architectural meaning between two inputs."
---

`diff` accepts two Terraform/OpenTofu directories or saved Rootform
architecture files, in before/after order. One of those architecture-file
inputs may be `-` for standard input, but not both. Alternatively, `--plan`
reads one JSON plan containing both sides; `--plan -` reads that plan from
standard input. Do not combine `--plan` with two positional inputs.

<!-- BEGIN GENERATED CLI: rootform diff -->

## Usage

```text
rootform diff <before> <after> [flags]
```

## Flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --exit-code ` | ` bool ` | ` false ` | exit 1 for changes or undetermined facts |
| ` --format ` | ` string ` | ` text ` | output `format`: text, json, or markdown |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform diff |
| ` -o, --output ` | ` string ` | ` "" ` | write the diff to this `file` |
| ` --plan ` | ` file ` | ` "" ` | read JSON plan; - reads standard input |

## Inherited flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --color ` | ` mode ` | ` auto ` | color human output: auto, always, never |

<!-- END GENERATED CLI -->

## Report

The default text report goes to standard output; choose `json` or `markdown`
with `--format`, and use `--output` for a file. Diagnostics go to standard
error.

## Exit status

A completed comparison can contain changes or undetermined facts.
Without `--exit-code` it returns `0` even then. With `--exit-code`, such a
report returns `1`. Status `2` means incorrect command use; `3` means the
comparison could not be completed. An undetermined fact in a completed report
is not by itself status `3`.

## Examples

```sh
rootform diff before.json after.json --exit-code
rootform diff ./before ./after --format markdown --output changes.md
rootform diff --plan tfplan.json --format json
```

See [Compare architectures](../../guides/compare-architectures.md) for reading
the facts and [Plan inputs](../../inputs/plans.md) for producing plan JSON.
