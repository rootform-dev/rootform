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
- Every representation has a stable ID derived from the normalized identity of
  its source root; the ID never depends on Rule, Concept, label, version, icon,
  or textual location.
- Every fact carries bounded provenance entries naming successful resolutions,
  rules, and emissions.
- Unknown and unsupported input stays explicit; a document with unknown data
  is never truncated and presented as complete.
- Architecture relations express accepted domain meaning, not raw Terraform
  dependency edges. Source dependencies remain source facts.
- Semantic meaning carries no renderer coordinates, icon assets, or layout
  instructions.

## Main sections

- `format_version` and `generator`: document contract and effective
  producer/release-set identity;
- `source`: normalized identity, declarations, locations, source
  dependencies, and distinct accounting for source, representation,
  interpretation, composition, and emissions;
- `semantics`: RF Language contract, exact owners with nature/origin/versions
  and digests, definitions, Rules, emission contracts, and
  release-set/selection identities;
- `architecture`: uniform representations with optional Rule and Concept,
  proven memberships, contexts, relations, contributions, and omissions;
- `resolutions`: bounded provenance records backing successful facts;
- `diagnostics`: canonical sanitized diagnostics tied to their phase and
  object.

## Uniform representations

`architecture.representations` is the single representation collection. Each
representation carries a stable ID, a reference to its root source declaration,
base metadata (kind, type, address, name, observed provider, location), an
optional applied Rule, and an optional Concept. Rule applied and Concept are
omitted when absent; no synthetic Rule, generic Concept, or architectural fact
is created for coverage.

For every representation and emission of its active Rule, closure consists of
one or more confirmed facts, one omission, or an emission-scoped diagnostic.
Facts may coexist with a diagnostic when another candidate remains unknown;
that query is incomplete despite confirmed evidence. Missing closure is
invalid.

A Rule-free resource base remains valid and complete as to structural
existence. `entity/scope/detail` categories no longer exist; N/F is derived at
presentation time from declared children, not from a stored category.

## Accounting

Source, representation, interpretation, composition, and emission accounting
are recorded separately with coherent links. Old exclusive outcomes
(`represented`/`supporting`/`filtered`/`unsupported`/`failed`) are not the
model; `unsupported` is never a synonym for missing Rule. A normalized
resource is never filtered merely because no Rule knows it.

## Semantics and selection

`semantics` records the RF Language contract, active owners (vocabulary or
dialect) with versions and digests, public definitions, Rules with optional
classifications, emission signatures and typed targets, composition contracts,
release-set identity, and effective selection (exclusions and replacements).
No unit excluded or replaced becomes active by mere presence in the binary.

## Saved IR

Saved IR is self-contained for rendering, inspection, Diff, explain, and
Policy evaluation. Consumers never reload producer Dialects, and linking on a
saved IR uses only its snapshot, never the currently embedded release set.
Snapshot excludes raw HCL, secrets, raw plans/state, absolute paths, `.rf`
source, full attempt ledgers, provider-wide coverage, and authored capability
catalogs.

## Validation

A consumer must reject unsupported `format_version`, forbidden unknown fields,
invalid identifiers, dangling references, duplicate identities, noncanonical
ordering, inconsistent accounting/references/closure, unresolved successful
provenance, or an active emission without closure. A rejected document
supports no compliance or no-change claim in any consumer.

Format version is independent from Rootform executable version. Breaking field
or meaning changes require a new format version.
