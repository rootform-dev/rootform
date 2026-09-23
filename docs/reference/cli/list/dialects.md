---
title: "rootform list dialects"
description: "List embedded and project-selected Dialects."
---

`list dialects` reads the effective local Dialect catalog: content embedded
in Rootform plus Dialects selected by the current project. Without
`--dialect`, it lists all loaded owners. Repeat `--dialect` to select owners.
This option filters the listing, not the project's lock.

<!-- BEGIN GENERATED CLI: rootform list dialects -->

## Usage

```text
rootform list dialects [flags]
```

## Flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --dialect ` | ` stringArray ` | ` [] ` | limit results to this dialect `name`; repeatable |
| ` -o, --format ` | ` string ` | ` "" ` | output `format`: text, wide, or json |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform list dialects |

## Inherited flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --color ` | ` mode ` | ` auto ` | color human output: auto, always, never |

<!-- END GENERATED CLI -->

```sh
rootform list dialects --dialect aws --dialect google -o wide
rootform list dialects -o json
```

Default output is one name per line. `-o wide` adds version, origin, and
declaration counts; `-o json` includes exact identity and digest. Output goes
to standard output, diagnostics to standard error. Status `0` means listed,
`2` means incorrect use, and `3` means selected definitions could not be
read. See [Dialects and RF Vocabulary](../../../concepts/dialects.md).
