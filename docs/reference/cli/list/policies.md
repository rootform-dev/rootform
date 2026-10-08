---
title: "rootform list policies"
description: "List Policies in selected or local Policy Packs."
---

`list policies` reads Policy Packs selected by the current project. Repeat
`--policy-pack` with local authoring roots to overlay Policy Packs of the same
name for this listing. Other selected Policy Packs remain active. It does not
discover remote Policy Packs or evaluate Policies.

<!-- BEGIN GENERATED CLI: rootform list policies -->

## Usage

```text
rootform list policies [options]
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

### Global options

| Flag | Type | Default | Description |
| --- | --- | --- | --- |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform list policies |
| ` --color ` | ` mode ` | ` auto ` | color human output: `auto\|always\|never`; default: auto |
| ` --no-pager ` | ` bool ` | ` false ` | print a long report in full instead of opening it in less |

<!-- END GENERATED CLI -->

From a checkout of the repository, inspect the public baseline Policy Pack.
The override reads it for this command without selecting it in `rootform.lock`.

<!-- docs-check:cli-list-policies -->
```sh
rootform list policies --policy-pack ./policy-packs/baseline --format wide
rootform list policies --policy-pack ./policy-packs/baseline --format json
```

The wide list includes `baseline.policy.cluster-network-context` and its
target Concept. Default output is one qualified Policy name per line.
`--format wide` adds targets. `--format json` includes owner and target.
Output goes to standard output, diagnostics to standard error. Status `0` means
the definitions were listed, `2` means the command was used incorrectly,
`3` means the project selection or catalog could not be loaded, and `4` means
the listing could not be written. To inspect one definition, use
[`show policy`](../show/policy.md); to evaluate it, see
[Understand Policy outcomes](../../../guides/check-architecture.md) or the
[`check` CLI reference](../check.md).
