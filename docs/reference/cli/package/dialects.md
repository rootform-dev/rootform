---
title: "rootform package dialects"
description: "Build dialect packages and a discovery index"
---

<!-- Generated from reference/cli.json. Run bun run generate:cli; do not edit this page. -->

Build dialect packages and a discovery index.

## Usage

```text
rootform package dialects <directory> [flags]
```

## Flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --documentation-url ` | ` string ` | ` "" ` | record documentation `url` in provenance |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform package dialects |
| ` --licenses ` | ` string ` | ` "" ` | record SPDX license `expression` in OCI provenance |
| ` --repository ` | ` string ` | ` "" ` | record target registry `repository` |
| ` --revision ` | ` string ` | ` "" ` | record source-control `revision` in OCI provenance |
| ` --source-url ` | ` string ` | ` "" ` | record canonical source `url` in OCI provenance |
| ` --to ` | ` string ` | ` "" ` | write registry layout to `directory` |

## Behavior

Compile a dialect source set and write one deterministic local registry
layout containing exact dialect packages and a generated discovery index.
Summary goes to standard output. Diagnostics go to standard error.
Nothing is sent to a registry.

## Exit status

```text
0  registry layout was written
1  dialects could not be packaged
2  the command was used incorrectly
```

## Examples

```sh
rootform package dialects ./dialects --to ./artifacts/oci
rootform package dialects . --to ./artifacts/oci
rootform package dialects ./private --to ./oci --repository r.example/dialects
```
