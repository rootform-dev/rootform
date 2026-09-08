---
title: Install Rootform
description: Install Rootform on macOS, Linux, or Windows and verify the executable.
---

Rootform is one executable. It needs no Node.js, Python, Terraform, OpenTofu, or
cloud credentials to render [your first architecture](getting-started/first-architecture.md).
The first project run downloads the required Dialects unless they are already
available locally.

<!-- rootform:tabs Operating system -->
<!-- rootform:tab macOS -->

## macOS

### Recommended: install script

```sh
curl -fsSL https://rootform.dev/install | sh
rootform version
```

### Other options

Install with Homebrew:

```sh
brew install --cask rootform
rootform version
```

For an exact archive and checksum, use [manual installation](#manual-installation).

<!-- rootform:tab Linux -->

## Linux

### Recommended: install script

```sh
curl -fsSL https://rootform.dev/install | sh
rootform version
```

### Other options

For an exact archive and checksum, use [manual installation](#manual-installation).

<!-- rootform:tab Windows -->

## Windows

### Recommended: PowerShell installer

```powershell
irm https://rootform.dev/install.ps1 | iex
rootform version
```

### Other options

Install with WinGet:

```powershell
winget install --id Rootform.Rootform --exact
rootform version
```

For an exact ZIP and checksum, use [manual installation](#manual-installation).

<!-- rootform:endtabs -->

## Container

Run the versioned image from GHCR:

```sh
docker run --rm ghcr.io/rootform-dev/rootform:0.1.0 rootform version
```

The [container guide](integrations/oci-image.md) covers project mounts,
persistent package storage, private registries, and offline execution. Use an
exact version or digest for repeatable runs.

## Manual installation

Download the archive for your platform and `SHA256SUMS` from the
[v0.1.0 release](https://github.com/rootform-dev/rootform/releases/tag/v0.1.0).

| Platform | Archive |
| --- | --- |
| macOS, Apple silicon | `rootform_0.1.0_darwin_arm64.tar.gz` |
| macOS, Intel | `rootform_0.1.0_darwin_amd64.tar.gz` |
| Linux, x86-64 | `rootform_0.1.0_linux_amd64.tar.gz` |
| Linux, ARM64 | `rootform_0.1.0_linux_arm64.tar.gz` |
| Windows, x86-64 | `rootform_0.1.0_windows_amd64.zip` |

### macOS archive

This example uses Apple silicon. Replace the filename with the Intel archive when
needed.

```sh
shasum -a 256 rootform_0.1.0_darwin_arm64.tar.gz
```

Compare the complete hash with the matching `SHA256SUMS` entry, then install:

```sh
tar -xzf rootform_0.1.0_darwin_arm64.tar.gz
mkdir -p "$HOME/.local/bin"
install -m 755 rootform "$HOME/.local/bin/rootform"
export PATH="$HOME/.local/bin:$PATH"
rootform version
```

Persist `~/.local/bin` in `PATH` if needed.

### Linux archive

This example uses x86-64. Replace the filename with the ARM64 archive when needed.

```sh
sha256sum rootform_0.1.0_linux_amd64.tar.gz
```

Compare the complete hash with the matching `SHA256SUMS` entry, then install:

```sh
tar -xzf rootform_0.1.0_linux_amd64.tar.gz
mkdir -p "$HOME/.local/bin"
install -m 755 rootform "$HOME/.local/bin/rootform"
export PATH="$HOME/.local/bin:$PATH"
rootform version
```

Persist `~/.local/bin` in `PATH` if needed.

### Windows ZIP

In PowerShell:

```powershell
Get-FileHash .\rootform_0.1.0_windows_amd64.zip -Algorithm SHA256
```

Compare the complete hash with the matching `SHA256SUMS` entry, then install:

```powershell
Expand-Archive .\rootform_0.1.0_windows_amd64.zip -DestinationPath .\rootform-release
New-Item -ItemType Directory -Force "$env:LOCALAPPDATA\Rootform\bin"
Copy-Item .\rootform-release\rootform.exe "$env:LOCALAPPDATA\Rootform\bin\rootform.exe"
$env:Path = "$env:LOCALAPPDATA\Rootform\bin;$env:Path"
rootform version
```

Add `%LOCALAPPDATA%\Rootform\bin` to your user `Path`, then open a new terminal.

Release archives include the Rootform binary license and third-party notices.
Keep each archive with `SHA256SUMS` from the same release; never verify one
release with another release's checksum file.

## Verify installation

```sh
rootform version
```

Rootform v0.1.0 prints:

```text
rootform 0.1.0
```

If the command is missing or the version differs, follow
[installation troubleshooting](troubleshooting/index.md#the-command-is-missing-or-an-older-version-runs).
Then continue to [your first architecture](getting-started/first-architecture.md).
