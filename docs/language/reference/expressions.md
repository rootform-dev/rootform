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
| `left == right` | Equality | compatible string, Boolean, or integer operands | supported numeric operands |
| `left != right` | Inequality | compatible string, Boolean, or integer operands | supported numeric operands |
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

```hcl title="rule.rf"
where = source.enabled == true
where = source.mode == "private"
where = source.priority >= 10 && source.priority < 20
```

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
          | numeric comparison numeric

numeric    = integer | length(query)
comparison = == | != | < | <= | > | >=
```

```hcl title="pack.rf"
assert = true
assert = length(contributions(concept.core.subnet)) >= 2
assert = !(
  length(contexts(context.core.network, concept.core.virtual-network)) < 1
)
```

Policy strings are not bare operands. Concept and context references occur only
in fixed query argument positions. A query collection occurs only as the one
argument of `length`.

Use direct Boolean expressions and `!` for Boolean logic. Boolean
`==` and `!=` are outside the supported evaluated policy surface; numeric
comparison is the portable policy comparison form.

## JSON expression carrier

In `.rf.json`, Boolean and integer literals can remain JSON primitives. A
traversal, operator expression, or function call uses HCL's interpolation
string carrier:

```json title="pack.rf.json"
{
  "target": "concept.core.subnet",
  "assert": "${length(contexts(context.core.network, concept.core.virtual-network)) > 0}"
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
