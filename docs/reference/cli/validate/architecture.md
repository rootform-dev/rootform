---
title: "rootform validate architecture"
description: "Check architecture structure and internal consistency."
---

`validate architecture` builds from a Terraform/OpenTofu directory or reads a
saved Rootform architecture file. With no input it uses the current directory.
`-` reads architecture JSON from standard input. It checks structural
validity and internal consistency, not Policy compliance or live cloud state.

<!-- BEGIN GENERATED CLI: rootform validate architecture -->

## Usage

```text
rootform validate architecture [input] [flags]
```

## Flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --dialect ` | ` stringArray ` | ` [] ` | use a dialect source `dir` for this run; repeatable |
| ` --format ` | ` string ` | ` text ` | output `format`: text or json |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform validate architecture |

## Inherited flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --color ` | ` mode ` | ` auto ` | color human output: auto, always, never |

<!-- END GENERATED CLI -->

Replace `./infra` with a prepared project directory, or save
`architecture.json` from [Your first architecture](../../../getting-started/first-architecture.md).

```sh
rootform validate architecture ./infra
rootform validate architecture architecture.json --format json
```

Text is the default result; JSON is also available. The result goes to
standard output and diagnostics to standard error. Status `0` means valid,
`1` means invalid, `2` means incorrect command use, and `3` means validation
could not be completed. Use [`check`](../check.md) to evaluate Policies and
[Architecture IR](../../../concepts/architecture-ir.md) for document meaning.
