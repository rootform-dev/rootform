---
title: "rootform test"
description: "Test Dialect fixtures"
---

<!-- Generated from reference/cli.json. Run bun run generate:cli; do not edit this page. -->

Test Dialect fixtures.

## Usage

```text
rootform test [directory] [flags]
```

## Flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --dialect ` | ` stringArray ` | ` [] ` | use dialect source `dir`; repeatable |
| ` --format ` | ` string ` | ` text ` | output `format`: text or json |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform test |
| ` --run ` | ` string ` | ` "" ` | run only the cases whose `name` contains this text |
| ` --update ` | ` bool ` | ` false ` | write the golden of every differing or new case |

## Inherited flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --color ` | ` mode ` | ` auto ` | color human output: auto, always, never |

## Behavior

Analyze Dialect fixtures and compare the Rootform documents they
produce with the recorded ones. A fixture is a directory holding one
plan.json or state.json export and an analysis.golden document; the
project at the test directory selects the Dialects. A plan.tfplan saved
plan beside plan.json must verify against it, and its configuration
snapshot then contributes the facts that follow references.

A golden records the analysis with only the Dialect definitions it
reaches. The comparison ignores which Rootform version and which Dialect
versions recorded it. With --update, test writes the produced golden for
every case that differs, and for a directory holding an export but no
golden yet.

With no directory, test reads the current directory. Text or JSON results
go to standard output. Diagnostics go to standard error.

## Exit status

| Status | Meaning |
| --- | --- |
| `0` | every selected fixture passed or, with --update, was recorded |
| `1` | at least one fixture differed or encountered an error |
| `2` | the command was used incorrectly |
| `3` | the run could not start or be reported, or no fixtures matched |

## Examples

```sh
rootform test
rootform test ./fixtures
rootform test ./fixtures --run cloud-sql
rootform test ./fixtures --format json
rootform test ./fixtures --update
```
