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
| ` --locked ` | ` bool ` | ` false ` | require and preserve the existing rootform.lock |
| ` --no-input ` | ` bool ` | ` false ` | never prompt; require deterministic action |
| ` --offline ` | ` bool ` | ` false ` | disable network; use only local data |
| ` -o, --output ` | ` string ` | ` "" ` | write the result to this `file` |
| ` --plan ` | ` file ` | ` "" ` | read JSON plan; - reads standard input |
| ` --policy ` | ` stringArray ` | ` [] ` | evaluate only this `policy`; repeatable |
| ` --policy-pack ` | ` stringArray ` | ` [] ` | select local Policy Pack `directory`; repeatable |
| ` -v, --verbose ` | ` bool ` | ` false ` | show provider evidence and origin |

Boolean flags set `true` when supplied without a value. Set the flag value to `false` to disable one. `""` means an empty string.

## Behavior

Build or load an architecture and evaluate the applicable policies.

The input can be an infrastructure directory, a Rootform architecture
file, or - for an architecture file on standard input. With no input,
check reads the current directory. --plan reads a plan in JSON format
instead. Directory input prepares missing project dialects before evaluation;
a coherent local lock is silent.

The selected text, JSON, SARIF, or Markdown result goes to standard
output, or to --output. Diagnostics go to standard error.

## Exit status

```text
0  every policy passed
1  at least one policy was violated
2  the command was used incorrectly
3  the architecture could not be evaluated
```

## Examples

```sh
rootform check
rootform check ./infra
rootform check . --locked
rootform check --plan tfplan.json
rootform check . --policy-pack ./policies
rootform build ./infra | rootform check -
rootform check ./infra --format sarif -o rootform.sarif
```

Command syntax and help are generated from the executable's command definitions. For guided tasks, start with the [reference overview](../index.md).
