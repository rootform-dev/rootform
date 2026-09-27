---
title: "rootform validate rule"
description: "Validate a Rule definition"
---

<!-- Generated from reference/cli.json. Run bun run generate:cli; do not edit this page. -->

Validate a Rule definition.

## Usage

```text
rootform validate rule <identifier> [options]
```

## Options

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --dialect ` | ` stringArray ` | ` [] ` | use Dialect source `dir` for this command only; repeatable |
| ` --format ` | ` string ` | ` "" ` | output format: `text\|json`; default: text |
| ` --project ` | ` string ` | ` "" ` | read rootform.lock from project `dir`; paths stay relative to the working directory; default: the working directory |

### Global options

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform validate rule |
| ` --color ` | ` mode ` | ` auto ` | color human output: `auto\|always\|never`; default: auto |

## Behavior

Validate a Rule and its references within its Dialect.

Use &lt;owner&gt;.&lt;kind&gt;.&lt;name&gt;, or a bare name when it resolves unambiguously.
--dialect adds or replaces one Dialect for this command only.

The text or JSON result goes to standard output. Diagnostics go to
standard error.

## Exit status

| Status | Meaning |
| --- | --- |
| `0` | the definition is valid |
| `1` | the definition is not valid, or no definition has that name |
| `2` | the command was used incorrectly |
| `3` | rootform.lock is invalid or the name is ambiguous |
| `4` | rootform.lock or definitions could not be read, or the report could not be written |

## Examples

```sh
rootform validate rule google.rule.cloud-sql-instance
rootform validate rule cloud-sql-instance
rootform validate rule payments.rule.gateway --dialect ./dialects/payments
rootform validate rule google.rule.cloud-sql-instance --format json
```
