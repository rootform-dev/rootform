---
title: "rootform install dialects"
description: "Install Dialects from registry references"
---

<!-- Generated from contracts/reference/cli.json. Run bun run generate:cli; do not edit this page. -->

Install Dialects from registry references.

## Usage

```text
rootform install dialects <reference>... [options]
```

## Options

| Flag | Type | Default | Description |
| --- | --- | --- | --- |
| ` --format ` | ` string ` | ` "" ` | output format: `text\|json`; default: text |
| ` --offline ` | ` bool ` | ` false ` | use no network; accept installed digest references |

### Global options

| Flag | Type | Default | Description |
| --- | --- | --- | --- |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform install dialects |
| ` --color ` | ` mode ` | ` auto ` | color human output: `auto\|always\|never`; default: auto |
| ` --no-pager ` | ` bool ` | ` false ` | print a long report in full instead of opening it in less |

## Behavior

Resolve each registry reference once, verify the Dialect it
names, and install it in the Rootform home. A version is immutable on a
machine: installing the same version from other content fails.

No project file is read or written. Use rootform add to select content.

The summary goes to standard output. Diagnostics go to standard error.

## Exit status

| Status | Description |
| --- | --- |
| `0` | every reference is installed |
| `1` | content is invalid or a named version is absent |
| `2` | the command was used incorrectly |
| `3` | --offline needs content that is not installed |
| `4` | a registry, network, or Rootform home operation failed |

## Examples

```sh
rootform install dialects \
  registry.example.com/acme/dialects:dialect-payments-0.1.0
rootform install dialects --format json \
  registry.example.com/acme/dialects:dialect-payments-0.1.0
rootform install dialects --offline \
  registry.example.com/acme/dialects@sha256:<digest>
```
