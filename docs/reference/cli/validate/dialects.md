---
title: "rootform validate dialects"
description: "Validate Dialect definitions"
---

<!-- Generated from reference/cli.json. Run bun run generate:cli; do not edit this page. -->

Validate Dialect definitions.

## Usage

```text
rootform validate dialects [directory] [options]
```

## Options

| Flag | Type | Default | Description |
| --- | --- | --- | --- |
| ` --format ` | ` string ` | ` "" ` | output format: `text\|json`; default: text |

### Global options

| Flag | Type | Default | Description |
| --- | --- | --- | --- |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform validate dialects |
| ` --color ` | ` mode ` | ` auto ` | color human output: `auto\|always\|never`; default: auto |
| ` --no-pager ` | ` bool ` | ` false ` | print a long report in full instead of opening it in less |

## Behavior

Compile and validate each Dialect of a directory, including its
Concepts, Rules, and references.

Without a directory, validation reads the current directory. The text or
JSON result goes to standard output. Diagnostics go to standard error.

## Exit status

| Status | Description |
| --- | --- |
| `0` | every Dialect is valid |
| `1` | at least one Dialect is not valid |
| `2` | the command was used incorrectly |
| `3` | no Dialects were found |
| `4` | a source could not be read or the report could not be written |

## Examples

```sh
rootform validate dialects
rootform validate dialects ./dialects
rootform validate dialects ./dialects --format json
```
