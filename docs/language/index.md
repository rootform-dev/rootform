---
title: "Rootform language"
description: "Learn how .rf.hcl sources give Terraform and OpenTofu declarations architectural meaning, then evaluate policies over the resulting Architecture IR."
---

The Rootform language is the public authoring language for **Dialects** and
**Policy Packs**. A Dialect explains what Terraform or OpenTofu declarations
mean. A Policy Pack asks bounded questions about the architecture facts those
Dialects produced.

Rootform reads two source forms: human-authored `.rf.hcl` and HCL JSON `.rf.json`.
HCL provides their surface syntax. Rootform defines the accepted blocks,
attributes, expressions, references, and evaluation rules. General Terraform
language and general HCL expressions are not part of this contract.

## Choose a path

| Goal | Start here |
| --- | --- |
| Understand the language through one real architecture | [Language tour](tour.md) |
| Author a provider Dialect | [Write a Dialect](../dialect-authoring.md) |
| Express and evaluate one governance rule | [Check an architecture](../guides/check-architecture.md) |
| Version and distribute several policies | [Write a Policy Pack](write-policy-pack.md) |
| Format, compile, test, and inspect definitions | [Test and validate](test-validate.md) |
| Check exact accepted forms | [Language reference](reference/index.md) |

## Two paths through the language

A Dialect participates while Rootform builds an architecture:

```text title="Dialect path"
.rf.hcl source
  → compiled Dialect
  → matched Terraform/OpenTofu declarations
  → Architecture IR facts and provenance
```

A Policy Pack participates after those facts exist:

```text title="Policy path"
.rf.hcl source
  → compiled Policy Pack
  → linked semantic pins
  → evaluation over Architecture IR facts
  → passed, violated, or indeterminate result
```

Architecture IR is the shared result. [Architecture Diff](../concepts/diff.md)
compares two documents over that contract, and
[Check an architecture](../guides/check-architecture.md) evaluates policies
against one. No policy rewrites the document, reads a live cloud account, or
repairs missing Dialect coverage.

## Dialects give declarations meaning

Every normalized `resource` has a base representation, identified by source
facts alone: identity, address, kind, type, provider, name, and location. A Rule
adds interpretation to that base. It can classify the representation with a
Concept, establish contexts or relations, record a contribution, or compose
several representations into one. A missing Rule leaves the base unclassified,
which is not an error.

A Dialect declares provider envelopes, local definitions, and Rules:

- a **Concept** is optional nominal classification;
- a **Context** names one placement dimension;
- a **Relation** names a directed predicate;
- facts connect representations through contexts, contributions, or relations;
- composition records exclusive source memberships while every member keeps its
  own base.

This Rule from the supplied AWS Dialect recognizes a subnet and records its VPC
reference as network context:

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

The rule establishes meaning and evidence: the declaration is classified
`rf.concept.subnet`, and its `vpc_id` reference may establish
`rf.context.network` toward `rf.concept.virtual-network`.

A supported provider can still contain resource types that no Rule interprets.
Every normalized `resource` contributes a base while only Rules add
interpretation, so representation coverage and interpretation coverage are
separate counts. Read [Dialects and RF Vocabulary](../concepts/dialects.md) for
the product model, then [write a Dialect](../dialect-authoring.md) to extend
coverage.

## Policies ask about known facts

A Policy target selects the representations it evaluates along three dimensions:
Concept, applied Rules, and Dialect owners. Values inside a list are ORed,
dimensions are ANDed, and at least `concept` or `rules` is required. An assertion
uses one of three closed fact queries: `contexts`, `relations`, and
`contributions`.

Within a Policy Pack source root, one top-level `policy_pack` manifest names the
pack. Policies are top-level declarations in any `.rf.hcl` or `.rf.json` file
beneath that same root:

```hcl title="policies/subnet-network-context.rf.hcl"
policy "subnet-network-context" {
  target {
    concept = rf.concept.subnet
  }

  assert = exists(contexts(rf.context.network, rf.concept.virtual-network))
  message = "Subnets must have an established virtual network context."
}
```

The manifest assigns pack identity to this policy through the shared source root.
The policy needs neither nesting nor a pack reference.

An empty query means zero only when the vocabulary, active emission support, and
all applicable closure are known. Unavailable or incompatible evidence makes an
affected query indeterminate, including under negation. A selected policy whose
target matches no representation contributes zero evaluations and is counted as
`not_evaluated`, so the run reports `compliant = false` and exit 3.

Read [Policies and Policy Packs](../concepts/policies.md) for governance meaning.
Use [Check an architecture](../guides/check-architecture.md) for a complete
evaluated example.

## Language boundaries

The Rootform language is deliberately closed. It does not include:

- authoring imports or modules;
- variables, user-defined functions, or general HCL/Terraform functions;
- arithmetic, loops, comprehensions, conditionals, object literals, or splats;
- Policy Pack inheritance or composition;
- access from policies to raw Terraform values, state, plans, or provider APIs.

Words such as `module`, `variable`, and `import` can appear as `match.kind`
values. There they identify Terraform/OpenTofu declaration categories. They do
not add equivalent authoring constructs to `.rf.hcl`.

Use `rootform lsp` for editor diagnostics and `rootform fmt` for canonical
formatting. Validation compiles definitions; `rootform test` compares Dialect
fixture architectures; `rootform check` evaluates policies. These operations
answer different questions, so use them together in a serious authoring
workflow.
