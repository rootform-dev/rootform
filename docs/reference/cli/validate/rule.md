---
title: "rootform validate rule"
description: "Validate a rule definition"
---

<!-- Generated from reference/cli.json. Run bun run generate:cli; do not edit this page. -->

Validate a rule definition.

## Usage

```text
rootform validate rule <identifier> [flags]
```

## Flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --format ` | ` string ` | ` text ` | output `format`: text or json |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform validate rule |

## Behavior

Validate a rule and its references in the context of its dialect.

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
rootform validate rule google/cloud-sql-instance
rootform validate rule cloud-sql-instance
rootform validate rule google/cloud-sql-instance --format json
```
