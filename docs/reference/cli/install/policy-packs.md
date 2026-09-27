---
title: "rootform install policy-packs"
description: "Install Policy Packs from registry references"
---

<!-- Generated from reference/cli.json. Run bun run generate:cli; do not edit this page. -->

Install Policy Packs from registry references.

## Usage

```text
rootform install policy-packs <reference>... [options]
```

## Options

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --format ` | ` string ` | ` "" ` | output format: `text\|json`; default: text |
| ` --offline ` | ` bool ` | ` false ` | use no network; accept installed digest references |

### Global options

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform install policy-packs |
| ` --color ` | ` mode ` | ` auto ` | color human output: `auto\|always\|never`; default: auto |

## Behavior

Resolve each registry reference once, verify the Policy Pack it
names, and install it in the Rootform home. A version is immutable on a
machine: installing the same version from other content fails.

No project file is read or written. Use rootform add to select content.

The summary goes to standard output. Diagnostics go to standard error.

## Exit status

| Status | Meaning |
| --- | --- |
| `0` | every reference is installed |
| `1` | content is invalid or a named version is absent |
| `2` | the command was used incorrectly |
| `3` | --offline needs content that is not installed |
| `4` | a registry, network, or Rootform home operation failed |

## Examples

```sh
rootform install policy-packs \
  registry.example.com/acme/policies:policy-pack-baseline-0.1.0
rootform install policy-packs --format json \
  registry.example.com/acme/policies:policy-pack-baseline-0.1.0
rootform install policy-packs --offline \
  registry.example.com/acme/policies@sha256:<digest>
```
