---
title: "Container image"
description: "Analyze a mounted plan or state export with the official Rootform image, persistent package storage, and offline inputs."
---

The official image runs the same `rootform` CLI as the release archive for `linux/amd64` and `linux/arm64`. It contains the embedded RF Vocabulary and Dialects, not Terraform, OpenTofu, providers, project source, or external selections. Produce a plan or state JSON before starting the container; OpenTofu users replace `terraform` with `tofu` in those commands, and [Plan inputs](../inputs/plans.md#produce-the-accepted-json) gives the procedure. Use an exact version tag such as `ghcr.io/rootform-dev/rootform:0.1.0` or the reviewed multi-platform index digest; there is no moving `latest` tag. The image has no entrypoint, so put `rootform` after the image reference in every command.

## Check the CLI version

```sh
docker run --rm ghcr.io/rootform-dev/rootform:0.1.0 rootform version
```

The version must match the release your team reviewed. To pin exact image bytes, replace the version tag with `ghcr.io/rootform-dev/rootform@sha256:<index-digest>`, using the complete reviewed index digest. For disconnected use, the image must already be present locally.

## Run against a project

Mount the directory containing `plan.json` read-only and run a one-shot analysis:

```sh
docker run --rm \
  --volume "$PWD:/workspace:ro" \
  --workdir /workspace \
  ghcr.io/rootform-dev/rootform:0.1.0 \
  rootform run plan.json --no-serve
```

The terminal summary reports the input kind, active Dialect count, stage, interpreted instances, facts, and policy outcome. A `0` without selected policies confirms successful analysis, not compliance. A binary saved plan is not a `run` input; export it to JSON first.

To keep the Rootform document while the project mount stays read-only, ask for JSON on standard output and let the host shell write the file:

```sh
docker run --rm \
  --volume "$PWD:/workspace:ro" \
  --workdir /workspace \
  ghcr.io/rootform-dev/rootform:0.1.0 \
  rootform run plan.json --no-serve --format json > analysis.json
```

Saved plans, plan JSON, and state JSON can contain cleartext secrets. Mount only the protected files needed by the run, keep them out of Git and public artifacts, and remove them according to your retention policy. Rootform reads locally, does not contact a provider or cloud, and does not place sensitive values in its document, reports, SARIF, or Explorer. Its outputs still expose topology and names.

## Write a report without changing the input mount

By default the container runs as UID/GID `65532:65532`, which may be able to read a host bind mount but not write to it. For a host-owned report directory, run the container as your host user and give Rootform a writable temporary home. Select outputs by extension:

```sh
mkdir -p reports
docker run --rm \
  --user "$(id -u):$(id -g)" \
  --env ROOTFORM_HOME=/tmp/rootform-home \
  --volume "$PWD:/workspace:ro" \
  --volume "$PWD/reports:/reports" \
  --workdir /workspace \
  ghcr.io/rootform-dev/rootform:0.1.0 \
  rootform run plan.json --no-serve \
    -o /reports/analysis.json -o /reports/report.md -o /reports/explorer.html
```

The JSON, Markdown, and self-contained HTML come from one analysis. The HTML export makes no network requests when opened from disk. If writing fails with status `4`, check host ownership and mount permissions before retrying; ownership behavior differs across Linux, Docker Desktop, and other runtimes. Do not make the source tree world-writable. For a saved plan, mount both files and add `--plan-file plan.tfplan --require-enrichment`; a refused pair exits `3`.

## Keep external packages between runs

A project using only embedded Dialects needs no lock or package volume. `ROOTFORM_HOME` holds installed OCI Dialects and Policy Packs selected by `rootform.lock`; a named volume preserves them across containers while the lock stays in the project. Local selections use their recorded project paths and need no package volume. Prepare the locked selection once:

```sh
docker volume create rootform-home
docker run --rm \
  --volume "$PWD:/workspace:ro" \
  --volume rootform-home:/home/rootform/.rootform \
  --workdir /workspace \
  ghcr.io/rootform-dev/rootform:0.1.0 \
  rootform init . --locked --no-input
```

Mount the same volume on later `run` commands and add `--locked`. `init` may acquire only the exact OCI content recorded in the lock; `run` never acquires packages. [Locks and vendored content](../offline-security.md) explains source precedence, and [Run in CI](ci/README.md#prepare-a-locked-selection-before-analysis) shows the same preparation in a runner.

## Run with vendored content offline

A disconnected run needs the exact `rootform.lock` and the vendored `.rootform/dialects` and `.rootform/policy-packs` directories in the project mount. Prepare and vendor them before disconnecting; the embedded RF Vocabulary and Dialects are already in the image.

Docker must have the chosen image locally before the container starts. `--network none` isolates the running container but does not stop Docker from pulling a missing image; `--pull never` makes a missing local image fail before startup. With the image, project, and plan JSON local, this read-only run writes the Rootform document to standard output:

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
  rootform run plan.json --locked --no-serve --format json > analysis.json
```

The temporary directories are writable by the container user, not the host workspace. A damaged or incomplete vendor tree fails closed instead of falling back to the package store or a registry. To check the selection alone, run `rootform init . --locked --offline --no-input` with the same flags; it verifies local or vendored content and cannot fetch anything missing. [Reproduce an analysis offline](../guides/reproduce-build.md#prepare-selected-external-content) covers transfer and byte comparison.

## Use private registry credentials

Only an explicit `init` or `vendor` acquisition needs registry credentials; `run` never acquires packages. Mount a Docker configuration directory read-only and point `DOCKER_CONFIG` at that directory, not at `config.json` itself:

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

Rootform reads `config.json` and chooses credentials for the registry host. A `credHelpers` or `credsStore` executable named there must also exist on `PATH` inside the container; the image does not ship host helpers, and mounting `config.json` does not mount their binaries. Supply a trusted helper separately or use a protected configuration that does not depend on one. For a private CA, mount its PEM bundle read-only and set `SSL_CERT_FILE` to its path inside the container. Never bake credentials into the image or copy them into `rootform.lock`. [Registry compatibility](registry-compatibility.md) explains registry behavior.

## Understand the runtime boundary

| Property | Value |
| --- | --- |
| Platforms | `linux/amd64`, `linux/arm64` |
| Working directory | `/workspace` |
| User | `65532:65532` |
| `HOME` | `/home/rootform` |
| `ROOTFORM_HOME` | `/home/rootform/.rootform` |
| Binary | `/usr/local/bin/rootform` |
| Entrypoint | None; default command is `rootform --help` |
| Binary license | Elastic-2.0 |

`run` normally serves a loopback interface and opens a browser. In a container, use `--no-serve` and export HTML for interactive review on the host. Publishing a container port does not change Rootform's loopback bind inside the container. The image carries the binary license, third-party notices, and SPDX SBOM; it does not include external Dialects or Policy Packs, Terraform or OpenTofu, provider binaries, Git, registry credentials, or project source. See [security and data handling](../security/index.md#know-which-operation-crosses-a-network-boundary) before moving artifacts beyond the workstation.
