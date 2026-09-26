---
title: "Comparisons and drift"
description: "Interpret changes within one plan and differences between inputs."
---

A comparison reads validated [Rootform documents](forms.md). It reports changes in interpreted instances and facts, with uncertainty intact. It does not compare HCL text, Terraform actions alone, raw values, or Explorer layout.

## Choose the stage pair

One plan can provide three comparisons when its stages exist:

| Comparison | Stage pair | Question |
| --- | --- | --- |
| Reported drift (`drift`) | Recorded to Refreshed | What architectural change does the plan report after refresh? |
| Planned changes (`changes`) | Refreshed to Planned | What does the plan change after refresh? |
| Net change (`net`) | Recorded to Planned | What remains after any drift the plan reverts cancels out? |

Recorded is reconstructed by reversing reported drift and may be partial. The drift report is separate from the Reported drift comparison. It lists plan records, including changed attribute *paths* and an architectural consequence such as `architectural`, `none_under_dialects`, `indeterminate`, `uncovered`, or `address_only`. “No drift reported in this plan” says the plan JSON has no drift record; it does not prove every resource was refreshed or that live infrastructure is unchanged.

`rootform run before.json --diff after.json` selects one stage from each separate input and writes an input comparison named `cross`. Its sides are Before and After; it shows differences, never drift. Plans default to Planned; state analyses select Recorded; saved Rootform documents use their saved default. Use `--before-stage` and `--after-stage` to choose other available stages. If an operand is already a comparison document, `--before-side` or `--after-side` selects its embedded side.

## Continuity starts with instance identity

An instance Representation keeps its address across stages. A stable address can have changed Rule, Concept, implementation, or provider identity without being treated as removed and added. Indexed instances remain separate. Rootform does not infer that two differently addressed resources are the same physical cloud object because their labels, types, or remote IDs resemble each other.

A move reported in the plan can connect a previous address to its planned address. A reported replacement is `replaced` with its reason; deletion followed by creation can appear as `recreated` in the net view. A cross-input move needs the before side to contain the previous address. External endpoints have document-local ordinals, so cross-input matching uses a recorded identity and Concept, never matching ordinal alone.

## One edit can create several architectural changes

Adding a subnet may add one Representation and one network Context toward a VPC. They answer different questions: the instance exists, and it is placed in that network frame. Fact entries use `added` and `removed`; Representation entries can also report `changed`, `moved`, `replaced`, or `recreated` where the plan evidence supports them. A Context move is a removed old Context and an added new one, not a fact entry named `moved`.

A Terraform replacement can leave architectural meaning unchanged. Conversely, a changed Dialect Rule can change meaning even when infrastructure source stays the same. To isolate infrastructure edits, compare with the same Rootform binary and semantic selection. Comparability problems are explicit; Rootform does not silently turn incompatible semantics into an empty result.

## Indeterminate preserves uncertainty

An added fact is determined only when the Before side can prove its absence; a removed fact needs the same proof on the After side. An indeterminate closure, missing interpretation, withheld external identity, or uncomparable semantic selection can leave a conclusion `indeterminate`. The report counts unresolved closures separately on the Before and After sides, so readers can see where proof is missing. A comparable report may contain determined changes and indeterminate closure entries together. `indeterminate` means neither no change nor a failed comparison.

An invalid document or a comparison with incompatible semantic selection reports a problem instead of claiming no change. Check `comparable`, `problems`, changed Representations and facts, and `indeterminate` before making a review decision. Status `0` means analysis completed; it does not mean the comparison is empty. [Outputs and exit status](../reference/outputs.md) is the status reference.

## Read the comparison in context

Text and Markdown summarize differences. The Rootform document retains both input analyses, selected stages, complete difference entries, and uncertainty. HTML opens the same Before, Diff, and After views as the local Explorer; it is self-contained and makes no network requests. See [Compare architectures](../guides/compare-architectures.md) for a runnable workflow, [Plan inputs](../inputs/plans.md#compare-both-sides-of-one-plan) for plan evidence, and the [document contract](../../contracts/rootform-document.md) for exact fields.
