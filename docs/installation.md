---
title: Install Rootform
description: Install Rootform on macOS, Linux, or Windows, or run it from a container.
---

Install Rootform on macOS, Linux, or Windows, or run it from a container. The
first run may need network access to download any required
[Dialects](concepts/dialects.md) that aren't already available locally.

<!-- rootform:tabs Operating system -->
<!-- rootform:tab macOS -->

**Recommended**

```sh
curl -fsSL https://rootform.dev/install | sh
```

**Verify**

```sh
rootform version
```

**Other options**

Homebrew:

```sh
brew install --cask rootform
```

<!-- rootform:tab Linux -->

**Recommended**

```sh
curl -fsSL https://rootform.dev/install | sh
```

**Verify**

```sh
rootform version
```

<!-- rootform:tab Windows -->

**Recommended**

```powershell
Invoke-RestMethod https://rootform.dev/install.ps1 | Invoke-Expression
```

**Verify**

```shell
rootform version
```

**Other options**

WinGet:

```shell
winget install --id Rootform.Rootform --exact
```

<!-- rootform:tab Container -->

**Recommended**

```sh
docker pull ghcr.io/rootform-dev/rootform:0.1.0
```

**Verify**

```sh
docker run --rm ghcr.io/rootform-dev/rootform:0.1.0 rootform version
```

[Container usage →](integrations/oci-image.md)

<!-- rootform:endtabs -->

## Manual installation

Use release archives when you need exact binary bytes, checksum evidence, or
an offline transfer. Download `SHA256SUMS` and the archive for your platform
from [Rootform v0.1.0](https://github.com/rootform-dev/rootform/releases/tag/v0.1.0):

| Platform | Archive |
| --- | --- |
| macOS, Apple silicon | `rootform_0.1.0_darwin_arm64.tar.gz` |
| macOS, Intel | `rootform_0.1.0_darwin_amd64.tar.gz` |
| Linux, x86-64 | `rootform_0.1.0_linux_amd64.tar.gz` |
| Linux, ARM64 | `rootform_0.1.0_linux_arm64.tar.gz` |
| Windows, x86-64 | `rootform_0.1.0_windows_amd64.zip` |

Release archives include binary license and third-party notices. Find archive
filename in `SHA256SUMS`, then require exact checksum match before extraction:

```sh title="macOS"
shasum -a 256 rootform_0.1.0_darwin_arm64.tar.gz
```

```sh title="Linux"
sha256sum rootform_0.1.0_linux_amd64.tar.gz
```

```powershell title="Windows"
Get-FileHash .\rootform_0.1.0_windows_amd64.zip -Algorithm SHA256
```

Extract `.tar.gz` or `.zip`, then place `rootform` or `rootform.exe` in a
directory on `PATH`. Run `rootform version` to verify selected executable.

For a container, pin image by index digest instead of using an archive; see
[Container usage](integrations/oci-image.md#run-against-a-project). For a
disconnected project, also prepare exact Dialects and Policy Packs as described
in [Offline operation](offline-security.md).

Continue with [your first architecture →](getting-started/first-architecture.md).
