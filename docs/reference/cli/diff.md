---
title: "rootform diff"
description: "Compare two architectures"
---

<!-- Generated from reference/cli.json. Run bun run generate:cli; do not edit this page. -->

Compare two architectures.

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

## Behavior

Compare two architectures and report the architectural changes between
them.

Each input can be an infrastructure directory, a Rootform architecture
file, or - for one architecture file on standard input. --plan reads
both sides from a plan in JSON format instead. Only one input can be -.

The selected text, JSON, or Markdown result goes to standard output, or
to --output. Diagnostics go to standard error.

## Exit status

```text
0  the comparison succeeded
1  changes or undetermined facts with --exit-code
2  the command was used incorrectly
3  the comparison could not be completed
```

## Examples

```sh
rootform diff ./before ./after
rootform diff before.json after.json --exit-code
rootform diff --plan tfplan.json
terraform show -json tfplan | rootform diff --plan -
rootform diff ./before ./after --format markdown -o rootform-diff.md
```
