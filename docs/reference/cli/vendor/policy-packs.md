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
| ` --offline ` | ` bool ` | ` false ` | use only exact local or cached Policy Packs |
| ` --to ` | ` string ` | ` "" ` | copy into `directory`; ./.rootform/policy-packs by default |

## Inherited flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --color ` | ` mode ` | ` auto ` | color human output: auto, always, never |

## Behavior

Materialize the exact rootform.lock Policy Pack selection from the
local store, the verified content cache, or each pinned registry
repository when network access is explicitly allowed. Offline mode
permits only verified local entries. No version is resolved and
rootform.lock is never changed.

With no --to flag, vendor writes ./.rootform/policy-packs. Commands
using the project's Policy Pack selection use that directory
exclusively when present. An explicit local --policy-pack selection
replaces the project selection for that invocation.

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
rootform vendor policy-packs
rootform vendor policy-packs --to ./offline/policy-packs
rootform package policy-packs ./policies --to ./artifacts/policies
```
