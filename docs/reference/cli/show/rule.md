---
title: "rootform show rule"
description: "Show a rule definition"
---

<!-- Generated from reference/cli.json. Run bun run generate:cli; do not edit this page. -->

Show a rule definition.

## Usage

```text
rootform show rule <identifier> [flags]
```

## Flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --format ` | ` string ` | ` text ` | output `format`: text or json |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform show rule |

## Behavior

Show what a rule matches, the concept it produces, and the
architectural facts it declares.

Use &lt;dialect&gt;/&lt;name&gt;, or a bare name when it resolves unambiguously.

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
rootform show rule google/cloud-sql-instance
rootform show rule cloud-sql-instance
rootform show rule google/cloud-sql-instance --format json
```
