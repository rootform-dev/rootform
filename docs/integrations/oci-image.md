---
title: Container image
description: Run Rootform from GHCR with explicit versions, project mounts, package storage, and offline inputs.
---

Rootform publishes a multi-platform image for `linux/amd64` and `linux/arm64`:

```text
ghcr.io/rootform-dev/rootform:<version>
```

Use an exact version or digest. Rootform does not publish a moving `latest` tag.

## Check the CLI version

```sh
docker run --rm ghcr.io/rootform-dev/rootform:0.1.0 rootform version
```

The image has no entrypoint, so always include `rootform` before its arguments.

## Run against a project

Project must be readable by container user and writable when output file is
created. Mount it at `/workspace` and choose that working directory:

```sh
docker run --rm \
  --volume "$PWD:/workspace" \
  --workdir /workspace \
  ghcr.io/rootform-dev/rootform:0.1.0 \
  rootform build . --output architecture.json
```

This supplied-only path needs no lock, package volume, or network access after
the image is local. Add `--locked` when project has a reviewed
`rootform.lock`; [prepare its external selection](../cli.md) before running a
normal build.

For repeatable image bytes, replace the version tag with an index digest:

```sh
docker run --rm \
  ghcr.io/rootform-dev/rootform@sha256:<index-digest> \
  rootform version
```

Replace `<index-digest>` with the complete digest of the reviewed multi-platform
image.

## Preserve external packages

Rootform home stores verified third-party Dialects and Policy Packs. A named
volume keeps those packages between runs when lock selects OCI content:

```sh
docker volume create rootform-home
docker run --rm \
  --volume "$PWD:/workspace" \
  --volume rootform-home:/home/rootform/.rootform \
  --workdir /workspace \
  ghcr.io/rootform-dev/rootform:0.1.0 \
  rootform init . --locked --no-input
```

The project lock remains in the mounted workspace; the package store remains in
the named volume.

## Run offline with vendored packages

Before disconnecting, commit or supply `rootform.lock` and required vendored
non-embedded selection under `.rootform/`. RF Vocabulary and supplied Dialects
are embedded in image and are never vendored. A locked check using external
Policy Packs needs `.rootform/policy-packs/`; `build` does not use Policy Packs.

The selected image must already be in Docker's local image store.
`--network none` disables container networking but does not prevent Docker from
trying to pull a missing image. Once the image and vendored packages are local,
run:

```sh
docker run --rm \
  --read-only \
  --cap-drop ALL \
  --security-opt no-new-privileges \
  --network none \
  --tmpfs /home/rootform/.rootform:uid=65532,gid=65532,mode=0700 \
  --volume "$PWD:/workspace:ro" \
  --workdir /workspace \
  ghcr.io/rootform-dev/rootform:0.1.0 \
  rootform build . --locked
```

Output goes to standard output because the workspace is read-only. Missing or
damaged vendor content fails without a store or registry fallback. See
[reproduce a build offline](../guides/reproduce-build.md) to prepare it.

## Use private registries

Rootform reads standard Docker credentials. Mount the selected Docker
configuration read-only and set `DOCKER_CONFIG` to the directory containing
`config.json`:

```sh
docker run --rm \
  --volume "$PWD:/workspace" \
  --volume "$HOME/.docker:/docker-config:ro" \
  --env DOCKER_CONFIG=/docker-config \
  --workdir /workspace \
  ghcr.io/rootform-dev/rootform:0.1.0 \
  rootform init . --locked --no-input
```

Credential helpers named by the Docker configuration must be available on the
container `PATH`; the official image does not include them. For a private
certificate authority, mount a PEM bundle and set `SSL_CERT_FILE` to its mounted
path.

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

Image contains Rootform executable with embedded RF Vocabulary and supplied
Dialect release set, its license, third-party notices, and SPDX SBOM. It does
not contain separately installed third-party Dialects, Terraform/OpenTofu,
provider binaries, Git, registry credentials, or source configuration.

The image uses the same CLI and registry contracts as the native executable. Review
[registry compatibility](registry-compatibility.md) before choosing a private
registry and [CI examples](ci/README.md) for runner configuration.
