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
| ` --to ` | ` string ` | ` "" ` | publish to tagless OCI `repository` |

## Inherited flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --color ` | ` mode ` | ` auto ` | color human output: auto, always, never |

## Behavior

Validate an existing local Rootform registry layout, publish its external
Dialects to one registry repository, repull every manifest by
digest, and verify the complete dialect set. Only the exact selected
dialects are written. Packaging and dry-run remain offline.

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
rootform publish dialects ./oci --to r.ex/ext
rootform publish dialects ./oci --to r.ex/ext --dry-run
rootform publish dialects ./oci --to r.ex/ext --dry-run --format json
```
