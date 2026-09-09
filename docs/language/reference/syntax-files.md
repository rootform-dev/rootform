---
title: "Syntax and files"
description: "Reference for .rf and .rf.json source discovery, structural syntax, identities, and source-unit boundaries."
---

The Rootform language has two equivalent parsing surfaces:

| Suffix | Purpose | Parser surface |
| --- | --- | --- |
| `.rf` | Human authoring | HCL native syntax |
| `.rf.json` | Generated or machine-authored source | Standard HCL JSON syntax |

Both compile into the same closed Rootform model. They can coexist under one
source root. A file in one form does not override a file in the other form;
duplicate declarations remain duplicates.

## Source discovery

Rootform walks the supplied source root recursively and deterministically. It
reads regular files ending in `.rf` or `.rf.json`. Plain `.hcl`, `.json`, and
Terraform `.tf` files are not part of the Rootform language.

Hidden organization and nested folders do not create language scope. The
package identity comes from a `dialect` or `policy_pack` declaration, not a
directory name.

Unreadable files, irregular files, source escaping its root, and excessive JSON
nesting fail with explicit diagnostics. Rootform does not skip a bad language
file silently.

## Native structural syntax

A native `.rf` file uses blocks, labels, attributes, and expressions:

```hcl title="dialect.rf"
dialect "example" {
  version = "0.1.0"

  provider "hashicorp/example" {
    version = ">= 1.0.0, < 2.0.0"
  }
}
```

The block has these structural parts:

| Token | Role |
| --- | --- |
| `dialect` | Block type fixed by Rootform. |
| `"example"` | Required block label. |
| `version` | Attribute name fixed at this position. |
| `"0.1.0"` | Literal string value. |
| `provider` | Nested block type. |
| `"hashicorp/example"` | Provider source label. |

Whitespace and newlines are not semantic outside strings. Native syntax
accepts line comments beginning with `#` or `//` and block comments delimited
by `/*` and `*/`. `rootform fmt` produces canonical layout.

Unknown attributes and blocks are errors. Extra or missing labels are errors.
Rootform never treats an unrecognized body item as extension metadata.

## Labels and names

Dialect, concept, context, rule, Policy Pack, policy, and composition-member
names use lower kebab case: lowercase ASCII letters and digits separated by
single hyphens. Names are 1–64 bytes, cannot begin or end with a hyphen, and
cannot contain spaces or underscores.

```text title="Name examples"
valid:   subnet
valid:   private-database-reachability
invalid: PrivateSubnet
invalid: private_subnet
invalid: -subnet
```

Provider source labels use canonical `namespace/name` or
`hostname/namespace/name` form. [Provider envelopes](dialects.md#provider-envelope)
define normalization and matching. Traversal attribute names follow source
adapter's path vocabulary and are not Dialect definition labels.

## Source-unit boundaries

Dialect and Policy Pack roots are separate compilation units:

| Source unit | Accepted top-level blocks | Required identity |
| --- | --- | --- |
| Dialect | `dialect`, `concept`, `context`, `rule` | Exactly one `dialect` declaration across the root. |
| Policy Pack | `policy_pack`, `policy` | Exactly one `policy_pack` declaration across the root. |

A top-level `policy` belongs to the single `policy_pack` manifest in its source
root. It does not need to nest inside that manifest or name a pack reference. A
policy found in a Dialect package is rejected with `POLICY_NOT_ALLOWED`. A
Dialect block in a Policy Pack source root is an unknown block.

Nested policies remain accepted for existing `0.1.0` source compatibility.
Top-level policies are canonical because they support recursive multi-file
authoring; all examples use that form.

Definitions in a Dialect can be split across files. Their language scope is the
Dialect, not the file. Definition identities must be unique across the whole
root. Policy declarations can likewise be split across any files and nested
folders beneath one Policy Pack root. A missing or second manifest makes their
ownership invalid. Package several packs by placing each in its own source root
beneath one parent directory.

There is no source `import`, `include`, or `module` construct. Cross-Dialect
vocabulary access uses an exact direct `requires` entry and a qualified
reference. Policy Packs have no source composition or inheritance.

## JSON structural syntax

`.rf.json` uses standard HCL JSON block encoding. A labeled block becomes a
nested object keyed by its label. This JSON source is equivalent to a native
`dialect "example"` declaration:

```json title="dialect.rf.json"
{
  "dialect": {
    "example": {
      "version": "0.1.0",
      "requires": {
        "core": "0.1.0"
      },
      "provider": {
        "hashicorp/example": {
          "version": ">= 1.0.0, < 2.0.0"
        }
      }
    }
  }
}
```

Policy Pack JSON uses same root-level ownership model. Manifest and policy are
sibling block objects:

```json title="pack.rf.json"
{
  "policy_pack": {
    "baseline": {
      "version": "0.1.0",
      "requires": {
        "core": "0.1.0"
      }
    }
  },
  "policy": {
    "network-context": {
      "target": "concept.core.virtual-network",
      "assert": "${length(contexts(context.core.network, concept.core.virtual-network)) > 0}",
      "message": "Networks must have network context."
    }
  }
}
```

Literal-only fields remain plain JSON strings. Fields that accept a Rootform
expression use HCL's interpolation-string carrier for nonliteral expressions.

`target` is a semantic-reference field and stays a plain string in JSON.
`assert` is a full-expression field; `${ ... }` carries its operator and call
expression. A bare assertion string such as `"a == b"` is a literal string,
not an expression to reinterpret.

`description`, `message`, match `kind` and `type`, versions, and matching
strategy are literal fields. Rootform does not interpolate their contents.

## Versions and string bounds

Dialect and Policy Pack versions use exact `MAJOR.MINOR.PATCH` form with
nonnegative decimal components, no leading zeroes, and no prerelease suffix.
`requires` values use the same exact form. Provider compatibility is different:
its `version` string is a validated provider constraint.

Descriptions and policy messages must be nonempty and fit within 1024 UTF-8
bytes. Expressions fit within 4096 source bytes. These bounds reject
pathological input; concise authoring should remain well below them.

Continue with [Dialects](dialects.md) or [Policy Packs](policy-packs.md) for
position-specific schemas.
