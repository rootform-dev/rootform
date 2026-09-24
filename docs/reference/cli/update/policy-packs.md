---
title: "rootform update policy-packs"
description: "Change one selected Policy Pack"
---

<!-- Generated from reference/cli.json. Run bun run generate:cli; do not edit this page. -->

Change one selected Policy Pack.

## Usage

```text
rootform update policy-packs <name> [source] [flags]
```

## Flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --dry-run ` | ` bool ` | ` false ` | print the planned change and write nothing |
| ` --format ` | ` string ` | ` text ` | output `format`: text or json |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform update policy-packs |
| ` --offline ` | ` bool ` | ` false ` | use no network; accept local and installed sources |

## Inherited flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --color ` | ` mode ` | ` auto ` | color human output: auto, always, never |

## Behavior

Change one selected Policy Pack. With no source, a local selection is read
again from its recorded path, which records content you edited. With a
source, the selection switches to it. The source must declare the same
name; a registry selection needs a source because no tag is recorded.

When the project vendors this family under .rootform/, the vendored
copy changes together with rootform.lock.

The summary goes to standard output. Diagnostics go to standard error.

## Exit status

| Status | Meaning |
| --- | --- |
| `0` | rootform.lock matches the request |
| `1` | nothing was written because a source or the result is invalid |
| `2` | the command was used incorrectly |

## Examples

```sh
rootform update policy-packs baseline
rootform update policy-packs baseline ./policies
rootform update policy-packs baseline registry.example.com/acme/baseline:1.1.0
```
