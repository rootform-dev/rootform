---
title: "Expressions"
description: "Reference for Rootform literal values, operators, predicate expressions, and policy assertions."
---

Rootform parses an HCL expression only where its schema allows one, then
compiles it into a closed expression model. Unsupported HCL expression forms do
not survive for later evaluation.

## Literal value kinds

| Kind | Native examples | Notes |
| --- | --- | --- |
| String | `"private"`, `"network-peering"` | UTF-8 string; accepted only in specific positions |
| Boolean | `true`, `false` | Used in predicates and assertions |
| Integer | `0`, `42`, `-1` | Signed 64-bit exact integer |

There are no floating-point, null, list, tuple, map, object, or set literals in
the compiled Rootform expression model. Structural JSON objects encode blocks;
they are not expression object values.

## Operators

| Operator | Result | Rule `where` | Policy `assert` |
| --- | --- | --- | --- |
| `!value` | Boolean negation | Boolean expression | Boolean expression |
| `left && right` | Boolean conjunction | Boolean expressions | Boolean expressions |
| `left \|\| right` | Boolean disjunction | Boolean expressions | Boolean expressions |
| `left == right` | Equality | compatible string, Boolean, or integer operands | compatible Boolean or numeric operands |
| `left != right` | Inequality | compatible string, Boolean, or integer operands | compatible Boolean or numeric operands |
| `<`, `<=`, `>`, `>=` | Ordered comparison | integer operands | integer or `length(...)` operands |

Parentheses are accepted. Use them whenever mixed logical and comparison
operators would make intent harder to scan.

Arithmetic operators, string concatenation, conditionals, for-expressions,
comprehensions, templates with multiple interpolated parts, splats, and dynamic
index expressions are rejected.

## Rule predicates

`match.where` narrows an initial or composition-member match. Its closed shape
is:

```text title="Predicate grammar"
predicate = true | false
          | !predicate
          | predicate && predicate
          | predicate || predicate
          | operand comparison operand

operand    = literal | source traversal
comparison = == | != | < | <= | > | >=
```

Equality operands must have the same effective type. Ordered comparison is
integer-only.

Independent `where` examples:

- `where = source.enabled == true`
- `where = source.mode == "private"`
- `where = source.priority >= 10 && source.priority < 20`

A bare `source.enabled` is not a complete predicate. Compare it with `true` or
`false`. Functions and architecture queries are not available in `where`.

Source values can be missing or unknown because Rootform does not evaluate
arbitrary Terraform expressions. An unresolved comparison is unknown and does
not select the rule.

## Policy assertions

An assertion must compile and evaluate to a Boolean:

```text title="Assertion grammar"
assertion = true | false
          | !assertion
          | assertion && assertion
          | assertion || assertion
          | assertion == assertion
          | assertion != assertion
          | numeric comparison numeric
          | exists(query)

numeric    = integer | length(query)
comparison = == | != | < | <= | > | >=
```

Independent `assert` examples:

- `assert = true`
- `assert = exists(relations(relation.core.private-reachability, concept.core.virtual-network))`
- `assert = length(contributions(concept.core.kubernetes-node-pool)) >= 2`
- `assert = !(length(contexts(context.core.network, concept.core.virtual-network)) < 1)`

Policy strings are not bare operands. Concept, context, and relation references
occur only in fixed query argument positions. Query collections occur only as
single argument of `length` or `exists`.

## JSON expression carrier

In `.rf.json`, Boolean and integer literals can remain JSON primitives. An
operator expression or function call uses HCL's interpolation string carrier.
Structural semantic references such as policy `target` remain plain strings:

```json title="pack.rf.json"
{
  "target": "concept.core.subnet",
  "assert": "${exists(contexts(context.core.network, concept.core.virtual-network))}"
}
```

A bare JSON string is a string literal. Rootform does not detect expression-like
text and reinterpret it.

## Expression size and failure

An expression is limited to 4096 source bytes. Invalid syntax produces
`HCL_PARSE`; a parsed but unsupported form produces `INVALID_EXPRESSION`,
`PREDICATE_UNRESOLVED`, or `POLICY_INVALID` according to its position.

See [Built-ins](built-ins.md) for query signatures and
[Evaluation](evaluation.md) for unknown values.
