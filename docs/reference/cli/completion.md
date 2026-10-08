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
rootform completion <shell> [options]
```

## Options

### Global options

| Flag | Type | Default | Description |
| --- | --- | --- | --- |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform completion |
| ` --color ` | ` mode ` | ` auto ` | color human output: `auto\|always\|never`; default: auto |
| ` --no-pager ` | ` bool ` | ` false ` | print a long report in full instead of opening it in less |

<!-- END GENERATED CLI -->

```sh
rootform completion bash > rootform.bash
rootform completion zsh > _rootform
rootform completion fish > rootform.fish
rootform completion powershell > rootform.ps1
```

These examples write files in the current directory. To activate completion
in the current shell and load it in future shells, use the commands for your
shell below.

### Bash

Cobra's generated Bash script uses helpers from `bash-completion`. Load that
package before loading the generated Rootform script.

```bash
source ./rootform.bash
```

### Zsh

Initialize Zsh completions before loading Rootform's script:

```zsh
autoload -Uz compinit
compinit
source ./_rootform
```

### Fish

```fish
source ./rootform.fish
```

### PowerShell

```powershell
. ./rootform.ps1
```

For future shells, move the generated file to a stable completion directory
and source its absolute path from `~/.bashrc`, `~/.zshrc`,
`~/.config/fish/config.fish`, or your PowerShell profile. Initialize
`bash-completion` or `compinit` before loading Rootform where required.

Status `0` means the completion script was generated, `2` means the command
was used incorrectly, and `4` means the completion script could not be
written. Use
[`rootform version`](version.md) to identify the executable providing the
completion script.
