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
| ` --semantics ` | ` string ` | ` "" ` | pin semantics from an architecture `file` (required) |

## Behavior

Compile one Policy Pack source directory against the semantic snapshot
in --semantics. Write the compiled JSON file to --output, preserving its
semantic pins for later offline checks without producer Dialects.
Summary goes to standard output. Diagnostics go to standard error.

## Exit status

```text
0  the compiled Policy Pack was written
1  the Policy Pack could not be compiled or written
2  the command was used incorrectly
```

## Examples

```sh
rootform compile policy-pack ./policies --semantics arch.json -o pack.json
rootform compile policy-pack . --semantics baseline.json -o pack.json
rootform compile policy-pack ./rules --semantics arch.json -o rules.json
```
