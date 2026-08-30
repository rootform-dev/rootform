# Policy Result contract

Current format version: `0.1.0`.

Policy evaluation consumes validated Architecture IR and deterministic
Rootform Language policies. It never re-reads Terraform or upgrades unresolved
evidence.

## Outcomes

Each evaluation has one outcome: `passed`, `violated`, or `indeterminate`.
Absence of evidence is never treated as pass.

A result contains exact architecture format version and dialect set, summary,
ordered evaluations, ordered violations, and ordered sanitized diagnostics.
Violations identify policy, stable target, message, source path and line when
available, plus inspected fact identifiers.

`compliant` means every evaluation is determinate, no violation exists, and no
diagnostic prevents a decision. Unevaluated, invalid, incomplete, or bounded-
limit input is not compliant.

Rootform may also emit SARIF as a presentation of same policy result. SARIF does
not change evaluation meaning or exit status.
