---
title: "rootform check"
description: "Evaluate selected policies against an architecture."
---

`check` builds an architecture from a Terraform/OpenTofu directory or loads a
saved architecture file. With no input it uses the current directory. A file
input, including `-` on standard input, still uses the current directory for
project Policy Pack selection. `--plan` reads a JSON plan instead of a
directory or architecture file; `--plan -` reads it from standard input.
Directory input does not acquire external content.

<!-- BEGIN GENERATED CLI: rootform check -->

## Usage

```text
rootform check [input] [flags]
```

## Flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --format ` | ` string ` | ` text ` | text/json/sarif/markdown `format` |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform check |
| ` --locked ` | ` bool ` | ` false ` | require an existing valid rootform.lock |
| ` -o, --output ` | ` string ` | ` "" ` | write the result to this `file` |
| ` --plan ` | ` file ` | ` "" ` | read JSON plan; - reads standard input |
| ` --policy ` | ` stringArray ` | ` [] ` | select pack/name or unique policy; repeatable |
| ` --policy-pack ` | ` stringArray ` | ` [] ` | select directory or compiled JSON `path`; repeatable |

## Inherited flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --color ` | ` mode ` | ` auto ` | color human output: auto, always, never |

<!-- END GENERATED CLI -->

## Select policies

By default, `check` uses Policy Packs selected by the project's lock. A
repeatable `--policy-pack` instead selects local source directories or compiled
JSON packs for this invocation, replacing the project selection. A compiled
pack retains its semantic pins. Repeatable `--policy` narrows evaluation to
qualified `pack/name` identifiers or unique policy names. `--policy-pack` and
`--locked` cannot be combined; neither a pack override nor a missing lock
silently establishes compliance.

```sh
rootform check ./infra --policy-pack ./policies
rootform check architecture.json --policy-pack ./policies --policy cluster-network-context
rootform check ./infra --policy-pack ./policies --format sarif --output result.sarif
```

The default `text` report goes to standard output. `json`, `markdown`, and
`sarif` are also available; `--output` writes the selected report to a file.
Operational diagnostics go to standard error. Status `0` requires every
selected policy to have been evaluated and passed. Status `1` means a confirmed
violation, even if other results are indeterminate. Status `2` means incorrect
command use. Status `3` means no compliant verdict, including zero selected
policies, zero evaluations, or a selected policy without targets when no
violation is confirmed.

See [Run checks](../../guides/check-architecture.md) for a complete local pack
example and [Outputs and exit status](../outputs.md) for report handling.
