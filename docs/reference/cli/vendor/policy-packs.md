---
title: "rootform vendor policy-packs"
description: "Vendor the project's exact Policy Pack source selection."
---

From the project root, `vendor policy-packs` copies Policy Pack sources pinned
by its `rootform.lock`, with licenses and notices. The lock must select at
least one Policy Pack. It does not copy Dialects,
resolve versions, or change the lock. A prior `init` must target this same
project if preparation is needed.

<!-- BEGIN GENERATED CLI: rootform vendor policy-packs -->

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

<!-- END GENERATED CLI -->

`--to` changes the destination, not the project selection. The default is
`./.rootform/policy-packs`; when present, project-selected packs are read
exclusively there. An explicit local `--policy-pack` on a consuming command
replaces the project selection for that invocation. `--offline` limits
vendoring to verified local content.

```sh
rootform init . --locked --no-input
rootform vendor policy-packs
rootform vendor policy-packs --offline --to ./offline/policy-packs
```

Copied names and versions go to standard output, diagnostics to standard
error. Status `0` means every selection was copied, `2` means incorrect
command use, and `3` means no complete vendored set was written. See
[Reproduce a build offline](../../../guides/reproduce-build.md).
