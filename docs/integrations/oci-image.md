---
title: Container image
description: Run Rootform with project mounts, persistent package storage, and offline inputs.
---

The Rootform image targets `linux/amd64` and `linux/arm64`. Use an exact version
tag such as `ghcr.io/rootform-dev/rootform:0.1.0`, or the reviewed multi-platform
index digest. There is no moving `latest` tag. The image has no entrypoint, so
put `rootform` after the image reference in every command.

## Check the CLI version

```sh
docker run --rm ghcr.io/rootform-dev/rootform:0.1.0 rootform version
```

To pin exact image bytes, replace the version tag with
`ghcr.io/rootform-dev/rootform@sha256:<index-digest>`, using the complete
reviewed index digest. The image must be present locally for disconnected use.

## Run against a project

Mount a Terraform or OpenTofu root at `/workspace` and run from there. For a
result on standard output, a read-only project mount is enough:

```sh
docker run --rm \
  --volume "$PWD:/workspace:ro" \
  --workdir /workspace \
  ghcr.io/rootform-dev/rootform:0.1.0 \
  rootform build . > architecture.json
```

The host shell writes `architecture.json`; Rootform writes to standard output.
To let Rootform create the file inside the mount instead, use a writable mount
and `--output`:

```sh
docker run --rm \
  --volume "$PWD:/workspace" \
  --workdir /workspace \
  ghcr.io/rootform-dev/rootform:0.1.0 \
  rootform build . --output architecture.json
```

The process runs as UID/GID `65532:65532`. A host bind mount may be readable
but not writable by that identity. Give the output directory suitable host-side
permissions or use standard output. Ownership behavior differs across Linux,
Docker Desktop, and other runtimes; broad permissions such as `chmod 777` are
not required. A project using only embedded Dialects needs no Rootform lock or
package volume. For an external selection, prepare its exact content first as
described in [Project configuration](../cli.md).

## Keep external packages between runs

`ROOTFORM_HOME` holds installed OCI Dialects and Policy Packs. A named volume
preserves them across containers while the project lock stays in the workspace.
Local selections use their recorded project paths and need no package volume.
Prepare an existing OCI selection explicitly:

```sh
docker volume create rootform-home
docker run --rm \
  --volume "$PWD:/workspace:ro" \
  --volume rootform-home:/home/rootform/.rootform \
  --workdir /workspace \
  ghcr.io/rootform-dev/rootform:0.1.0 \
  rootform init . --locked --no-input
```

Mount the same volume on later `build` or `check` runs. `init` may acquire only
the exact OCI content selected by the lock; normal analysis commands never
acquire it. See [Locks and vendored content](../offline-security.md) for source
precedence and [Run in CI](ci/README.md) for runner orchestration.

## Run with vendored content offline

Prepare `rootform.lock` and the needed `.rootform/dialects` and
`.rootform/policy-packs` directories before disconnecting. A build needs
selected Dialects, while a locked check also needs selected Policy Packs.
Embedded RF Vocabulary and supplied Dialects are already in the image.

Docker must have the chosen image locally before the container starts.
`--network none` isolates the running container but does not stop Docker from
pulling a missing image. `--pull never` makes a missing local image fail before
startup. With exact vendored content, this read-only workspace can produce an
architecture on standard output:

```sh
docker run --rm \
  --pull never \
  --network none \
  --read-only \
  --cap-drop ALL \
  --security-opt no-new-privileges \
  --tmpfs /tmp:uid=65532,gid=65532,mode=0700 \
  --tmpfs /home/rootform/.rootform:uid=65532,gid=65532,mode=0700 \
  --volume "$PWD:/workspace:ro" \
  --workdir /workspace \
  ghcr.io/rootform-dev/rootform:0.1.0 \
  rootform build . --locked
```

The temporary directories are writable to the container user, not the host
workspace. A damaged or incomplete vendor tree fails closed instead of falling
back to the package store or a registry. Follow
[Reproduce a build offline](../guides/reproduce-build.md) to prepare and check
the selection.

## Use private registry credentials

For an explicit `init` or `vendor` acquisition, mount a Docker configuration
directory read-only and point `DOCKER_CONFIG` at its directory, not at
`config.json` itself:

```sh
docker run --rm \
  --volume "$PWD:/workspace:ro" \
  --volume "$HOME/.docker:/run/docker-config:ro" \
  --volume rootform-home:/home/rootform/.rootform \
  --env DOCKER_CONFIG=/run/docker-config \
  --workdir /workspace \
  ghcr.io/rootform-dev/rootform:0.1.0 \
  rootform init . --locked --no-input
```

Rootform reads `config.json` and chooses credentials for the registry host.
If it names a `credHelpers` or `credsStore` executable, that helper must also
exist inside the container on `PATH`. The official image does not include host
credential helpers, and mounting `config.json` alone does not mount their
binaries. Supply a trusted helper separately or use a protected Docker config
that does not depend on one. Never copy credentials into the image. For a
private CA, mount its PEM bundle read-only and set `SSL_CERT_FILE` to the path
inside the container. See [Registry compatibility](registry-compatibility.md).

## Runtime contract

| Property | Value |
| --- | --- |
| Platforms | `linux/amd64`, `linux/arm64` |
| Working directory | `/workspace` |
| Default user | `65532:65532` |
| `HOME` | `/home/rootform` |
| `ROOTFORM_HOME` | `/home/rootform/.rootform` |
| Binary | `/usr/local/bin/rootform` |
| Entrypoint | none |
| Default command | `rootform --help` |
| Binary license | Elastic-2.0 |

The image includes the Rootform executable, embedded RF Vocabulary and
supplied Dialects, binary license, third-party notices, and SPDX SBOM. It does
not include external Dialects or Policy Packs, Terraform/OpenTofu, provider
binaries, Git, registry credentials, or the project source.
