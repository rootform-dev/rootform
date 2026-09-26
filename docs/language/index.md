---
title: "Rootform language"
description: "Learn how Dialects interpret plan and state instances and how Policy Packs evaluate the resulting architecture."
---

The Rootform language is the public authoring language for **Dialects** and
**Policy Packs**. A Dialect explains what resource instances in a Terraform or
OpenTofu plan JSON or state JSON mean. A Policy Pack asks bounded questions
about the architecture facts those Dialects produced.

Rootform reads two source syntaxes: human-authored `.rf.hcl` and HCL JSON `.rf.json`.
HCL provides their surface syntax. Rootform defines the accepted blocks,
attributes, expressions, references, and evaluation rules. General Terraform
language and general HCL expressions are not part of this contract.

## Choose a path

| Goal | Start here |
| --- | --- |
| Understand the language through one real architecture | [Language tour](tour.md) |
| Author a provider Dialect | [Write a Dialect](../dialect-authoring.md) |
| Express and evaluate one governance rule | [Run checks](../guides/check-architecture.md) |
| Version and distribute several policies | [Write a Policy Pack](write-policy-pack.md) |
| Format, compile, test, and inspect definitions | [Test and validate](test-validate.md) |
| Check exact accepted syntax | [Language reference](reference/index.md) |

## Two paths through the language

A Dialect participates while Rootform builds an architecture:

1. .rf.hcl source
2. compiled Dialect
3. `rootform run` on plan JSON or state JSON, optionally paired with a saved plan
4. matched resource instances, with facts and closure results in a Rootform document

A Policy Pack participates after those facts exist:

1. .rf.hcl source
2. compiled Policy Pack
3. linked semantic pins
4. evaluation of each Policy against exactly one Form in a Rootform document
5. passed, violated, indeterminate, or no decision result

The Rootform document is the saved result. Its public data contract is defined
in the [Rootform document reference](../concepts/forms.md). [Architecture comparisons](../concepts/comparisons.md)
compares two inputs over that contract, and
[Run checks](../guides/check-architecture.md) evaluates policies
against one. No policy rewrites the document, reads a live cloud account, or
repairs missing Dialect coverage. Policy outcomes appear in the run summary, the
Markdown report, SARIF, and `rootform explain policy`, never in the document
itself.

## Dialects give instances meaning

Every managed or data resource instance present in the input has a
Representation in each applicable stage of the Rootform document, identified
by its instance address. A Rule adds interpretation to an eligible instance.
It can classify it with a Concept, establish Contexts or Relations, record a
Contribution, or group implementation members. An instance with no matching
Rule remains uninterpreted; this is distinct from a Rule whose match cannot be
decided.

A Dialect declares provider envelopes, local definitions, and Rules:

- a **Concept** is optional nominal classification;
- a **Context** names one placement dimension;
- a **Relation** names a directed predicate;
- facts connect representations through contexts, contributions, or relations;
- composition records members per root instance, including unresolved members;
  each member remains a separate Representation.

This Rule from the embedded AWS Dialect recognizes a subnet and records its VPC
reference as network context:

```rf title="aws/network/vpc.rf.hcl"
rule "subnet" {
  match {
    type = "aws_subnet"
  }

  as = rf.concept.subnet

  identity {
    attributes = ["id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id"]
  }

  context {
    as       = rf.context.network
    to       = rf.concept.virtual-network
    via      = source.vpc_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }

    external = "allow"
  }
}
```

The Rule classifies a subnet instance as `rf.concept.subnet`. Its `vpc_id` may
establish network Context toward a virtual-network instance. A verified saved
plan can also establish the referenced endpoint when the value itself is
unknown. When no represented VPC matches a known ID, this Rule permits an
external virtual-network endpoint. The closure says whether the endpoint
resolved, is absent, or remains indeterminate, with a reason.

A supported provider can still contain resource types that no Rule interprets.
Every observed instance gets a Representation while only Rules add
interpretation, so instance and interpretation counts answer different
questions. Read [Dialects and RF Vocabulary](../concepts/dialects.md) for
the product model, then [write a Dialect](../dialect-authoring.md) to extend
coverage.

## Policies ask about known facts

A Policy target selects interpreted instances it evaluates along three dimensions:
Concept, applied Rules, and Dialect owners. Values inside a list are ORed,
dimensions are ANDed, and at least `concept` or `rules` is required. An assertion
uses one of three closed fact queries: `contexts`, `relations`, and
`contributions`.

Within a Policy Pack source root, one top-level `policy_pack` manifest names the
pack. Policies are top-level declarations in any `.rf.hcl` or `.rf.json` file
beneath that same root:

```rf title="policies/subnet-network-context.rf.hcl"
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

An empty query means zero only when the relevant emission is supported and its
closure and instance population are complete. An unresolved closure makes an
affected query indeterminate, including under negation. A selected Policy with
no targets has status `not_evaluated`; the run reports no decision and exits 3
if nothing was evaluated. An indeterminate evaluation also exits 3. A confirmed
violation exits 1; all evaluated Policies passing exits 0.

Read [Policies and Policy Packs](../concepts/policies.md) for governance meaning.
Use [Run checks](../guides/check-architecture.md) for a complete
evaluated example.

## Language boundaries

The Rootform language is deliberately closed. It does not include:

- authoring imports or modules;
- variables, user-defined functions, or general HCL/Terraform functions;
- arithmetic, loops, comprehensions, conditionals, object literals, or splats;
- Policy Pack inheritance or composition;
- access from policies to raw Terraform values, state, plans, or provider APIs.

`match.kind` selects `resource` (managed instance) or `data` (data instance).
These words identify input instance kinds; they do not add equivalent
authoring constructs to `.rf.hcl`.

Use `rootform lsp` for editor diagnostics and `rootform fmt` for canonical
formatting. Validation compiles definitions; `rootform test` compares Dialect
fixture architectures; `rootform run` evaluates selected policies. These operations
answer different questions, so use them together in a serious authoring
workflow.
