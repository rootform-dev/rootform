---
title: "rootform test"
description: "Test Dialect fixtures"
---

<!-- Generated from reference/cli.json. Run bun run generate:cli; do not edit this page. -->

Test Dialect fixtures.

## Usage

```text
rootform test [directory] [options]
```

## Options

| Flag | Type | Default | Description |
| --- | --- | --- | --- |
| ` --dialect ` | ` stringArray ` | ` [] ` | use Dialect source `dir` for this command only; repeatable |
| ` --format ` | ` string ` | ` "" ` | output format: `text\|json`; default: text |
| ` --run ` | ` string ` | ` "" ` | run only the cases whose `name` contains this text |
| ` --update ` | ` bool ` | ` false ` | write the golden of every differing or new case |

### Global options

| Flag | Type | Default | Description |
| --- | --- | --- | --- |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform test |
| ` --color ` | ` mode ` | ` auto ` | color human output: `auto\|always\|never`; default: auto |
| ` --no-pager ` | ` bool ` | ` false ` | print a long report in full instead of opening it in less |

## Behavior

Analyze Dialect fixtures and compare the Forms they produce with the
recorded ones. A fixture is a directory holding one plan.json or
state.json export and an analysis.golden Form; the project at the test
directory selects the Dialects. A plan.tfplan saved plan beside plan.json
must pair with it, and its configuration snapshot then contributes the
facts that follow references.

A golden records the Form with only the Dialect definitions it reaches.
The comparison ignores which Rootform version and which Dialect versions
recorded it. With --update, test writes the produced golden for every
case that differs, and for a directory holding an export but no golden
yet.

Without a directory, test reads the current directory. Text or JSON
results go to standard output. Diagnostics go to standard error.

## Exit status

| Status | Description |
| --- | --- |
| `0` | every selected fixture passed or, with --update, was recorded |
| `1` | at least one fixture differed or could not be analyzed |
| `2` | the command was used incorrectly |
| `3` | rootform.lock is invalid or no fixtures matched |
| `4` | fixture files, rootform.lock, Dialects, or the report could not be read or written |

## Examples

```sh
rootform test
rootform test ./fixtures
rootform test ./fixtures --run cloud-sql
rootform test ./fixtures --format json
rootform test ./fixtures --update
```

Follow [Test and validate](../../language/test-validate.md) for the fixture workflow and Policy evaluation examples.
