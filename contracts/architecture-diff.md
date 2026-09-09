# Architecture Diff contract

Current diff format version: `0.1.0`.

Architecture Diff compares two validated Architecture IR `0.1.0` documents.
It reports architectural meaning, not source formatting, byte positions, or
rule provenance changes.

## Result

A result contains:

- `format_version` and `architecture_format_version`;
- summary counts for representations, contexts, contributions, and relations;
- ordered `changes` classified as `added`, `removed`, or `changed`;
- ordered `undetermined` entries where evidence supports no change claim;
- diagnostic and declaration population deltas;
- sanitized `problems` when comparison was not possible.

Changed fields are drawn from `concept`, `kind`, `name`,
`implementation_kind`, `members`, `dimension`, `predicate`, `from`, and `to`.
Rule, emission, resolution, and fact provenance may accompany a change but do
not create one.

## Safety rules

- Invalid input yields indeterminate result, never empty diff.
- Documents with different executable semantic digests are not compared;
  description-only or presentation-only changes remain comparable.
- An object or proven-empty emission present on one side is added or removed
  only when the empty side has complete applicable closure. Unsupported,
  unresolved, or incomplete absence is `undetermined`.
- Empty means valid comparison with no changes and no undetermined entry.
- Output ordering and bytes are deterministic and carry no host, path, time, or
  duration.

A completed comparison can contain undetermined facts without a top-level
problem. The CLI reports that comparison with status `0` by default, or `1`
with `--exit-code` because the report is nonempty. Status `3` is reserved for
a comparison that could not be completed. Consumers must inspect classifications
as well as exit status.
