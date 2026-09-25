---
title: "rootform list dialects"
description: "List embedded and project-selected Dialects."
---

`list dialects` reads active Dialects: embedded content plus project
selections and any `--dialect <dir>` override. Positional owner names filter
the listing. `--installed` instead reads exact versions in the Rootform home
without loading a project.

<!-- BEGIN GENERATED CLI: rootform list dialects -->

## Usage

```text
rootform list dialects [name]... [flags]
```

## Flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --dialect ` | ` stringArray ` | ` [] ` | use a dialect source `dir` for this run; repeatable |
| ` -o, --format ` | ` string ` | ` "" ` | output `format`: text, wide, or json |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform list dialects |
| ` --installed ` | ` bool ` | ` false ` | list versions installed in the Rootform home |

## Inherited flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --color ` | ` mode ` | ` auto ` | color human output: auto, always, never |

<!-- END GENERATED CLI -->

<!-- docs-check:cli-list-dialect-owners -->
```sh
rootform list dialects aws google -o wide
rootform list dialects --installed -o wide
rootform list dialects -o json
```

Default output is one name per line. `-o wide` adds version, origin, and
declaration counts; `-o json` includes exact identity and digest. Output goes
to standard output, diagnostics to standard error. Status `0` means listed,
`2` means incorrect use, and `3` means selected definitions could not be
read. See [Dialects and RF Vocabulary](../../../concepts/dialects.md).
