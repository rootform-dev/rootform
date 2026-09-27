---
title: "rootform validate policy"
description: "Validate a Policy definition"
---

<!-- Generated from reference/cli.json. Run bun run generate:cli; do not edit this page. -->

Validate a Policy definition.

## Usage

```text
rootform validate policy <identifier> [options]
```

## Options

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --dialect ` | ` stringArray ` | ` [] ` | use Dialect source `dir` for this command only; repeatable |
| ` --format ` | ` string ` | ` "" ` | output format: `text\|json`; default: text |
| ` --policy-pack ` | ` stringArray ` | ` [] ` | add or replace the Policy Pack at `path`, a source directory or a compiled file, for this command only; repeatable |

### Global options

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform validate policy |
| ` --color ` | ` mode ` | ` auto ` | color human output: `auto\|always\|never`; default: auto |

## Behavior

Validate a Policy definition in its selected Policy Pack.

The project must select the Policy Pack that owns the Policy, or
--policy-pack must name its source directory for this command only.
Use &lt;policy-pack&gt;.policy.&lt;name&gt;, or a bare name when it resolves
unambiguously.

The text or JSON result goes to standard output. Diagnostics go to
standard error.

## Exit status

| Status | Meaning |
| --- | --- |
| `0` | the definition is valid |
| `1` | the definition is not valid, or no definition has that name |
| `2` | the command was used incorrectly |
| `3` | rootform.lock is invalid or the name is ambiguous |
| `4` | definitions could not be loaded or the report could not be written |

## Examples

```sh
rootform validate policy baseline.policy.cluster-network-context
rootform validate policy cluster-network-context
rootform validate policy cluster-network-context --policy-pack ./policies
rootform validate policy baseline.policy.cluster-network-context --format json
```
