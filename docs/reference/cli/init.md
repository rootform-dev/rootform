---
title: "rootform init"
description: "Prepare a Rootform project"
---

<!-- Generated from reference/cli.json. Run bun run generate:cli; do not edit this page. -->

Prepare a Rootform project.

## Usage

```text
rootform init [path] [flags]
```

## Flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --format ` | ` string ` | ` text ` | output `format`: text or json |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform init |
| ` --locked ` | ` bool ` | ` false ` | require and preserve the existing rootform.lock |
| ` --no-input ` | ` bool ` | ` false ` | never prompt; require deterministic action |
| ` --offline ` | ` bool ` | ` false ` | disable network; use only local data |
| ` -v, --verbose ` | ` bool ` | ` false ` | show provider evidence and origin |

## Behavior

Prepare an existing rootform.lock and materialize the project's exact
non-embedded selections (dialects and Policy Pack sources) locally.

init is explicit: it never detects providers, selects another version,
or writes rootform.lock. With --locked the existing rootform.lock is
required and valid; without it, a missing lock is an empty selection
and an existing lock is always preserved. Supplied dialects ship
inside the release set and are never acquired. When network access is
available and not disabled by --offline, init fetches only the exact
manifest digests already pinned by rootform.lock.

Path defaults to . and is both the project and Terraform or OpenTofu
root. Machine JSON goes to standard output. Diagnostics and verbose
detail go to standard error.

## Exit status

```text
0  preparation completed
1  preparation failed
2  the command was used incorrectly
3  no deterministic preparation was available
```

## Examples

```sh
rootform init
rootform init ./infra
rootform init ./infra --locked --offline
rootform init ./infra --no-input
rootform init ./infra --format json
```
