---
title: "rootform show relation"
description: "Show a relation predicate"
---

<!-- Generated from reference/cli.json. Run bun run generate:cli; do not edit this page. -->

Show a relation predicate.

## Usage

```text
rootform show relation <identifier> [flags]
```

## Flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --format ` | ` string ` | ` text ` | output `format`: text or json |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform show relation |

## Behavior

Show a relation predicate, ownership, producers, and concept pairs.

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
rootform show relation google/private-access
rootform show relation private-access
rootform show relation google/private-access --format json
```
