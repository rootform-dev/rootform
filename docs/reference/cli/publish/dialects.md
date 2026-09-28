---
title: "rootform publish dialects"
description: "Publish a verified Dialect registry layout"
---

<!-- Generated from reference/cli.json. Run bun run generate:cli; do not edit this page. -->

Publish a verified Dialect registry layout.

## Usage

```text
rootform publish dialects <layout> [options]
```

## Options

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --dry-run ` | ` bool ` | ` false ` | report the verified publication plan without network access |
| ` --format ` | ` string ` | ` "" ` | output format: `text\|json`; default: text |
| ` --to ` | ` string ` | ` "" ` | publish to the tagless OCI `repository` |

### Global options

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform publish dialects |
| ` --color ` | ` mode ` | ` auto ` | color human output: `auto\|always\|never`; default: auto |
| ` --no-pager ` | ` bool ` | ` false ` | print a long report in full instead of opening it in less |

## Behavior

Validate an existing local Rootform registry layout, publish its external
Dialects to one registry repository, repull every manifest by digest, and
verify the complete Dialect set. Only the exact selected Dialects are
written. Packaging and dry-run remain offline.

The text or JSON result goes to standard output. Diagnostics go to
standard error.

## Exit status

| Status | Meaning |
| --- | --- |
| `0` | publication or dry-run verification completed |
| `1` | the registry layout is invalid |
| `2` | the command was used incorrectly |
| `4` | the layout could not be read, or registry publication or verification failed |

## Examples

```sh
rootform publish dialects ./oci --to registry.example.com/acme/dialects
rootform publish dialects ./oci --to localhost:5000/acme/dialects --dry-run
rootform publish dialects ./oci --to registry.example.com/acme/dialects \
  --dry-run --format json
```
