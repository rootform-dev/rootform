---
title: "rootform remove policy-packs"
description: "Remove Policy Packs from rootform.lock"
---

<!-- Generated from reference/cli.json. Run bun run generate:cli; do not edit this page. -->

Remove Policy Packs from rootform.lock.

## Usage

```text
rootform remove policy-packs <name>... [options]
```

## Options

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --dry-run ` | ` bool ` | ` false ` | print the planned change and write nothing |
| ` --format ` | ` string ` | ` "" ` | output format: `text\|json`; default: text |

### Global options

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform remove policy-packs |
| ` --color ` | ` mode ` | ` auto ` | color human output: `auto\|always\|never`; default: auto |

## Behavior

Remove Policy Packs from rootform.lock by name. Every name must be selected;
otherwise nothing changes.

When the project vendors this family under .rootform/, the vendored
copy changes together with rootform.lock.

The summary goes to standard output. Diagnostics go to standard error.

## Exit status

| Status | Meaning |
| --- | --- |
| `0` | rootform.lock matches the request |
| `1` | a named selection is absent or the remaining selection is invalid |
| `2` | the command was used incorrectly |
| `3` | rootform.lock is invalid |
| `4` | a file or Rootform home operation failed |

## Examples

```sh
rootform remove policy-packs baseline
rootform remove policy-packs baseline audit
rootform remove policy-packs baseline --format json
```
