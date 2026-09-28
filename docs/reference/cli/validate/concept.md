---
title: "rootform validate concept"
description: "Validate a Concept definition"
---

<!-- Generated from reference/cli.json. Run bun run generate:cli; do not edit this page. -->

Validate a Concept definition.

## Usage

```text
rootform validate concept <identifier> [options]
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
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform validate concept |
| ` --color ` | ` mode ` | ` auto ` | color human output: `auto\|always\|never`; default: auto |
| ` --no-pager ` | ` bool ` | ` false ` | print a long report in full instead of opening it in less |

## Behavior

Validate a Concept within its Dialect.

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
rootform validate concept rf.concept.virtual-network
rootform validate concept virtual-network
rootform validate concept rf.concept.virtual-network --format json
```
