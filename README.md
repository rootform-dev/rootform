# Rootform

[![Source license](https://img.shields.io/badge/source-Apache--2.0-blue.svg)](LICENSE)
[![Binary license](https://img.shields.io/badge/binaries-proprietary-orange.svg)](LICENSES/ROOTFORM-BINARY-LICENSE-REVIEW.md)

Rootform turns Terraform and OpenTofu into deterministic, explainable
architecture documents.

This repository is private during migration and is prepared for a later manual
visibility change. It is Rootform's distribution and public contract surface;
the proprietary engine source is not present here or in this repository's
history.

## What lives here

- [`contracts/`](contracts/): Rootform Language, Architecture IR, Diff, policy,
  lock, presentation, and release contracts;
- [`schemas/`](schemas/): machine-readable public schemas;
- [`docs/`](docs/): installation, concepts, CLI, dialect authoring, security,
  offline operation, and integrations;
- [`examples/`](examples/): synthetic AWS, Azure, GCP, Kubernetes, and
  multi-cloud examples;
- `releases/`: checksums, SBOMs, manifests, and license bundles for published
  versions once releases begin.

## Install

No supported public release exists yet. Private migration candidates are not a
support commitment. When releases begin, install only an exact version, verify
its published SHA-256 checksum, and keep its accompanying binary license and
notices.

See [`docs/installation.md`](docs/installation.md).

## Licensing boundary

- Repository source, contracts, docs, examples, and tooling: Apache-2.0.
- Rootform executable release assets: separate Rootform Binary License.
- Rootform name and logos: trademark rights reserved.
- Third-party assets: original owner terms.

Current binary license text requires legal review before any public binary
release. See [`LICENSES/ROOTFORM-BINARY-LICENSE-REVIEW.md`](LICENSES/ROOTFORM-BINARY-LICENSE-REVIEW.md),
[`TRADEMARKS.md`](TRADEMARKS.md), and
[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).
