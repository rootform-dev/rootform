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
| ` --format ` | ` string ` | ` text ` | output `format`: text or json |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform show policy |
| ` --policy-pack ` | ` stringArray ` | ` [] ` | select local Policy Pack `directory`; repeatable |

## Behavior

Show a policy's target, assertion, message, Policy Pack, and source
location.

Use "rootform explain policy" to understand why a policy produced a
result for an architecture element.

Use &lt;policy-pack&gt;/&lt;name&gt;, or a bare name when unambiguous.

The text or JSON definition goes to standard output. Diagnostics go to
standard error.

## Exit status

```text
0  the definition was shown
1  the named definition was not found
2  the command was used incorrectly
3  no single definition could be selected
```

## Examples

```sh
rootform show policy baseline/database-private-connectivity
rootform show policy database-private-connectivity
rootform show policy baseline/database-private-connectivity --format json
```
