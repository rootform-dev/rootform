---
title: "rootform init"
description: "Initialize a Rootform project"
---

<!-- Generated from reference/cli.json. Run bun run generate:cli; do not edit this page. -->

Initialize a Rootform project.

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
| ` --official-layout ` | ` string ` | ` "" ` | use local package `layout` as official index |
| ` --offline ` | ` bool ` | ` false ` | disable network; use only local data |
| ` --policy-pack ` | ` stringArray ` | ` [] ` | select a Policy Pack OCI `reference`; repeatable |
| ` --source ` | ` stringArray ` | ` [] ` | add dialect or index `reference`; repeatable |
| ` --upgrade ` | ` bool ` | ` false ` | refresh compatible dialect versions |
| ` -v, --verbose ` | ` bool ` | ` false ` | show provider evidence and origin |

## Behavior

Detect providers, resolve Rootform dialects, install missing exact
dialect packages, and write rootform.lock. Path defaults to . and is both the
project and Terraform or OpenTofu root. Unlocked resolution includes the
official index; repeat --source to add a Rootform dialect or index registry
reference. --official-layout replaces the official index with a local package
layout while explicit sources remain additive. Repeat --policy-pack to select
an independent Policy Pack explicitly.

Machine JSON goes to standard output. Diagnostics and verbose detail go
to standard error.

## Exit status

```text
0  initialization completed
1  initialization failed
2  the command was used incorrectly
3  no deterministic initialization was available
```

## Examples

```sh
rootform init
rootform init ./infra
rootform init ./infra --official-layout ./dialects-layout
rootform init --source ghcr.io/acme/rootform/company-core:1.2.0
rootform init --policy-pack ghcr.io/acme/policies:policy-pack-baseline-0.1.0
rootform init ./infra --no-input
rootform init ./infra --locked --offline
```
