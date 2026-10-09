---
title: Install Rootform
description: Install Rootform on macOS, Linux, or Windows, or run it from a container.
---

Choose your platform, install Rootform, then verify the executable. Embedded
[Dialects](concepts/dialects.md) are included and need no additional Rootform
configuration for your first architecture.

Check [provider coverage](reference/provider-coverage.md) for interpreted types,
provider bindings and input limits before choosing a runtime.

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
brew install rootform-dev/tap/rootform
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
docker pull ghcr.io/rootform-dev/rootform:0.2.0
```

**Verify**

```sh
docker run --rm ghcr.io/rootform-dev/rootform:0.2.0 rootform version
```

[Container usage](integrations/oci-image.md)

<!-- rootform:endtabs -->

## Manual installation

Use a release archive when you need exact binary bytes, checksum evidence, or a
transfer to a machine without network access. From
[Rootform releases](https://github.com/rootform-dev/rootform/releases), select a
published product version and take its platform archive and `SHA256SUMS`.
The filenames below show archive conventions; use the selected release's
version in each name. A verification runtime is for contributor checks and does not
provide a product installation.

| Platform | Archive |
| --- | --- |
| macOS, Apple silicon | `rootform_0.2.0_darwin_arm64.tar.gz` |
| macOS, Intel | `rootform_0.2.0_darwin_amd64.tar.gz` |
| Linux, x86-64 | `rootform_0.2.0_linux_amd64.tar.gz` |
| Linux, ARM64 | `rootform_0.2.0_linux_arm64.tar.gz` |
| Windows, x86-64 | `rootform_0.2.0_windows_amd64.zip` |

Release archives include binary license and third-party notices. Match the
archive against its `SHA256SUMS` entry before extraction:

```sh title="macOS"
shasum -a 256 rootform_0.2.0_darwin_arm64.tar.gz
```

```sh title="Linux"
sha256sum rootform_0.2.0_linux_amd64.tar.gz
```

```powershell title="Windows"
Get-FileHash .\rootform_0.2.0_windows_amd64.zip -Algorithm SHA256
```

Extract the `.tar.gz` or `.zip`, then place `rootform` or `rootform.exe` in
a directory on `PATH`. Run `rootform version` to confirm the executable.

To run a container, pin the image by index digest instead of using an archive.
See [Container usage](integrations/oci-image.md#run-against-a-project). For a
disconnected project, prepare exact third-party Dialects and Policy Packs as
described in [Locks and vendored content](offline-security.md).

## Update or remove Rootform

Update package-managed installations with their package managers:

- Homebrew: `brew upgrade rootform-dev/tap/rootform`
- WinGet: `winget upgrade --id Rootform.Rootform --exact`
- Shell installer: run the recommended install command again. It replaces the
  executable in the same installation directory.
- Manual archive: replace the executable with the binary from the new release,
  then verify it with `rootform version`.
- Container: pull the selected release tag again, for example
  `docker pull ghcr.io/rootform-dev/rootform:0.2.0`.

Remove package-managed installations with:

- Homebrew: `brew uninstall rootform-dev/tap/rootform`
- WinGet: `winget uninstall --id Rootform.Rootform --exact`
- Shell installer: remove `~/.local/bin/rootform` by default, or the file
  under the custom `ROOTFORM_INSTALL_DIR`.
- Manual archive: remove `rootform` or `rootform.exe` from its `PATH` directory.
- Container: `docker image rm ghcr.io/rootform-dev/rootform:0.2.0`.

These steps remove the executable or image. `rootform uninstall` removes
installed Dialects or Policy Packs from `$ROOTFORM_HOME`; it does not remove
the executable. See the [`uninstall` command reference](reference/cli/uninstall.md).

Continue with the [quickstart](getting-started/quickstart.md) to analyze a
sample plan, or [analyze your own plan or state](getting-started/analyze-your-plan.md)
right away.
