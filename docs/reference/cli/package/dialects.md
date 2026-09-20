---
title: "rootform package dialects"
description: "Build dialect packages"
---

<!-- Generated from reference/cli.json. Run bun run generate:cli; do not edit this page. -->

Build dialect packages.

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
| ` --revision ` | ` string ` | ` "" ` | record source-control `revision` in OCI provenance |
| ` --source-url ` | ` string ` | ` "" ` | record canonical source `url` in OCI provenance |
| ` --to ` | ` string ` | ` "" ` | write registry layout to `directory` |

## Inherited flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --color ` | ` mode ` | ` auto ` | color human output: auto, always, never |

## Behavior

Compile an external dialect source set and write one deterministic,
local-only registry layout of exact dialect packages. Dialects
embedded in Rootform are never packaged. Summary goes to
standard output. Diagnostics go to standard error. Nothing is sent
to a registry.

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
rootform package dialects ./own --to ./oci --licenses MPL-2.0
```
