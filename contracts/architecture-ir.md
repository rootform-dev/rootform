# Architecture IR contract

Current format version: `0.1.0`.

Architecture IR is Rootform's canonical, provider-neutral architecture
document. [`../schemas/architecture-ir.schema.json`](../schemas/architecture-ir.schema.json)
is machine-readable source for field types and bounds.

## Required properties

- Every stable object uses content-derived identity, never display label or
  array position.
- Collections serialize in canonical order.
- Every discovered declaration appears in source accounting exactly once.
- Provenance references only successful resolutions.
- Unknown and unsupported input stays explicit.
- Architecture relations express accepted domain meaning, not raw Terraform
  dependency edges.
- Semantic meaning carries no renderer coordinates, icon assets, or layout
  instructions.

## Main sections

- `source`: normalized input identity and complete declaration accounting;
- `semantics`: exact dialect identities and versions;
- `architecture`: entities, scopes, details, contexts, contributions, and
  relations;
- `trace`: bounded provenance records backing non-trivial conclusions;
- `diagnostics`: canonical sanitized diagnostics.

## Validation

A consumer must reject unsupported `format_version`, unknown fields forbidden
by schema, invalid identifiers, dangling references, duplicate identities,
noncanonical ordering, invalid accounting, or unresolved successful
provenance. A rejected document supports no compliance or no-change claim.

Format version is independent from Rootform executable version. Breaking field
or meaning changes require a new format version.
