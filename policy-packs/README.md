# Policy pack examples

Rootform separates architecture semantics from architecture governance.
[Dialects](../contracts/dialect-distribution.md) define what a declaration
means; policy packs define which meanings are acceptable. A policy always
belongs to exactly one policy pack and never to a dialect.

This directory holds synthetic public examples of Rootform Policy Packs. Each
example directory is a complete pack source unit and is package-ready at the
layer boundary described in
[`contracts/policy-pack-distribution.md`](../contracts/policy-pack-distribution.md):
source files are `*.rf` or `*.rf.json`, and legal text is limited to
`LICENSE*`, `NOTICE*`, and `THIRD_PARTY_NOTICES*`. Anything else would be
rejected by the pack layer boundary.

Pack identity is a validated name plus an exact semantic version. The example
below is versioned `0.1.0`, uses only the referenced `core` dialect
vocabulary, and is provider-neutral: selecting the pack never installs a
provider dialect.

## Example: `baseline/`

[`baseline/`](baseline/) is a minimal provider-neutral pack that depends only
on `core@0.1.0`. It contains two demonstration policies over core concepts:

- `baseline/private-database-reachability` — managed databases must be
  privately reachable from a virtual network or subnet;
- `baseline/cluster-network-context` — Kubernetes clusters must belong to a
  network context.

The examples are synthetic and exist only to show the pack authoring shape.
They never become authoritative governance and never become dialect source.

## Validation

`bun run verify` compiles this source with the exact verified Rootform binary,
packages it twice to prove deterministic OCI bytes, and validates a publication
dry-run. Repository checks independently enforce its legal-file and source-file
boundary. Neither path contacts a registry.

## Publication flow

Publication is a separate, authorized step. The
[`publish example policy packs`](../.github/workflows/publish-policy-packs.yml)
workflow follows the same verified-release and OCI evidence boundary as
official image publication:

```text
rootform package policy-packs policy-packs/baseline \
  --to LAYOUT --source-url URL --revision REV --documentation-url URL \
  --licenses Apache-2.0
rootform publish policy-packs LAYOUT --to ghcr.io/rootform-dev/policy-packs
```

`package policy-packs` is local and offline; destination repository is recorded
only at publish time. Destination tags are immutable
`policy-pack-<name>-<version>`, for example
`policy-pack-baseline-0.1.0`. Publication uses `workflow_dispatch`, minimal
`packages: write` permission, pinned action SHAs, no persistent secrets, and an
isolated `DOCKER_CONFIG`. Workflow then requires public package visibility and
proves anonymous pulls by tag and digest before success.

Provenance annotations (`org.opencontainers.image.source`, `revision`,
`documentation`, `licenses`) are supplied explicitly at package time;
provenance is never discovered from Git state or machine paths.
