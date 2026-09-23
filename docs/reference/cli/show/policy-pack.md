---
title: "rootform show policy-pack"
description: "Inspect one selected or local Policy Pack."
---

`show policy-pack` displays a pack's version, declared policies, content
identity, and source location. It reads the current project's selection by
default. Repeat `--policy-pack` with local authoring roots to replace that
selection for this invocation; the positional name chooses one loaded pack.

<!-- BEGIN GENERATED CLI: rootform show policy-pack -->

## Usage

```text
rootform show policy-pack <name> [flags]
```

## Flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` -o, --format ` | ` string ` | ` "" ` | output `format`: text or json |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform show policy-pack |
| ` --policy-pack ` | ` stringArray ` | ` [] ` | select local Policy Pack `directory`; repeatable |

## Inherited flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --color ` | ` mode ` | ` auto ` | color human output: auto, always, never |

<!-- END GENERATED CLI -->

After creating `./policies` in [Run checks](../../../guides/check-architecture.md):

<!-- docs-check:cli-show-policy-pack -->
```sh
rootform show policy-pack tutorial --policy-pack ./policies
rootform show policy-pack tutorial --policy-pack ./policies -o json
```

Text or JSON goes to standard output, diagnostics to standard error. Status
`0` means shown, `1` means name not found, `2` means incorrect use, and `3`
means no single pack could be selected. Use
[`list policy-packs`](../list/policy-packs.md) for the available names and
[Select Dialects and Policy Packs](../../../cli.md) for project selection.
