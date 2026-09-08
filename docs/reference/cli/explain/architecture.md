---
title: "rootform explain architecture"
description: "Explain an architecture element"
---

<!-- Generated from reference/cli.json. Run bun run generate:cli; do not edit this page. -->

Explain an architecture element.

## Usage

```text
rootform explain architecture <address> [flags]
```

## Flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --format ` | ` string ` | ` text ` | output `format`: text or json |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform explain architecture |
| ` --input ` | ` string ` | ` "" ` | read the architecture at `path`; - reads standard input |

Boolean flags set `true` when supplied without a value. Set the flag value to `false` to disable one. `""` means an empty string.

## Behavior

Show how an architecture element is implemented and which semantic
facts and source locations support it.

By default, explain reads the current directory. --input accepts an
infrastructure directory, a Rootform architecture file, or - for an
architecture file on standard input.

The text or JSON explanation goes to standard output. Diagnostics go to
standard error.

## Exit status

```text
0  the element was explained
1  the declaration or architecture element was not found
2  the command was used incorrectly
3  no explanation could be decided
```

## Examples

```sh
rootform explain architecture google_compute_network.vpc
rootform explain architecture kubernetes_deployment_v1.app --format json
rootform explain architecture google_compute_network.vpc --input prod.json
```

Command syntax and help are generated from the executable's command definitions. For guided tasks, start with the [reference overview](../../index.md).
