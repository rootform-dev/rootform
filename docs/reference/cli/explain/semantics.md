---
title: "rootform explain semantics"
description: "Explain a semantic interpretation"
---

<!-- Generated from reference/cli.json. Run bun run generate:cli; do not edit this page. -->

Explain a semantic interpretation.

## Usage

```text
rootform explain semantics <identifier> [flags]
```

## Flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --format ` | ` string ` | ` text ` | output `format`: text or json |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform explain semantics |

Boolean flags set `true` when supplied without a value. Set the flag value to `false` to disable one. `""` means an empty string.

## Behavior

Show how a source declaration was interpreted, including the matching
rule and the architecture it produced.

The current directory supplies the architecture.
Use &lt;dialect&gt;/&lt;name&gt;, or a bare name when it resolves unambiguously.

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
rootform explain semantics google/cloud-sql-instance
rootform explain semantics cloud-sql-instance
rootform explain semantics google/cloud-sql-instance --format json
```

Command syntax and help are generated from the executable's command definitions. For guided tasks, start with the [reference overview](../../index.md).
