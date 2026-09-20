# Rootform language contract

Status: development contract, version `0.1.0`.

The Rootform language (RF) defines deterministic rules that convert Terraform
and OpenTofu evidence into architecture meaning. It contains no renderer
layout, network behavior, provider executable, or opaque heuristic. Sources
are written in `.rf.hcl` or `.rf.json`.

## Units

RF has three source-unit responsibilities, never mixed in one tree:

- a Dialect: one `dialect` declaration, local definitions, and Rules;
- the RF Vocabulary: common definitions only, identity and version provided by
  its manifest, no provider, no Rule, no source matching;
- a Policy Pack: one `policy_pack` declaration with its source version, then
  its Policies.

Each dialect source root contains exactly one `dialect` declaration with a
lowercase kebab-case owner and exact `x.y.z` version. Its filename has no
meaning. Provider blocks declare exact provider source addresses and proven
version envelopes.

## Symbols and qualification

An identity is `owner + kind + name`: for example `rf.concept.managed-database`,
`google.rule.cloud-sql-instance`, `rf.context.network`, or local
`context.foo`. Two segments are a local reference; three segments a qualified
reference. Owners and names are lowercase kebab-case without dots. `rf` is
reserved for the RF Vocabulary; `rootform` is a legal dialect owner.

A dialect references only its own symbols and those of `rf`. There is no
implicit import, no local-to-RF fallback, and no shadowing. Policies use only
qualified references. The owner register states each owner's nature:
`vocabulary` or `dialect`. Canonical IR symbol identity is the qualified form.

Compilation proceeds in two passes: collection of declarations and local
labels, then reference resolution. File order has no effect. Repeated labelled
blocks across Rules in one dialect designate the same local symbol; a top-level
homonymous definition may provide its documentation. Two homonymous top-level
definitions are an error, even when identical.

## Rules

A Rule has exactly one `match`, zero or one `as` to a Concept, zero or more
context/relation/contribution emissions, and zero or one non-empty composition.
It must contribute at least one classification, emission, or composition; a
match-only Rule is invalid, and declaring only a label, icon, or source type is
not an architectural contribution.

Eligibility follows source kind, exact `match.type`, declared provider with
applicable compatibility, and an optional `where`; a Rule eliminated earlier
never evaluates `where`. `resource` is the default kind; `data` stays
explicit. At most one proper Rule is applied per source declaration.

Context and relation blocks have two exclusive forms: a labelled block that
introduces or uses a local symbol, and a label-free block with `as` referencing
an existing symbol. Label and `as` together are invalid. A contribution has no
named predicate and no `as`. Each emission requires a typed `to` target, a
`via` proof path, and an optional explicit attribute reconciliation.

Expressions stay bounded: recognized static paths, scalars, typed comparisons,
and boolean operators. No script, arbitrary call, or selector DSL.

## Evidence and meaning

Terraform references, dependencies, provider metadata, and naming proximity are
evidence, not automatic architecture relations. A Rule must state how evidence
produces meaning. Each authored fact block compiles to a stable emission. An
applied Rule provides provenance for that representation's own interpretation;
a failed candidacy is not an applied Rule. A successfully applied Rule enriches
an existing representation base; a later Rule enriches the same representation.
An interpretation failure never deletes its base.

Conclusively empty active emission records an omission; unknown, ambiguous,
partially dangling, or incomparable evidence records an emission-scoped
diagnostic. Confirmed facts and incompleteness diagnostics may coexist. Unknown
evidence never proves absence.

## Concepts

A Concept is an optional nominal architectural classification. Its absence
implies neither absence of representation nor absence of facts. When a Concept
is established it corresponds exactly to the `as` of the applied Rule; it is
never derived from the Rule's name and no member inherits a root's Concept.
`kind = entity | scope | detail` no longer exists; the source `kind` of
matching keeps only its eligibility role.

## Policies

Policies belong to separate Policy Packs over canonical architecture facts, use
qualified references only, and never declare semantic dependency versions.

## Determinism and privacy

Equivalent sources and resolved units produce equivalent canonical artifacts
independent of path, file enumeration order, host, time, and cache location.
Content digests identify exact compiled package content. Semantic digests
identify executable IR/query behavior and exclude descriptions, presentation,
and source ranges. Raw HCL ASTs, plans, state, secrets, and sensitive values
never enter compiled artifacts, the IR, or presentation manifests.

## Presentation separation

Optional `presentation.json` lives beside `.rf.hcl` sources but is not Rootform
Language source, and its resource-type keys are independent of Rule and Concept
contracts. Presentation changes do not alter semantic artifact digest.
See `presentation-manifest.md`.
