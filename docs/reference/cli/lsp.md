---
title: "rootform lsp"
description: "Serve Rootform language features over stdio"
---

<!-- Generated from reference/cli.json. Run bun run generate:cli; do not edit this page. -->

Serve Rootform language features over stdio.

## Usage

```text
rootform lsp [options]
```

## Options

### Global options

| Flag | Type | Default | Description |
| --- | --- | --- | --- |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform lsp |
| ` --color ` | ` mode ` | ` auto ` | color human output: `auto\|always\|never`; default: auto |
| ` --no-pager ` | ` bool ` | ` false ` | print a long report in full instead of opening it in less |

## Behavior

Run the Rootform language server over standard input and standard output.
Protocol frames are the only standard output. Process diagnostics go to
standard error; source diagnostics travel through LSP.

## Exit status

| Status | Description |
| --- | --- |
| `0` | the client completed shutdown and exit |
| `2` | the command was used incorrectly |
| `4` | the transport or the protocol lifecycle failed |

## Examples

```sh
rootform lsp
rootform lsp 2>rootform-lsp.log
rootform lsp <client.frames >server.frames
```

## Editor clients

Connect `rootform lsp` from [VS Code](../../integrations/vscode.md) or [Zed](../../integrations/zed.md).
