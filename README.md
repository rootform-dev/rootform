# Rootform

[![Source license](https://img.shields.io/badge/source-Apache--2.0-blue.svg)](LICENSE)

Rootform turns Terraform and OpenTofu into deterministic, explainable
architecture documents.

This repository contains Rootform's contracts, schemas, documentation,
examples, and release metadata.

## What lives here

- [`contracts/`](contracts/): Rootform Language, Architecture IR, Diff, policy,
  lock, presentation, and release contracts;
- [`schemas/`](schemas/): machine-readable public schemas;
- [`docs/`](docs/): installation, concepts, CLI, dialect authoring, security,
  offline operation, and integrations;
- [`examples/`](examples/): synthetic AWS, Azure, GCP, Kubernetes, and
  multi-cloud examples.

## Install

Install an exact release version, verify its published SHA-256 checksum, and
read the license and notices included with its archive.

See [`docs/installation.md`](docs/installation.md).

## Licensing boundary

- Repository source, contracts, docs, examples, and tooling: Apache-2.0.
- Rootform executable release assets: separate Rootform Binary License.
- Rootform name and logos: trademark rights reserved.
- Third-party assets: original owner terms.

See [`TRADEMARKS.md`](TRADEMARKS.md) and
[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).
