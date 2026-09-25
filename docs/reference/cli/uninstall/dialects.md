---
title: "rootform uninstall dialects"
description: "Delete installed dialect versions"
---

<!-- Generated from reference/cli.json. Run bun run generate:cli; do not edit this page. -->

Delete installed dialect versions.

## Usage

```text
rootform uninstall dialects <name@version>... [flags]
```

## Flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --format ` | ` string ` | ` text ` | output `format`: text or json |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform uninstall dialects |

## Inherited flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --color ` | ` mode ` | ` auto ` | color human output: auto, always, never |

## Behavior

Delete each named installed version from the Rootform home. The whole
request fails before deleting anything when a version is not installed.

The summary goes to standard output. Diagnostics go to standard error.

## Exit status

| Status | Meaning |
| --- | --- |
| `0` | every named version was deleted |
| `1` | a named version is not installed or could not be deleted |
| `2` | the command was used incorrectly |

## Examples

```sh
rootform uninstall dialects example@1.0.0
rootform uninstall dialects example@1.0.0 example@1.1.0
rootform uninstall dialects example@1.0.0 --format json
```
