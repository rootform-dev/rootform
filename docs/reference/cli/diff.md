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
| ` --dialect ` | ` stringArray ` | ` [] ` | use a dialect source `dir` for this run; repeatable |
| ` --exit-code ` | ` bool ` | ` false ` | exit 1 for changes or undetermined facts |
| ` --format ` | ` string ` | ` text ` | text/json/markdown/html `format` |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform diff |
| ` --no-browser ` | ` bool ` | ` false ` | --serve without opening the browser |
| ` -o, --output ` | ` string ` | ` "" ` | write the diff to this `file` |
| ` --plan ` | ` file ` | ` "" ` | read JSON plan; use `-` for standard input |
| ` --port ` | ` int ` | ` 21717 ` | --serve on this `port`; 0 picks a free one |
| ` --serve ` | ` bool ` | ` false ` | serve the comparison in the local interface |

## Inherited flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --color ` | ` mode ` | ` auto ` | color human output: auto, always, never |

<!-- END GENERATED CLI -->

## Report

The default text report goes to standard output; choose `json`, `markdown`,
or `html` with `--format`, and use `--output` for a file. HTML is one
self-contained page that opens the comparison in the interactive interface.
Diagnostics go to standard error.

## Local interface

`--serve` serves the comparison in the local interface instead of printing a
report. It builds the comparison once, prints the local address alone on
standard output, and opens a browser unless `--no-browser` is set. The default
port is `21717`; `--port 0` asks the operating system for a free port. Stop it
with `Ctrl+C`. `--serve` excludes `--format`, `--output`, and `--exit-code`. A
comparison that cannot be completed is reported on standard error and never
served.

## Exit status

A completed comparison can contain changes or undetermined facts.
Without `--exit-code` it returns `0` even then. With `--exit-code`, such a
report returns `1`. Status `2` means incorrect command use; `3` means the
comparison could not be completed. An undetermined fact in a completed report
is not by itself status `3`. With `--serve`, `0` means the local interface
stopped cleanly and `1` means it could not start.

## Examples

Use saved Before and After architecture files from
[Compare architectures](../../guides/compare-architectures.md), or replace
`./before` and `./after` with prepared project directories. Create
`tfplan.json` as described in [Plan inputs](../../inputs/plans.md).

```sh
rootform diff before.json after.json --exit-code
rootform diff ./before ./after --format markdown --output changes.md
rootform diff --plan tfplan.json --format json
rootform diff before.json after.json --format html --output architecture-diff.html
rootform diff --plan tfplan.json --serve
```

See [Compare architectures](../../guides/compare-architectures.md) for reading
the facts and [Plan inputs](../../inputs/plans.md) for producing plan JSON.
