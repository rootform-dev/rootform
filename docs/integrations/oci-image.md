---
title: Container image
description: Run Rootform from GHCR with explicit versions, project mounts, package storage, and offline inputs.
---

Rootform publishes a multi-platform image for `linux/amd64` and `linux/arm64`:

```text
ghcr.io/rootform-dev/rootform:<version>
```

Use an exact version or digest. Rootform does not publish a moving `latest` tag.

## Verify the image

```sh
docker run --rm ghcr.io/rootform-dev/rootform:0.1.0 rootform version
```

The image has no entrypoint, so always include `rootform` before its arguments.

## Run against a project

Mount a project at `/workspace` and choose that working directory:

```sh
docker run --rm \
  --volume "$PWD:/workspace" \
  --workdir /workspace \
  ghcr.io/rootform-dev/rootform:0.1.0 \
  rootform build . --locked --no-input --output architecture.json
```

The project must be readable by the container user. It must also be writable
when Rootform creates `rootform.lock`, `.rootform/`, or an output file.

For repeatable image bytes, replace the version tag with an index digest:

```sh
docker run --rm \
  ghcr.io/rootform-dev/rootform@sha256:<index-digest> \
  rootform version
```

Replace `<index-digest>` with the complete digest of the reviewed multi-platform
image.

## Preserve downloaded packages

The Rootform home stores verified Dialects and Policy Packs. A named volume keeps
those packages between runs:

```sh
docker volume create rootform-home
docker run --rm \
  --volume "$PWD:/workspace" \
  --volume rootform-home:/home/rootform/.rootform \
  --workdir /workspace \
  ghcr.io/rootform-dev/rootform:0.1.0 \
  rootform init . --no-input
```

The project lock remains in the mounted workspace; the package store remains in
the named volume.

## Run offline with vendored packages

Commit or supply `rootform.lock` and the required `.rootform/dialects/` and
`.rootform/policy-packs/` directories before disconnecting from the network. Then run:

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
  rootform build . --locked --offline --no-input
```

Output goes to standard output because workspace is read-only. Missing or
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

The image contains the Rootform executable, its license, third-party notices,
and an SPDX SBOM. It does not contain Dialects, Terraform/OpenTofu, provider
binaries, Git, registry credentials, or source configuration. Dialects remain
independently versioned OCI artifacts.

The image uses the same CLI and registry contracts as the native executable. Review
[registry compatibility](registry-compatibility.md) before choosing a private
registry and [CI examples](ci/README.md) for runner configuration.
