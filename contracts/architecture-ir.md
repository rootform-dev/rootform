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
- Every fact carries bounded provenance entries naming successful resolutions,
  rules, and emissions.
- Unknown and unsupported input stays explicit.
- Architecture relations express accepted domain meaning, not raw Terraform
  dependency edges.
- Semantic meaning carries no renderer coordinates, icon assets, or layout
  instructions.

## Main sections

- `source`: normalized input identity and complete declaration accounting;
- `semantics`: exact Dialect IDs, versions, content and semantic digests, plus
  compiled concepts, contexts, relations, rules, and emission shapes;
- `architecture`: entities, scopes, details, contexts, contributions, and
  relations, plus sparse omissions for proven-empty active emissions;
- `resolutions`: bounded provenance records backing successful facts;
- `diagnostics`: canonical sanitized diagnostics.

For every representation and emission of its active rule, closure consists of
one or more confirmed facts, one omission, or an emission-scoped diagnostic.
Facts may coexist with a diagnostic when another candidate remains unknown;
that query is incomplete despite confirmed evidence. Missing closure is
invalid.

Saved IR is self-contained for rendering, inspection, Diff, explain, and
Policy evaluation. Consumers never reload producer Dialects. Snapshot excludes
`.rf` source, full attempt ledgers, provider-wide coverage, and authored
capability catalogs.

## Validation

A consumer must reject unsupported `format_version`, forbidden unknown fields,
invalid identifiers, dangling references, duplicate identities, noncanonical
ordering, invalid accounting, unresolved successful provenance, or an active
emission without closure. A rejected document supports no compliance or
no-change claim.

Format version is independent from Rootform executable version. Breaking field
or meaning changes require a new format version.
