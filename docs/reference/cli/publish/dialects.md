---
title: "rootform publish dialects"
description: "Publish a verified dialect registry layout"
---

<!-- Generated from reference/cli.json. Run bun run generate:cli; do not edit this page. -->

Publish a verified dialect registry layout.

## Usage

```text
rootform publish dialects <layout> [flags]
```

## Flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --dry-run ` | ` bool ` | ` false ` | report verified publication plan without network access |
| ` --format ` | ` string ` | ` text ` | output `format`: text or json |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform publish dialects |
| ` --index ` | ` bool ` | ` false ` | publish index after all dialects pass verification |
| ` --to ` | ` string ` | ` "" ` | publish to tagless OCI `repository` |

## Behavior

Validate an existing local Rootform registry layout, publish its dialects
to one registry repository, repull every manifest by digest, and verify the
complete dialect set. Use --index to publish the generated index last under
an immutable digest-derived tag. Packaging and dry-run remain offline.

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
rootform publish dialects ./oci --to registry.example/acme/dialects
rootform publish dialects ./oci --to registry.example/acme/dialects --index
rootform publish dialects ./oci --to example/dialects --dry-run --format json
```
