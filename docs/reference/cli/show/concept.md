---
title: "rootform show concept"
description: "Show a concept definition"
---

<!-- Generated from reference/cli.json. Run bun run generate:cli; do not edit this page. -->

Show a concept definition.

## Usage

```text
rootform show concept <identifier> [flags]
```

## Flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --format ` | ` string ` | ` text ` | output `format`: text or json |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform show concept |

## Behavior

Show a concept's kind, description, dialect, and source location.

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
rootform show concept core/virtual-network
rootform show concept virtual-network
rootform show concept core/virtual-network --format json
```
