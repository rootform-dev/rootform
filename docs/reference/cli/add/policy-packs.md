---
title: "rootform add policy-packs"
description: "Add Policy Packs to rootform.lock"
---

<!-- Generated from reference/cli.json. Run bun run generate:cli; do not edit this page. -->

Add Policy Packs to rootform.lock.

## Usage

```text
rootform add policy-packs <source>... [flags]
```

## Flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --dry-run ` | ` bool ` | ` false ` | print the planned change and write nothing |
| ` --format ` | ` string ` | ` text ` | output `format`: text or json |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform add policy-packs |
| ` --offline ` | ` bool ` | ` false ` | use no network; accept local and installed sources |

## Inherited flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --color ` | ` mode ` | ` auto ` | color human output: auto, always, never |

## Behavior

Add Policy Packs to rootform.lock. Each source is a local directory (./path),
a registry reference with a tag or digest.

Rootform compiles and verifies every source, records its exact identity,
and writes rootform.lock once, or not at all. A registry source is
installed in the Rootform home. A tag is resolved once and never
recorded.

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
rootform add policy-packs ./policies
rootform add policy-packs \
  registry.example.com/acme/policies:policy-pack-baseline-0.1.0
rootform add policy-packs ./policies --dry-run
```
