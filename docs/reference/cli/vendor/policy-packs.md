---
title: "rootform vendor policy-packs"
description: "Vendor selected Policy Packs"
---

<!-- Generated from reference/cli.json. Run bun run generate:cli; do not edit this page. -->

Vendor selected Policy Packs.

## Usage

```text
rootform vendor policy-packs [flags]
```

## Flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform vendor policy-packs |
| ` --offline ` | ` bool ` | ` false ` | use only exact installed or cached Policy Packs |
| ` --to ` | ` string ` | ` "" ` | copy into `directory`; ./.rootform/policy-packs by default |

## Behavior

Materialize the exact rootform.lock Policy Pack set from the installed
store, content cache, or each pinned registry repository. No version is
resolved and rootform.lock is never changed.

With no --to flag, vendor writes ./.rootform/policy-packs. Commands using
the project's Policy Pack selection use that directory exclusively when
present. An explicit local --policy-pack selection replaces the project
selection for that invocation.

Copied names and versions go to standard output. Diagnostics go to
standard error.

## Exit status

```text
0  every selected Policy Pack was copied
2  the command was used incorrectly
3  no complete vendored set was written
```

## Examples

```sh
rootform init --policy-pack r.example/p:policy-pack-baseline-0.1.0
rootform vendor policy-packs
rootform vendor policy-packs --to ./offline/policy-packs
```
