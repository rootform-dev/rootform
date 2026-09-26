---
title: "Language reference"
description: "Complete reference for Rootform language 0.1.0 source units, declarations, expressions, evaluation, and diagnostics."
---

Rootform language is a closed, statically validated language for two jobs:

- Dialects interpret normalized infrastructure declarations as architecture.
- Policy Packs evaluate that architecture without reading infrastructure source.

HCL supplies lexical syntax for `.rf.hcl` and `.rf.json`. Rootform defines the
accepted blocks, attributes, expressions, references, types, defaults, and
runtime meaning. General HCL or Terraform expressions are not implicitly part
of RF.

This reference documents Rootform language version `0.1.0`.

## How to use this reference

### Source units

| Page | Contract covered |
| --- | --- |
| [Syntax and files](syntax-files.md) | Source discovery, native and JSON syntax, structural grammar, names, versions, and source-unit boundaries |
| [Symbols and references](symbols.md) | Canonical IDs, local and qualified references, resolution, and duplicate rules |
| [RF Vocabulary](rf-vocabulary.md) | Complete embedded `rf.*` vocabulary and exact meanings |

### Dialects

| Page | Contract covered |
| --- | --- |
| [Dialect declarations](dialects.md) | `dialect`, `provider`, `concept`, `context`, and `relation` |
| [Rules and matching](rules.md) | `rule`, `match`, all 15 source kinds, predicates, and selection |
| [Fact emissions](emissions.md) | `context`, `relation`, `contribution`, explicit attribute matching, and omissions |
| [Composition](composition.md) | Ordered members, matching, exclusivity, and transactional application |

### Expression language

| Page | Contract covered |
| --- | --- |
| [Expressions](expressions.md) | Literal types, expression grammars, operators, precedence, and rejected forms |
| [Traversals and scope](traversals.md) | `source`, `provider`, `target`, `member`, path steps, and position rules |
| [Built-ins](built-ins.md) | Complete signatures and parameters for `exists`, `length`, and architecture queries |

### Policies

| Page | Contract covered |
| --- | --- |
| [Policy Packs](policy-packs.md) | `policy_pack`, `policy`, `target`, linking, messages, and target intersections |
| [Evaluation](evaluation.md) | Rule precedence, three-valued evidence, query completeness, outcomes, and exit status |

[Diagnostics and limits](diagnostics.md): Stable codes, severity, source ranges, and all author-facing bounds

## Construct index

Cardinality applies across one source root unless a placement says otherwise.

| Construct | Source unit | Placement | Cardinality | Label | Detail |
| --- | --- | --- | --- | --- | --- |
| `dialect` | Dialect | Top level | Exactly 1 | Required | [Dialect declarations](dialects.md#dialect-block) |
| `provider` | Dialect | Inside `dialect` | 0 or more; at least 1 when unit has a Rule | Required | [Provider block](dialects.md#provider-block) |
| `concept` | Dialect | Top level | 0 or more | Required | [Semantic definitions](dialects.md#semantic-definition-blocks) |
| `context` definition | Dialect | Top level | 0 or more | Required | [Semantic definitions](dialects.md#semantic-definition-blocks) |
| `relation` definition | Dialect | Top level | 0 or more | Required | [Semantic definitions](dialects.md#semantic-definition-blocks) |
| `rule` | Dialect | Top level | 0 or more | Required | [Rules](rules.md) |
| Rule `match` | Dialect | Inside `rule` | Exactly 1 | Forbidden | [Matching](rules.md) |
| `context` emission | Dialect | Inside `rule` | 0 or more | Optional, exclusive with `as` | [Context emission](emissions.md#forms-and-parameters) |
| `relation` emission | Dialect | Inside `rule` | 0 or more | Optional, exclusive with `as` | [Relation emission](emissions.md#forms-and-parameters) |
| `contribution` emission | Dialect | Inside `rule` | 0 or more | Forbidden | [Contribution emission](emissions.md#forms-and-parameters) |
| Fact `match` | Dialect | Inside an emission | 0 or 1 | Forbidden | [Explicit attribute match](emissions.md#matching-target-identities) |
| `composition` | Dialect | Inside `rule` | 0 or 1 | Forbidden | [Composition](composition.md#composition-block) |
| `member` | Dialect | Inside `composition` | 1 or more | Required | [Member](composition.md#member-block) |
| Member `match` | Dialect | Inside `member` | Exactly 1 | Forbidden | [Member matching](composition.md#member-matching) |
| `policy_pack` | Policy Pack | Top level | Exactly 1 | Required | [Policy Pack manifest](policy-packs.md#policy_pack-block) |
| `policy` | Policy Pack | Top level | 0 or more | Required | [Policy](policy-packs.md#policy-block) |
| `target` | Policy Pack | Inside `policy` | Exactly 1 | Forbidden | [Target](policy-packs.md#target-block) |

## Closed expression surface

| Area | Accepted values |
| --- | --- |
| Literal values | String, Boolean, non-negative number literal with exact signed 64-bit integer value |
| Unary operators | `!` |
| Binary operators | `&&`, <code>&#124;&#124;</code>, `==`, `!=`, `<`, `<=`, `>`, `>=` |
| Traversal roots | `source`, `provider`, `target`, `member.<name>`, each restricted by position |
| Policy wrappers | `exists(query)`, `length(query)` |
| Policy queries | `contexts(...)`, `relations(...)`, `contributions(...)` |

`where` and `assert` do not accept collections, object values, `null`,
floating-point values, arithmetic, conditionals, comprehensions, splats,
dynamic indexes, or arbitrary function calls. Static string fields use
result-based constant HCL evaluation, and dedicated Policy target fields accept
closed list forms.

## Reference conventions

Parameter tables use these meanings:

| Term | Meaning |
| --- | --- |
| Required | Author must provide value or block. |
| Optional | Author may omit value or block. |
| Default | Value compiler uses when optional attribute is absent. |
| Static | Value must evaluate in empty HCL context; variables and runtime data are unavailable. |

Unknown attributes, blocks, functions, and expression shapes fail closed with
a diagnostic. They are never preserved for later evaluation.
