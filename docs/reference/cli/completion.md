---
title: "rootform completion"
description: "Generate completion for a supported shell."
---

`completion` writes a script for Bash, Zsh, Fish, or PowerShell to standard
output; diagnostics go to standard error. Choose the shell you actually use,
then save or load the result according to that shell's completion setup.

<!-- BEGIN GENERATED CLI: rootform completion -->

## Usage

```text
rootform completion <shell> [flags]
```

## Flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform completion |

## Inherited flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --color ` | ` mode ` | ` auto ` | color human output: auto, always, never |

<!-- END GENERATED CLI -->

```sh
rootform completion bash > rootform.bash
rootform completion zsh > _rootform
rootform completion fish > rootform.fish
rootform completion powershell > rootform.ps1
```

These examples write files in the current directory; move them to a
completion directory configured by your shell. Status `0` means generated,
`1` means generation failed, and `2` means incorrect command use. Use
[`rootform version`](version.md) to identify the executable providing the
completion script.
