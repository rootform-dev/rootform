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
rootform list dialects [name]... [options]
```

## Options

### Output

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --format ` | ` string ` | ` "" ` | output format: `text\|wide\|json`; default: text |

### Rootform project

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --dialect ` | ` stringArray ` | ` [] ` | use Dialect source `dir` for this command only; repeatable |
| ` --project ` | ` string ` | ` "" ` | read rootform.lock from project `dir`; paths stay relative to the working directory; default: the working directory |

### Rootform home

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --installed ` | ` bool ` | ` false ` | list versions installed in the Rootform home |

### Global options

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform list dialects |
| ` --color ` | ` mode ` | ` auto ` | color human output: `auto\|always\|never`; default: auto |

<!-- END GENERATED CLI -->

<!-- docs-check:cli-list-dialect-owners -->
```sh
rootform list dialects aws google --format wide
rootform list dialects --installed --format wide
rootform list dialects --format json
```

Default output is one name per line. `--format wide` adds version, origin,
and declaration counts; `--format json` includes exact identity and digest.
`aws` and `google` show `embedded` as their origin; JSON records it with the
Form's semantic origin value, `supplied`. A fresh Rootform home gives no rows
for `--installed`; this does not remove embedded Dialects. Output goes to
standard output, diagnostics to standard error. Status `0` means the
definitions were listed, `1` means a named Dialect is not loaded, `2` means the
command was used incorrectly, `3` means the project selection or catalog could
not be loaded, and `4` means the Rootform home could not be read or the listing
could not be written. See
[Dialects and RF Vocabulary](../../../concepts/dialects.md).
