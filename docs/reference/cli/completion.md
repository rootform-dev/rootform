---
title: "rootform completion"
description: "Generate shell completion"
---

<!-- Generated from reference/cli.json. Run bun run generate:cli; do not edit this page. -->

Generate shell completion.

## Usage

```text
rootform completion <shell> [flags]
```

## Flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform completion |

## Behavior

Generate a completion script for bash, zsh, fish, or PowerShell.

The script goes to standard output. Diagnostics go to standard error.

## Exit status

```text
0  the completion script was generated
1  the completion script could not be generated
2  the command was used incorrectly
```

## Examples

```sh
rootform completion bash > /usr/local/etc/bash_completion.d/rootform
rootform completion zsh > "${fpath[1]}/_rootform"
rootform completion fish > ~/.config/fish/completions/rootform.fish
```
