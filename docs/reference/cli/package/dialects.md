---
title: "rootform package dialects"
description: "Build Dialect packages"
---

<!-- Generated from contracts/reference/cli.json. Run bun run generate:cli; do not edit this page. -->

Build Dialect packages.

## Usage

```text
rootform package dialects <directory> [options]
```

## Options

| Flag | Type | Default | Description |
| --- | --- | --- | --- |
| ` --documentation-url ` | ` string ` | ` "" ` | record the documentation `url` in OCI provenance |
| ` --licenses ` | ` string ` | ` "" ` | record the SPDX license `expression` in OCI provenance |
| ` --revision ` | ` string ` | ` "" ` | record the source-control `revision` in OCI provenance |
| ` --source-url ` | ` string ` | ` "" ` | record the canonical source `url` in OCI provenance |
| ` --to ` | ` string ` | ` "" ` | write the registry layout to `directory` |

### Global options

| Flag | Type | Default | Description |
| --- | --- | --- | --- |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform package dialects |
| ` --color ` | ` mode ` | ` auto ` | color human output: `auto\|always\|never`; default: auto |
| ` --no-pager ` | ` bool ` | ` false ` | print a long report in full instead of opening it in less |

## Behavior

Compile an external Dialect source set and write one deterministic,
local-only registry layout of exact Dialect packages. Dialects embedded
in Rootform are never packaged. Nothing is sent to a registry.

The summary goes to standard output. Diagnostics go to standard error.

## Exit status

| Status | Description |
| --- | --- |
| `0` | the registry layout was written |
| `1` | the Dialect source is invalid |
| `2` | the command was used incorrectly |
| `4` | a source could not be read or the layout could not be written |

## Examples

```sh
rootform package dialects ./dialects --to ./artifacts/oci
rootform package dialects . --to ./artifacts/oci
rootform package dialects ./own --to ./oci --licenses MPL-2.0
```
