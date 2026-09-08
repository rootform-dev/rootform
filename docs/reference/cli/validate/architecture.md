---
title: "rootform validate architecture"
description: "Validate an architecture"
---

<!-- Generated from reference/cli.json. Run bun run generate:cli; do not edit this page. -->

Validate an architecture.

## Usage

```text
rootform validate architecture [input] [flags]
```

## Flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --format ` | ` string ` | ` text ` | output `format`: text or json |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform validate architecture |

## Behavior

Build or load an architecture and check that it is structurally valid
and internally consistent.

The input can be an infrastructure directory, a Rootform architecture
file, or - for an architecture file on standard input. With no input,
validation reads the current directory.

The text or JSON result goes to standard output. Diagnostics go to
standard error.

## Exit status

```text
0  the architecture is valid
1  the architecture is not valid
2  the command was used incorrectly
3  the architecture could not be validated
```

## Examples

```sh
rootform validate architecture
rootform validate architecture architecture.json
cat architecture.json | rootform validate architecture -
```
