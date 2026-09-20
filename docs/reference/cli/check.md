---
title: "rootform check"
description: "Check architecture policies"
---

<!-- Generated from reference/cli.json. Run bun run generate:cli; do not edit this page. -->

Check architecture policies.

## Usage

```text
rootform check [input] [flags]
```

## Flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --format ` | ` string ` | ` text ` | text/json/sarif/markdown `format` |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform check |
| ` --locked ` | ` bool ` | ` false ` | require an existing valid rootform.lock |
| ` -o, --output ` | ` string ` | ` "" ` | write the result to this `file` |
| ` --plan ` | ` file ` | ` "" ` | read JSON plan; - reads standard input |
| ` --policy ` | ` stringArray ` | ` [] ` | select pack/name or unique policy; repeatable |
| ` --policy-pack ` | ` stringArray ` | ` [] ` | select directory or compiled JSON `path`; repeatable |

## Inherited flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --color ` | ` mode ` | ` auto ` | color human output: auto, always, never |

## Behavior

Build or load an architecture and evaluate the applicable policies.

The input can be an infrastructure directory, a Rootform architecture
file, or - for an architecture file on standard input. With no input,
check reads the current directory. --plan reads a plan in JSON format
instead. Directory input never downloads, acquires, or prompts: selected
external content must already be available locally, or be prepared
explicitly with rootform init or rootform vendor. A coherent local lock
is silent. An explicit --policy-pack selection replaces the project's
Policy Pack selection for this invocation.

The selected text, JSON, SARIF, or Markdown result goes to standard
output, or to --output. Diagnostics go to standard error.

## Exit status

```text
0  all selected policies were evaluated and compliant
1  at least one policy was violated, including in mixed runs
2  the command was used incorrectly
3  indeterminate or not_evaluated, with no confirmed violation

Violations take precedence: exit 1. Zero policies or zero evaluations
are never compliant. A selected policy without targets prevents compliance.
--policy-pack accepts a source directory or compiled JSON file; compiled
files retain their semantic pins during evaluation.
```

## Examples

```sh
rootform check
rootform check ./infra
rootform check . --locked
rootform check --plan tfplan.json
rootform check . --policy-pack ./policies
rootform check arch.json --policy-pack pack.json
rootform build ./infra | rootform check -
rootform check ./infra --format sarif -o rootform.sarif
```
