---
title: "rootform vendor"
description: "Copy exact selected external content into a project-local destination."
---

`vendor` reads the current project's `rootform.lock` and copies selected
external content into `.rootform/`. With no family argument, it vendors
every selected family. Choose `dialects` or `policy-packs` to write one
family. It does not choose versions or change the lock. Run it from the
project root whose selection you intend to copy.

<!-- BEGIN GENERATED CLI: rootform vendor -->

## Usage

```text
rootform vendor [object] [flags]
```

## Flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform vendor |
| ` --offline ` | ` bool ` | ` false ` | use only exact local or installed content |

## Inherited flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --color ` | ` mode ` | ` auto ` | color human output: auto, always, never |

## Subcommands

| Command | Purpose |
| --- | --- |
| [` rootform vendor dialects `](vendor/dialects.md) | Vendor selected dialects |
| [` rootform vendor policy-packs `](vendor/policy-packs.md) | Vendor selected Policy Packs |

<!-- END GENERATED CLI -->

Run from a project whose `rootform.lock` selects content. An empty
selection has nothing to vendor.

<!-- docs-check:cli-vendor -->
```sh
rootform vendor
rootform vendor dialects
rootform vendor policy-packs
```

When the corresponding default vendored directory exists, consuming commands
use it as the exclusive source for that project's selected content. See
[External content storage](../storage.md) for the precedence
rules and [Add external content](../../guides/external-content.md)
for selection setup.
