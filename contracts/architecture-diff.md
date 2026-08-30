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
`implementation_kind`, `members`, `dimension`, `relation_type`, `from`, and
`to`. Provenance fields may accompany a change but do not create one.

## Safety rules

- Invalid input yields indeterminate result, never empty diff.
- Documents built with different dialect sets or versions are not compared.
- An object present on one side and unresolved on other is undetermined, not
  automatically added or removed.
- Empty means valid comparison with no changes and no undetermined entry.
- Output ordering and bytes are deterministic and carry no host, path, time, or
  duration.
