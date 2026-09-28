---
title: "rootform publish policy-packs"
description: "Publish a verified Policy Pack registry layout"
---

<!-- Generated from reference/cli.json. Run bun run generate:cli; do not edit this page. -->

Publish a verified Policy Pack registry layout.

## Usage

```text
rootform publish policy-packs <layout> [options]
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
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform publish policy-packs |
| ` --color ` | ` mode ` | ` auto ` | color human output: `auto\|always\|never`; default: auto |
| ` --no-pager ` | ` bool ` | ` false ` | print a long report in full instead of opening it in less |

## Behavior

Validate an existing local Policy Pack registry layout, publish every
Policy Pack to one registry repository, and repull each manifest by
digest. Policy Packs are published exactly as selected. Dry-run remains
offline.

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
rootform publish policy-packs ./oci --to registry.example.com/acme/policies
rootform publish policy-packs ./oci --to localhost:5000/acme/policies
rootform publish policy-packs ./oci --to registry.example.com/acme/policies \
  --dry-run --format json
```
