---
title: "rootform install dialects"
description: "Install dialects from registry references"
---

<!-- Generated from reference/cli.json. Run bun run generate:cli; do not edit this page. -->

Install dialects from registry references.

## Usage

```text
rootform install dialects <reference>... [flags]
```

## Flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --format ` | ` string ` | ` text ` | output `format`: text or json |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform install dialects |
| ` --offline ` | ` bool ` | ` false ` | use no network; accept installed digest references |

## Inherited flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --color ` | ` mode ` | ` auto ` | color human output: auto, always, never |

## Behavior

Resolve each registry reference once, verify the dialect it
names, and install it in the Rootform home. A version is immutable on a
machine: installing the same version from other content fails.

No project file is read or written. Use rootform add to select content.

The summary goes to standard output. Diagnostics go to standard error.

## Exit status

| Status | Meaning |
| --- | --- |
| `0` | every reference is installed |
| `1` | a reference could not be resolved, verified, or installed |
| `2` | the command was used incorrectly |

## Examples

```sh
rootform install dialects \
  registry.example.com/acme/dialects:dialect-payments-0.1.0
rootform install dialects --format json \
  registry.example.com/acme/dialects:dialect-payments-0.1.0
rootform install dialects --offline \
  registry.example.com/acme/dialects@sha256:<digest>
```
