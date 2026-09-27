---
title: "rootform update dialect"
description: "Change one selected Dialect"
---

<!-- Generated from reference/cli.json. Run bun run generate:cli; do not edit this page. -->

Change one selected Dialect.

## Usage

```text
rootform update dialect <name> [source] [options]
```

## Options

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --dry-run ` | ` bool ` | ` false ` | print the planned change and write nothing |
| ` --format ` | ` string ` | ` "" ` | output format: `text\|json`; default: text |
| ` --offline ` | ` bool ` | ` false ` | use no network; accept local and installed sources |

### Global options

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform update dialect |
| ` --color ` | ` mode ` | ` auto ` | color human output: `auto\|always\|never`; default: auto |

## Behavior

Change one selected Dialect. Without a source, a local selection is
read again from its recorded path, which records content you edited. With
a source, the selection switches to it. The source must declare the same
name; a registry selection needs a source because no tag is recorded.

When the project vendors this family under .rootform/, the vendored
copy changes together with rootform.lock.

The summary goes to standard output. Diagnostics go to standard error.

## Exit status

| Status | Meaning |
| --- | --- |
| `0` | rootform.lock matches the request |
| `1` | a source is invalid or a named selection is absent |
| `2` | the command was used incorrectly |
| `3` | rootform.lock is invalid, selections conflict, or --offline needs content that is not installed |
| `4` | a file, Rootform home, or network operation failed |

## Examples

```sh
rootform update dialect payments
rootform update dialect payments ./dialects/payments-next
rootform update dialect payments \
  registry.example.com/acme/dialects:dialect-payments-0.2.0
```
