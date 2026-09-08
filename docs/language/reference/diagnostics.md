---
title: "Language diagnostics"
description: "Reference for stable .rf compiler and policy-evaluation diagnostic codes, ranges, and corrections."
---

Rootform diagnostics identify invalid source or an evaluation that cannot make
a trusted decision. Use stable `code` values in automation and show the message
and range to people.

Language compiler diagnostics carry:

| Field | Meaning |
| --- | --- |
| `severity` | `error` for rejected language source |
| `code` | Stable machine-readable category |
| `message` | Bounded explanation |
| `range.path` | Sanitized path relative to the source root |
| `range.start` / `range.end` | One-based line and column plus byte offsets |

Diagnostics are emitted in canonical order. Absolute source-root paths are not
needed in portable output.

## File and parser codes

| Code | Cause | Correction |
| --- | --- | --- |
| `ROOT_UNREADABLE` | Supplied source root cannot be read. | Check path, type, and permissions. |
| `FILE_UNREADABLE` | Discovered language file cannot be read. | Restore readable regular source. |
| `FILE_NOT_REGULAR` | Source path is not a regular file. | Replace it with a regular `.rf` or `.rf.json` file. |
| `SYMLINK_OUTSIDE_ROOT` | Source symlink leaves its root. | Keep source within the package root. |
| `NESTING_TOO_DEEP` | JSON or expression nesting exceeds the accepted bound. | Flatten generated input. |
| `HCL_PARSE` | Native or JSON source is not valid HCL syntax. | Fix syntax at the reported range, then rerun validation. |

## Structural codes

| Code | Cause | Correction |
| --- | --- | --- |
| `UNKNOWN_ATTRIBUTE` | Attribute is not accepted in this block. | Remove it or move meaning to a supported field. |
| `UNKNOWN_BLOCK` | Block is not accepted at this position. | Use the position-specific schema. |
| `INVALID_LABEL` | Block has wrong label count or invalid name. | Use required labels in lower kebab case. |
| `MISSING_ATTRIBUTE` | Required attribute is absent. | Add the exact required field. |
| `DUPLICATE_BLOCK` | Single-cardinality nested block occurs more than once. | Keep one declaration. |
| `INVALID_VALUE` | Literal field has wrong type or value. | Use the closed value form for that attribute. |
| `DUPLICATE_ID` | Pack, policy, definition, requirement, or member identity repeats. | Give each identity one owner. |

## Dialect and rule codes

| Code | Cause | Correction |
| --- | --- | --- |
| `DIALECT_MISSING` | Dialect source root has no identity declaration. | Add exactly one `dialect` block. |
| `DIALECT_DUPLICATE` | More than one Dialect identity is declared in one root. | Keep one `dialect` declaration. |
| `DIALECT_REQUIREMENT` | Required Dialect name or exact version is invalid. | Use valid name and `MAJOR.MINOR.PATCH`. |
| `REQUIREMENT_MISSING` | Directly required local Dialect is not loaded. | Include or acquire the exact requirement. |
| `REQUIREMENT_VERSION` | Loaded requirement has another version. | Align exact versions deliberately. |
| `REQUIREMENT_CYCLE` | Dialect requirement graph is cyclic. | Remove the cycle; requirements are acyclic. |
| `PROVIDER_INVALID` | Provider source or constraint is invalid. | Fix canonical source and version clauses. |
| `PROVIDER_REQUIRED` | Dialect has source-matching rules but no provider envelope. | Declare the provider the rules cover. |
| `CONCEPT_INVALID` | Concept shape, description, or kind field is invalid. | Supply label, valid kind, and nonempty description. |
| `CONTEXT_INVALID` | Context definition is invalid. | Supply valid label and nonempty description. |
| `CONCEPT_KIND_UNKNOWN` | Kind is outside `entity`, `scope`, `detail`. | Choose one closed concept kind. |
| `RULE_INVALID` | Rule lacks required shape or has empty match type. | Supply one match and one valid `as`. |
| `MATCH_KIND_UNKNOWN` | `match.kind` is outside the closed declaration set. | Use a documented match kind. |
| `PREDICATE_UNRESOLVED` | `where` cannot compile into a safe predicate. | Restrict it to supported literals, `source`, and operators. |
| `FACT_INVALID` | Fact fields or concept-kind endpoints violate graph rules. | Correct fact shape and endpoint concepts. |
| `COMPOSITION_INVALID` | Member shape or source/member ordering is invalid. | Use source or an earlier unique member. |
| `AMBIGUOUS_RULE_MATCH` | More than one rule classifies a source declaration. | Make matches disjoint with type or proven predicate. |

## Reference and expression codes

| Code | Cause | Correction |
| --- | --- | --- |
| `INVALID_EXPRESSION` | Parsed expression is outside Rootform's closed model. | Use supported literals, operators, traversals, or calls for the field. |
| `INVALID_REFERENCE` | Traversal/reference form or root is invalid at this position. | Use the position's allowed root and a static path. |
| `CONCEPT_UNKNOWN` | Concept is not local or visible through an exact direct requirement. | Define it locally or qualify a directly required Dialect. |
| `CONTEXT_UNKNOWN` | Context is not local or visible through an exact direct requirement. | Define it locally or qualify a directly required Dialect. |
| `ARTIFACT_INVALID` | Compiled result fails canonical model validation. | Treat as invalid source; preserve diagnostic evidence. |
| `COMPILER_FAILED` | Compilation could not produce a trusted artifact. | Resolve preceding diagnostics and rerun. |

## Policy Pack compiler codes

| Code | Cause | Correction |
| --- | --- | --- |
| `PACK_MISSING` | Source set has no `policy_pack` declaration. | Add at least one pack. |
| `PACK_REQUIREMENT` | Pack requirement name or exact version is invalid. | Use valid name and `MAJOR.MINOR.PATCH`. |
| `POLICY_NOT_ALLOWED` | A `policy` block appears in a Dialect package. | Move it inside a dedicated `policy_pack`. |
| `POLICY_REFERENCE_UNQUALIFIED` | Pack uses local-form vocabulary reference. | Use `concept.dialect.name` or `context.dialect.name`. |
| `POLICY_INVALID` | Target, assertion, message, or expression type is invalid. | Correct the policy's closed schema and Boolean assertion. |

## Policy evaluation codes

These codes belong to policy results rather than source compilation:

| Code | Decision blocked by |
| --- | --- |
| `POLICY_PACK_DUPLICATE` | Same pack identity loaded more than once |
| `POLICY_REQUIREMENT_MISSING` | Required Dialect absent from loaded semantics |
| `POLICY_REQUIREMENT_VERSION` | Required Dialect loaded at another version |
| `POLICY_CONCEPT_UNKNOWN` | Referenced concept absent from loaded vocabulary |
| `POLICY_CONTEXT_UNKNOWN` | Referenced context absent from loaded vocabulary |
| `POLICY_SEMANTICS_MISMATCH` | Loaded Dialects differ from architecture provenance |
| `POLICY_ARCHITECTURE_INVALID` | Architecture IR fails structural validation |
| `POLICY_ARCHITECTURE_INCOMPLETE` | Architecture or reference evidence is incomplete |
| `POLICY_ASSERTION_UNKNOWN` | One assertion did not produce a known Boolean |
| `POLICY_LIMIT_EXCEEDED` | Policy, evaluation, assertion, or fact-inspection bound exceeded |
| `POLICY_NOT_EVALUATED` | No policy decision run occurred |

Policy result diagnostics use severity `error`. An indeterminate diagnostic is
not a known violation and must not be converted to success. See
[Evaluation](evaluation.md) for whole-run behavior.
