---
title: "rootform vendor"
description: "Copy exact selected external content into a project-local destination."
---

`vendor` reads the current project's `rootform.lock` and materializes its
non-embedded selections. Choose `dialects` or `policy-packs`; each has its own
destination. It does not choose versions or change the lock. Run it from the
project root whose selection you intend to copy.

<!-- BEGIN GENERATED CLI: rootform vendor -->

## Usage

```text
rootform vendor <object> [flags]
```

## Flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform vendor |

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

Run these commands from a project whose `rootform.lock` selects content for the
corresponding family. An empty selection has nothing to vendor.

```sh
rootform vendor dialects
rootform vendor policy-packs
```

When the corresponding default vendored directory exists, consuming commands
use it as the exclusive source for that project's selected content. See
[Locks and vendored content](../../offline-security.md) for the precedence
rules and [Use external Dialects and Policy Packs](../../guides/external-content.md)
for selection setup.
