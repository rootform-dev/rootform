---
title: "Policy Packs"
description: "Complete reference for Policy Pack manifests, Policies, target dimensions, assertions, linking, and messages."
---

A Policy Pack is a named, versioned collection of portable Policies. It defines
governance, not architecture semantics. It contributes no Concepts, Contexts,
Relations, or Rules.

Policy source reads validated Architecture IR only. It never reads Terraform or
OpenTofu source values directly.

## Complete example

```hcl title="policy-reference/pack.rf.hcl"
policy_pack "network-baseline" {
  version = "0.1.0"
}

policy "subnet-has-network-context" {
  target {
    concept  = rf.concept.subnet
    rules    = [aws.rule.subnet]
    dialects = ["aws"]
  }

  assert = exists(
    contexts(rf.context.network, rf.concept.virtual-network)
  )

  message = "Each subnet must declare its virtual network."
}
```

Canonical Policy ID is
`network-baseline.policy.subnet-has-network-context`.

## `policy_pack` block

| Property | Contract |
| --- | --- |
| Placement | Top level of a Policy Pack source root |
| Cardinality | Exactly one per source root |
| Labels | Exactly one required Pack name |
| Attributes | `version` |
| Nested blocks | None |

### Parameters

| Name | Type | Required | Default | Constraints |
| --- | --- | --- | --- | --- |
| Label | Identifier | Yes | None | Lowercase kebab case, 1-64 bytes |
| `version` | Static string | Yes | None | Exact `MAJOR.MINOR.PATCH` |

A Policy Pack may contain zero Policies. Source files and directories do not
create sub-packs or namespaces.

## `policy` block

| Property | Contract |
| --- | --- |
| Placement | Top level of a Policy Pack source root |
| Cardinality | Zero or more |
| Labels | Exactly one required Policy name |
| Attributes | `assert`, `message` |
| Nested blocks | Exactly one `target` |

### Parameters

| Name | Type | Required | Default | Constraints |
| --- | --- | --- | --- | --- |
| Label | Identifier | Yes | None | Lowercase kebab case, 1-64 bytes; unique in Pack |
| `assert` | Policy assertion | Yes | None | Must statically produce Boolean |
| `message` | Static string | Yes | None | Nonempty valid UTF-8, at most 1,024 bytes |
| `target` | Block | Yes | None | Exactly one, unlabeled |

Message is attached to each confirmed violation. It is not a Policy assertion
or runtime template and cannot interpolate target data. Native syntax still
accepts the constant string-expression forms described under
[Expressions](expressions.md#static-string-expressions).

## `target` block

```hcl title="target dimensions"
target {
  concept  = rf.concept.subnet
  rules    = [aws.rule.subnet, google.rule.vpc-subnetwork]
  dialects = ["aws", "google"]
}
```

| Property | Contract |
| --- | --- |
| Placement | Inside `policy` |
| Cardinality | Exactly one |
| Labels | Forbidden |
| Attributes | `concept`, `rules`, `dialects` |
| Nested blocks | None |

### Parameters

| Name | Type | Required | Default | Constraints |
| --- | --- | --- | --- | --- |
| `concept` | Qualified Concept reference | Conditionally | No Concept filter | At least `concept` or `rules` is required |
| `rules` | Static nonempty list of qualified Rule references | Conditionally | No Rule filter | 1-1,024 unique entries; at least `concept` or `rules` is required |
| `dialects` | Static nonempty list of owner strings | No | No owner filter | 1-1,024 unique valid Dialect owners; `rf` forbidden |

Each `dialects` item is a static string expression, not a semantic reference.
Direct quoted strings are canonical:

```hcl
dialects = ["aws", "google"]
```

This is invalid:

```hcl
dialects = [aws, google]
```

A constant expression is accepted but normalized by compilation:

```hcl
dialects = [true ? "aws" : "google"]
```

### Target intersection

Dimensions combine as logical AND. Entries inside one list combine as logical
OR.

For target above, representation must:

1. have Concept `rf.concept.subnet`;
2. have Rule `aws.rule.subnet` OR `google.rule.vpc-subnetwork`;
3. have Rule owner `aws` OR `google`.

`concept` and `rules` may appear together. When `rules` is present, linker
rejects `POLICY_TARGET_CONTRADICTORY` if none of listed Rules can satisfy
optional `concept` and `dialects` filters. Without explicit `rules`, linker does
not infer contradiction from absence of current implementations: a valid
Concept target, with or without `dialects`, may select zero representations and
become `not_evaluated`. `dialects` alone is invalid because it does not define
semantic target.

Target selects representations, not raw source declarations. A resource base
without matching Rule cannot satisfy Rule, Concept, or Dialect target dimension.

## Assertions

`assert` uses closed Policy expression grammar:

```hcl
assert = exists(contexts(rf.context.network))
assert = length(relations(aws.relation.subscribes-to)) >= 1
assert = (
  exists(contexts(rf.context.runtime, rf.concept.kubernetes-cluster)) &&
  !exists(contributions(aws.rule.s3-bucket-versioning))
)
```

Accepted result types:

| Form | Type |
| --- | --- |
| `true`, `false` | Boolean |
| `exists(query)` | Boolean |
| `length(query)` | Number |
| `!` Boolean | Boolean |
| Boolean `&&` or <code>&#124;&#124;</code> Boolean | Boolean |
| Same-type Boolean or number `==`, `!=` | Boolean |
| Number `<`, `<=`, `>`, `>=` number | Boolean |

Bare queries, traversals, strings, and arbitrary calls are invalid. See
[Expressions](expressions.md#policy-assertions) and
[Built-ins](built-ins.md).

## Portable source and linking

Policy Pack source stores qualified references but no semantic versions or
digests. Before evaluation, Rootform links source against one validated
Architecture IR semantic snapshot:

```bash
rootform compile policy-pack ./policy-reference \
  --semantics architecture.json \
  --output network-baseline.json
```

Linking:

1. resolves every owner, Concept, Context, Relation, and Rule;
2. validates target intersections;
3. derives exact owner kind, version, and semantic digest pins, including
   referenced Dialects' RF Vocabulary dependencies;
4. writes deterministic compiled Policy Pack JSON.

Compiled pack can be evaluated offline without producer Dialect source. Its pins
must exactly match Architecture IR. Mismatch produces
`POLICY_SEMANTICS_MISMATCH`; Rootform never relinks silently.

Unrelated semantic owners are not pinned.

See [compile policy-pack](../../reference/cli/compile/policy-pack.md) for CLI
flags and [Evaluation](evaluation.md#per-target-outcomes) for outcomes.

## Zero targets

A valid Policy may select zero representations in one architecture. It is then
`not_evaluated`, not passed. A selected Policy without targets prevents an
overall compliant result.

## Rejected forms

This Policy has only an owner filter:

```hcl title="invalid/dialect-only-pack.rf.hcl"
policy_pack "invalid" {
  version = "0.1.0"
}

policy "dialect-only" {
  target {
    dialects = ["aws"]
  }

  assert  = true
  message = "This target is incomplete."
}
```

It produces `POLICY_INVALID` because `concept` or nonempty `rules` is
required.

Unqualified semantic references such as `concept.subnet` produce
`POLICY_REFERENCE_UNQUALIFIED`. Empty `rules` or `dialects` lists,
duplicate entries, empty message, extra target block, or non-Boolean assertion
also fail compilation.
