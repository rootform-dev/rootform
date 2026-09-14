# Architecture Diff contract

Current diff format version: `0.1.0`.

Architecture Diff compares two validated Architecture IR `0.1.0` documents.
It separates structural continuity of source objects from comparison of
architectural knowledge, and reports meaning, not source formatting, byte
positions, or provenance changes.

## Structural continuity

For the same normalized resource, the representation ID is stable across
interpretation changes: appearance, change, or disappearance of a Rule or
Concept is not a resource creation or deletion; adding or removing a composite
membership neither deletes nor creates member bases; an interpretation failure
does not prove deletion of the source object; a new data representation is a
new interpreted observation, not proof of a managed resource creation.

Structural comparison requires comparable source scope and the same identity
normalization contract at the same version. Otherwise continuity is
indeterminate; a contract gap becomes neither a creation nor a deletion.
Absence of a declaration is asserted only when source accounting and identity
compatibility allow that conclusion. V0.1 introduces no physical identity
reconciliation across resource and data.

## Semantic comparison

The semantic environments of both sides are recorded. A semantic mismatch
blocks conclusions about facts and interpretations but does not void source
continuity that remains provable. Conclusions about facts require compatible
contracts and the necessary closure; without proof they stay indeterminate. In
particular, a Rule or emission absent in R1 does not mean "zero architectural
facts in R1", and facts newly known in R2 are not automatically infrastructure
changes.

Attributing a difference solely to knowledge evolution requires proof of
identical normalized inputs, or reanalysis of both original sources under one
exact semantic set; reanalysis is not promised from a saved IR alone.

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
not create one. A change of interpretation alone never changes the source
identity of a representation.

## Safety rules

- Invalid input yields indeterminate result, never empty diff.
- Documents with different semantic environments are comparable only under the
  compatibility and closure conditions above; unprovable semantic conclusions
  are `undetermined`, not empty or asserted.
- A representation or proven-empty emission present on one side is added or
  removed only when the empty side has complete applicable closure.
  Unsupported, unresolved, or incomplete absence is `undetermined`.
- Empty means valid comparison with no changes and no undetermined entry.
- Output ordering and bytes are deterministic and carry no host, path, time, or
  duration.

A completed comparison can contain undetermined facts without a top-level
problem. The CLI reports that comparison with status `0` by default, or `1`
with `--exit-code` because the report is nonempty. Status `3` is reserved for
a comparison that could not be completed. Consumers must inspect
classifications as well as exit status.
