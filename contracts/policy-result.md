# Policy Result contract

Current format version: `0.1.0`.

Policy evaluation consumes validated Architecture IR and deterministic
Rootform Language policies sourced from independently distributed policy
packs. It never re-reads Terraform or upgrades unresolved evidence.

Policies belong to policy packs, never to dialects. A dialect may not carry,
override, or append policy; a policy pack may not change dialect semantics.
Pack selection is never automatic: evaluation uses only packs recorded in the
project lock or named explicitly.

## Outcomes

Each evaluation has one outcome: `passed`, `violated`, or `indeterminate`.
Absence of evidence is never treated as pass.

A result contains exact architecture format version and dialect set, summary,
ordered evaluations, ordered violations, and ordered sanitized diagnostics.
Violations identify policy, stable target, message, source path and line when
available, plus inspected fact identifiers.

A result identifies each evaluated Policy Pack by name and version and every
policy by its pack-qualified identity. Exact pack content and acquisition pins
remain in `rootform.lock`; policy results do not duplicate them. Changing pack
or policy identity changes result meaning; a result is valid only for the
architecture versions and pack selection it records.

`compliant` means every evaluation is determinate, no violation exists, and no
diagnostic prevents a decision. Unevaluated, invalid, incomplete, or bounded-
limit input is not compliant.

Rootform may also emit SARIF as a presentation of same policy result. SARIF does
not change evaluation meaning or exit status.
