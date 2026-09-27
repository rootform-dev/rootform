---
title: "Fact emissions"
description: "Context, Relation, and Contribution syntax, endpoint resolution, and closure outcomes."
---

An applied Rule may emit directed facts from its instance to a target endpoint in the same stage. `to` declares the target's required Rule or Concept. `via` reads evidence on the source instance. A Terraform dependency alone creates no Context, Relation, or Contribution.

| Emission | Meaning | Direction |
| --- | --- | --- |
| Context | Placement in a named Context dimension | Source to target |
| Relation | Named architectural predicate | Source to target |
| Contribution | Source contributes to target | Source to target |

## Complete example

```rf title="emissions/dialect.rf.hcl"
dialect "example" {
  version = "0.1.0"

  provider "hashicorp/aws" {
    version = ">= 6.0.0, < 7.0.0"
  }
}

rule "vpc" {
  match {
    type = "aws_vpc"
  }
  as = rf.concept.virtual-network
  identity {
    attributes = ["id"]
  }
  endpoint {
    attributes = ["id"]
  }
}

rule "subnet" {
  match {
    type = "aws_subnet"
  }
  as = rf.concept.subnet

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
  }
}
```

A subnet can establish network Context through its known `vpc_id`, or through a verified saved-plan reference to the VPC's declared endpoint. The closure records how each fact was proved.

## Emission syntax and parameters

### Common parameters

Each emission is a block inside a `rule`. It may appear more than once, has no
nested blocks except one optional, unlabeled `match`, and uses these shared
parameters:

| Name | Type | Required | Default | Constraint |
| --- | --- | --- | --- | --- |
| `to` | Concept or Rule reference | Yes | None | Applied target Rule must satisfy it |
| `via` | Traversal | Yes | None | `source.*` or `provider.*`; with `match`, `source.*` only |
| `on_null` | `"absent"` or `"indeterminate"` | Yes | None | Meaning of a known null |
| `on_empty` | `"absent"` or `"indeterminate"` | Yes | None | Meaning of known empty string, list, or map |
| `external` | `"deny"` or `"allow"` | No | `"deny"` | Whether a known unmatched value can name an external endpoint |
| `disclose` | `"none"`, `"record"`, or `"report"` | No | `"none"` | Requires `external = "allow"` for non-default disclosure |
| `prefix` | Static string | No | None | Removes declared prefix from `via` before comparison; requires `match` |
| `match` | Block | No | None | Compare the value with declared target identity attributes |

A missing `on_null` or `on_empty` is a compile error. Unknown values remain `indeterminate(unknown_until_apply)` and sensitive values remain `indeterminate(sensitive)` regardless of those declarations. A list fans out element by element; established facts remain even if another element makes the overall closure indeterminate. A nested list, map, or Boolean element is an unsupported endpoint shape (`VIA_VALUE_SHAPE`).

## Context emission

### Reference syntax

```rf title="Referenced Context"
context {
  as       = rf.context.network
  to       = rf.concept.virtual-network
  via      = source.vpc_id
  on_null  = "absent"
  on_empty = "absent"
}
```

| Property | Contract |
| --- | --- |
| Placement | Inside `rule` |
| Cardinality | Zero or more |
| Labels | None when `as` is present; otherwise one |
| Attributes | Exactly one of a label or `as`, plus the common parameters |
| Nested blocks | Zero or one `match` |

### Labeled syntax

`context "placement" { ... }` introduces or reuses a local Context instead of referencing one through `as`. Both syntaxes need the common emission parameters.

| Syntax | Required | Forbidden | Meaning |
| --- | --- | --- | --- |
| Referenced | `as` Context reference | Label | Use a defined Context |
| Labeled | Context label | `as` | Introduce or reuse a local Context |

### Context-specific parameter

Exactly one of a label or `as` is required. Both or neither produce `FACT_INVALID`. A Context states its declared placement meaning, not live network reachability.

## Relation emission

### Labeled syntax

```rf title="Labeled Relation"
relation "reads-from" {
  to       = concept.database
  via      = source.database_id
  on_null  = "absent"
  on_empty = "indeterminate"
}
```

### Reference syntax

An unlabeled `relation { as = relation.reads-from ... }` references an existing local Relation. Exactly one of label or `as` is required. Relations describe only the declared predicate; Rootform never turns every dependency into a Relation. The RF Vocabulary has no predefined Relations.

| Syntax | Required | Forbidden | Meaning |
| --- | --- | --- | --- |
| Referenced | `as` Relation reference | Label | Use a defined local Relation |
| Labeled | Relation label | `as` | Introduce or reuse a local Relation |

## Contribution emission

```rf title="Contribution"
contribution {
  to       = rf.concept.object-storage-container
  via      = source.bucket
  on_null  = "absent"
  on_empty = "absent"
}
```

Contribution has neither label nor `as`. It can be queried from the target with [`contributions`](built-ins.md#contributions). Duplicated emissions of the same identity in one Rule fail with `DUPLICATE_ID`; a fact reached through distinct valid evidence is deduplicated while retaining provenance.

| Property | Contract |
| --- | --- |
| Placement | Inside `rule` |
| Cardinality | Zero or more |
| Labels and `as` | Forbidden |
| Attributes | Common parameters except `as` |
| Nested blocks | Zero or one `match` |

## Direct target resolution

Without a nested `match`, a verified saved-plan traversal can identify a target through a declared `endpoint` path. The target must be represented by an applied Rule satisfying `to`; a source dependency or a matching value alone does not establish a direct reference. [Traversal evidence](#traversal-evidence) states which expressions qualify.

The target must:

1. have a Representation in the selected stage;
2. have an applied Rule;
3. satisfy the exact Concept or Rule named by `to`.

## Explicit attribute match

### Matching target identities

Without `match`, a verified saved-plan traversal may identify a declared endpoint directly. For value comparison, add one `match` block:

```rf title="Identity match"
match {
  by       = [target.id, target.arn]
  strategy = "exact"
}
```

### `match` block contract

The block belongs inside one Context, Relation, or Contribution emission. It
has no label or nested blocks and appears at most once in that emission.

| Name | Required | Accepted |
| --- | --- | --- |
| `by` | Yes | One `target.*` traversal or nonempty ordered list of them, each declared in a candidate target Rule's `identity.attributes` |
| `strategy` | Yes | `"exact"`, `"dot-ancestor"`, or `"last-segment"` |

`exact` compares known values. `dot-ancestor` accepts a dot-delimited ancestor, choosing the most specific candidate. `last-segment` compares the final `/`-separated segment. Rootform tries `by` paths in order. A candidate with unknown, sensitive, or unavailable identity cannot be discarded to manufacture a unique match. Duplicate known identities produce `DUPLICATE_IDENTITY`; an uncomparable candidate can leave `indeterminate(uncomparable_candidate)`. A known value and verified traversal that point to different targets produce `EVIDENCE_CONFLICT` and `indeterminate(reference_ambiguous)`.

## Traversal evidence

`--plan-file` verifies the saved plan against its plan JSON and reads the configuration snapshot. A bare reference or single interpolation through variables, locals, or module outputs can pair the referenced managed or data instance with a target Rule's `endpoint` attribute. A tuple written at the emitted attribute, or within one static block, pairs elements separately. This is Planned-stage evidence. Functions, operators, conditionals, dynamic indexes, and transformed references do not establish endpoint identity. A fact records `value`, `traversal`, or `both` as its evidence kind. See [Traversals and scope](traversals.md#value-and-identity-evidence).

`via = provider.host` follows the emitting instance's bound provider block. Only a verified Planned-stage direct reference or supported pass-through can establish its endpoint. A literal, transformed expression, plan without verified saved plan, state JSON, historical stage, OpenTofu provider `for_each`, or JSON provider configuration leaves `indeterminate(unavailable)`. Rootform does not read literal provider configuration values.

## External and data endpoints

An interpreted data resource instance is a `data` endpoint. It needs an applied Rule just like a managed target. A known unmatched value may become an `external` endpoint only with `external = "allow"` and no eligible unresolved in-scope candidate. Put a source comment beside that choice explaining why the target may live outside the inventory. External means declared reference, not verification of a remote object.

`disclose = "none"` keeps external identity in memory. `"record"` permits it in the Rootform JSON document; `"report"` also permits it in text, Markdown, HTML, and SARIF. Sensitive values never enter any tier. When several emissions reach one external endpoint, the most restrictive tier wins. Managed and data endpoints are named by instance, never by copied attribute values. Saved plans, plan JSON, and state JSON can contain clear-text secrets: keep them out of Git and public artifacts. Rootform masks sensitive values before architecture output, but names and topology in its outputs still deserve internal handling.

## Omission and uncertainty

Each source instance and emission has one closure in its stage:

| Outcome | Meaning |
| --- | --- |
| `resolved` | One or more target facts established; every list element settled |
| `absent` | `on_null` or `on_empty` declared a known missing value absent |
| `indeterminate` | Evidence cannot decide; reason and candidate counts explain why |

Other reasons include `unknown_until_apply`, `sensitive`, `ambiguous_unknown`, `uncomparable_candidate`, `duplicate_identity`, `identity_incomplete`, `reference_ambiguous`, `unavailable`, and `external_denied`. A missing attribute path on an emitted instance yields `EMISSION_PATH_UNDEFINED` and `indeterminate(unavailable)`, not absence. A wrong target Concept does not get coerced; an unresolved target does not turn into an external endpoint. See [Diagnostics and limits](diagnostics.md#emission-warnings).

## Emission diagnostics

`EMISSION_PATH_UNDEFINED`, `VIA_VALUE_SHAPE`, `DUPLICATE_IDENTITY`, and `EVIDENCE_CONFLICT` warn that a fact was not safely established. They are evidence limits, not instructions to suppress the closure. The [evaluation rules](evaluation.md#query-truth) explain why missing facts under indeterminate closures cannot make a negative policy assertion pass.

## Rejected syntax

A Context or Relation with both a label and `as` fails with `FACT_INVALID`. A missing `to` or `via` fails likewise. Missing null or empty policy fails with `EMISSION_ON_NULL_REQUIRED` or `EMISSION_ON_EMPTY_REQUIRED`. `match.by` outside the target Rule's declared identities fails with `MATCH_IDENTITY_UNDECLARED`.
