---
title: "Install Rootform"
description: "Install a verified release on macOS, Linux, or Windows and check your first command."
---

Rootform is a single executable. Choose a release for your operating system,
verify its checksum, and put it on your `PATH`. No language runtime is required.

## Available release

[Rootform v0.1.1](https://github.com/rootform-dev/rootform/releases/tag/v0.1.1)
is the published release used to verify the command examples in these docs.

> **Renderer version:** the renderer guide describes the current implementation.
> Its Survey, Plan, and updated Diff controls are not yet in the published
> v0.1.1 binary. The first-architecture commands work in v0.1.1; its browser
> interface looks different.

| System | Archive |
| --- | --- |
| macOS, Apple silicon | `rootform_0.1.1_darwin_arm64.tar.gz` |
| macOS, Intel | `rootform_0.1.1_darwin_amd64.tar.gz` |
| Linux, x86-64 | `rootform_0.1.1_linux_amd64.tar.gz` |
| Linux, ARM64 | `rootform_0.1.1_linux_arm64.tar.gz` |
| Windows, x86-64 | `rootform_0.1.1_windows_amd64.zip` |

Download your archive and `SHA256SUMS` from that same release. Release manifests
record the supported targets; do not infer another target from its processor name.

## macOS and Linux

In the download directory, compute the archive checksum. This macOS example
uses the Apple silicon archive:

```sh
shasum -a 256 rootform_0.1.1_darwin_arm64.tar.gz
```

On Linux, use `sha256sum` with your archive's filename. Compare the complete
hash with the matching line in `SHA256SUMS`. Stop if they differ.

Extract the verified archive. The following macOS example installs into your
user directory; substitute your archive filename on another target:

```sh
tar -xzf rootform_0.1.1_darwin_arm64.tar.gz
mkdir -p "$HOME/.local/bin"
install -m 755 rootform "$HOME/.local/bin/rootform"
export PATH="$HOME/.local/bin:$PATH"
```

Read `ROOTFORM-BINARY-LICENSE.txt` and `THIRD_PARTY_NOTICES.txt` from the archive.
Add the `PATH` setting to your shell configuration if this directory is not
already present. The `export` above applies to the current terminal.

## Windows

Use the ZIP from the release. In PowerShell, compute its checksum:

```powershell
Get-FileHash .\rootform_0.1.1_windows_amd64.zip -Algorithm SHA256
```

Compare it with the matching entry in `SHA256SUMS`, then extract:

```powershell
Expand-Archive .\rootform_0.1.1_windows_amd64.zip -DestinationPath .\rootform-release
```

Read the included license and notices. Move `rootform.exe` to a directory you
control, add that directory to your user `Path` environment variable, and open
a new terminal. A verified ZIP is the supported documentation path here;
there is no Rootform WinGet or Scoop package to install from these instructions.

## Check the installation

```sh
rootform version
```

Expected for this release:

```text
rootform 0.1.1
```

If the command is not found, check that the executable's directory is on
`PATH`, then open a new terminal. If an older version runs, inspect the path
with `command -v rootform` on macOS/Linux or `Get-Command rootform` in PowerShell.

[Render your first architecture](getting-started/first-architecture.md).

## Target local installation methods

The target v0.1 installation experience also includes a Linux/macOS script at
`rootform.dev/install.sh` and a macOS Homebrew formula. These methods are
planned; use the release archive today. Their final commands will be documented
when the installer and formula are published.

Windows remains a verified ZIP first. A package-manager entry can be added
once its publisher, manifests, and update process are established.

## Container and CI

The official image uses `ghcr.io/rootform-dev/rootform:<version>`. Follow the
[container image guide](integrations/oci-image.md) for platform, volume, and
permission requirements. Use the [GitHub Action](integrations/github-actions.md)
for a checksum-verifying installer in a workflow.

Pin an exact version in automation. Rootform executables and official images
use Elastic License 2.0; repository documentation and tooling use Apache-2.0.
