# Policy Result contract

Current format version: `0.1.0`.

Policy evaluation consumes validated autonomous Architecture IR and compiled
Policy Packs. It never re-reads Terraform, reloads producer Dialects, contacts
a registry, recompiles source, or upgrades unresolved evidence.

Policies belong to policy packs, never to dialects. A dialect may not carry,
override, or append policy; a policy pack may not change dialect semantics.
Pack selection is never automatic: evaluation uses only packs recorded in the
project lock or named explicitly.

## Outcomes

Each evaluation has one outcome: `passed`, `violated`, or `indeterminate`.
Queries return confirmed fact IDs plus `supported` and `complete`. `length(q)`
is known only when both flags are true. `exists(q)` is true with any confirmed
fact, false only for supported complete zero, and indeterminate otherwise.
Boolean negation preserves indeterminate evidence.

A result contains exact architecture format version and Dialect set, linked
Policy Pack identities and semantic pins, global `status`, `compliant`,
per-policy target coverage, summary, ordered evaluations, ordered violations,
and ordered sanitized diagnostics.
Violations identify policy, stable target, message, source path and line when
available, plus inspected fact identifiers.

A result identifies each evaluated Policy Pack by name and version and every
policy by its pack-qualified identity. Exact pack content and acquisition pins
remain in `rootform.lock`; policy results do not duplicate them. Changing pack
or policy identity changes result meaning; a result is valid only for the
architecture versions and pack selection it records.

Global status is `compliant`, `violated`, `indeterminate`, or `not_evaluated`.
`compliant` is true only for `compliant`. A selected policy with zero targets
increments coverage as not evaluated and prevents compliance. Mixed runs keep
determinate evaluations; any confirmed violation takes precedence, followed by
indeterminate evidence, then not evaluated.

CLI exit status is `0` for compliant, `1` for violated, `2` for command misuse,
and `3` for indeterminate or not evaluated.

Rootform may also emit SARIF as a presentation of same policy result. SARIF does
not change evaluation meaning or exit status.
