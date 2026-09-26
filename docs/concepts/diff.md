---
title: "Architecture comparisons"
description: "Interpret cross-input and within-plan changes without confusing them with drift."
---

A comparison reads validated [Rootform documents](architecture-ir.md). It reports changes in interpreted instances and facts, with uncertainty intact. It does not compare HCL text, Terraform actions alone, raw values, or Explorer layout.

## Choose the stage pair

One plan can provide three comparisons when its stages exist:

| Comparison | Stage pair | Question |
| --- | --- | --- |
| `drift` | `recorded` to `refreshed` | What architectural consequence did changes reported outside Terraform or OpenTofu have? |
| `planned` | `refreshed` to `planned` | What does the proposed plan change after refresh? |
| `net` | `recorded` to `planned` | What is the combined change from recorded to proposed state? |

`recorded` is reconstructed by reversing reported drift and may be partial. The drift report lists plan records, including changed attribute *paths* and an architectural consequence such as `architectural`, `none_under_dialects`, `undetermined`, `uncovered`, or `address_only`. “No drift reported in this plan” says the plan JSON has no drift record; it does not prove every resource was refreshed or that live infrastructure is unchanged.

`rootform run before.json --diff after.json` selects one stage from each separate input and writes a `cross` comparison. Plans default to `planned`; state snapshots select `recorded`; saved Rootform documents use their saved default. Use `--before-stage` and `--after-stage` to choose other available stages. If an operand is already a comparison document, `--before-side` or `--after-side` selects its embedded side. A cross-input comparison is never drift: no single refresh links its two inputs.

## Continuity starts with instance identity

An instance Representation keeps its address across stages. A stable address can have changed Rule, Concept, implementation, or provider identity without being treated as removed and added. Indexed instances remain separate. Rootform does not infer that two differently addressed resources are the same physical cloud object because their labels, types, or remote IDs resemble each other.

A move reported in the plan can connect a previous address to its planned address. A reported replacement is `replaced` with its reason; deletion followed by creation can appear as `recreated` in the net view. A cross-input move needs the before side to contain the previous address. External endpoints have document-local ordinals, so cross-input matching uses a recorded identity and Concept, never matching ordinal alone.

## One edit can create several architectural changes

Adding a subnet may add one Representation and one network Context toward a VPC. They answer different questions: the instance exists, and it is placed in that network frame. Fact entries use `added` and `removed`; Representation entries can also report `changed`, `moved`, `replaced`, or `recreated` where the plan evidence supports them. A Context move is a removed old Context and an added new one, not a fact entry named `moved`.

A Terraform replacement can leave architectural meaning unchanged. Conversely, a changed Dialect Rule can change meaning even when infrastructure source stays the same. To isolate infrastructure edits, compare with the same Rootform binary and semantic selection. Comparability problems are explicit; Rootform does not silently turn incompatible semantics into an empty result.

## Undetermined preserves uncertainty

An added fact is determined only when the before side can prove its absence; a removed fact needs the same proof after. An indeterminate closure, missing interpretation, withheld external identity, or uncomparable semantic selection can leave a conclusion `undetermined`. The report counts unresolved closures separately on the before and after sides, so readers can see where proof is missing. A comparable report may contain determined changes and undetermined closure entries together. `undetermined` means neither no change nor a failed comparison.

An invalid document or a comparison with incompatible semantic selection reports a problem instead of claiming no change. Check `comparable`, `problems`, changed Representations and facts, and `undetermined` before making a review decision. Status `0` means analysis completed; it does not mean the comparison is empty. [Outputs and exit status](../reference/outputs.md) is the status reference.

## Read the comparison in context

Text and Markdown summarize changes. The Rootform document retains both input documents, selected stages, complete change entries, and uncertainty. HTML opens the same Before, Diff, and After views as the local Explorer; it is self-contained and makes no network requests. See [Compare architectures](../guides/compare-architectures.md) for a runnable workflow, [Plan inputs](../inputs/plans.md#compare-both-sides-of-one-plan) for plan evidence, and the [comparison contract](../../contracts/architecture-diff.md) for exact fields.
