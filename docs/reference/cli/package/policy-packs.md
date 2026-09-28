---
title: "rootform package policy-packs"
description: "Build Policy Pack packages"
---

<!-- Generated from reference/cli.json. Run bun run generate:cli; do not edit this page. -->

Build Policy Pack packages.

## Usage

```text
rootform package policy-packs <directory> [options]
```

## Options

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --documentation-url ` | ` string ` | ` "" ` | record the documentation `url` in OCI provenance |
| ` --licenses ` | ` string ` | ` "" ` | record the SPDX license `expression` in OCI provenance |
| ` --revision ` | ` string ` | ` "" ` | record the source-control `revision` in OCI provenance |
| ` --source-url ` | ` string ` | ` "" ` | record the canonical source `url` in OCI provenance |
| ` --to ` | ` string ` | ` "" ` | write the registry layout to `directory` |

### Global options

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform package policy-packs |
| ` --color ` | ` mode ` | ` auto ` | color human output: `auto\|always\|never`; default: auto |
| ` --no-pager ` | ` bool ` | ` false ` | print a long report in full instead of opening it in less |

## Behavior

Compile a Policy Pack source set and write one deterministic, local-only
registry layout of exact Policy Pack packages. Nothing is sent to a
registry.

The summary goes to standard output. Diagnostics go to standard error.

## Exit status

| Status | Meaning |
| --- | --- |
| `0` | the registry layout was written |
| `1` | the Policy Pack source is invalid |
| `2` | the command was used incorrectly |
| `4` | a source could not be read or the layout could not be written |

## Examples

```sh
rootform package policy-packs ./policies --to ./artifacts/policies
rootform package policy-packs ./baseline --to ./baseline-oci
rootform package policy-packs . --to ./oci
```
