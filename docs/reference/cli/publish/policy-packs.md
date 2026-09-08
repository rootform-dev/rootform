---
title: "rootform publish policy-packs"
description: "Publish a verified Policy Pack registry layout"
---

<!-- Generated from reference/cli.json. Run bun run generate:cli; do not edit this page. -->

Publish a verified Policy Pack registry layout.

## Usage

```text
rootform publish policy-packs <layout> [flags]
```

## Flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --dry-run ` | ` bool ` | ` false ` | report verified publication plan without network access |
| ` --format ` | ` string ` | ` text ` | output `format`: text or json |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform publish policy-packs |
| ` --to ` | ` string ` | ` "" ` | publish to tagless OCI `repository` |

## Behavior

Validate an existing local Policy Pack registry layout, publish every pack
to one registry repository, and repull each manifest by digest. Policy
Packs have no discovery index in V0. Dry-run remains offline.

Text or JSON result goes to standard output. Diagnostics go to standard
error.

## Exit status

```text
0  publication or dry-run verification completed
2  the command was used incorrectly
3  publication could not be verified
```

## Examples

```sh
rootform publish policy-packs ./oci --to registry.example/acme/policies
rootform publish policy-packs ./oci --to localhost:5000/acme/policies
rootform publish policy-packs ./oci --to registry.example/acme/policies \
  --dry-run --format json
```
