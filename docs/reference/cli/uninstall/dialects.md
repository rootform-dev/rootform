---
title: "rootform uninstall dialects"
description: "Delete installed Dialect versions"
---

<!-- Generated from contracts/reference/cli.json. Run bun run generate:cli; do not edit this page. -->

Delete installed Dialect versions.

## Usage

```text
rootform uninstall dialects <name@version>... [options]
```

## Options

| Flag | Type | Default | Description |
| --- | --- | --- | --- |
| ` --format ` | ` string ` | ` "" ` | output format: `text\|json`; default: text |

### Global options

| Flag | Type | Default | Description |
| --- | --- | --- | --- |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform uninstall dialects |
| ` --color ` | ` mode ` | ` auto ` | color human output: `auto\|always\|never`; default: auto |
| ` --no-pager ` | ` bool ` | ` false ` | print a long report in full instead of opening it in less |

## Behavior

Delete each named installed version from the Rootform home. The whole
request fails before deleting anything when a version is not installed.

The summary goes to standard output. Diagnostics go to standard error.

## Exit status

| Status | Description |
| --- | --- |
| `0` | every named version was deleted |
| `1` | a named version is not installed |
| `2` | the command was used incorrectly |
| `4` | the Rootform home could not be read or changed |

## Examples

```sh
rootform uninstall dialects example@1.0.0
rootform uninstall dialects example@1.0.0 example@1.1.0
rootform uninstall dialects example@1.0.0 --format json
```
