---
title: "rootform validate context"
description: "Validate a context dimension"
---

<!-- Generated from reference/cli.json. Run bun run generate:cli; do not edit this page. -->

Validate a context dimension.

## Usage

```text
rootform validate context <identifier> [flags]
```

## Flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --format ` | ` string ` | ` text ` | output `format`: text or json |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform validate context |

## Behavior

Validate a context dimension in the context of its dialect.

Use &lt;dialect&gt;/&lt;name&gt;, or a bare name when it resolves unambiguously.
The text or JSON result goes to standard output. Diagnostics go to
standard error.

## Exit status

```text
0  the definition is valid
1  the definition is not valid
2  the command was used incorrectly
3  the definition could not be validated
```

## Examples

```sh
rootform validate context core/geography
rootform validate context geography
rootform validate context core/geography --format json
```
