---
title: "Expressions"
description: "Complete RF expression grammar, literal types, operators, precedence, typing rules, JSON encoding, and rejected forms."
---

RF expressions are a strict subset of HCL expressions. Accepted shape depends
on position:

| Position | Purpose | Accepted expression family |
| --- | --- | --- |
| Rule or member `match.where` | Test normalized source declaration | Predicate |
| Policy `assert` | Test Architecture IR facts | Policy assertion |
| `as`, `to`, Policy target references | Name semantic symbol | Typed reference only |
| `via`, `by` | Navigate normalized declaration | Traversal only |
| Static string fields | Metadata or closed enum | Constant expression producing string |
| `target.rules`, `target.dialects` | Static target filters | Nonempty list with position-specific item type |

General HCL expression evaluation is not available in `where` or `assert`.
Static string fields use separate constant evaluation described below.

## Literal types

| Type | Native examples | Accepted positions | Notes |
| --- | --- | --- | --- |
| String | `"prod"`, static heredoc | Predicate comparison operand | Valid UTF-8; no interpolation |
| Boolean | `true`, `false` | Predicate and Policy assertion | Lowercase keywords |
| Integer-valued number | `0`, `3`, `1.0`, `1e3` | Predicate comparison and Policy assertion | Exact integer value within signed 64-bit range |
| Floating point | `1.5` | None | Rejected |
| Null | `null` | None | Rejected |
| Collection or object | `[]`, `{}` | No general value position | Only dedicated static list fields accept lists |

RF validates numeric value, not spelling: `1.0` and `1e3` are accepted
because their values are exact integers. `1.5` is not. Although runtime scalar
evidence can contain signed integers, native RF source has no unary minus
operator. Authorable number literals are therefore non-negative. `-1` is
rejected as unsupported unary expression.

Static metadata strings may be empty only where block-specific table permits
it. For example, definition `description` may be empty, while Policy
`message` may not.

## Predicate expressions

A `match.where` predicate tests declaration currently selected by its
surrounding Rule or member `match`.

```ebnf
predicate       = boolean-literal
                | "!", predicate
                | "(", predicate, ")"
                | predicate, ("&&" | "||"), predicate
                | comparison ;

comparison      = predicate-operand, comparison-operator, predicate-operand ;

predicate-operand
                = string-literal
                | boolean-literal
                | integer-valued-number-literal
                | source-traversal ;

comparison-operator
                = "==" | "!=" | "<" | "<=" | ">" | ">=" ;
```

Examples:

```rf title="valid predicates"
where = source.enabled == true
where = source.mode == "ACTIVE"
where = source.replicas >= 2
where = source.enabled == true && source.replicas >= 2
where = !(source.mode == "DISABLED")
```

Rules:

- only `source.*` traversal is accepted;
- bare Boolean literal is accepted;
- bare traversal is not a predicate;
- equality and inequality require same runtime scalar type;
- ordering requires numbers;
- missing, unknown, collection-valued, or type-incompatible evidence makes
  comparison unknown;
- only known `true` accepts Rule candidate.

Compiler cannot always know traversal result type. A syntactically accepted
comparison such as `source.enabled > true` becomes unknown at evaluation,
rather than inventing ordering for Booleans.

## Policy assertions

Policy assertions operate on Architecture IR queries. They cannot traverse
source declarations.

```ebnf
assertion       = boolean-value ;

boolean-value   = boolean-literal
                | exists-call
                | "!", boolean-value
                | "(", boolean-value, ")"
                | boolean-value, ("&&" | "||"), boolean-value
                | boolean-value, ("==" | "!="), boolean-value
                | number-value, numeric-operator, number-value ;

number-value    = integer-valued-number-literal
                | length-call
                | "(", number-value, ")" ;

numeric-operator
                = "==" | "!=" | "<" | "<=" | ">" | ">=" ;

exists-call     = "exists", "(", query, ")" ;
length-call     = "length", "(", query, ")" ;
query           = contexts-call | relations-call | contributions-call ;
```

Grammar is type-directed and precedence follows table below. Because a
comparison produces a Boolean, its result can participate in another Boolean
equality or logical operation. HCL left associativity makes both expressions
valid:

```rf
assert = true == false == false
assert = 1 < 2 == true
```

Practical examples:

```rf title="valid Policy assertions"
assert = true
assert = exists(contexts(rf.context.network))
assert = length(contexts(rf.context.network)) >= 1
assert = !exists(relations(aws.relation.subscribes-to))
assert = (
  exists(contexts(rf.context.network)) &&
  length(contributions(aws.rule.s3-bucket-versioning)) == 0
)
```

This complete Pack verifies recursive Boolean results:

```rf title="expression-results/pack.rf.hcl"
policy_pack "expression-results" {
  version = "0.1.0"
}

policy "recursive-booleans" {
  target {
    rules = [aws.rule.subnet]
  }

  assert = (
    true == false == false &&
    1 < 2 == true
  )

  message = "Recursive Boolean expressions must remain true."
}
```

`exists` and `length` each take exactly one query call. Query call cannot be
stored, compared directly, nested in another function, or passed as a general
collection. See [Built-ins](built-ins.md) for exact signatures.

## Operators and types

| Operator | Operand type | Result | Predicate | Policy |
| --- | --- | --- | --- | --- |
| `!` | Boolean | Boolean | Yes | Yes |
| `&&`, <code>&#124;&#124;</code> | Boolean, Boolean | Boolean | Yes | Yes |
| `==`, `!=` | Same scalar type | Boolean | String, Boolean, integer | Boolean or number |
| `<`, `<=`, `>`, `>=` | Integer, integer | Boolean | Yes | Yes |

No implicit conversion exists. `"3" == 3` is never true. In Policy source it
is rejected by static typing; in predicate evaluation mismatched runtime types
produce unknown.

## Precedence and associativity

From highest to lowest:

| Precedence | Operators |
| --- | --- |
| 1 | Parentheses |
| 2 | Unary `!` |
| 3 | `<`, `<=`, `>`, `>=` |
| 4 | `==`, `!=` |
| 5 | `&&` |
| 6 | <code>&#124;&#124;</code> |

Binary operators are left-associative. Use parentheses when mixing comparisons
or Boolean operators. Chained comparison such as `1 < source.count < 5` is
invalid; write `source.count > 1 && source.count < 5`.

## Parentheses

Parentheses do not add an expression node to compiled RF artifact; they only
control grouping.

```rf
where = (source.enabled == true) && (source.replicas >= 2)
```

## Static string expressions

Fields such as `version`, `description`, `message`, `kind`, `type`,
provider constraints, and fact-match `strategy` use HCL constant evaluation
separately from predicate/assertion grammar.

Result must be known, non-null string in empty evaluation context. Therefore:

- quoted strings and static heredocs are accepted;
- parentheses and constant string conditionals are accepted;
- a pure `"${expression}"` wrapper is accepted only when wrapped constant
  result is string;
- variables and runtime traversals are unavailable;
- function calls are unavailable;
- multi-part interpolation is rejected.

For native `.rf.hcl`, acceptance is result-based: any HCL expression meeting
that rule is accepted, except a multi-part template. This constant-expression
surface is separate from closed `where` and `assert` grammars. In
`.rf.json`, static string fields are ordinary JSON strings.

```rf title="valid static strings"
description = "Production workload"

kind = true ? "resource" : "data"

message = <<-EOT
  Workloads must declare a runtime.
EOT
```

Direct literals are canonical and recommended. Dynamic templates are rejected:

```rf title="invalid static string"
description = "Workload for ${source.environment}"
```

This complete Dialect demonstrates accepted constant string conditionals:

```rf title="constant-strings/dialect.rf.hcl"
dialect "constant-example" {
  version = true ? "0.1.0" : "9.9.9"

  provider "hashicorp/example" {
    version = true ? ">= 1.0.0" : "< 1.0.0"
  }
}

concept "application" {
  description = true ? "A deployable application." : "Unused"
}

rule "application" {
  match {
    kind = true ? "resource" : "data"
    type = true ? "example_application" : "other"
  }

  as = concept.application
}
```

## JSON expression carrier

HCL JSON stores expression-valued fields in strings using `"${...}"`:

```json
{
  "match": {
    "type": "example_service",
    "where": "${source.enabled == true}"
  },
  "as": "${concept.application}"
}
```

Native `.rf.hcl` also accepts pure `"${expression}"` wrapper for
full-expression fields and unwraps it to enclosed value. Direct native form is
canonical:

```rf
where = source.enabled == true
```

Boolean and numeric JSON values can directly carry literal expressions. Raw
string fields such as `message` remain ordinary JSON strings. Rootform does
not parse arbitrary JSON strings as RF expressions.

## Rejected full-expression families

In `where` and `assert`, Rootform language 0.1.0 rejects:

- arithmetic: `+`, `-`, `*`, `/`, `%`;
- unary minus;
- conditional expressions in `where` and `assert`;
- multi-part templates and interpolation mixed with literal text;
- tuple, list, set, map, and object values outside dedicated list fields;
- comprehensions and `for` expressions;
- splats;
- dynamic or string indexes;
- relative traversals;
- arbitrary function calls;
- expanded function arguments;
- bare architecture queries.

Examples:

```rf title="invalid expressions"
where  = source.enabled
where  = source.replicas >= -1
where  = source.cpu > 1.5
assert = contexts(rf.context.network)
assert = "yes"
assert = length(contexts(rf.context.network))
assert = length(contexts(rf.context.network)) + 1 > 1
```

Depending on position, these produce `INVALID_EXPRESSION`,
`PREDICATE_UNRESOLVED`, or `POLICY_INVALID`.

## Bounds

| Bound | Limit |
| --- | --- |
| Authored expression source | 4,096 bytes |
| Compiled expression tree depth | 64 |
| Compiled expression nodes | 1,024 per expression |

Exceeded source shape fails compilation. Compiled Policy Pack has additional
aggregate limits under [Diagnostics and limits](diagnostics.md#limits).
