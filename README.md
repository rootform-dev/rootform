# Rootform

[![Source license](https://img.shields.io/badge/source-Apache--2.0-blue.svg)](LICENSE)

Rootform turns Terraform and OpenTofu into deterministic, explainable
architecture documents.

This repository contains Rootform's contracts, schemas, documentation,
examples, and release metadata.

## What lives here

- [`contracts/`](contracts/): Rootform language, Architecture IR, Diff, policy,
  lock, presentation, and release contracts;
- [`schemas/`](schemas/): machine-readable public schemas;
- [`docs/`](docs/): installation, concepts, CLI, dialect authoring, security,
  offline operation, and integrations;
- [`examples/`](examples/): synthetic AWS, Azure, GCP, Kubernetes, and
  multi-cloud examples;
- [`policy-packs/`](policy-packs/): package-ready public Policy Pack examples.

## Install

Install an exact release version, verify its published SHA-256 checksum, and
read license and notices included with archive. Then run directly from
Terraform or OpenTofu root; release carries RF Vocabulary and supplied
Dialects:

```bash
rootform run .
```

See [`docs/installation.md`](docs/installation.md).

## Dialect lifecycle

Rootform release embeds one immutable supplied Dialect set. Third-party
Dialects may be packaged and published through generic OCI commands.
`rootform.lock` records only explicit additions, exclusions, and whole-owner
replacements. No Dialect discovery index exists. Project vendor is exclusive
execution source when present; `$ROOTFORM_HOME/dialects` stores exact installed
third-party units.

See [`contracts/dialect-distribution.md`](contracts/dialect-distribution.md) and
[`contracts/rootform-oci-core-profile.md`](contracts/rootform-oci-core-profile.md).

## Policy Pack lifecycle

Policy Packs version and distribute governance independently from Dialects. A
Policy belongs to one pack and uses owner-first identity. Source declares no
semantic versions; linking derives exact RF Vocabulary and Dialect pins from
qualified references and Architecture IR.

See [`contracts/policy-pack-distribution.md`](contracts/policy-pack-distribution.md)
and [`baseline` example](policy-packs/baseline/pack.rf.hcl). Repository makes no
publication claim for this local pre-release source.

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
