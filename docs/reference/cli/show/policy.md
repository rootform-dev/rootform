---
title: "rootform show policy"
description: "Show a policy definition"
---

<!-- Generated from reference/cli.json. Run bun run generate:cli; do not edit this page. -->

Show a policy definition.

## Usage

```text
rootform show policy <identifier> [flags]
```

## Flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` -o, --format ` | ` string ` | ` "" ` | output `format`: text or json |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform show policy |
| ` --policy-pack ` | ` stringArray ` | ` [] ` | select local Policy Pack `directory`; repeatable |

## Inherited flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --color ` | ` mode ` | ` auto ` | color human output: auto, always, never |

## Behavior

Show a policy's target, assertion, message, Policy Pack, and source
location.

The project must select the owning Policy Pack, or --policy-pack can
supply a local root. Use &lt;policy-pack&gt;.policy.&lt;name&gt;, or a bare name
when it resolves unambiguously.

Use "rootform explain policy" to understand why a policy produced a
result for an architecture element.

The text or JSON definition goes to standard output. Diagnostics go
to standard error.

## Exit status

```text
0  the definition was shown
1  the named definition was not found
2  the command was used incorrectly
3  no single definition could be selected
```

## Examples

```sh
rootform show policy baseline.policy.cluster-network-context
rootform show policy cluster-network-context
rootform show policy cluster-network-context --policy-pack ./policies
rootform show policy baseline.policy.cluster-network-context -o json
```
