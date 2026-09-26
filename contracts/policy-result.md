# Policy Result contract

Current format version: `1`.

Policy evaluation consumes one Form from a validated Rootform document and linked
Policy Pack artifacts (or their source, linked automatically and locally
during a source check). It never re-reads Terraform, reloads producer Dialects,
accesses the network, recompiles locked source, or upgrades unresolved
evidence. A Policy evaluates exactly one Form. Its result is separate from the
Rootform document.

Policies belong to policy packs, never to dialects. A dialect may not carry,
override, or append policy; a policy pack may not change dialect semantics.
Pack selection is never automatic: evaluation uses only packs recorded in the
project lock, named explicitly, or linked from an explicitly selected source.

## Targets and queries

A Policy target composes `concept`, `rules`, and `dialects` dimensions:
OR within each list, AND between dimensions; at least `concept` or `rules` is
required, and present lists are non-empty. `concept` examines the effectively
established classification; `rules` examines the effectively applied proper
Rule; `dialects` filters the owner of that interpretation. `rf` is not a
dialect owner usable in `dialects`. A supporting member never inherits its
root's eligibility.

A base without Rule or Concept is not selected by these targets. A Rule-target
is satisfied only by representations to which that Rule is actually applied;
no fallback to type or provider exists. A concept-only target never fails for
lacking a producer: the symbol must exist, and zero instances at runtime give
`not_evaluated` for that policy.

Query signatures are:

```text
contexts(dimension[, target])
relations(predicate[, target])
contributions(contributor)
```

Targets are typed Concept or Rule references. Queries return deduplicated fact
IDs plus `supported` and `complete`. Support exists when at least one active
emission contract is compatible with the evaluated target. Completeness
requires the relevant contributor population to be determined and all their
active emissions closed; a source or interpretation uncertainty that could hide
a relevant contributor prevents a complete zero.

Cardinality counts distinct contributing representations, not emissions or
composition members. `length(q)` is known only when both flags are true.
`exists(q)` is true with any confirmed fact, false only for a supported
complete zero, and indeterminate otherwise. Negation and boolean operators
follow three-valued logic. A Rule-free base provides no emission contract; its
absence of facts creates neither support, omission, nor proven zero.

## Outcomes

Each evaluation has one outcome: `passed`, `violated`, or `indeterminate`.
A result contains exact Rootform document format version and semantic pins, linked
Policy Pack identities and pins, global `status`, `compliant`, explicit
policy scope and target coverage, summary, ordered evaluations, ordered
violations, and ordered sanitized diagnostics. Violations identify policy,
stable target, message, source path and line when available, plus inspected
fact identifiers.

A result identifies each evaluated Policy Pack by name and version and every
policy by its pack-qualified identity. Exact pack source and acquisition pins
remain in `rootform.lock`; policy results do not duplicate them. Changing pack
or policy identity changes result meaning; a result is valid only for the
Form semantics and pack selection it records.

Global status is `compliant`, `violated`, `indeterminate`, or `not_evaluated`.
`compliant` is true only when every selected policy is satisfied on its
defined architectural domain, with that scope stated in the artifact itself;
it never implies universal infrastructure inventory compliance. A selected
policy with zero targets increments coverage as not evaluated and prevents
compliance. Priority is `violated`, then `indeterminate`, then
`not_evaluated`, then `compliant`. A linking error prevents any compliance
verdict and yields an error/indeterminate result with a non-success exit.

CLI exit status is `0` for compliant, `1` for violated, `2` for command misuse,
and `3` for indeterminate or not evaluated.

Rootform may also emit SARIF as a presentation of the same policy result. SARIF
does not change evaluation meaning or exit status.

## Linking

Explicitly provided linked artifacts are replayed strictly: mismatch of
format, contract, or pins against the evaluated Form is a terminal refusal with
no fallback and no relink. In the source path, check derives pins from the document
semantics, links deterministically and locally on cache miss, validates, caches,
and evaluates; a compatible evolution of a pinned unit triggers a new local
link without prompt or network. Linked cache state never changes the verdict,
semantic evidence, or linked digest. See
[`policy-pack-distribution.md`](policy-pack-distribution.md) and
[`../docs/offline-security.md`](../docs/offline-security.md).
