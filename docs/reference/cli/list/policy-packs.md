---
title: "rootform list policy-packs"
description: "List selected or explicit local Policy Packs."
---

`list policy-packs` reads the current project's selection. Repeat
`--policy-pack` with a local authoring root to overlay a Policy Pack of the
same name for this invocation. Other selected Policy Packs remain active.
`--installed` reads the Rootform home without loading the project. This reports
accessible content, not remote availability.

<!-- BEGIN GENERATED CLI: rootform list policy-packs -->

## Usage

```text
rootform list policy-packs [options]
```

## Options

### Output

| Flag | Type | Default | Description |
| --- | --- | --- | --- |
| ` --format ` | ` string ` | ` "" ` | output format: `text\|wide\|json`; default: text |

### Rootform project

| Flag | Type | Default | Description |
| --- | --- | --- | --- |
| ` --policy-pack ` | ` stringArray ` | ` [] ` | add or replace the Policy Pack at `path`, a source directory or a compiled file, for this command only; repeatable |
| ` --project ` | ` string ` | ` "" ` | read rootform.lock from project `dir`; paths stay relative to the working directory; default: the working directory |

### Rootform home

| Flag | Type | Default | Description |
| --- | --- | --- | --- |
| ` --installed ` | ` bool ` | ` false ` | list versions installed in the Rootform home |

### Global options

| Flag | Type | Default | Description |
| --- | --- | --- | --- |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform list policy-packs |
| ` --color ` | ` mode ` | ` auto ` | color human output: `auto\|always\|never`; default: auto |
| ` --no-pager ` | ` bool ` | ` false ` | print a long report in full instead of opening it in less |

<!-- END GENERATED CLI -->

From a checkout of the repository, inspect the public baseline Policy Pack
without changing the project's selection.

<!-- docs-check:cli-list-packs -->
```sh
rootform list policy-packs --policy-pack ./policy-packs/baseline --format wide
rootform list policy-packs --policy-pack ./policy-packs/baseline --format json
```

The wide row reads `baseline`, version `0.1.0`, and two Policies. Default
output is one name per line. `--format wide` adds version and Policy count.
`--format json` includes exact version and content digest. Output goes to
standard output, diagnostics to standard error. Status `0` means the
definitions were listed, `2` means the command was used incorrectly, `3` means
the project selection or catalog could not be loaded, and `4` means the
Rootform home could not be read or the listing could not be written. Use
[`show policy-pack`](../show/policy-pack.md) for one Policy Pack and
[Select Dialects and Policy Packs](../../../cli.md) for project selection.
