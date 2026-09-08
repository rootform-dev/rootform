---
title: "Install Rootform"
description: "Install Rootform on macOS, Linux, or Windows, choose a version, and verify the executable."
---

Rootform is one executable. It needs no Node.js, Python, Terraform, or cloud
credentials to render the [first architecture](getting-started/first-architecture.md).
The first project run needs access to its Dialect registry unless those packages
are already available locally.

## Available release

[GitHub Releases](https://github.com/rootform-dev/rootform/releases/tag/v0.1.1)
provides verified archives for **v0.1.1**. Download the archive for your system
and `SHA256SUMS` from the same release.

**Installation preview:** the script and Homebrew commands below describe the
target v0.1 installation experience. Those methods are not published yet; use
the archive instructions today. Windows uses the verified ZIP.

**Renderer version:** the published archive contains an earlier interface.
These guides and captures use the current documentation verification build,
identified in the [verification record](../reference/README.md). The
[Diff guide](renderer/diff.md#read-a-delta) explains interactive Delta availability
separately from the command-line reports.

## macOS

### Release archive

Choose `rootform_0.1.1_darwin_arm64.tar.gz` for Apple silicon or
`rootform_0.1.1_darwin_amd64.tar.gz` for Intel. This example uses Apple silicon:

```sh
shasum -a 256 rootform_0.1.1_darwin_arm64.tar.gz
```

Compare the complete hash with that filename's entry in `SHA256SUMS`. If it
differs, stop and download the files again from the release. Extract only after
verification:

```sh
tar -xzf rootform_0.1.1_darwin_arm64.tar.gz
mkdir -p "$HOME/.local/bin"
install -m 755 rootform "$HOME/.local/bin/rootform"
export PATH="$HOME/.local/bin:$PATH"
rootform version
```

Read `ROOTFORM-BINARY-LICENSE.txt` and `THIRD_PARTY_NOTICES.txt` from the archive.
Add the `PATH` line to your shell configuration if this directory is not already
on it. For zsh, that is usually `~/.zshrc`; the `export` above affects this terminal.

### Homebrew (target v0.1)

The target formula installs the current release:

```sh
brew install rootform-dev/tap/rootform
rootform version
```

Upgrade or remove the formula with:

```sh
brew update
brew upgrade rootform
brew uninstall rootform
```

For a specific historical version, use its release archive. Do not assume that
`brew install rootform@0.1.1` exists. Keep one installation method on your `PATH`
to avoid running an older executable by accident.

## Linux

### Release archive

Choose `rootform_0.1.1_linux_amd64.tar.gz` for x86-64 or
`rootform_0.1.1_linux_arm64.tar.gz` for ARM64. This example uses x86-64:

```sh
sha256sum rootform_0.1.1_linux_amd64.tar.gz
```

Compare the full hash with the matching entry in `SHA256SUMS`, then extract
and install into your user directory:

```sh
tar -xzf rootform_0.1.1_linux_amd64.tar.gz
mkdir -p "$HOME/.local/bin"
install -m 755 rootform "$HOME/.local/bin/rootform"
export PATH="$HOME/.local/bin:$PATH"
rootform version
```

Read the included binary license and notices. Make the `PATH` setting persistent
in your shell configuration if necessary.

### Installer script (target v0.1, Linux and macOS)

The target installer detects the supported OS and CPU, downloads a release,
verifies its checksum, and installs into `~/.local/bin`. Download it first so
you can inspect the script before running it:

```sh
curl -fsSLo install-rootform.sh https://rootform.dev/install.sh
sh install-rootform.sh
```

The target command for a specific version is:

```sh
sh install-rootform.sh --version 0.1.1
```

To upgrade a script installation, download the installer again and run it
without `--version`, then check `rootform version`.

## Windows

Download `rootform_0.1.1_windows_amd64.zip`. Windows ARM64 is not a published
native target. In PowerShell:

```powershell
Get-FileHash .\rootform_0.1.1_windows_amd64.zip -Algorithm SHA256
```

Compare the complete hash with the matching line in `SHA256SUMS`, then extract:

```powershell
Expand-Archive .\rootform_0.1.1_windows_amd64.zip -DestinationPath .\rootform-release
New-Item -ItemType Directory -Force "$env:LOCALAPPDATA\Rootform\bin"
Copy-Item .\rootform-release\rootform.exe "$env:LOCALAPPDATA\Rootform\bin\rootform.exe"
$env:Path = "$env:LOCALAPPDATA\Rootform\bin;$env:Path"
rootform version
```

Read the extracted license and notices. Add `%LOCALAPPDATA%\Rootform\bin`
to your **user** `Path` in Windows environment-variable settings, then open a
new terminal. The PowerShell assignment above affects only this session.

To upgrade, close running Rootform processes, verify the new ZIP, and replace
`rootform.exe` in the same directory. To uninstall, delete that executable and
remove the directory from your user `Path`. There is no Rootform WinGet or
Scoop package in this installation procedure.

## Choose, upgrade, or remove an archive version

Every release has its own versioned assets and checksums. To install a specific
version, choose that release and use its filenames throughout verification and
extraction. Do not combine an archive with another release's `SHA256SUMS`.

To upgrade on macOS/Linux, repeat the archive procedure with the new release;
`install` replaces the executable at the chosen path. To remove the user-local
executable installed above:

```sh
rm "$HOME/.local/bin/rootform"
```

Removing the binary leaves project source, `rootform.lock`, vendored packages,
and the Rootform home intact. Keep them if you intend to reinstall or reproduce
an existing architecture.

## Container

With Docker or a compatible container runtime installed, verify the image with:

```sh
docker run --rm ghcr.io/rootform-dev/rootform:0.1.1 version
```

Containers are an alternative when you already use a runtime; local installation
does not require one. The [container guide](integrations/oci-image.md) covers
supported platforms, project mounts, writable home, and image digests. Use an
exact version or digest for repeatable runs.

## Verify the command you will use

```sh
rootform version
```

Expected for v0.1.1:

```text
rootform 0.1.1
```

If the command is missing or the version is unexpected, inspect which path your
shell resolves:

```sh
command -v rootform
```

In PowerShell, use `Get-Command rootform`. Correct the `PATH` entry and open a
new terminal before continuing to [your first architecture](getting-started/first-architecture.md).
