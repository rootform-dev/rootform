---
title: "Evidence and target resolution"
description: "Understand identity, endpoint, value matching, verified references and the closures they support."
---

A subnet's `vpc_id` names something. To emit network Context, Rootform must
establish which eligible virtual network it names. Knowing the target Concept
alone is insufficient: several instances can share that classification.

## Two ways to identify a target

**Value matching** compares an evaluated source value with target identity
attributes. The target Rule declares `identity`; the emission's nested `match`
chooses paths with `by` and a comparison `strategy`. For a subnet's VPC ID,
`target.id` and `"exact"` express the intended comparison.

**Verified reference evidence** names an instance through the expression
recorded in a paired saved plan. The target Rule declares which attribute paths
are endpoints. For example, `aws_vpc.main.id` can identify `aws_vpc.main` when
`id` is declared in its `endpoint` block, even before that ID is known.
The `.rf.hcl` emission still reads `via = source.vpc_id`; it does not contain
that Terraform address.

These solve different problems. `identity` does not recover a reference from
an unknown value. `endpoint` does not make a literal value unique. An emission
without nested `match` has no value-comparison route. Without a usable target
identity or endpoint, classification alone cannot supply the missing proof.

The [Rule walkthrough](read-a-rule.md) shows both declarations in their actual
positions. [Rules](../reference/rules.md#identity-and-endpoint-declarations) and
[Emissions](../reference/emissions.md#explicit-attribute-match) define their syntax.

## What each input supplies

| Input | Value evidence | Verified reference evidence |
| --- | --- | --- |
| State JSON | Recorded values, with sensitivity masks | None |
| Plan JSON alone | Values available in each supported stage, with unknown and sensitivity masks | None |
| Plan JSON with verified saved plan | Same evaluated values | Supported direct references and pass-through chains, on Planned only |

A state records producer evidence; it is not a live cloud inventory.
Plan JSON reference lists also record dependencies, but cannot distinguish
`vpc.id` from a transformation of that ID. The optional saved plan supplies
the configuration needed to make that distinction. Rootform verifies its
pairing with the JSON; a working checkout does not substitute for it.
A refused pair is reported and recorded. `--require-enrichment` makes refusal
stop the run. [Plan inputs](../../inputs/plans.md) gives the export procedure.

Bare references and supported pass-through variables, locals and module outputs
can name an endpoint. Functions, conditionals, computed indexes and transformed
references cannot. Their evaluated values may still match by identity.
`via = provider.host` specifically needs a verified provider configuration
reference on Planned; Rootform never reads its literal provider value.
See [Traversals and scope](../reference/traversals.md#value-and-identity-evidence)
for exact supported forms and collection handling.

## Identity scope and ambiguity

A target identity defaults to `scope = "provider"`: value comparisons require
compatible provider address and alias. An unavailable alias leaves compatibility
uncertain, including for state input. Rootform cannot drop that candidate to
force a unique result. Use `"global"` only for identities unique across provider
configurations by construction, such as a service-account email.

Multiple known matching targets, or candidates whose identities cannot be
compared, prevent a unique value match. Listing `id`, `self_link` and `name`
does not build a composite key; it accepts alternative reference forms. Add a
path only when it carries the form the source may use.

A verified reference can identify one instance despite shared or unknown
identity values. It can also name an instance across provider configurations,
because it identifies the instance directly rather than comparing scoped values.

## Reconcile the evidence

| Available proof | Conclusion |
| --- | --- |
| One unique, compatible value match | Fact with `value` evidence |
| Verified endpoint reference; value unknown, sensitive or unavailable | Fact with `traversal` evidence, without reading the sensitive value |
| Value comparison corroborates the referenced instance | Fact with `both` evidence |
| Known value excludes the referenced instance or matches only other candidates | `indeterminate(reference_ambiguous)`, with `EVIDENCE_CONFLICT` |
| No verified reference and source value unknown or sensitive | Indeterminate with the corresponding reason |

A reference must still satisfy the emission's `to` contract. Naming an
uninterpreted instance is insufficient for a fact target. Known values never
override conflicting verified reference evidence.

## Targets outside the inventory

`external = "allow"` permits a known unmatched value to identify an external
endpoint only after eligible in-scope candidates have been excluded. An unknown
candidate prevents that conclusion. The default `"deny"` leaves it indeterminate;
neither outcome proves remote existence or absence.

Disclosure is separate: `"none"` omits external identity from saved output,
`"record"` permits it in JSON, and `"report"` also permits it in reports.
Sensitive values never become external identities. Omission of `disclose`
defaults to `"none"`; omission of `external` defaults to `"deny"`.
[External and data endpoints](../reference/emissions.md#external-and-data-endpoints)
owns the exact rules.

## Closure records what was settled

A closure belongs to one source instance, emission and stage. `resolved` means
the emission settled its endpoints; `absent` means evidence established no
endpoint under its declared policy; `indeterminate` preserves an unresolved
part and its reason. It does not mean the object itself is missing.

`on_null` and `on_empty` let the author decide whether a **known** null or empty
value establishes absence or remains indeterminate. An undefined path, unknown
value or sensitive value without reference proof cannot establish absence.
A list can establish some facts while an unresolved element keeps the closure
indeterminate. Those confirmed facts remain usable, but do not prove a complete
count or the absence of other endpoints.

Continue with [Composition](composition.md) for implementation members, or
[Policies over facts](policies.md) for what an assertion can conclude from
these closures. Exact outcomes and reasons live in
[Omission and uncertainty](../reference/emissions.md#omission-and-uncertainty).
