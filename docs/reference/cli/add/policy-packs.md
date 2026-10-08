---
title: "rootform add policy-packs"
description: "Add Policy Packs to rootform.lock"
---

<!-- Generated from contracts/reference/cli.json. Run bun run generate:cli; do not edit this page. -->

Add Policy Packs to rootform.lock.

## Usage

```text
rootform add policy-packs <source>... [options]
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
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform add policy-packs |
| ` --color ` | ` mode ` | ` auto ` | color human output: `auto\|always\|never`; default: auto |
| ` --no-pager ` | ` bool ` | ` false ` | print a long report in full instead of opening it in less |

## Behavior

Add Policy Packs to rootform.lock. Each source is a local directory
(./path) or a registry reference with a tag or digest.

Rootform compiles and verifies every source, records its exact identity,
and writes rootform.lock once, or not at all. A registry source is
installed in the Rootform home. A tag is resolved once and never
recorded.

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
rootform add policy-packs ./policies
rootform add policy-packs \
  registry.example.com/acme/policies:policy-pack-baseline-0.1.0
rootform add policy-packs ./policies --dry-run
```
