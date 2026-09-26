---
title: "Diagnostics and limits"
description: "Diagnostic codes for language compilation, plan and state analysis, document validation, and policy evaluation."
---

Diagnostics carry a stable `code`, severity, sanitized message, and subject when available. Branch on the code in automation. A warning about unresolved evidence is not proof of absence.

## Language source

Language discovery, parsing, and compilation errors use these codes:

| Code | Meaning |
| --- | --- |
| `ROOT_UNREADABLE`, `FILE_UNREADABLE`, `FILE_NOT_REGULAR`, `SYMLINK_OUTSIDE_ROOT`, `NESTING_TOO_DEEP` | Source cannot be safely discovered or read. |
| `HCL_PARSE`, `UNKNOWN_ATTRIBUTE`, `UNKNOWN_BLOCK`, `INVALID_LABEL`, `MISSING_ATTRIBUTE`, `DUPLICATE_BLOCK`, `INVALID_VALUE`, `INVALID_EXPRESSION`, `INVALID_REFERENCE`, `DUPLICATE_ID` | Source syntax, structure, value, or reference is invalid. |
| `DIALECT_MISSING`, `DIALECT_DUPLICATE`, `DIALECT_RESERVED`, `PROVIDER_INVALID`, `PROVIDER_REQUIRED` | Dialect or provider declaration is invalid. |
| `CONCEPT_INVALID`, `CONTEXT_INVALID`, `RELATION_INVALID`, `RULE_INVALID`, `RULE_NO_ARCHITECTURE`, `MATCH_KIND_UNKNOWN`, `PREDICATE_UNRESOLVED`, `FACT_INVALID`, `COMPOSITION_INVALID` | Architecture definition cannot compile. |
| `CONCEPT_UNKNOWN`, `CONTEXT_UNKNOWN`, `RELATION_UNKNOWN`, `RULE_UNKNOWN` | Referenced definition is unavailable. |
| `EMISSION_ON_NULL_REQUIRED`, `EMISSION_ON_EMPTY_REQUIRED` | Emission must explicitly say how null and empty values behave. |
| `MATCH_IDENTITY_UNDECLARED` | A `match.by` path is not a declared target identity attribute. |
| `DISCLOSE_REQUIRES_EXTERNAL_ALLOW`, `PREFIX_REQUIRES_MATCH` | External disclosure or prefix lacks the required companion declaration. |
| `PACK_MISSING`, `PACK_DUPLICATE`, `POLICY_NOT_ALLOWED`, `POLICY_REFERENCE_UNQUALIFIED`, `POLICY_INVALID` | Policy Pack source is invalid. |
| `ARTIFACT_INVALID`, `COMPILER_FAILED` | Compilation cannot produce a valid artifact. |

## Analysis and evidence

| Code | Severity | Meaning |
| --- | --- | --- |
| `INPUT_UNRECOGNIZED`, `INPUT_INVALID`, `INPUT_UNREADABLE`, `INPUT_REFUSED` | Input kind, content, or access is invalid or refused. |
| `PLAN_ERRORED` | Error | The producer marked the plan errored. |
| `PLAN_MASK_INVALID` | Warning | A malformed sensitivity or unknown mask causes affected instance values to be discarded. |
| `PLAN_FILE_REQUIRED`, `PLAN_FILE_UNREADABLE`, `PLAN_PAIR_MISMATCH` | Warning or error | Saved-plan enrichment is required, unavailable, or fails verification against the JSON export. |
| `PROVIDER_UNBOUND` | Warning | No selected Dialect binds the observed provider. |
| `RULE_MATCH_AMBIGUOUS` | Error | More than one Rule matches an instance. |
| `EMISSION_PATH_UNDEFINED` | Warning | The Dialect reads an attribute path this instance type does not define. |
| `VIA_VALUE_SHAPE` | Warning | An emission value has a shape that cannot be interpreted as endpoint evidence. |
| `DUPLICATE_IDENTITY` | Warning | Multiple eligible instances share the matched identity. |
| `EVIDENCE_CONFLICT` | Warning | Evaluated value and verified identity traversal name different endpoints. |
| `CROSS_INPUT_NOT_DRIFT` | Info | A cross-input comparison is not labelled drift. |
| `RELEASE_SET_MISMATCH`, `SELECTION_MISMATCH` | Warning | Comparison sides have incompatible semantic selections. |

A closure gives the corresponding `resolved`, `absent`, or `indeterminate` outcome and reason. An indeterminate result can mean `unknown_until_apply`, `sensitive`, `ambiguous_unknown`, `uncomparable_candidate`, `reference_ambiguous`, `identity_incomplete`, `unavailable`, `external_denied`, or `duplicate_identity`. `reference_ambiguous` means the evaluated value and verified traversal name different endpoints and accompanies `EVIDENCE_CONFLICT`.

For `via = provider.<path>`, `unavailable` means the planned stage lacks a verified saved-plan reference that identifies an endpoint. This includes plan-only analysis, state input, refreshed and recorded stages, literal or transformed provider expressions, OpenTofu provider blocks with `for_each`, and JSON configuration syntax. Rootform never reads a literal provider configuration value.

## Document validation

`rootform validate architecture` reports `DOCUMENT_*` codes for malformed JSON, unsupported format or kind, forbidden, required, or unknown fields, invalid or duplicate IDs, missing references, invalid stages or generator, inconsistent accounting, incomplete or extra closure, and invalid semantic vocabulary. `ANALYSIS_INVALID` and `DOCUMENT_INVALID` mark a refused analysis document at command boundaries. A rejected document cannot support a no-change or compliance conclusion.

## Policy evaluation

| Code | Meaning |
| --- | --- |
| `POLICY_OWNER_UNKNOWN`, `POLICY_CONCEPT_UNKNOWN`, `POLICY_CONTEXT_UNKNOWN`, `POLICY_RELATION_UNKNOWN`, `POLICY_RULE_UNKNOWN` | A referenced semantic definition is unavailable. |
| `POLICY_TARGET_CONTRADICTORY` | Target filters select no compatible Rule. |
| `POLICY_SEMANTICS_MISMATCH`, `POLICY_ARCHITECTURE_INVALID` | The selected policy cannot safely use this document. |
| `POLICY_TARGET_DOMAIN_INCOMPLETE`, `POLICY_ASSERTION_UNKNOWN` | Available evidence cannot decide the assertion. |
| `POLICY_LIMIT_EXCEEDED`, `POLICY_PACK_DUPLICATE` | Evaluation bound or Pack identity is invalid. |
| `POLICY_NOT_EVALUATED` | No policy decision occurred. |

See [Evaluation](evaluation.md) for how uncertainty affects results and [Architecture documents](../../concepts/architecture-ir.md) for the evidence model.
