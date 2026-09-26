---
title: "rootform show policy-pack"
description: "Inspect one selected or local Policy Pack."
---

`show policy-pack` displays a pack's version, declared policies, content
identity, and source location. It reads the current project's selection by
default. Repeat `--policy-pack` with local authoring roots to overlay packs
of the same names for this invocation. Other selected packs remain active;
the positional name chooses one loaded pack.

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
| ` --policy-pack ` | ` stringArray ` | ` [] ` | select local Policy Pack `dir`; repeatable |

## Inherited flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --color ` | ` mode ` | ` auto ` | color human output: auto, always, never |

<!-- END GENERATED CLI -->

From a checkout of the repository, inspect the public baseline Pack. This
shows identity and contained Policies; it does not evaluate them.

<!-- docs-check:cli-show-policy-pack -->
```sh
rootform show policy-pack baseline --policy-pack ./policy-packs/baseline
rootform show policy-pack baseline --policy-pack ./policy-packs/baseline -o json
```

The result names version `0.1.0` and two Policies. Text or JSON goes to
standard output, diagnostics to standard error. Status
`0` means shown, `1` means name not found, `2` means incorrect use, and `3`
means no single pack could be selected. Use
[`list policy-packs`](../list/policy-packs.md) for the available names and
[Select Dialects and Policy Packs](../../../cli.md) for project selection.
