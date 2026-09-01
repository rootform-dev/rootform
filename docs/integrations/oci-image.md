# Container image

Rootform publishes one official multi-platform image:

```text
ghcr.io/rootform-dev/rootform:<version>
```

It targets `linux/amd64` and `linux/arm64`. The image carries the Rootform
executable, its binary license, third-party notices, and the release SBOM. It
carries no dialect, no Terraform, no OpenTofu, and no registry client: Rootform
acquires dialects itself when a run needs them.

## Invocation

The image declares no entrypoint, so every caller names the command explicitly:

```bash
docker run --rm \
  -v "$PWD:/workspace" \
  -w /workspace \
  ghcr.io/rootform-dev/rootform:0.1.0 \
  rootform check .
```

Pin an exact version, or a digest when a workflow must never move:

```bash
docker run --rm ghcr.io/rootform-dev/rootform@sha256:<digest> rootform version
```

Avoid `latest`. A moving tag makes a passing pipeline and a failing pipeline
indistinguishable from the analyzed source alone.

## Image contract

| Property | Value | Reason |
| --- | --- | --- |
| Base | Alpine, pinned by index digest | GitLab, CircleCI, Buildkite, and Jenkins run a shell inside job images |
| Entrypoint | none | CI runners replace the command with their own script |
| Command | `/bin/sh` | inherited from the base image, never used to wrap Rootform |
| Working directory | `/workspace` | matches the documented `docker run` mount |
| `ROOTFORM_HOME` | `/var/cache/rootform` | writable dialect store outside the mounted workspace |
| Default user | `root` | runners bind-mount workspaces with arbitrary host UIDs |
| Mode of `/workspace` and `ROOTFORM_HOME` | `1777` | an explicit `--user` still works |
| Binary license | `Elastic-2.0` | recorded in `org.opencontainers.image.licenses` |

GitLab CI places the repository in `$CI_PROJECT_DIR` regardless of the image
working directory. GitLab jobs must reference `$CI_PROJECT_DIR`, not
`/workspace`.

Licensing inside the image follows the distribution boundary:

```text
/usr/local/bin/rootform                                    Elastic-2.0
/usr/local/share/rootform/ROOTFORM-BINARY-LICENSE.txt      Elastic-2.0 terms
/usr/local/share/rootform/THIRD_PARTY_NOTICES.txt          upstream terms
/usr/local/share/rootform/rootform_<version>_sbom.spdx.json  release SBOM
```

## Build and verification

The image is built from an assembled release directory, never from producer
source and never by compiling inside the image:

```bash
bun run build:image \
  --version 0.1.0 \
  --release <assembled-release-directory> \
  --revision <distribution-commit> \
  --output <image-output-directory>
```

The build stages only payload whose digests match both the release checksum
file and the archive's own inner checksums, then audits the produced OCI layout
offline. The audit fails when the executable is not the released binary, when an
entrypoint appears, when the working directory, default user, or
`ROOTFORM_HOME` drift, when a required label drifts, or when any unexpected file
is added on top of the base image.

Layer timestamps are pinned through `SOURCE_DATE_EPOCH` and the exporter's
`rewrite-timestamp` option, so the same release payload always produces the same
image digest.

Provenance and SBOM attestations are produced by the publication chain when the
image is pushed to a registry. A locally exported OCI layout carries neither, so
its layers can be compared byte for byte against the release archives.

## Dialects in CI

The image behaves exactly like the native binary. Three situations are
supported.

**Vendored dialects.** `.rootform/dialects` is the exclusive source. Nothing is
downloaded and the global store never completes a partial vendor directory.

**Committed `rootform.lock`, no vendor.** Rootform installs the exact missing
versions, verifies every digest, and keeps the lock byte-identical. A lock that
no longer covers the current providers fails with the exact local command to
run, never with a silent rewrite.

**Neither lock nor vendor.** Rootform detects providers, resolves unambiguous
official recommendations from a single index snapshot, installs the dialects,
writes an exact `rootform.lock`, and continues. Commit that file to make later
runs reproducible.

Air-gapped runners use `--offline` with either vendored dialects or a
preloaded `ROOTFORM_HOME`:

```bash
docker run --rm \
  -v "$PWD:/workspace" \
  -v rootform-home:/var/cache/rootform \
  -w /workspace \
  ghcr.io/rootform-dev/rootform:0.1.0 \
  rootform check . --offline --locked
```

## CI examples

Rootform does not ship a separate integration per platform. Non-GitHub runners
use the CLI or this image.

### GitLab CI

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
    - rootform check "$CI_PROJECT_DIR" --format json --output architecture.json
  artifacts:
    paths:
      - architecture.json
      - rootform.lock
```

### Azure Pipelines

```yaml
- job: rootform
  container: ghcr.io/rootform-dev/rootform:0.1.0
  steps:
    - checkout: self
    - script: rootform init "$(Build.SourcesDirectory)" --no-input
      displayName: Prepare dialects
    - script: rootform check "$(Build.SourcesDirectory)" --format sarif --output rootform.sarif
      displayName: Analyze architecture
```

### Jenkins

```groovy
pipeline {
  agent { docker { image 'ghcr.io/rootform-dev/rootform:0.1.0' } }
  stages {
    stage('rootform') {
      steps {
        sh 'rootform init . --no-input'
        sh 'rootform check . --format json --output architecture.json'
      }
    }
  }
}
```

### CircleCI

```yaml
jobs:
  rootform:
    docker:
      - image: ghcr.io/rootform-dev/rootform:0.1.0
    steps:
      - checkout
      - run: rootform init . --no-input
      - run: rootform check . --format json --output architecture.json
      - store_artifacts:
          path: architecture.json
```

### Buildkite

```yaml
steps:
  - label: rootform
    plugins:
      - docker#v5.13.0:
          image: ghcr.io/rootform-dev/rootform:0.1.0
          propagate-environment: true
    command: |
      rootform init . --no-input
      rootform check . --format json --output architecture.json
```

### Locked run with a warm store

```text
checkout
→ restore ROOTFORM_HOME cache
→ rootform init . --locked
→ rootform check . --locked
```

### First run without a lock

```text
checkout
→ rootform check .
→ rootform.lock generated
→ published as an artifact, reported in the job log
→ analysis completes
```

Rootform never runs `terraform init`, `tofu init`, or any plan command. It reads
the evidence a workspace already exposes, such as `.terraform.lock.hcl`,
`TF_DATA_DIR`, materialized modules, or an explicitly provided Plan JSON. When
provider versions cannot be verified, the analysis continues with a warning
instead of failing the pipeline.
