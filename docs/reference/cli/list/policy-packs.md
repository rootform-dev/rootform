---
title: "rootform list policy-packs"
description: "List selected or explicit local Policy Packs."
---

`list policy-packs` reads the current project's selection. Repeat
`--policy-pack` with local authoring roots to overlay packs of the same
name for this invocation. Other selected packs remain active. `--installed`
reads the Rootform home without loading the project. This reports accessible content, not remote availability.

<!-- BEGIN GENERATED CLI: rootform list policy-packs -->

## Usage

```text
rootform list policy-packs [flags]
```

## Flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` -o, --format ` | ` string ` | ` "" ` | output `format`: text, wide, or json |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform list policy-packs |
| ` --installed ` | ` bool ` | ` false ` | list versions installed in the Rootform home |
| ` --policy-pack ` | ` stringArray ` | ` [] ` | select local Policy Pack `dir`; repeatable |

## Inherited flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --color ` | ` mode ` | ` auto ` | color human output: auto, always, never |

<!-- END GENERATED CLI -->

Create `./policies` as in [Run checks](../../../guides/check-architecture.md)
before using the explicit pack example. Without that option, `list` reads the
current project's selection.

<!-- docs-check:cli-list-packs -->
```sh
rootform list policy-packs --policy-pack ./policies -o wide
rootform list policy-packs -o json
```

Default output is one name per line. `-o wide` adds version and policy count.
`-o json` includes exact version and content digest. Output goes to standard
output, diagnostics to standard error. Status `0` means listed, `2` means
incorrect use, and `3` means selected definitions could not be read. Use
[`show policy-pack`](../show/policy-pack.md) for one pack and
[Select Dialects and Policy Packs](../../../cli.md) for project selection.
