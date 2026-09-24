---
title: "rootform remove dialects"
description: "Remove dialects from rootform.lock"
---

<!-- Generated from reference/cli.json. Run bun run generate:cli; do not edit this page. -->

Remove dialects from rootform.lock.

## Usage

```text
rootform remove dialects <name>... [flags]
```

## Flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --dry-run ` | ` bool ` | ` false ` | print the planned change and write nothing |
| ` --embedded ` | ` bool ` | ` false ` | exclude the named embedded dialects from the project |
| ` --format ` | ` string ` | ` text ` | output `format`: text or json |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform remove dialects |

## Inherited flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --color ` | ` mode ` | ` auto ` | color human output: auto, always, never |

## Behavior

Remove dialects from rootform.lock by name. A name that is not selected
changes nothing.

Removing a dialect that replaced an embedded one makes the embedded
one active again. With --embedded, the named embedded dialects are
excluded from the project instead.

When the project vendors this family under .rootform/, the vendored
copy changes together with rootform.lock.

The summary goes to standard output. Diagnostics go to standard error.

## Exit status

| Status | Meaning |
| --- | --- |
| `0` | rootform.lock matches the request |
| `1` | nothing was written because a source or the result is invalid |
| `2` | the command was used incorrectly |

## Examples

```sh
rootform remove dialects payments
rootform remove dialects payments billing --dry-run
rootform remove dialects aws --embedded
```
