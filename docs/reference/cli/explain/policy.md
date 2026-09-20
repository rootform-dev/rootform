---
title: "rootform explain policy"
description: "Explain a policy result"
---

<!-- Generated from reference/cli.json. Run bun run generate:cli; do not edit this page. -->

Explain a policy result.

## Usage

```text
rootform explain policy <identifier> [flags]
```

## Flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --format ` | ` string ` | ` text ` | output `format`: text or json |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform explain policy |

## Inherited flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --color ` | ` mode ` | ` auto ` | color human output: auto, always, never |

## Behavior

Show why a policy passed, failed, or could not be evaluated for an
architecture element.

The current directory supplies the architecture.
The project must select the Policy Pack that owns the policy.
Use &lt;policy-pack&gt;.policy.&lt;name&gt;, or a bare name when it resolves unambiguously.

The text or JSON explanation goes to standard output. Diagnostics go to
standard error.

## Exit status

```text
0  the result was explained
1  the named definition was not found
2  the command was used incorrectly
3  no explanation could be decided
```

## Examples

```sh
rootform explain policy baseline.policy.cluster-network-context
rootform explain policy cluster-network-context
rootform explain policy baseline.policy.cluster-network-context --format json
```
