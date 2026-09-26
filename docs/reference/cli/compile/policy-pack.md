---
title: "rootform compile policy-pack"
description: "Compile and pin a Policy Pack"
---

<!-- Generated from reference/cli.json. Run bun run generate:cli; do not edit this page. -->

Compile and pin a Policy Pack.

## Usage

```text
rootform compile policy-pack <directory> [flags]
```

## Flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform compile policy-pack |
| ` -o, --output ` | ` string ` | ` "" ` | write compiled Policy Pack to `file` (required) |
| ` --semantics ` | ` string ` | ` "" ` | read semantics from a Rootform document `file` (required) |

## Inherited flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --color ` | ` mode ` | ` auto ` | color human output: auto, always, never |

## Behavior

Compile one Policy Pack source directory using the Rootform document
in --semantics. Write the compiled JSON file to --output. The compiled
Pack keeps its semantic pins for later offline evaluation without the
Dialect sources that produced the document.
Summary goes to standard output. Diagnostics go to standard error.

## Exit status

| Status | Meaning |
| --- | --- |
| `0` | the compiled Policy Pack was written |
| `1` | the Policy Pack could not be compiled or written |
| `2` | the command was used incorrectly |

## Examples

```sh
rootform compile policy-pack ./policies --semantics analysis.json -o pack.json
rootform compile policy-pack . --semantics analysis.json -o pack.json
rootform compile policy-pack ./rules --semantics analysis.json -o rules.json
```
