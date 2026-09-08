---
title: "rootform test"
description: "Test dialect fixtures"
---

<!-- Generated from reference/cli.json. Run bun run generate:cli; do not edit this page. -->

Test dialect fixtures.

## Usage

```text
rootform test [directory] [flags]
```

## Flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --format ` | ` string ` | ` text ` | output `format`: text or json |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform test |
| ` --run ` | ` string ` | ` "" ` | run only the cases whose `name` contains this text |

## Behavior

Build dialect fixtures and compare their architectures with the
expected results.

With no directory, test reads the current directory. Text or JSON results
go to standard output. Diagnostics go to standard error.

## Exit status

```text
0  every selected fixture passed
1  at least one fixture differed
2  the command was used incorrectly
3  no fixture result could be decided
```

## Examples

```sh
rootform test
rootform test ./fixtures
rootform test ./fixtures --run cloud-sql
rootform test ./fixtures --format json
```
