---
title: "rootform validate relation"
description: "Validate a relation predicate"
---

<!-- Generated from reference/cli.json. Run bun run generate:cli; do not edit this page. -->

Validate a relation predicate.

## Usage

```text
rootform validate relation <identifier> [flags]
```

## Flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --format ` | ` string ` | ` text ` | output `format`: text or json |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform validate relation |

## Behavior

Validate a relation and every compiled producer reference.

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
rootform validate relation google/private-access
rootform validate relation private-access
rootform validate relation google/private-access --format json
```
