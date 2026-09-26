---
title: "Rules and matching"
description: "Rule declarations, instance matching, identity, and selection precedence."
---

A Rule interprets one managed or data resource instance in a plan JSON or state JSON. Its `match` decides eligibility; `as` assigns an optional Concept; emissions and composition add further architecture meaning. The Rule name alone creates no Concept or fact.

## Complete example

```rf title="reference/dialect.rf.hcl"
dialect "example" {
  version = "0.1.0"

  provider "hashicorp/aws" {
    version = ">= 6.0.0, < 7.0.0"
  }
}

rule "bucket" {
  match {
    type = "aws_s3_bucket"
  }

  as = rf.concept.object-storage-container

  identity {
    attributes = ["bucket"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "bucket", "arn"]
  }
}
```

The official AWS Dialect uses this shape for buckets. `bucket` is an instance identity attribute; `id`, `bucket`, and `arn` are endpoint paths that a verified saved-plan traversal may name. Neither block publishes its values. See [Fact emissions](emissions.md#matching-target-identities) for target resolution.

## `rule` block

| Property | Contract |
| --- | --- |
| Placement | Top level of a Dialect source root |
| Cardinality | Zero or more |
| Label | Exactly one Rule name, unique within the Dialect |
| Attributes | Optional `as` Concept reference |
| Nested blocks | Exactly one `match`; optional `identity`, `endpoint`, and `composition`; zero or more emissions |

A Rule must have `as`, at least one emission, or a nonempty composition. A match-only Rule fails validation with `RULE_NO_ARCHITECTURE`. The Rule has no `description` attribute. See [Member resolution](composition.md#member-resolution) for per-instance evidence and [Unresolved members](composition.md#unresolved-members) for what remains when one member cannot be established.

### Parameters

| Name | Type | Required | Default | Constraint |
| --- | --- | --- | --- | --- |
| Label | Identifier | Yes | None | Lowercase kebab case, 1–64 bytes |
| `as` | Concept reference | No | No Concept | Local/current owner or supported `rf.concept.*` |

### Nested blocks

| Block | Cardinality | Purpose |
| --- | --- | --- |
| `match` | Exactly one | Choose eligible instances |
| `identity` | Zero or one | Name value attributes for target matching |
| `endpoint` | Zero or one | Name attributes a saved-plan traversal can pair with this instance |
| `context`, `relation`, `contribution` | Zero or more | Emit facts; see [Fact emissions](emissions.md#emission-syntax-and-parameters) |
| `composition` | Zero or one | Claim ordered members |

## `match` block

```rf title="Rule match"
match {
  kind  = "resource"
  type  = "aws_s3_bucket"
  where = source.bucket == "logs"
}
```

| Property | Contract |
| --- | --- |
| Placement | Exactly once inside `rule` or a composition `member` |
| Labels and nested blocks | Forbidden |
| Attributes | `kind`, `type`, and optional `where` |

| Name | Type | Required | Default | Constraint |
| --- | --- | --- | --- | --- |
| `kind` | Static string | No | `"resource"` | `"resource"` or `"data"` for plan/state instances |
| `type` | Static string | Yes | None | Exact, nonempty resource type; case-sensitive |
| `where` | Predicate | No | Known `true` | Closed [predicate grammar](expressions.md#predicate-expressions) |

`match` has no label or nested block. `where` reads the instance's available `source.*` values. An unknown or sensitive operand can make the predicate indeterminate; it cannot make a candidate false. A bare traversal such as `where = source.enabled` is not a Boolean predicate and produces `PREDICATE_UNRESOLVED` during validation.

## `match.kind` values

The language keeps a closed 15-value set. Plan/state analysis provides only the first two populations:

| Value | Construct | Plan/state instances |
| --- | --- | --- |
| `resource` | Managed resource | Yes |
| `data` | Data source | Yes |
| `settings`, `provider`, `ephemeral`, `action`, `module` | Other infrastructure constructs | No |
| `variable`, `local`, `output` | Values declared in configuration | No |
| `moved`, `removed`, `import`, `check`, `language` | Other configuration constructs | No |

The other values remain accepted language syntax, but plan and state inputs contain no instances of those kinds, so a Rule that matches one never applies. `type` never glob-matches or follows the Rule name.

## Identity and endpoint declarations

| Block | Attribute | Required | Default | Meaning |
| --- | --- | --- | --- | --- |
| `identity` | `attributes` | Yes | None | Nonempty, distinct attribute paths eligible for an emission's `match.by` |
| `identity` | `scope` | No | `"provider"` | `"provider"` requires compatible provider address and alias; `"global"` permits cross-provider candidates |
| `endpoint` | `attributes` | Yes | None | Nonempty, distinct paths a verified traversal may use to identify the instance |

These attributes are declared on a target Rule, not inferred from a Concept. A target with an unavailable provider alias remains a possible candidate, so Rootform cannot force a unique value match around it. `scope = "global"` changes candidate eligibility, not the meaning of an identity value. With `--plan-file`, a direct reference to a declared endpoint can establish the exact instance even if its evaluated value is unknown or shared. [Traversals and scope](traversals.md#value-and-identity-evidence) gives the supported expression syntax variants.

## Classification with `as`

`as` assigns one Concept to an interpreted instance. A Rule can instead emit facts or compose members without a Concept. There is no Concept inheritance or automatic classification from resource type. The built-in [RF Vocabulary](rf-vocabulary.md) supplies shared Concepts; a Dialect can declare local ones.

## Eligibility pipeline

For each instance, Rootform checks, in order:

1. mode (`resource` or `data`);
2. exact resource type;
3. provider source address;
4. optional `where` predicate.

The Dialect manifest declares a provider version envelope, but plan/state Rule selection does not compare an observed exact provider version to it. A Dialect provider shorthand such as `hashicorp/aws` binds its corresponding Terraform and OpenTofu public-registry addresses; a fully qualified host binds only that host. An unbound provider is reported with `PROVIDER_UNBOUND`. Do not use a version constraint to distinguish two Rules for the same instance.

## Selection precedence

| Priority | Condition | Result |
| --- | --- | --- |
| 1 | More than one Rule accepted | `RULE_MATCH_AMBIGUOUS`; no Rule applies |
| 2 | An eligible Rule has an indeterminate predicate | Interpretation indeterminate; no Rule selected around it |
| 3 | Exactly one Rule accepted | Apply it |
| 4 | No Rule accepted | Keep the instance without an applied Rule or Concept |

If a resource type could match but no selected Dialect binds its provider address, interpretation fails with `PROVIDER_UNBOUND` before Rule selection. There is no priority by file order, Dialect origin, or Rule name. A managed or data instance with no matching Rule still has a Representation in the Rootform document. It has no invented classification or emissions. Policy selection can also include an instance whose possible Rule is indeterminate or failed, producing an indeterminate policy evaluation; see [Evaluation](evaluation.md#policy-target-selection). [Rule selection](evaluation.md#rule-selection) places this step in the analysis pipeline.

## Rejected syntax

```rf title="invalid/match-only.rf.hcl"
dialect "example" {
  version = "0.1.0"

  provider "hashicorp/aws" {
    version = ">= 6.0.0"
  }
}

rule "no-architecture" {
  match {
    type = "aws_s3_bucket"
  }
}
```

`rootform validate dialects` reports `RULE_NO_ARCHITECTURE`. Add an `as`, an emission, or a nonempty composition only when it expresses intended meaning. [Test and validate](../test-validate.md) shows how to check a Rule against a plan fixture.
