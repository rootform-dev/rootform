# Rootform language contract

Status: development contract, version `0.1.0`.

The Rootform language defines deterministic rules that convert Terraform and
OpenTofu evidence into architecture meaning. It contains no renderer layout,
network behavior, provider executable, or opaque heuristic.

## Dialect identity

Each dialect source root contains exactly one `dialect` declaration with a
lowercase kebab-case name and exact `x.y.z` version. Its filename has no
meaning. Requirements name exact dialect versions. Provider blocks declare
exact provider source addresses and proven version envelopes.

Published dialect versions are immutable. One resolved set contains at most one
version of a dialect name.

## Stable primitives

Engine-recognized primitives are:

- `entity`, `scope`, and `detail` concepts;
- `context` and shared `relation` definitions;
- `context`, `contribution`, local or shared `relation`, and `composition`
  emissions inside rules;
- policies in separate Policy Packs over canonical architecture facts.

Provider-specific concepts and resource knowledge belong to dialects. Engine
core never privileges a dialect name, including `core`.

## Namespaces

Unqualified `concept.NAME`, `context.NAME`, and `relation.NAME` references
address current Dialect vocabulary. Cross-Dialect references use
`concept.DIALECT.NAME`, `context.DIALECT.NAME`, or `relation.DIALECT.NAME` and
require one direct dependency. Policy Packs always use qualified references.
Transitive or unrelated vocabulary is unavailable.

A labelled `relation "name"` inside a rule introduces and emits local
predicate `<dialect>/name`. An unlabelled relation emission uses `as =
relation.owner.name` and may reference only a shared top-level relation. Label
plus `as` is invalid. Predicate identity excludes rule, endpoints, package
version, digest, and fact provenance.

## Evidence and meaning

Terraform references, dependencies, provider metadata, and naming proximity are
evidence, not automatic architecture relations. A rule must state how evidence
produces meaning. Each authored fact block compiles to a stable emission. A
successful fact names that emission. Conclusively empty active emission records
an omission; unknown, ambiguous, partially dangling, or incomparable evidence
records an emission-scoped diagnostic. Unknown evidence never proves absence.

Every discovered Terraform declaration receives exactly one explicit outcome:
represented, supporting, filtered by an accepted rule, unsupported, or failed.

## Determinism and privacy

Equivalent sources and resolved Dialects produce equivalent canonical
artifacts independent of path, file enumeration order, host, time, and cache
location. Content digests identify exact compiled package content. Semantic
digests identify executable IR/query behavior and exclude descriptions,
presentation, and source ranges. Raw HCL ASTs, plans, state, secrets, and
sensitive values never enter compiled artifacts or presentation manifests.

## Presentation separation

Optional `presentation.json` lives beside `.rf` sources but is not Rootform
Language source. Presentation changes do not alter semantic artifact digest.
See `presentation-manifest.md`.
