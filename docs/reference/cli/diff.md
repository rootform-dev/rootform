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
| ` --exit-code ` | ` bool ` | ` false ` | exit 1 when the two architectures differ |
| ` --format ` | ` string ` | ` text ` | output `format`: text, json, or markdown |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform diff |
| ` -o, --output ` | ` string ` | ` "" ` | write the diff to this `file` |
| ` --plan ` | ` file ` | ` "" ` | read JSON plan; - reads standard input |

Boolean flags set `true` when supplied without a value. Set the flag value to `false` to disable one. `""` means an empty string.

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
1  the architectures differ, and --exit-code was given
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

Command syntax and help are generated from the executable's command definitions. For guided tasks, start with the [reference overview](../index.md).
