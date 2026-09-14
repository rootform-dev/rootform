---
title: "Syntax and files"
description: "RF source discovery, native and JSON syntax, structural grammar, identifiers, versions, and source-unit boundaries."
---

RF has two equivalent source surfaces:

| Suffix | Encoding | Intended use |
| --- | --- | --- |
| `.rf` | HCL native syntax | Human-authored Dialects and Policy Packs |
| `.rf.json` | HCL JSON syntax | Generated Dialects and Policy Packs |

Both suffixes may coexist inside one source root. Files and directories organize
source for people only. They do not create namespaces, imports, or evaluation
order.

## Source discovery

Rootform walks requested source root recursively.

| Path | Behavior |
| --- | --- |
| Regular file ending in `.rf` or `.rf.json` | Parsed |
| Other file suffix | Ignored |
| Dot-prefixed file or directory | Ignored |
| Symlink resolving to regular file inside source root | Parsed |
| Symlink escaping source root | Rejected with `SYMLINK_OUTSIDE_ROOT` |
| Matching file that cannot be read or is not regular | Rejected |

Discovery and diagnostic ordering are deterministic. Declaration resolution is
independent of filename and file order. Only
[composition members](composition.md) retain authored order.

## Source units

One source root has exactly one responsibility.

| Unit | Required manifest | Other allowed top-level blocks |
| --- | --- | --- |
| Dialect | Exactly one `dialect` | `concept`, `context`, `relation`, `rule` |
| Policy Pack | Exactly one `policy_pack` | `policy` |

RF Vocabulary is embedded by Rootform and cannot be authored as a source unit.
A Dialect cannot contain `policy`. A Policy Pack cannot contain Dialect
blocks. RF has no `import`, `include`, `module`, `requires`, or
cross-Dialect dependency block.

## Structural grammar

This grammar describes RF block structure. Brackets mean optional, braces mean
zero or more, and a trailing `+` means one or more. Commas and semicolons are
grammar notation, not RF tokens. Attribute order and block order are not
significant except for `member` order.

```text
dialect-unit       = dialect-block,
                     { concept-block | context-definition |
                       relation-definition | rule-block } ;

dialect-block      = "dialect", label, "{",
                       version-attribute,
                       { provider-block },
                     "}" ;

provider-block     = "provider", provider-source, "{",
                       version-constraint-attribute,
                     "}" ;

concept-block      = "concept", label, "{", [ description-attribute ], "}" ;
context-definition = "context", label, "{", [ description-attribute ], "}" ;
relation-definition
                   = "relation", label, "{", [ description-attribute ], "}" ;

rule-block         = "rule", label, "{",
                       match-block,
                       [ as-attribute ],
                       { context-emission | relation-emission |
                         contribution-emission },
                       [ composition-block ],
                     "}" ;

match-block        = "match", "{",
                       [ kind-attribute ],
                       type-attribute,
                       [ where-attribute ],
                     "}" ;

context-emission   = ( "context", label | "context" ), "{",
                       [ as-attribute ],
                       to-attribute,
                       via-attribute,
                       [ fact-match-block ],
                     "}" ;

relation-emission  = ( "relation", label | "relation" ), "{",
                       [ as-attribute ],
                       to-attribute,
                       via-attribute,
                       [ fact-match-block ],
                     "}" ;

contribution-emission
                   = "contribution", "{",
                       to-attribute,
                       via-attribute,
                       [ fact-match-block ],
                     "}" ;

fact-match-block   = "match", "{",
                       by-attribute,
                       strategy-attribute,
                     "}" ;

composition-block  = "composition", "{", member-block+, "}" ;
member-block       = "member", label, "{",
                       via-attribute,
                       match-block,
                     "}" ;

policy-pack-unit   = policy-pack-block, { policy-block } ;

policy-pack-block  = "policy_pack", label, "{",
                       version-attribute,
                     "}" ;

policy-block       = "policy", label, "{",
                       target-block,
                       assert-attribute,
                       message-attribute,
                     "}" ;

target-block       = "target", "{",
                       [ concept-attribute ],
                       [ rules-attribute ],
                       [ dialects-attribute ],
                     "}" ;
```

Detailed pages define every attribute type, default, exclusivity rule, and
runtime effect.

## Native syntax

```hcl title="dialect.rf"
dialect "example" {
  version = "0.1.0"

  provider "hashicorp/example" {
    version = ">= 1.0.0, < 2.0.0"
  }
}
```

Source text is UTF-8. Native RF follows
[HCL native lexical rules](https://github.com/hashicorp/hcl/blob/main/hclsyntax/spec.md):

- whitespace is insignificant outside strings;
- line comments use `#` or `//`;
- block comments use `/* ... */`;
- string literals use quotes or static heredocs;
- block labels are conventionally quoted; a bare HCL identifier is also
  accepted when resulting label satisfies RF label grammar;
- `rootform fmt` writes canonical layout.

A field documented as a static string is evaluated in an empty HCL context.
Result must be known, non-null string. Variables and functions are unavailable;
multi-part interpolated templates are rejected. Constant string conditionals
are accepted, although direct literals are canonical and recommended.
Expression fields accept only RF subset documented under
[Expressions](expressions.md).

## JSON syntax

HCL JSON represents labeled blocks as nested objects. This complete Dialect is
equivalent to native RF:

```json title="dialect.rf.json"
{
  "dialect": {
    "example": {
      "version": "0.1.0",
      "provider": {
        "hashicorp/example": {
          "version": ">= 1.0.0, < 2.0.0"
        }
      }
    }
  },
  "concept": {
    "network": {
      "description": "An example network."
    }
  },
  "rule": {
    "network": {
      "match": {
        "kind": "resource",
        "type": "example_network"
      },
      "as": "${concept.network}"
    }
  }
}
```

Expression-valued JSON strings use HCL JSON expression carrier
`"${...}"`. Static string fields remain ordinary JSON strings in
`.rf.json` and are never reparsed as expressions.

A Policy Pack manifest and its Policies are sibling top-level blocks:

```json title="pack.rf.json"
{
  "policy_pack": {
    "baseline": {
      "version": "0.1.0"
    }
  },
  "policy": {
    "network-context": {
      "target": {
        "concept": "${rf.concept.subnet}",
        "rules": [
          "${aws.rule.subnet}"
        ],
        "dialects": [
          "aws"
        ]
      },
      "assert": "${exists(contexts(rf.context.network, rf.concept.virtual-network))}",
      "message": "Subnets must declare their virtual network."
    }
  }
}
```

For repeated blocks with the same labels, HCL JSON uses arrays at the repeated
body position. HCL JSON has no comment tokens; a `"//"` property carries
comment text where [HCL JSON mapping](https://github.com/hashicorp/hcl/blob/main/json/spec.md)
allows it. Generated authors should follow that mapping rather than translating
native punctuation mechanically.

## Identifiers

Most RF labels use this grammar:

```text
identifier = lower, { lower | digit | "-" }, with no trailing or doubled "-" ;
lower      = "a" ... "z" ;
digit      = "0" ... "9" ;
```

Equivalent regular expression:

```text
[a-z][a-z0-9]*(?:-[a-z0-9]+)*
```

Identifiers are 1 to 64 UTF-8 bytes and ASCII lowercase kebab case. This
applies to Dialect, definition, Rule, composition member, Policy Pack, and
Policy labels. Provider source labels follow their own slash-form grammar.
Traversal attributes follow their own adapter-name grammar.

`rf` is reserved as the embedded vocabulary owner and cannot be a Dialect
label.

## Versions

Dialect and Policy Pack `version` use exact three-component decimal form:

```text
version = component, ".", component, ".", component ;
```

Each component is non-negative and has no leading zero unless it is exactly
`0`. Pre-release identifiers, build metadata, and ranges are invalid.

| Accepted | Rejected |
| --- | --- |
| `0.1.0` | `v0.1.0` |
| `2.0.14` | `2.0` |
| `10.4.0` | `01.4.0` |
| | `1.0.0-beta.1` |

Provider `version` is a constraint string, not this exact-version field. See
[Provider block](dialects.md#provider-block).

## Source bounds

| Value | Bound |
| --- | --- |
| Structural nesting | At most 10,000 levels |
| RF identifier | 1 to 64 bytes |
| Optional definition description | At most 1,024 UTF-8 bytes; empty is allowed |
| Required Policy message | 1 to 1,024 UTF-8 bytes |
| Expression source | At most 4,096 bytes |

Additional compiled and evaluation bounds appear under
[Diagnostics and limits](diagnostics.md#limits).

## Rejected example

```hcl title="invalid-version.rf"
dialect "example" {
  version = "0.1"
}
```

`version` is required to use exact `MAJOR.MINOR.PATCH`, so this source
produces `INVALID_VALUE`.
