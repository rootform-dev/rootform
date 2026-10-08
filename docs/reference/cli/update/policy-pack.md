---
title: "rootform update policy-pack"
description: "Change one selected Policy Pack"
---

<!-- Generated from reference/cli.json. Run bun run generate:cli; do not edit this page. -->

Change one selected Policy Pack.

## Usage

```text
rootform update policy-pack <name> [source] [options]
```

## Options

| Flag | Type | Default | Description |
| --- | --- | --- | --- |
| ` --dry-run ` | ` bool ` | ` false ` | print the planned change and write nothing |
| ` --format ` | ` string ` | ` "" ` | output format: `text\|json`; default: text |
| ` --offline ` | ` bool ` | ` false ` | use no network; accept local and installed sources |
| ` --project ` | ` string ` | ` "" ` | change rootform.lock and vendored copies in project `dir`; paths stay relative to the working directory; default: the working directory |

### Global options

| Flag | Type | Default | Description |
| --- | --- | --- | --- |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform update policy-pack |
| ` --color ` | ` mode ` | ` auto ` | color human output: `auto\|always\|never`; default: auto |
| ` --no-pager ` | ` bool ` | ` false ` | print a long report in full instead of opening it in less |

## Behavior

Change one selected Policy Pack. Without a source, a local selection is
read again from its recorded path, which records content you edited. With
a source, the selection switches to it. The source must declare the same
name; a registry selection needs a source because no tag is recorded.

When the project vendors this family under .rootform/, the vendored
copy changes together with rootform.lock.

The summary goes to standard output. Diagnostics go to standard error.

## Exit status

| Status | Description |
| --- | --- |
| `0` | rootform.lock matches the request |
| `1` | a source is invalid or a named selection is absent |
| `2` | the command was used incorrectly |
| `3` | rootform.lock is invalid, selections conflict, or --offline needs content that is not installed |
| `4` | a file, Rootform home, or network operation failed |

## Examples

```sh
rootform update policy-pack baseline
rootform update policy-pack baseline ./policies
rootform update policy-pack baseline \
  registry.example.com/acme/policies:policy-pack-baseline-0.2.0
```
