---
title: "rootform package policy-packs"
description: "Build Policy Pack packages"
---

<!-- Generated from reference/cli.json. Run bun run generate:cli; do not edit this page. -->

Build Policy Pack packages.

## Usage

```text
rootform package policy-packs <directory> [flags]
```

## Flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --documentation-url ` | ` string ` | ` "" ` | record documentation `url` in provenance |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform package policy-packs |
| ` --licenses ` | ` string ` | ` "" ` | record SPDX license `expression` in OCI provenance |
| ` --revision ` | ` string ` | ` "" ` | record source-control `revision` in OCI provenance |
| ` --source-url ` | ` string ` | ` "" ` | record canonical source `url` in OCI provenance |
| ` --to ` | ` string ` | ` "" ` | write registry layout to `directory` |

## Behavior

Compile a Policy Pack source set and write one deterministic local registry
layout containing exact Policy Pack packages and no discovery index.
Nothing is sent to a registry. Summary goes to standard output.
Diagnostics go to standard error.

## Exit status

```text
0  registry layout was written
1  Policy Packs could not be packaged
2  the command was used incorrectly
```

## Examples

```sh
rootform package policy-packs ./policies --to ./artifacts/policies
rootform package policy-packs ./baseline --to ./baseline-oci
rootform package policy-packs . --to ./oci
```
