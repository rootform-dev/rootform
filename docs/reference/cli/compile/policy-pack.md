---
title: "rootform compile policy-pack"
description: "Compile and pin a Policy Pack"
---

<!-- Generated from reference/cli.json. Run bun run generate:cli; do not edit this page. -->

Compile and pin a Policy Pack.

## Usage

```text
rootform compile policy-pack <directory> [options]
```

## Options

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` -o, --output ` | ` string ` | ` "" ` | write compiled Policy Pack to `file` (required) |
| ` --semantics ` | ` string ` | ` "" ` | read semantics from a saved Form `file` (required) |

### Global options

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform compile policy-pack |
| ` --color ` | ` mode ` | ` auto ` | color human output: `auto\|always\|never`; default: auto |

## Behavior

Compile one Policy Pack source directory using the semantics of the saved
Form in --semantics, and write the compiled JSON file to --output. The
compiled Policy Pack keeps its semantic pins for later offline evaluation
without the Dialect sources that produced the Form.

The summary goes to standard output. Diagnostics go to standard error.

## Exit status

| Status | Meaning |
| --- | --- |
| `0` | the compiled Policy Pack was written |
| `1` | the Policy Pack or Form is invalid |
| `2` | the command was used incorrectly |
| `4` | a source could not be read or the output could not be written |

## Examples

```sh
rootform compile policy-pack ./policies --semantics form.json -o pack.json
rootform compile policy-pack . --semantics form.json -o pack.json
rootform compile policy-pack ./rules --semantics form.json -o rules.json
```
