# Container image

Official Rootform image contract defines one versioned multi-platform image:

```text
ghcr.io/rootform-dev/rootform:<version>
```

It targets `linux/amd64` and `linux/arm64`. Publication remains manual. GHCR
package must already be public before official publication. Workflow verifies
visibility before and after publication but never changes it. No `latest` tag
is published.

Image is assembled from checksum-verified Linux release archives. It never
compiles Rootform and never checks out Engine. Rootform executable in each
platform image is byte-identical to executable in matching native archive.

## Runtime contract

| Property | Value |
| --- | --- |
| Base | Alpine `3.21`, pinned by multi-platform index digest |
| Platforms | `linux/amd64`, `linux/arm64` |
| Entrypoint | none |
| Default command | `rootform --help` |
| Working directory | `/workspace` |
| Default user | `65532:65532` |
| `HOME` | `/home/rootform` |
| `ROOTFORM_HOME` | `/home/rootform/.rootform` |
| Binary | `/usr/local/bin/rootform` |
| Binary license | `Elastic-2.0` |

Alpine supplies `/bin/sh`, `grep`, and CA certificates. Dockerfile performs no
package installation and no build instruction downloads payload. `FROM`
remains an external input and is pinned by digest. Image exposes no `git`,
`curl`, `wget`, Terraform, OpenTofu, compiler, dialect, credential, or token.

No entrypoint lets GitLab, CircleCI, Buildkite, Jenkins, and other runners
inject a shell. Default command makes an ordinary run useful:

```bash
docker run --rm ghcr.io/rootform-dev/rootform:0.1.0

docker run --rm \
  --volume "$PWD:/workspace" \
  --workdir /workspace \
  ghcr.io/rootform-dev/rootform:0.1.0 \
  rootform check .
```

Use exact version or digest. Avoid moving tags:

```bash
docker run --rm \
  ghcr.io/rootform-dev/rootform@sha256:<index-digest> \
  rootform version
```

## Files and licensing

Image-owned Rootform payload is a closed list:

```text
/usr/local/bin/rootform
/usr/local/share/rootform/ROOTFORM-BINARY-LICENSE.txt
/usr/local/share/rootform/THIRD_PARTY_NOTICES.txt
/usr/local/share/rootform/rootform_<version>_sbom.spdx.json
```

Executable and official image use Elastic License 2.0. Repository source and
tooling remain Apache-2.0. Third-party assets retain upstream terms. OCI label
`org.opencontainers.image.licenses=Elastic-2.0`, embedded license, notices, and
release manifest all record same boundary.

Image contains no dialect source. Dialects remain independent MPL-2.0 OCI
artifacts acquired by Rootform.

Dialect registries need only
[`rootform-oci-core-v1`](../../contracts/rootform-oci-core-profile.md). See
[`registry-compatibility.md`](registry-compatibility.md) for tested scope and
evidence boundary.

## Permissions

Default user owns image-created `/workspace` and
`/home/rootform/.rootform`. New Docker named volumes mounted at
`ROOTFORM_HOME` inherit prepared ownership and work without weakening its
`0700` mode:

```bash
docker volume create rootform-home
docker run --rm \
  --volume "$PWD:/workspace" \
  --volume rootform-home:/home/rootform/.rootform \
  ghcr.io/rootform-dev/rootform:0.1.0 \
  rootform init . --no-input
```

A host bind mount masks directory ownership and mode prepared in image.
`chmod 1777 /workspace` inside Dockerfile would not change host mount. Caller
must provide workspace accessible to selected UID and writable when `init`
must create or update `rootform.lock`.

Arbitrary UID is supported when caller supplies both accessible workspace and
writable `ROOTFORM_HOME`:

```bash
mkdir -p .rootform-container-home
# Prepare ownership or ACLs for UID/GID selected by your runner.
docker run --rm \
  --user 12345:23456 \
  --volume "$PWD:/workspace" \
  --volume "$PWD/.rootform-container-home:/home/rootform/.rootform" \
  ghcr.io/rootform-dev/rootform:0.1.0 \
  rootform init . --locked --no-input
```

Image does not make Rootform home world-writable to simulate arbitrary-UID
support without caller configuration.

Read-only workspace works when lock and dialect inputs are already available.
This hardened vendored example needs no persistent home:

```bash
docker run --rm \
  --read-only \
  --cap-drop ALL \
  --security-opt no-new-privileges \
  --network none \
  --tmpfs /home/rootform/.rootform:uid=65532,gid=65532,mode=0700 \
  --volume "$PWD:/workspace:ro" \
  ghcr.io/rootform-dev/rootform:0.1.0 \
  rootform build . --locked --offline --no-input --format json
```

## Dialect acquisition

Image uses same embedded OCI client as native binary.

- Project `.rootform/dialects/` is exclusive. Store and network are never
  fallback for incomplete vendor.
- Distribution-ready `rootform.lock` carries exact artifact pins. Empty store
  recovery creates client for each pin's repository, resolves its manifest
  digest directly, and does not consult mutable `official-index-v1`.
- Project without vendor or lock resolves one official index snapshot,
  installs verified dialects atomically, and writes exact pins to
  `rootform.lock`.
- Repeatable `rootform init --source` accepts exact external dialect or index
  OCI references. Official index remains implicit; configured indexes have no
  priority, and source conflicts fail before selection.
- `--locked` requires and preserves lock bytes while allowing missing pinned
  artifacts to be acquired.
- `--offline` forbids network. Use vendor or preloaded store/cache.
- Private registries use standard Docker config. Mount selected config directory
  read-only and set `DOCKER_CONFIG` inside container. Configured credential
  helpers must also be installed or mounted on container `PATH`; official image
  bundles no registry credential or helper.
- Registries using a private CA require its PEM bundle mounted read-only and
  selected with `SSL_CERT_FILE`; invalid bundles fail closed.
- Provider with no configured dialect is recorded explicitly in
  `unsupported_providers` with transparent diagnostic.

Rootform never runs Terraform, OpenTofu, providers, or modules. Remote modules
must already be materialized by Terraform/OpenTofu.

## Build and supply chain

Offline audit build uses assembled native release directory:

```bash
bun run build:image -- \
  --version 0.1.0 \
  --release <assembled-release-directory> \
  --revision <exact-distribution-commit> \
  --output <image-output-directory>
```

Staging allow-list contains Dockerfile, two verified Linux executables, binary
license, notices, and release SBOM only. Offline OCI audit checks:

- exact amd64/arm64 platform set;
- binary SHA-256 and mode `0755` against release archives;
- three share files and mode `0644`;
- non-root user, homes, workdir, no entrypoint, and exact command;
- OCI labels and binary license;
- absence of unexpected overlay payload and forbidden source/state material.

Candidate gate then loads both platforms, publishes byte-identical Dialects to
public and Basic-authenticated TLS Distribution registries, and executes real
runtime matrix: official cold init and no-op upgrade; public/private direct
sources by tag and digest; one/multiple private indexes; identical-index
deduplication; conflicting identity and provider-ambiguity refusal;
private-to-official and private-to-private dependencies; empty-store locked
recovery without mutable source; mixed-source build/check/run and vendor
offline; arbitrary and multi-repository direct pins; Docker auth and credential
helper; warm/cold offline with `--network none`; sanitized auth failures; wrong
digest rejection; unsupported provider; GitLab shell injection; arbitrary UID;
read-only workspace; `--read-only`; dropped capabilities; and
`no-new-privileges`.

Trivy is checksum-pinned. High/Critical findings block. Exception file accepts
only named image paths, justification, and expiration within 90 days; current
policy has no exception. Medium/Low findings are emitted as evidence.
Dependabot reviews Alpine digest updates from `oci/Dockerfile`.

Official publication repeats qualification, pushes exact version, and requires:

- platform manifest digests equal offline audited manifests;
- one SPDX SBOM from digest-pinned BuildKit Syft scanner and one maximal SLSA
  provenance attestation per platform;
- GHCR package is public before and after publication;
- no moving `latest` tag and no package visibility mutation.

## CI examples

Portable tested examples live under [`ci/`](ci/).

GitLab shell injection works because image has no entrypoint:

```yaml
rootform:
  image: ghcr.io/rootform-dev/rootform:0.1.0
  variables:
    ROOTFORM_HOME: $CI_PROJECT_DIR/.rootform-home
  cache:
    key: rootform-$CI_COMMIT_REF_SLUG
    paths:
      - .rootform-home/dialects
  script:
    - rootform init "$CI_PROJECT_DIR" --no-input
    - rootform build "$CI_PROJECT_DIR" --format json --output architecture.json
    - rootform check "$CI_PROJECT_DIR" --format sarif --output rootform.sarif
  artifacts:
    paths:
      - architecture.json
      - rootform.sarif
      - rootform.lock
```

Other container runners use same explicit command pattern:

```text
checkout
→ provide writable ROOTFORM_HOME
→ rootform init . --no-input
→ rootform build . --locked --format json
→ rootform check . --locked --format sarif
```

For air-gapped jobs:

```text
checkout with .rootform/dialects and rootform.lock
→ rootform init . --locked --offline
→ rootform build . --locked --offline
→ rootform check . --locked --offline
```

## Anonymous post-visibility canary

Run only after both `rootform-dev/dialects` and official Rootform image package
are public:

1. use empty Docker credential directory and pull
   `ghcr.io/rootform-dev/dialects:official-index-v1` anonymously;
2. use empty `ROOTFORM_HOME`, synthetic Terraform project, and no
   `rootform.lock`; run `rootform init . --no-input`;
3. run `rootform build . --locked`;
4. run `rootform check . --locked`;
5. start `rootform run . --locked --no-browser --no-watch`, observe serving
   address, then stop cleanly;
6. delete store, rerun `rootform init . --locked`, and verify lock SHA-256 is
   unchanged;
7. run `rootform vendor dialects`, then build/check with `--network none` and
   `--locked --offline` using empty home.

Canary must use no GHCR token. A `401` or `403`, lock mutation, mutable-index
request during pinned recovery, or missing attestation blocks public launch.
