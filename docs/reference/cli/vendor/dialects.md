---
title: "rootform vendor dialects"
description: "Vendor selected dialects"
---

<!-- Generated from reference/cli.json. Run bun run generate:cli; do not edit this page. -->

Vendor selected dialects.

## Usage

```text
rootform vendor dialects [flags]
```

## Flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform vendor dialects |
| ` --offline ` | ` bool ` | ` false ` | use only exact local or cached dialects |
| ` --to ` | ` string ` | ` "" ` | copy into `directory`; ./.rootform/dialects by default |

## Inherited flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --color ` | ` mode ` | ` auto ` | color human output: auto, always, never |

## Behavior

Materialize the exact dialect selection from rootform.lock: external
dialects from remote or local sources, with their licenses and notices.
Policy Packs have their own vendoring destination and are never
materialized here. Embedded dialects, the RF vocabulary, and derived
caches are never materialized. No version is resolved and rootform.lock
is never changed.

With no --to flag, vendor writes ./.rootform/dialects. Consuming
commands launched from that project root use that directory as the
exclusive source for these selections when present.

Copied names and versions go to standard output. Diagnostics go to
standard error.

## Exit status

```text
0  every selected dialect was copied
2  the command was used incorrectly
3  no complete vendored set was written
```

## Examples

```sh
rootform init ./infra --no-input
rootform vendor dialects
rootform vendor dialects --to ./offline/dialects
```
