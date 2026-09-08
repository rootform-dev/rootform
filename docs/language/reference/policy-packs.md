---
title: "Policy Packs"
description: "Reference for Policy Pack identity, requirements, policy targets, assertions, and messages."
---

A Policy Pack source set compiles one or more independently versioned packs.
Each pack owns its policies and declares the exact Dialect vocabulary they
query.

```hcl title="pack.rf"
policy_pack "tutorial" {
  version = "0.1.0"

  requires {
    core = "0.1.0"
  }

  policy "subnet-network-context" {
    target = concept.core.subnet
    assert = length(contexts(context.core.network, concept.core.virtual-network)) > 0
    message = "Subnets must have an established virtual network context."
  }
}
```

## Policy Pack block

| Item | Cardinality | Value |
| --- | --- | --- |
| Label | exactly 1 | Pack name; lower kebab case |
| `version` | exactly 1 | Literal exact `MAJOR.MINOR.PATCH` string |
| `requires` | 0 or more blocks | Exact direct Dialect requirements |
| `policy` | 0 or more blocks | Policies owned by this pack |

Pack identity is `<name>@<version>`. Several distinctly named packs can be
compiled from one supplied source set. A pack name cannot be reopened in a
second declaration; that produces `DUPLICATE_ID`. For end-to-end packaging,
keep one pack declaration per source root and place multiple roots under the
supplied parent directory.

An empty pack is structurally valid but evaluates no policy. Useful packs
declare at least one policy and document expected target coverage.

## Requirements

```hcl title="pack.rf"
requires {
  core = "0.1.0"
}
```

| Position | Form |
| --- | --- |
| Attribute name | Required Dialect name |
| Attribute value | Literal exact `MAJOR.MINOR.PATCH` string |

Every concept and context reference in the pack must name a directly required
Dialect. Unlike Dialect-local definitions, Policy Pack references cannot use
an unqualified `concept.name` or `context.name` form.

The requirement checks authoring scope and evaluation compatibility. If the
loaded architecture semantics omit that Dialect or use another version, the
whole policy run is indeterminate.

## Policy block

| Item | Cardinality | Value |
| --- | --- | --- |
| Label | exactly 1 | Policy name; unique within the pack, lower kebab case |
| `target` | exactly 1 | Dialect-qualified concept reference |
| `assert` | exactly 1 | Expression that must evaluate to Boolean |
| `message` | exactly 1 | Nonempty literal string, at most 1024 UTF-8 bytes |
| Nested blocks | none | Rejected |

Policy identity is `<pack>/<policy>`. `target` selects an exact concept:

```hcl title="pack.rf"
target = concept.core.managed-database
```

At runtime, the policy evaluates once for each architecture representation
whose concept is exactly `core/managed-database`. Subtypes or name similarity
do not expand that target.

## Assertions

An assertion can combine:

- Boolean literals;
- `!`, `&&`, and `||`;
- integer comparisons using `==`, `!=`, `<`, `<=`, `>`, and `>=`;
- signed 64-bit integer literals;
- `length(...)` over one supported architecture-fact query;
- parentheses.

```hcl title="pack.rf"
assert = (
  length(relations("private-reachability", concept.core.virtual-network)) > 0 ||
  length(relations("private-reachability", concept.core.subnet)) > 0
)
```

Strings are accepted only in the fixed `relations` signature, not as bare
policy operands. A query cannot appear bare; it must be the single argument to
`length`. General HCL/Terraform functions and user functions are rejected.

See [Expressions](expressions.md) and [Built-ins](built-ins.md) for exact forms.

## Messages and findings

`message` is returned for a known false assertion:

```hcl title="pack.rf"
message = "Managed databases must be privately reachable from a virtual network or subnet."
```

Write the requirement, not remediation that may be wrong for every provider.
A violation also records policy identity, target representation, source
location in the Policy Pack, and inspected fact IDs.

An indeterminate evaluation is a diagnostic rather than a violation and does
not use the message as proof of failure. A pack cannot configure warning or
error severity per policy.

## Isolation and distribution

Policy Pack source accepts no Dialect, concept, context, or rule definitions.
A policy cannot:

- add, remove, or rewrite Architecture IR facts;
- read raw Terraform/OpenTofu attributes;
- call another policy or pack;
- inherit, include, or extend another Policy Pack;
- select its provider Dialects.

Several packs can be selected for a project through CLI configuration. They
remain independent compilation and distribution identities. See
[Evaluation](evaluation.md) for whole-run failure behavior and
[Write a Policy Pack](../write-policy-pack.md) for packaging.
