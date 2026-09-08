---
title: "rootform lsp"
description: "Serve Rootform Language over stdio"
---

<!-- Generated from reference/cli.json. Run bun run generate:cli; do not edit this page. -->

Serve Rootform Language over stdio.

## Usage

```text
rootform lsp [flags]
```

## Flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform lsp |

Boolean flags set `true` when supplied without a value. Set the flag value to `false` to disable one. `""` means an empty string.

## Behavior

Run the Rootform Language Server Protocol service over standard input
and standard output. Protocol frames are the only standard output. Process
diagnostics go to standard error; source diagnostics travel through LSP.

## Exit status

```text
0  the client completed shutdown and exit
1  transport or lifecycle failed
2  the command was used incorrectly
```

## Examples

```sh
rootform lsp
rootform lsp 2>rootform-lsp.log
rootform lsp <client.frames >server.frames
```

Command syntax and help are generated from the executable's command definitions. For guided tasks, start with the [reference overview](../index.md).
