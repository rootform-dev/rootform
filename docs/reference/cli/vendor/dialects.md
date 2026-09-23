---
title: "rootform vendor dialects"
description: "Vendor the project's exact external Dialect selection."
---

From the project root, `vendor dialects` copies the external Dialects pinned by
its `rootform.lock`, with licenses and notices. The lock must select at least
one external Dialect. Embedded Dialects, RF
Vocabulary, Policy Packs, and derived caches are not copied. A prior `init`
must target this same project if preparation is needed.

<!-- BEGIN GENERATED CLI: rootform vendor dialects -->

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

<!-- END GENERATED CLI -->

`--to` changes the copy destination, not which project's lock is read. The
default destination is `./.rootform/dialects`; when present, commands run from
that project root use it exclusively for selected external Dialects. Use
`--offline` to restrict copies to exact local or cached content. Neither
vendoring nor `--to` changes the lock.

```sh
rootform init . --locked --no-input
rootform vendor dialects
rootform vendor dialects --offline --to ./offline/dialects
```

Copied names and versions go to standard output, diagnostics to standard
error. Status `0` means every selection was copied, `2` means incorrect
command use, and `3` means no complete vendored set was written. See
[Reproduce a build offline](../../../guides/reproduce-build.md).
