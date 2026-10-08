# Rootform distribution

Package already-built Rootform executables for native installation and OCI.
The scripts verify exact release manifests, digests, licenses and provenance
before assembling artifacts.

| Path | Contents |
| --- | --- |
| [`installers/`](installers/) | Shell and PowerShell sources; Homebrew and WinGet generation |
| [`oci/Dockerfile`](oci/Dockerfile) | Runtime image from verified release assets and a pinned Alpine base |

Use [installation](../docs/installation.md) for downloads and supported platforms.
The [binary handoff](../contracts/binary-handoff.md) and
[release manifest](../contracts/release-manifest.md) define packaging inputs.

Generation and qualification are local operations. Release and image publication
are separate workflows.
