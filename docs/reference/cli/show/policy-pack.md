---
title: "rootform show policy-pack"
description: "Inspect one selected or local Policy Pack."
---

`show policy-pack` displays a Policy Pack's version, declared Policies,
content identity, and source location. It reads the current project's
selection by default. Repeat `--policy-pack` with local authoring roots to
overlay Policy Packs of the same names for this invocation. Other selected
Policy Packs remain active; the positional name chooses one loaded Policy Pack.

<!-- BEGIN GENERATED CLI: rootform show policy-pack -->

## Usage

```text
rootform show policy-pack <name> [options]
```

## Options

### Output

| Flag | Type | Default | Description |
| --- | --- | --- | --- |
| ` --format ` | ` string ` | ` "" ` | output format: `text\|json`; default: text |

### Rootform project

| Flag | Type | Default | Description |
| --- | --- | --- | --- |
| ` --policy-pack ` | ` stringArray ` | ` [] ` | add or replace the Policy Pack at `path`, a source directory or a compiled file, for this command only; repeatable |
| ` --project ` | ` string ` | ` "" ` | read rootform.lock from project `dir`; paths stay relative to the working directory; default: the working directory |

### Global options

| Flag | Type | Default | Description |
| --- | --- | --- | --- |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform show policy-pack |
| ` --color ` | ` mode ` | ` auto ` | color human output: `auto\|always\|never`; default: auto |
| ` --no-pager ` | ` bool ` | ` false ` | print a long report in full instead of opening it in less |

<!-- END GENERATED CLI -->

From a checkout of the repository, inspect the public baseline Policy Pack.
This shows identity and contained Policies; it does not evaluate them.

<!-- docs-check:cli-show-policy-pack -->
```sh
rootform show policy-pack baseline --policy-pack ./policy-packs/baseline
rootform show policy-pack baseline --policy-pack ./policy-packs/baseline --format json
```

The result names version `0.1.0` and two Policies. Text or JSON goes to
standard output, diagnostics to standard error. Status `0` means the definition
was shown, `1` means the named definition was not found, `2` means the command
was used incorrectly, `3` means the selection was unavailable or the name was
ambiguous, and `4` means the definition could not be written. Use
[`list policy-packs`](../list/policy-packs.md) for available Policy Pack names
and [Select Dialects and Policy Packs](../../../cli.md) for project selection.
