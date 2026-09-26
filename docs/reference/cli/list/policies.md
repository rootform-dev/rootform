---
title: "rootform list policies"
description: "List policies declared by selected or explicit local packs."
---

`list policies` reads Policy Packs selected by the current project. Repeat
`--policy-pack` with local authoring roots to overlay packs of the same
name for this listing. Other selected packs remain active. It does not discover remote packs or evaluate policies.

<!-- BEGIN GENERATED CLI: rootform list policies -->

## Usage

```text
rootform list policies [flags]
```

## Flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` -o, --format ` | ` string ` | ` "" ` | output `format`: text, wide, or json |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform list policies |
| ` --policy-pack ` | ` stringArray ` | ` [] ` | select local Policy Pack `dir`; repeatable |

## Inherited flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --color ` | ` mode ` | ` auto ` | color human output: auto, always, never |

<!-- END GENERATED CLI -->

From a checkout of the repository, inspect the public baseline Pack. The
override reads it for this command without selecting it in `rootform.lock`.

<!-- docs-check:cli-list-policies -->
```sh
rootform list policies --policy-pack ./policy-packs/baseline -o wide
rootform list policies --policy-pack ./policy-packs/baseline -o json
```

The wide list includes `baseline.policy.cluster-network-context` and its
target Concept. Default output is one qualified policy name per line. `-o wide` adds targets.
`-o json` includes owner and target. Output goes to standard output,
diagnostics to standard error. Status `0` means listed, `2` means incorrect
use, and `3` means selected definitions could not be read. To inspect one
definition, use [`show policy`](../show/policy.md); to evaluate it, see
[Run checks](../../../guides/check-architecture.md).
