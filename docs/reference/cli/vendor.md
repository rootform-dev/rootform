---
title: "rootform vendor"
description: "Copy selected external content into a project-local directory."
---

`vendor` reads the current project's `rootform.lock` and copies selected
external content into `.rootform/`. Without a subcommand, it vendors every
selected family; run `vendor dialects` or `vendor policy-packs` to write one
family. It does not choose versions or change the lock. Run it from the
project root whose selection you intend to copy.

<!-- BEGIN GENERATED CLI: rootform vendor -->

## Usage

```text
rootform vendor [options]
rootform vendor <command> [options]
```

## Options

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --offline ` | ` bool ` | ` false ` | use no network; copy only local and installed content |
| ` --project ` | ` string ` | ` "" ` | vendor what rootform.lock selects in project `dir`; paths stay relative to the working directory; default: the working directory |

### Global options

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform vendor |
| ` --color ` | ` mode ` | ` auto ` | color human output: `auto\|always\|never`; default: auto |

## Subcommands

| Command | Purpose |
| --- | --- |
| [` rootform vendor dialects `](vendor/dialects.md) | Vendor selected Dialects |
| [` rootform vendor policy-packs `](vendor/policy-packs.md) | Vendor selected Policy Packs |

<!-- END GENERATED CLI -->

Run from a project whose `rootform.lock` selects content. An empty
selection has nothing to vendor. The first command copies both selected
families; the subcommands limit the copy to one family.

<!-- docs-check:cli-vendor -->
```sh
rootform vendor
rootform vendor dialects
rootform vendor policy-packs
```

When the corresponding default vendored directory exists, consuming commands
use it as the exclusive source for that project's selected content. See
the printed destination and selected Dialect or Policy Pack names to confirm
what was copied. `vendor` and both subcommands share these exit statuses: `0`
means every selected unit was copied; `1` means selected content is invalid,
missing, or differs from `rootform.lock`; `2` means the command was used
incorrectly; `3` means no content was selected, `rootform.lock` is invalid, or
`--offline` needs content that is not installed; and `4` means a file, the
Rootform home, or the registry could not be read or written. See
[External content storage](../storage.md) for the precedence
rules and [Add external content](../../guides/external-content.md)
for selection setup.
