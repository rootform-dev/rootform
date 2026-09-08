---
title: "Rootform Language"
description: "Learn how .rf definitions turn source declarations into architecture facts and evaluate policies over those facts."
---

Rootform Language is the public authoring language for **Dialects** and
**Policy Packs**. A Dialect explains what source declarations mean. A Policy
Pack asks bounded questions about the architecture facts those Dialects
produced.

Rootform reads two source forms: human-authored `.rf` and HCL JSON `.rf.json`.
HCL provides their surface syntax. Rootform defines the accepted blocks,
attributes, expressions, references, and evaluation rules. General Terraform
language and general HCL expressions are not part of this contract.

## Two paths through the language

A Dialect participates while Rootform builds an architecture:

```text title="Dialect path"
.rf source
  → compiled Dialect
  → matched Terraform/OpenTofu declarations
  → Architecture IR facts and provenance
  → renderer
```

A Policy Pack participates after those facts exist:

```text title="Policy path"
.rf source
  → compiled Policy Pack
  → evaluation over Architecture IR facts
  → passed, violated, or indeterminate result
```

The renderer never executes `.rf`. It reads the resulting Architecture IR.
A policy never rewrites that IR, reads a live cloud account, or repairs missing
Dialect coverage.

## Dialects describe meaning

A Dialect declares vocabulary and rules:

- a **concept** classifies a representation as an entity, scope, or detail;
- a **context** names a placement dimension, such as network or ownership;
- a **rule** recognizes one kind of source declaration and assigns a concept;
- facts connect representations through contexts, contributions, or relations;
- a composition can treat several related declarations as one representation.

This official AWS rule recognizes a subnet and records its VPC reference as
network context:

```hcl title="aws/network/vpc.rf"
rule "subnet" {
  match {
    kind = "resource"
    type = "aws_subnet"
  }

  as = concept.core.subnet

  context {
    as  = context.core.network
    to  = concept.core.virtual-network
    via = source.vpc_id
  }
}
```

The rule does not say how to draw a subnet. It establishes meaning and evidence:
the declaration represents `core/subnet`, and its `vpc_id` reference may
establish `core/network` context inside a `core/virtual-network`.

Read [Dialects](../concepts/dialects.md) for the product model, then
[write a Dialect](../dialect-authoring.md) when you need to extend coverage.

## Policies ask about known facts

A policy targets one exact concept and evaluates once for each matching
representation. Its assertion can count three closed fact queries:
`contexts`, `relations`, and `contributions`.

```hcl title="policies/pack.rf"
policy "subnet-network-context" {
  target = concept.core.subnet
  assert = length(contexts(context.core.network, concept.core.virtual-network)) > 0
  message = "Subnets must have an established virtual network context."
}
```

An empty query has length zero. Unavailable or incompatible evidence can make
an evaluation indeterminate. No representation with the target concept means
zero evaluations; it is not proof that the requirement passed.

Read [Policies and Policy Packs](../concepts/policies.md) for governance meaning.
Use [Write a Policy](../guides/check-architecture.md) for a complete evaluated
example.

## Language boundaries

Rootform Language is deliberately closed. It does not include:

- authoring imports or modules;
- variables, user-defined functions, or general HCL/Terraform functions;
- arithmetic, loops, comprehensions, conditionals, object literals, or splats;
- Policy Pack inheritance or composition;
- access from policies to raw Terraform values, state, plans, or provider APIs.

Words such as `module`, `variable`, and `import` can appear as `match.kind`
values. There they identify Terraform/OpenTofu declaration categories. They do
not add equivalent authoring constructs to `.rf`.

## Choose a path

| Goal | Start here |
| --- | --- |
| Understand the language through one real architecture | [Language tour](tour.md) |
| Add or change provider semantics | [Write a Dialect](../dialect-authoring.md) |
| Express and evaluate one governance rule | [Write a Policy](../guides/check-architecture.md) |
| Version and distribute several policies | [Write a Policy Pack](write-policy-pack.md) |
| Format, compile, test, and inspect definitions | [Test and validate](test-validate.md) |
| Check exact accepted forms | [Language reference](reference/index.md) |

Use `rootform lsp` for editor diagnostics and `rootform fmt` for canonical
formatting. Validation compiles definitions; `rootform test` compares Dialect
fixture architectures; `rootform check` evaluates policies. These operations
answer different questions and should all appear in a serious authoring
workflow.
