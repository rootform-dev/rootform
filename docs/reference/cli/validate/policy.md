---
title: "rootform validate policy"
description: "Validate a policy definition"
---

<!-- Generated from reference/cli.json. Run bun run generate:cli; do not edit this page. -->

Validate a policy definition.

## Usage

```text
rootform validate policy <identifier> [flags]
```

## Flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --format ` | ` string ` | ` text ` | output `format`: text or json |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform validate policy |

## Behavior

Validate a policy definition in its selected Policy Pack.

The project must select the Policy Pack that owns the policy.
Use &lt;policy-pack&gt;/&lt;name&gt;, or a bare name when it resolves unambiguously.
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
rootform validate policy baseline/private-database-reachability
rootform validate policy private-database-reachability
rootform validate policy baseline/private-database-reachability --format json
```
