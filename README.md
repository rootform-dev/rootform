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
  multi-cloud examples;
- [`policy-packs/`](policy-packs/): package-ready public Policy Pack examples.

## Install

Install an exact release version, verify its published SHA-256 checksum, and
read the license and notices included with its archive. Then run directly from
Terraform or OpenTofu root; project preparation initializes missing dialects
before local server starts:

```bash
rootform run .
```

See [`docs/installation.md`](docs/installation.md).

## Dialect lifecycle

VCS is authoring provenance. OCI registries distribute dialects. Indexes provide
discovery. `rootform.lock` records exact selection. Project vendor is exclusive
execution source when present; verified store/cache supports materialization
and offline reuse. Docker-compatible credentials authenticate private
registries. No forge or Rootform Cloud service is required.

See [`contracts/dialect-distribution.md`](contracts/dialect-distribution.md) and
[`contracts/rootform-oci-core-profile.md`](contracts/rootform-oci-core-profile.md).

## Policy Pack lifecycle

Policy Packs version and distribute governance independently from Dialect
semantics. A policy belongs to one pack, uses pack-qualified identity, and
declares exact Dialect requirements without installing them. Same OCI,
authentication, lock, cache, offline, and vendor primitives apply under
separate Policy Pack identities and paths.

See [`contracts/policy-pack-distribution.md`](contracts/policy-pack-distribution.md)
and the [`baseline` example](policy-packs/baseline/pack.rf). Its published OCI
artifact is visible in the
[`rootform-dev/policy-packs` GHCR package](https://github.com/orgs/rootform-dev/packages/container/package/policy-packs).

## Licensing boundary

- Repository source, contracts, docs, examples, and tooling: Apache-2.0.
- Rootform-owned executable code: [Elastic License 2.0](dependencies/ROOTFORM-BINARY-LICENSE.txt)
  (`Elastic-2.0`).
- Official release archives and OCI images embed that binary notice; repository
  `LICENSE` remains Apache-2.0 and does not license distributed executables.
- Rootform name and logos: trademark rights reserved.
- Dialects, third-party components, and assets: their identified terms.

See [`TRADEMARKS.md`](TRADEMARKS.md) and
[`THIRD_PARTY_NOTICES.txt`](THIRD_PARTY_NOTICES.txt).
