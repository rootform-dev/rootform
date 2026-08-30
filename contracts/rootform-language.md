# Rootform Language contract

Status: development contract, version `0.1.0`.

Rootform Language defines deterministic rules that convert Terraform and
OpenTofu evidence into architecture meaning. It contains no renderer layout,
network behavior, provider executable, or opaque heuristic.

## Dialect identity

Each dialect root contains one `dialect.rf` declaration with lowercase
kebab-case name and exact `x.y.z` version. Requirements name exact dialect
versions. Provider blocks declare exact provider source addresses and proven
version envelopes.

Published dialect versions are immutable. One resolved set contains at most one
version of a dialect name.

## Stable primitives

Engine-recognized primitives are:

- `entity`, `scope`, and `detail` concepts;
- `context` definitions;
- `contribution`, `relation`, and `composition` rules;
- policies over canonical architecture facts.

Provider-specific concepts and resource knowledge belong to dialects. Engine
core never privileges a dialect name, including `core`.

## Namespaces

Unqualified `concept.NAME` and `context.NAME` references address only current
dialect declarations. Cross-dialect references use exact
`concept.DIALECT.NAME` or `context.DIALECT.NAME` syntax and may address current
dialect or one direct requirement. Transitive or unrelated dialect vocabulary
is unavailable.

## Evidence and meaning

Terraform references, dependencies, provider metadata, and naming proximity are
evidence, not automatic architecture relations. A rule must state how evidence
produces meaning. Missing, ambiguous, dynamic, dangling, or wrong-concept
evidence produces no successful fact and remains visible through diagnostics
or source outcomes.

Every discovered Terraform declaration receives exactly one explicit outcome:
represented, supporting, filtered by an accepted rule, unsupported, or failed.

## Determinism and privacy

Equivalent sources and resolved dialects produce equivalent canonical
artifacts independent of path, file enumeration order, host, time, and cache
location. Raw HCL ASTs, plans, state, secrets, and sensitive values never enter
compiled artifacts or presentation manifests.

## Presentation separation

Optional `presentation.json` lives beside `.rf` sources but is not Rootform
Language source. Presentation changes do not alter semantic artifact digest.
See `presentation-manifest.md`.
