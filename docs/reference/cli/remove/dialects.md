---
title: "rootform remove dialects"
description: "Remove Dialects from rootform.lock"
---

<!-- Generated from reference/cli.json. Run bun run generate:cli; do not edit this page. -->

Remove Dialects from rootform.lock.

## Usage

```text
rootform remove dialects <name>... [options]
```

## Options

| Flag | Type | Default | Description |
| --- | --- | --- | --- |
| ` --dry-run ` | ` bool ` | ` false ` | print the planned change and write nothing |
| ` --embedded ` | ` bool ` | ` false ` | exclude the named embedded Dialects from the project |
| ` --format ` | ` string ` | ` "" ` | output format: `text\|json`; default: text |
| ` --project ` | ` string ` | ` "" ` | change rootform.lock and vendored copies in project `dir`; paths stay relative to the working directory; default: the working directory |

### Global options

| Flag | Type | Default | Description |
| --- | --- | --- | --- |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform remove dialects |
| ` --color ` | ` mode ` | ` auto ` | color human output: `auto\|always\|never`; default: auto |
| ` --no-pager ` | ` bool ` | ` false ` | print a long report in full instead of opening it in less |

## Behavior

Remove Dialects from rootform.lock by name. Every name must be selected;
otherwise nothing changes.

Removing a Dialect that replaced an embedded one makes the embedded
one active again. With --embedded, each name must instead be an embedded
Dialect that no selection replaces; it is excluded from the project.

When the project vendors this family under .rootform/, the vendored
copy changes together with rootform.lock.

The summary goes to standard output. Diagnostics go to standard error.

## Exit status

| Status | Description |
| --- | --- |
| `0` | rootform.lock matches the request |
| `1` | a named selection is absent or the remaining selection is invalid |
| `2` | the command was used incorrectly |
| `3` | rootform.lock is invalid, or --embedded names a Dialect that is not embedded or that a selection replaces |
| `4` | a file or Rootform home operation failed |

## Examples

```sh
rootform remove dialects payments
rootform remove dialects payments billing --dry-run
rootform remove dialects aws --embedded
```
