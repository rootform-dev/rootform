---
title: "rootform lsp"
description: "Serve Rootform language features over stdio"
---

<!-- Generated from reference/cli.json. Run bun run generate:cli; do not edit this page. -->

Serve Rootform language features over stdio.

## Usage

```text
rootform lsp [flags]
```

## Flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform lsp |

## Behavior

Run the Rootform language server over standard input
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
