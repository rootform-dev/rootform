---
title: "rootform validate context"
description: "Validate a context dimension"
---

<!-- Generated from reference/cli.json. Run bun run generate:cli; do not edit this page. -->

Validate a context dimension.

## Usage

```text
rootform validate context <identifier> [flags]
```

## Flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --dialect ` | ` stringArray ` | ` [] ` | use dialect source `dir`; repeatable |
| ` --format ` | ` string ` | ` text ` | output `format`: text or json |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform validate context |

## Inherited flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --color ` | ` mode ` | ` auto ` | color human output: auto, always, never |

## Behavior

Validate a context dimension in the context of its dialect.

Use &lt;owner&gt;.&lt;kind&gt;.&lt;name&gt;, or a bare name when it resolves unambiguously.
--dialect adds or replaces one Dialect for this run only.
The text or JSON result goes to standard output. Diagnostics go to
standard error.

## Exit status

| Status | Meaning |
| --- | --- |
| `0` | the definition is valid |
| `1` | the definition is not valid |
| `2` | the command was used incorrectly |
| `3` | the definition could not be validated |

## Examples

```sh
rootform validate context rf.context.network
rootform validate context network
rootform validate context rf.context.network --format json
```
