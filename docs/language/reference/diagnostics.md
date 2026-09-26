---
title: "Diagnostics and limits"
description: "Stable diagnostic codes, severity, document validation, and authoring limits."
---

Use a diagnostic's stable `code` for automation. Its message explains the immediate problem; source validation also gives a sanitized path and range when available. Analysis diagnostics name a stage or instance when applicable. A warning about uncertain evidence is not proof of absence.

## Severity by phase

| Phase | Typical severity | Consequence |
| --- | --- | --- |
| Language discovery, parsing, compilation | Error | Invalid source cannot be used |
| Plan/state input and saved-plan pairing | Error for refusal; warning for recoverable lost enrichment | Input may be refused or analyzed with less evidence |
| Instance interpretation | Error or warning | Affected Rule or emission may remain undecided |
| Comparison | Warning or info | Comparability or drift wording is constrained |
| Policy linking and evaluation | Error | No compliance decision from affected policy |
| Rootform document validation | Error | Document refused |

## RF source diagnostics

These codes come from `rootform validate dialects`, definition validation, or Policy Pack compilation. All have error severity.

### Discovery and parsing

| Code | Cause |
| --- | --- |
| `ROOT_UNREADABLE` | Source root cannot be read |
| `FILE_UNREADABLE` | Discovered source file cannot be read |
| `FILE_NOT_REGULAR` | Matching source path is not a regular file |
| `SYMLINK_OUTSIDE_ROOT` | Symlink escapes the source root |
| `NESTING_TOO_DEEP` | Source nesting exceeds 10,000 levels |
| `HCL_PARSE` | Native or JSON HCL syntax fails |

### Closed structure and values

| Code | Cause |
| --- | --- |
| `UNKNOWN_ATTRIBUTE` | Attribute is outside the block schema |
| `UNKNOWN_BLOCK` | Block is outside the source-unit schema |
| `INVALID_LABEL` | Block label count or identifier is invalid |
| `MISSING_ATTRIBUTE` | Required attribute is absent |
| `DUPLICATE_BLOCK` | A single-cardinality block appears more than once |
| `INVALID_VALUE` | Static value has wrong type, format, enum, or bound |
| `INVALID_EXPRESSION` | Expression is outside the closed language expression union |
| `INVALID_REFERENCE` | Reference or traversal has wrong shape, kind, root, or scope |
| `DUPLICATE_ID` | Canonical identity is declared more than once |
| `ARTIFACT_INVALID` | Compiled artifact violates its language contract |
| `COMPILER_FAILED` | Compiler cannot produce a valid artifact |

### Dialect, definitions, and Rules

| Code | Cause |
| --- | --- |
| `DIALECT_MISSING` | Source root has no `dialect` declaration |
| `DIALECT_DUPLICATE` | Source root has more than one `dialect` declaration |
| `DIALECT_RESERVED` | Dialect owner is reserved `rf` |
| `PROVIDER_INVALID` | Provider source address, label, or version constraint is invalid |
| `PROVIDER_REQUIRED` | Dialect has Rules but no provider declaration |
| `CONCEPT_INVALID` | Concept definition is invalid or exceeds its bound |
| `CONTEXT_INVALID` | Context definition is invalid or exceeds its bound |
| `RELATION_INVALID` | Relation definition is invalid or exceeds its bound |
| `RULE_INVALID` | Rule lacks exactly one `match`, or its type is empty |
| `RULE_NO_ARCHITECTURE` | Rule has no `as`, emission, or nonempty composition |
| `MATCH_KIND_UNKNOWN` | `match.kind` is outside the closed 15-value set |
| `PREDICATE_UNRESOLVED` | Authored predicate cannot compile safely |
| `FACT_INVALID` | Emission lacks `to` or `via`, or Context/Relation syntax is invalid |
| `COMPOSITION_INVALID` | Composition is empty or a member is malformed or out of order |
| `CONCEPT_UNKNOWN` | Concept reference does not resolve in permitted scope |
| `CONTEXT_UNKNOWN` | Context reference does not resolve in permitted scope |
| `RELATION_UNKNOWN` | Relation reference does not resolve in permitted scope |
| `RULE_UNKNOWN` | Rule reference does not resolve in permitted scope |
| `EMISSION_ON_NULL_REQUIRED`, `EMISSION_ON_EMPTY_REQUIRED` | Emission omits explicit null or empty behavior |
| `MATCH_IDENTITY_UNDECLARED` | `match.by` path is absent from target Rule identities |
| `DISCLOSE_REQUIRES_EXTERNAL_ALLOW` | Non-default disclosure requires `external = "allow"` |
| `PREFIX_REQUIRES_MATCH` | Prefix is declared without explicit target matching |

### Policy Pack source

| Code | Cause |
| --- | --- |
| `PACK_MISSING` | Source root has no `policy_pack` declaration |
| `PACK_DUPLICATE` | Source root has more than one `policy_pack` declaration |
| `POLICY_NOT_ALLOWED` | `policy` appears in a Dialect source root |
| `POLICY_REFERENCE_UNQUALIFIED` | Policy semantic reference omits its owner |
| `POLICY_INVALID` | Policy target, assertion, message, list, or built-in call is invalid |

A Rule with only `match` returns `RULE_NO_ARCHITECTURE`. Add actual architecture meaning; do not silence the diagnostic with an arbitrary Concept. [Test and validate](../test-validate.md#compile-a-dialect-source-set) shows the validation command.

## Architecture interpretation diagnostics

### Source and selection errors

| Code | Severity | Cause and next check |
| --- | --- | --- |
| `INPUT_UNRECOGNIZED`, `INPUT_INVALID`, `INPUT_UNREADABLE`, `INPUT_REFUSED` | Error | Input shape, content, access, or allowed size is wrong; regenerate or inspect the export |
| `PLAN_ERRORED` | Error | Terraform or OpenTofu marked the plan as errored; fix the plan failure and export again |
| `PLAN_MASK_INVALID` | Warning | Malformed unknown/sensitive mask discards affected instance values; inspect the exported JSON |
| `PLAN_FILE_REQUIRED`, `PLAN_FILE_UNREADABLE`, `PLAN_PAIR_MISMATCH` | Error or warning | Saved plan missing, unreadable, or not paired with plan JSON; repeat `terraform show -json` from the same saved plan |
| `PROVIDER_UNBOUND` | Warning | Observed provider has no selected Dialect binding; inspect provider identity and selection |
| `RULE_MATCH_AMBIGUOUS` | Error | More than one Rule accepts one instance; narrow `match` predicates or provider envelopes |

### Emission warnings

| Code | Severity | Cause and next check |
| --- | --- | --- |
| `EMISSION_PATH_UNDEFINED` | Warning | `via` path is not defined on the emitted instance; correct the Dialect path |
| `VIA_VALUE_SHAPE` | Warning | Evaluated value has unsupported endpoint shape; choose a scalar or list of scalars |
| `DUPLICATE_IDENTITY` | Warning | Multiple eligible target instances share the matched identity; refine target identity |
| `EVIDENCE_CONFLICT` | Warning | Known value and verified traversal identify different endpoints; inspect source and Rule declarations |

### Comparison diagnostics

| Code | Severity | Cause |
| --- | --- | --- |
| `CROSS_INPUT_NOT_DRIFT` | Info | Difference between two inputs is a comparison, not drift reported by Terraform or OpenTofu |
| `RELEASE_SET_MISMATCH`, `SELECTION_MISMATCH` | Warning | Comparison sides use incompatible semantic selection |

An `indeterminate` closure records a reason such as `unknown_until_apply`, `sensitive`, `ambiguous_unknown`, `uncomparable_candidate`, `duplicate_identity`, `identity_incomplete`, `reference_ambiguous`, `unavailable`, or `external_denied`. These are closure reasons, not interchangeable diagnostic codes. For `via = provider.<path>`, `unavailable` includes a missing verified Planned-stage reference; a literal provider value is never read. See [Fact emissions](emissions.md#omission-and-uncertainty).

## Policy linking and evaluation diagnostics

| Code | Meaning |
| --- | --- |
| `POLICY_OWNER_UNKNOWN`, `POLICY_CONCEPT_UNKNOWN`, `POLICY_CONTEXT_UNKNOWN`, `POLICY_RELATION_UNKNOWN`, `POLICY_RULE_UNKNOWN` | Referenced owner or definition unavailable |
| `POLICY_TARGET_CONTRADICTORY` | Target filters cannot select a compatible Rule |
| `POLICY_SEMANTICS_MISMATCH`, `POLICY_ARCHITECTURE_INVALID` | Pack and document cannot be safely evaluated together |
| `POLICY_STAGE_MISSING` | Requested evaluation stage is unavailable |
| `POLICY_LIMIT_EXCEEDED`, `POLICY_PACK_DUPLICATE` | Evaluation bound or Pack identity invalid |
| `POLICY_NOT_EVALUATED` | No Policy decision took place |
| `POLICY_NO_DECISION` | Selected policies evaluated zero targets; `run` exits `3` |

An unknown assertion or incomplete target domain produces an indeterminate evaluation, not a violation or pass. The policy result and its diagnostics identify the affected target; see [Evaluation](evaluation.md#per-target-outcomes).

## Rootform document validation

`rootform validate document analysis.json` checks a saved Rootform document. The validator reports a dotted field path and one of these code groups:

| Codes | Fault |
| --- | --- |
| `DOCUMENT_JSON_INVALID`, `DOCUMENT_TRAILING_CONTENT`, `DOCUMENT_FIELD_UNKNOWN` | JSON or unknown field |
| `DOCUMENT_FORMAT_UNSUPPORTED`, `DOCUMENT_KIND_INVALID`, `DOCUMENT_GENERATOR_INVALID`, `DOCUMENT_STAGE_INVALID` | Envelope or stage |
| `DOCUMENT_FIELD_REQUIRED`, `DOCUMENT_FIELD_FORBIDDEN`, `DOCUMENT_VOCABULARY_INVALID` | Field presence or closed vocabulary |
| `DOCUMENT_ID_INVALID`, `DOCUMENT_ID_DUPLICATE`, `DOCUMENT_REFERENCE_MISSING` | Identity or reference |
| `DOCUMENT_CLOSURE_INCOMPLETE`, `DOCUMENT_CLOSURE_EXTRA`, `DOCUMENT_ACCOUNTING_MISMATCH`, `DOCUMENT_INCONSISTENT` | Closure or cross-field accounting |

`DOCUMENT_INVALID` or `ANALYSIS_INVALID` marks a refused document at a command boundary. A rejected document cannot support a no-change or compliance conclusion. Regenerate it from the original plan or state JSON rather than editing evidence to satisfy validation.

## Limits

Exceeding a limit fails closed. These bounds are part of the language and evaluation contract.

### RF source and artifact

| Item | Limit |
| --- | --- |
| Source nesting | 10,000 levels |
| Identifier | 64 bytes |
| Definition description | 1,024 UTF-8 bytes |
| Policy message | 1–1,024 UTF-8 bytes |
| Authored expression | 4,096 source bytes |
| Compiled expression depth | 64 |
| Compiled expression nodes | 1,024 per expression |

### Compiled Policy Pack

| Item | Limit |
| --- | --- |
| Serialized input | 16 MiB |
| Policies and semantic pins | 1,024 each |
| Rule references or Dialect owners per Policy target | 1,024 each |
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

A limit failure cannot be treated as a partial pass. See [Test and validate](../test-validate.md) for the authoring sequence that exposes source and fixture problems before distribution.

## Fixing a diagnostic

1. Use the stable code to identify the phase and construct.
2. Read its sanitized source range or Rootform document path.
3. Fix the earliest source error first; later references may depend on it.
4. Repeat source validation and the affected fixture or policy run.

Keep warnings as incomplete evidence until the instance and closure explain
them.
