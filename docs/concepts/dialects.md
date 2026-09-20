---
title: "Dialects and RF Vocabulary"
description: "How Rootform turns normalized resources into architectural meaning, and which semantics ship with the binary."
---

A Dialect is a named, versioned unit of source interpretation. It declares the
provider envelopes, local definitions, and Rules that turn Terraform or OpenTofu
evidence into architectural meaning. It never decides which source declarations
exist.

## Base representation comes first

Every normalized `resource` has a representation, even when no Dialect knows its
provider or type. The base carries the identity, address, kind, type, provider,
name, and location that Rootform reads from the source, and it depends on no
Rule, Concept, icon, or label.

A Rule adds interpretation to that base. It can classify the representation with
a Concept, establish contexts or relations, record a contribution, or compose
several representations into one. No Rule means an unclassified representation,
not an unsupported resource. The same boundary applies to `data` declarations:
they stay source declarations until a successfully applied Rule justifies a
representation for them.

Because the base does not depend on interpretation, a Rule or Concept can appear
or disappear without creating or deleting the underlying representation.

## Follow one declaration

```hcl title="aws/network/vpc.rf.hcl"
rule "subnet" {
  match {
    kind = "resource"
    type = "aws_subnet"
  }

  as = rf.concept.subnet

  context {
    as  = rf.context.network
    to  = rf.concept.virtual-network
    via = source.vpc_id
  }
}
```

`aws.rule.subnet` matches the `aws_subnet` declaration, classifies it as
`rf.concept.subnet`, and proves `rf.context.network` toward the representation
classified `rf.concept.virtual-network`. The resolved `vpc_id` reference is the
evidence for that placement; a source reference on its own never proves an
architecture fact. Compilation records the applied Rule, the emission, and the
successful resolution in [Architecture IR](architecture-ir.md).

## Resource coverage and Rule coverage differ

A supported provider can still contain resource types that no Rule interprets.
Every normalized `resource` contributes a base, while only Rules add
interpretation. A successful Rule may also justify a representation for a
`data` declaration. Representation coverage and interpretation coverage are
therefore separate counts. Read both before claiming that a Dialect covers a
type. Rootform never derives a Rule from a resource type, a provider version,
or a similar name.

## What a Dialect defines

- Concepts, Contexts, and Relations as local definitions, each with an optional
  `description`;
- provider envelopes: exact provider source addresses and version constraints;
- Rules: one `match` plus at least one classification, emission, or composition.

Local identities are owner-first, for example `google.concept.load-balancer`,
`google.relation.uses-network`, and `google.rule.application-load-balancer`. A
two-segment reference such as `concept.load-balancer` is local to the declaring
Dialect; a three-segment reference must name the current owner or `rf`.

A Rule that only matches is invalid, and a label, icon, or source type alone is
not an architectural contribution. Every applied Rule provides the provenance
for its own interpretation. A Concept is optional: its absence implies neither
the absence of a representation nor the absence of facts, and a composition
member never inherits its root's Concept. A Dialect cannot import another
Dialect; it references only its own symbols and `rf.*`.

## RF Vocabulary belongs to `rf`

RF Vocabulary is an embedded language contract, not a Dialect. Its owner is
`rf`, so its symbols use the reserved `rf.*` identifiers:

- Concepts: `rf.concept.virtual-network`, `rf.concept.subnet`,
  `rf.concept.kubernetes-cluster`, `rf.concept.managed-database`,
  `rf.concept.object-storage-container`, `rf.concept.service-identity`;
- Contexts: `rf.context.network`, `rf.context.runtime`;
- no Relations.

Treat these six Concepts and two Contexts as the release's exact contract. RF
Vocabulary ships as part of every release set, so it is never installed,
vendored, replaced, or excluded. A Dialect's dependency on it is derived from
actual `rf.*` references rather than declared by hand.

## Supplied Dialects ship with the release

Rootform embeds its supplied Dialects in the binary alongside RF Vocabulary.
They upgrade with the executable and need no install or project lock entry. A
project uses them by default. An explicit whole-owner exclusion or replacement
in `rootform.lock` can alter that effective set, except for reserved owner
`rf`.

Third-party, local, and replacement Dialects use external logistics instead.
`rootform.lock` records their exact owners, versions, and content digests, and
the content is installed under `$ROOTFORM_HOME/dialects/<owner>/<version>` or
vendored into the project under `.rootform/dialects`. Rootform never discovers a
Dialect from a registry, a provider, or a mutable index. `rootform init --locked`
validates the recorded selection and may acquire only the exact OCI pins already
in the lock. See
[Add a third-party Dialect or Policy Pack](../guides/external-content.md).

## Inspect a dialect

```sh
rootform list dialects
rootform list dialects -o wide
rootform show aws
rootform show aws.rule.subnet
```

`list dialects` prints one Dialect name per line. Add `-o wide` for versions,
origins and symbol counts. `show aws` reports the Dialect summary and qualified
references for its Concepts, Contexts, Relations and Rules. Copy a reference
into `show` to inspect its definition. Neither command changes the selection. Follow
[Reproduce a build offline](../guides/reproduce-build.md) for an intentional
update.

## Dialects and Policy Packs answer different questions

A Dialect decides what the architecture means. A [Policy Pack](policies.md) asks
whether the facts in that architecture satisfy a requirement. Selecting a
Dialect never selects governance, and a Policy cannot rewrite Dialect output.

Continue with [Write a Dialect](../dialect-authoring.md),
[Language tour](../language/tour.md), or
[Dialect definitions](../language/reference/dialects.md).
