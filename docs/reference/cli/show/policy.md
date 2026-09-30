---
title: "rootform show policy"
description: "Inspect one Policy definition without evaluating it."
---

`show policy` displays a Policy's target, assertion, message, owning Policy
Pack, and source location. It reads the project-selected Policy Pack by
default. Repeat `--policy-pack` with local authoring roots to overlay Policy
Packs of the same names for this invocation. Other selected Policy Packs
remain active. Use a qualified identifier such as
`tutorial.policy.subnet-network-context`, or a bare name when unambiguous.

<!-- BEGIN GENERATED CLI: rootform show policy -->

## Usage

```text
rootform show policy <identifier> [options]
```

## Options

### Output

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --format ` | ` string ` | ` "" ` | output format: `text\|json`; default: text |

### Rootform project

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --policy-pack ` | ` stringArray ` | ` [] ` | add or replace the Policy Pack at `path`, a source directory or a compiled file, for this command only; repeatable |
| ` --project ` | ` string ` | ` "" ` | read rootform.lock from project `dir`; paths stay relative to the working directory; default: the working directory |

### Global options

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform show policy |
| ` --color ` | ` mode ` | ` auto ` | color human output: `auto\|always\|never`; default: auto |
| ` --no-pager ` | ` bool ` | ` false ` | print a long report in full instead of opening it in less |

<!-- END GENERATED CLI -->

From a checkout of the repository, inspect one baseline definition. The
command shows its target and assertion without evaluating a plan.

<!-- docs-check:cli-show-policy -->
```sh
rootform show policy cluster-network-context --policy-pack ./policy-packs/baseline
rootform show policy baseline.policy.cluster-network-context --policy-pack ./policy-packs/baseline --format json
```

The definition names `rf.concept.kubernetes-cluster` as its target. Text or
JSON goes to standard output, diagnostics to standard error. Status `0` means
the definition was shown, `1` means the named definition was not found,
`2` means the command was used incorrectly, `3` means the selection was
unavailable or the name was ambiguous, and `4` means the definition could not
be written. This does not evaluate the Policy. Use
[`explain policy`](../explain/policy.md) with `--result` to explain an outcome
that `check` recorded in a saved Policy result, or see
[Understand Policy outcomes](../../../guides/check-architecture.md) for a full
report. See the [`check` CLI reference](../check.md).
