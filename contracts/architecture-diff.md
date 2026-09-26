# Architecture comparison contract

Architecture comparisons are part of the [format-1 document family](architecture-ir.md). The [JSON Schema](../schemas/architecture-ir.schema.json) defines their wire representation. `rootform run plan.json --diff state.json -o comparison.json --no-serve` produces a `kind: "comparison"` document containing the two analysis sides, selected stages, and a `name: "cross"` comparison.

## Compared evidence

A plan can contain three internal comparisons when the relevant stages exist: `drift` is recorded to refreshed, `planned` is refreshed to planned, and `net` is recorded to planned. Only a plan's recorded-to-refreshed comparison uses the name drift. Separate input documents do not share the producer evidence needed for that claim.

Each comparison records its `before` and `after` stage, `comparable` status, counts, representation and fact changes, `undetermined` entries, `cancelled` changes, and `problems`. Fact changes require closure proof on both sides. Missing, sensitive, unknown, or incompatible evidence yields an undetermined entry or comparison problem. A known move can be shown in planned, net, or cross comparison without being classified as drift.

Semantic selections and release sets are part of comparability. External endpoint ordinals are local to a document; cross-input matching uses disclosed identities and concept meaning. Withheld or unavailable identity can leave a fact undetermined. An empty comparable result with no undetermined entries means no architectural change under the selected Dialects and evidence scope. It makes no claim about unmodeled infrastructure.

Use diagnostics, scope, closure outcomes, and comparison problems before treating a result as a gate. Command exit status alone does not express every evidence limit.
