---
title: "Diagnostics and limits"
description: "Complete RF compiler, Architecture IR validation, policy diagnostic codes, severity rules, and bounded execution limits."
---

Diagnostics expose stable machine-readable `code`, severity, sanitized
message, and source or Architecture IR location when available. Automation
should branch on `code`, not message text.

## Severity by phase

| Phase | Normal severity |
| --- | --- |
| RF source discovery, parsing, and compilation | Error |
| Rule selection | Error |
| Composition | Error |
| Fact emission and dependency accounting | Warning |
| Architecture IR validation | Error |
| Policy Pack linking and Policy evaluation | Error |

Warning is not safe absence. Emission warning marks affected query evidence
incomplete and can make Policy result indeterminate.

## RF source diagnostics

All codes in this section have error severity.

### Discovery and parsing

| Code | Cause |
| --- | --- |
| `ROOT_UNREADABLE` | Source root cannot be read |
| `FILE_UNREADABLE` | Discovered RF source cannot be read |
| `FILE_NOT_REGULAR` | Matching source path does not resolve to regular file |
| `SYMLINK_OUTSIDE_ROOT` | Symlink escapes source root |
| `NESTING_TOO_DEEP` | Source nesting exceeds 10,000-level guard |
| `HCL_PARSE` | Native or JSON HCL syntax is invalid |

### Closed structure and values

| Code | Cause |
| --- | --- |
| `UNKNOWN_ATTRIBUTE` | Block contains attribute outside its schema |
| `UNKNOWN_BLOCK` | Source contains block outside its schema or source-unit kind |
| `INVALID_LABEL` | Block label count or identifier is invalid |
| `MISSING_ATTRIBUTE` | Required attribute is absent |
| `DUPLICATE_BLOCK` | Single-cardinality block appears more than once |
| `INVALID_VALUE` | Static value has wrong type, format, enum, or bound |
| `INVALID_EXPRESSION` | Expression is outside closed RF expression union |
| `INVALID_REFERENCE` | Reference or traversal has wrong shape, kind, root, or scope |
| `DUPLICATE_ID` | Canonical identity is declared more than once |
| `ARTIFACT_INVALID` | Compiled artifact violates canonical language contract |
| `COMPILER_FAILED` | Compiler cannot produce valid artifact |

### Dialect, definitions, and Rules

| Code | Cause |
| --- | --- |
| `DIALECT_MISSING` | Source root has no `dialect` block |
| `DIALECT_DUPLICATE` | Source root has more than one `dialect` block |
| `DIALECT_RESERVED` | Dialect owner is reserved `rf` |
| `PROVIDER_INVALID` | Provider label count, source address, or version constraint is invalid |
| `PROVIDER_REQUIRED` | Dialect has Rules but no provider declaration |
| `CONCEPT_INVALID` | Concept description exceeds its 1,024-byte bound |
| `CONTEXT_INVALID` | Context description exceeds its 1,024-byte bound |
| `RELATION_INVALID` | Relation description exceeds its 1,024-byte bound |
| `RULE_INVALID` | Rule lacks exactly one `match`, or `match.type` is empty |
| `RULE_NO_ARCHITECTURE` | Rule has no `as`, emission, or nonempty composition |
| `MATCH_KIND_UNKNOWN` | `match.kind` is outside closed 15-value enum |
| `PREDICATE_UNRESOLVED` | Authored predicate shape cannot compile safely |
| `FACT_INVALID` | Emission lacks `to`/`via`, or Context/Relation does not provide exactly one of label and `as` |
| `COMPOSITION_INVALID` | Composition is empty; member lacks `via`/one `match`; or member uses provider, self, or forward traversal |
| `CONCEPT_UNKNOWN` | Concept reference cannot resolve in allowed scope |
| `CONTEXT_UNKNOWN` | Context reference cannot resolve in allowed scope |
| `RELATION_UNKNOWN` | Relation reference cannot resolve in allowed scope |
| `RULE_UNKNOWN` | Rule reference cannot resolve in allowed scope |

### Policy Pack source

| Code | Cause |
| --- | --- |
| `PACK_MISSING` | Source root has no `policy_pack` block |
| `PACK_DUPLICATE` | Source root has more than one `policy_pack` block |
| `POLICY_NOT_ALLOWED` | `policy` appears in Dialect source root |
| `POLICY_REFERENCE_UNQUALIFIED` | Policy semantic reference omits owner |
| `POLICY_INVALID` | Policy, target, assertion, message, list, or built-in call is invalid |

## Architecture interpretation diagnostics

### Source and selection errors

| Code | Severity | Cause |
| --- | --- | --- |
| `DUPLICATE_ADDRESS` | Error | Normalized source produces duplicate declaration identity |
| `AMBIGUOUS_RULE_MATCH` | Error | More than one Rule accepts declaration |
| `PREDICATE_UNRESOLVED` | Error | Eligible Rule predicate depends on unknown evidence |
| `PROVIDER_IDENTITY_UNRESOLVED` | Error | Provider binding required for match cannot be proved |
| `PROVIDER_VERSION_INCOMPATIBLE` | Error | Known exact provider version violates Dialect envelope |
| `SEMANTIC_EXPANSION_LIMIT` | Error | Bounded semantic or architecture expansion is exceeded |

### Composition errors

| Code | Severity | Cause |
| --- | --- | --- |
| `COMPOSITION_MEMBER_UNRESOLVED` | Error | Required member cannot resolve |
| `COMPOSITION_MEMBER_MISMATCH` | Error | Resolved member fails declared match |
| `COMPOSITION_MEMBER_CONFLICT` | Error | Declaration has own selected Rule or more than one composition slot claims it |
| `COMPOSITION_MEMBER_UNCERTAIN` | Error | Member interpretation is indeterminate |

Composition may also carry traversal, predicate, or provider diagnostic from
selection table.

### Emission warnings

| Code | Severity | Cause |
| --- | --- | --- |
| `TRAVERSAL_UNRESOLVED` | Warning | Emission path cannot be decided |
| `TRAVERSAL_DANGLING` | Warning | Emission reference names absent declaration |
| `TRAVERSAL_AMBIGUOUS` | Warning | Emission reference has incompatible targets |
| `ATTRIBUTE_MATCH_UNRESOLVED` | Warning | Explicit source/target comparison cannot be completed |
| `ATTRIBUTE_MATCH_AMBIGUOUS` | Warning | Explicit match has more than one best candidate |
| `FACT_TARGET_UNREPRESENTED` | Warning | Resolved target has no usable representation |
| `FACT_TARGET_MISMATCH` | Warning | Target representation does not satisfy emission `to` |

### Dependency-accounting warnings

| Code | Severity | Cause |
| --- | --- | --- |
| `DEPENDENCY_DANGLING` | Warning | Dependency evidence names unknown declaration |
| `DEPENDENCY_MODULE_UNTRAVERSED` | Warning | Dependency enters module whose declarations are unavailable |
| `DEPENDENCY_CYCLE` | Warning | Dependency evidence contains declaration cycle |
| `DEPENDENCY_UNRESOLVED` | Warning | Dependency cannot be resolved |

These codes describe normalized source dependency graph, not RF source syntax.

## Policy linking and evaluation diagnostics

All codes in this section have error severity.

| Code | Phase | Cause |
| --- | --- | --- |
| `POLICY_OWNER_UNKNOWN` | Link | Referenced Dialect owner is absent |
| `POLICY_CONCEPT_UNKNOWN` | Link | Referenced Concept is absent |
| `POLICY_CONTEXT_UNKNOWN` | Link | Referenced Context is absent |
| `POLICY_RELATION_UNKNOWN` | Link | Referenced Relation is absent |
| `POLICY_RULE_UNKNOWN` | Link | Referenced Rule is absent |
| `POLICY_TARGET_CONTRADICTORY` | Link | Explicit `rules` list has no Rule satisfying optional Concept and owner filters |
| `POLICY_SEMANTICS_MISMATCH` | Evaluate | Compiled Pack pins differ from Architecture IR |
| `POLICY_ARCHITECTURE_INVALID` | Link/evaluate | Architecture IR is structurally invalid |
| `POLICY_TARGET_DOMAIN_INCOMPLETE` | Evaluate | Source uncertainty can hide target representation |
| `POLICY_ASSERTION_UNKNOWN` | Evaluate | Assertion depends on unsupported or incomplete evidence |
| `POLICY_LIMIT_EXCEEDED` | Evaluate | Policy evaluation bound is exceeded |
| `POLICY_PACK_DUPLICATE` | Evaluate | Loaded Pack identity appears more than once |
| `POLICY_NOT_EVALUATED` | Evaluate | No Policy decision run occurred |

Unknown is distinct from violation. These diagnostics never authorize
compliance.

## Source-adapter diagnostics

Architecture IR can also carry diagnostics from Terraform/OpenTofu adapter.
They are not RF syntax errors:

| Code | Severity | Meaning |
| --- | --- | --- |
| `READ_FAILED` | Error | Infrastructure source cannot be read |
| `SYNTAX_INVALID` | Error | Infrastructure syntax is invalid |
| `UNSUPPORTED_BLOCK` | Error | Source construct is unsupported by adapter |
| `DUPLICATE_ADDRESS` | Error | Infrastructure address is duplicated |
| `PROVIDER_UNRESOLVED` | Error | Provider identity is unresolved |
| `MODULE_REMOTE` | Warning | Remote module is recorded but not traversed |
| `MODULE_MISSING` | Error | Local module source target is missing |
| `MODULE_UNRESOLVED` | Error | Local module source cannot be resolved |
| `MODULE_CYCLE` | Error | Local module source graph has a cycle |
| `MODULE_ESCAPE` | Error | Local module source escapes repository root |
| `OVERRIDE_MISSING_BASE` | Error | Override has no base configuration |
| `OVERRIDE_UNSUPPORTED` | Error | Override shape is unsupported |
| `FILE_SHADOWED` | Warning | OpenTofu precedence shadows source file |
| `FILE_NOT_READ` | Warning | File belongs to inactive source family |
| `NESTING_DEPTH_EXCEEDED` | Error | Infrastructure source nesting guard is exceeded |

These adapter codes can appear inside Architecture IR. Structural validation of
that document uses separate codes below.

## Architecture IR validation diagnostics

`rootform validate architecture` emits these codes when serialized Architecture
IR violates its autonomous contract. Policy linking or evaluation reports the
document-level `POLICY_ARCHITECTURE_INVALID` boundary instead. Every `IR_*`
diagnostic has error severity.

| Code | Cause |
| --- | --- |
| `IR_INVALID_DOCUMENT` | Document or generator envelope is invalid |
| `IR_INVALID_VERSION` | IR, RF language, source normalization, or source version metadata is invalid |
| `IR_NIL_COLLECTION` | Required collection is `null` instead of an array |
| `IR_INVALID_STRING` | ID, enum, provider evidence, or bounded string is invalid |
| `IR_INVALID_RANGE` | Source path, location, or range is invalid |
| `IR_DUPLICATE_ID` | Canonical object or collection identity is duplicated |
| `IR_DANGLING_REFERENCE` | Object references an absent semantic, source, architecture, resolution, or diagnostic ID |
| `IR_INVALID_ACCOUNTING` | Source outcome, interpretation, coverage, membership, or closure accounting is inconsistent |
| `IR_INVALID_IMPLEMENTATION` | Direct or composition implementation record is invalid |
| `IR_INVALID_OWNER` | Semantic owner, provider envelope, dependency, selection, or release-set identity is invalid |
| `IR_INVALID_CONTEXT` | Context definition or embedded Context contract is invalid |
| `IR_INVALID_RULE` | Rule definition or applied Rule reference is invalid |
| `IR_INVALID_CONCEPT` | Concept definition or Concept reference is invalid |
| `IR_INVALID_RESOLUTION` | Reference or attribute-match provenance record is invalid or unused |
| `IR_INVALID_DEPENDENCY` | Normalized source dependency or dependency evidence is invalid |
| `IR_INVALID_FACT` | Relation definition, emission contract, fact, omission, provenance, or emission closure is invalid |
| `IR_INVALID_DIAGNOSTIC` | Stored diagnostic is malformed, unsanitized, or incompatible with its subject |
| `IR_PRIVACY_VIOLATION` | Reserved for private source payload crossing public IR boundary; current schema excludes that payload structurally |
| `IR_NON_CANONICAL_ORDER` | One or more document collections are not canonically ordered |
| `IR_LIMIT_EXCEEDED` | Semantic, architecture-object, or active-emission collection bound is exceeded |

See [Architecture IR](../../concepts/architecture-ir.md) for document sections,
closure, and autonomy rules.

## Limits

Limits are part of language safety contract. Exceeding them fails closed.

### RF source and artifact

| Item | Limit |
| --- | --- |
| Source nesting | 10,000 levels |
| RF identifier | 64 bytes |
| Definition description | 1,024 UTF-8 bytes |
| Policy message | 1,024 UTF-8 bytes, minimum 1 |
| Authored expression | 4,096 source bytes |
| Compiled expression depth | 64 |
| Compiled expression nodes | 1,024 per expression |

### Compiled Policy Pack

| Item | Limit |
| --- | --- |
| Serialized input | 16 MiB |
| Policies | 1,024 |
| Semantic pins | 1,024 |
| Rule references per Policy target | 1,024 |
| Dialect owners per Policy target | 1,024 |
| Aggregate expression nodes | 65,536 |
| Aggregate string bytes | 4 MiB |
| One serialized string | 4,096 bytes |
| JSON nesting | 80 levels |
| JSON values | 2,097,152 |

### One Policy evaluation run

| Item | Limit |
| --- | --- |
| Policies | 1,024 |
| Per-target evaluations | 100,000 |
| Inspected fact references | 100,000 |

### Architecture compilation

| Item | Limit |
| --- | --- |
| Semantic definitions | 200,000 |
| Architecture objects | 200,000 |
| Active Rule-emission pairs | 200,000 |
| Provenance records per fact | 1,024 |

Architecture expansion failures use `SEMANTIC_EXPANSION_LIMIT`. Policy run
failures use `POLICY_LIMIT_EXCEEDED`; unsafe partial Policy findings are not
reported as successful result.

## Fixing a diagnostic

1. Use stable code to identify phase and construct.
2. Read sanitized source range or Architecture IR location.
3. Fix earliest source-level error first; later references may depend on it.
4. Re-run `rootform fmt --check` and relevant validation command.
5. Treat warnings as incomplete evidence until understood.

See [Test and validate](../test-validate.md) for command workflow and
[Evaluation](evaluation.md) for result consequences.
