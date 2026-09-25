---
title: "rootform remove policy-packs"
description: "Remove Policy Packs from rootform.lock"
---

<!-- Generated from reference/cli.json. Run bun run generate:cli; do not edit this page. -->

Remove Policy Packs from rootform.lock.

## Usage

```text
rootform remove policy-packs <name>... [flags]
```

## Flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --dry-run ` | ` bool ` | ` false ` | print the planned change and write nothing |
| ` --format ` | ` string ` | ` text ` | output `format`: text or json |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform remove policy-packs |

## Inherited flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --color ` | ` mode ` | ` auto ` | color human output: auto, always, never |

## Behavior

Remove Policy Packs from rootform.lock by name. A name that is not selected
changes nothing.

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
rootform remove policy-packs baseline
rootform remove policy-packs baseline audit
rootform remove policy-packs baseline --format json
```
