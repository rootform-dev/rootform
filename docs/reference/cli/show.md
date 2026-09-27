---
title: "rootform show"
description: "Inspect one Dialect or RF Vocabulary definition."
---

`show` displays an active Dialect, the RF Vocabulary, or one declaration.
A bare owner such as `google` shows that owner and its declarations. Use a
qualified `owner.kind.name` such as `google.rule.cloud-sql-instance` for one
declaration; a bare declaration name works only when unambiguous. These are
definition identifiers, not Terraform resource addresses.

<!-- BEGIN GENERATED CLI: rootform show -->

## Usage

```text
rootform show <name> [options]
rootform show <command> [options]
```

## Options

### Output

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --format ` | ` string ` | ` "" ` | output format: `text\|json`; default: text |

### Rootform project

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --dialect ` | ` stringArray ` | ` [] ` | use Dialect source `dir` for this command only; repeatable |
| ` --project ` | ` string ` | ` "" ` | read rootform.lock from project `dir`; paths stay relative to the working directory; default: the working directory |

### Global options

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform show |
| ` --color ` | ` mode ` | ` auto ` | color human output: `auto\|always\|never`; default: auto |

## Subcommands

| Command | Purpose |
| --- | --- |
| [` rootform show policy `](show/policy.md) | Show a Policy definition |
| [` rootform show policy-pack `](show/policy-pack.md) | Show a Policy Pack |

<!-- END GENERATED CLI -->

<!-- docs-check:cli-show -->
```sh
rootform show google.rule.cloud-sql-instance
rootform show rf.concept.virtual-network --format json
```

The first result prints the Rule's match and emissions. The JSON result
identifies the RF Vocabulary Concept without evaluating any instance.
`--dialect <dir>` overlays one Dialect owner for this inspection and leaves
`rootform.lock` unchanged. Repeat it for different owners.

Text or JSON goes to standard output, diagnostics to standard error. Status
`0` means the definition was shown; `1` means it was not found; `2` means
incorrect usage; `3` means the selection was unavailable or the name was
ambiguous; `4` means the definition could not be written. Use
[`list dialects`](list/dialects.md) to see available owners or
[`explain rule`](explain/rule.md) with `--input` to trace an application.
