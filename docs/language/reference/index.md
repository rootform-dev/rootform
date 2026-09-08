---
title: "Language reference"
description: "Exact accepted source units, expressions, references, evaluation rules, and diagnostics for Rootform Language."
---

Rootform Language has a closed contract: only documented source and expression
forms reach architecture compilation or policy evaluation.

HCL is the parsing surface for `.rf` and `.rf.json`. HCL documentation can
explain lexical details, but it cannot tell you which blocks or expressions
Rootform accepts. The pages below are authoritative for Rootform authoring.

## Source and definition reference

| Page | Use it for |
| --- | --- |
| [Syntax and files](syntax-files.md) | `.rf`, `.rf.json`, discovery, labels, attributes, blocks, and source-unit boundaries. |
| [Dialects](dialects.md) | `dialect`, `requires`, `provider`, `concept`, and `context` definitions. |
| [Rules](rules.md) | `rule`, `match`, predicates, facts, exact matching, and composition. |
| [Policy Packs](policy-packs.md) | `policy_pack`, requirements, policies, targets, assertions, and messages. |

## Expression and runtime reference

| Page | Use it for |
| --- | --- |
| [Expressions](expressions.md) | Effective literal types, operators, parentheses, and forms rejected by context. |
| [Traversals and scope](traversals.md) | `source`, `provider`, `target`, `member`, concept/context references, and direct requirements. |
| [Built-ins](built-ins.md) | Exact signatures for `length`, `contexts`, `relations`, and `contributions`. |
| [Evaluation](evaluation.md) | Rule matching, fact resolution, policy outcomes, unknown evidence, and limits. |
| [Diagnostics](diagnostics.md) | Stable diagnostic families, source ranges, causes, and corrections. |

## Closed surface at a glance

| Area | Accepted set |
| --- | --- |
| Source suffixes | `.rf`, `.rf.json` |
| Dialect top level | `dialect`, `concept`, `context`, `rule` |
| Policy Pack top level | `policy_pack` |
| Concept kinds | `entity`, `scope`, `detail` |
| Literal value kinds | string, Boolean, signed 64-bit integer |
| Operators | `!`, `&&`, `||`, `==`, `!=`, `<`, `<=`, `>`, `>=` |
| Traversal roots | `source`, `provider`, `target`, `member.<name>`; each limited by position |
| Policy functions | `length`, `contexts`, `relations`, `contributions` in fixed nested forms |
| Policy outcomes | `passed`, `violated`, `indeterminate` |

Rootform does not expose general HCL or Terraform evaluation. Unsupported
syntax fails compilation; it does not pass through to a later runtime.
