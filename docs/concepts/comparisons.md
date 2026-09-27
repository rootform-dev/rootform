---
title: "Comparisons and drift"
description: "Interpret changes within one plan and differences between inputs."
---

A comparison reads selected architectures in validated [Forms](forms.md). It reports changes in interpreted instances and facts, with uncertainty intact. It does not compare HCL text, Terraform actions alone, raw values, or Explorer layout.

## Choose the stage pair

One plan can provide three comparisons when its stages exist:

| Comparison | Stage pair | Question |
| --- | --- | --- |
| Reported drift (`drift`) | Recorded to Refreshed | What architectural difference follows the plan's drift records? |
| Planned changes (`changes`) | Refreshed to Planned | What architectural change does the plan propose? |
| Net change (`net`) | Recorded to Planned | What remains after any drift the plan reverts cancels out? |

Recorded is reconstructed by reversing drift records and may be partial. Refreshed is the state the plan starts from; the plan does not record whether or how far refresh ran. The drift report is separate from the Reported drift comparison. It lists plan records, including changed attribute *paths* and an architectural consequence such as `architectural`, `none_under_dialects`, `indeterminate`, `uncovered`, or `address_only`. “No drift reported in this plan” says the plan JSON has no drift record; it does not prove every resource was refreshed or that live infrastructure is unchanged.

An input comparison, `rootform run before.json --diff after.json`, selects one stage from each separate input and writes a comparison Form with `cross` Differences. Its sides are Before and After; its Differences are never drift: they show how the two inputs differ and do not establish what drifted between the two exports. Plans default to Planned; state Forms select Recorded; saved single-input Forms use their saved default. Use `--before-stage` and `--after-stage` to choose other available stages. A comparison Form reopens alone with `rootform run comparison.json`; it cannot be a `--diff` operand.

## See drift cancel in the net change

A plan can propose to undo reported drift. The Rootform repository keeps a synthetic plan JSON for this case in `scripts/fixtures/docs/restored-drift`: it was written by hand, not exported by Terraform or OpenTofu, and describes no real infrastructure. An out-of-band change retargeted the KMS alias `aws_kms_alias.app` from `aws_kms_key.primary` to `aws_kms_key.standby`, and the plan retargets it to the primary key. The embedded AWS Rule `aws.rule.kms-alias` interprets the alias as a Contribution to the key it targets. From that directory:

<!-- docs-check:concept-restored-drift -->
```sh
rootform run plan.json --no-serve --color always
```

<!-- docs-output:concept-restored-drift -->
```ansi title="Restored drift, excerpt"
[1m[38;5;208mPlanned changes[0m
  Refreshed -> Planned

  [2mContributions[0m           1 added, 1 removed
  [2mIndeterminate closures[0m  0

  [1mContributions[0m
    [32m+[0m aws_kms_alias.app  [2mcontribution ->[0m aws_kms_key.primary  [2madded[0m
    [31m-[0m aws_kms_alias.app  [2mcontribution ->[0m aws_kms_key.standby  [2mremoved[0m

[1m[38;5;208mReported drift[0m
  Recorded -> Refreshed
  The export does not establish the refresh scope.

  [2mDrift entries[0m  1 (1 architectural)
  [2mEffect[0m         1 fact added, 1 removed

  [33m~[0m aws_kms_alias.app  [2mchanges the architecture; 2 fact changes[0m

[1m[38;5;208mNet change[0m
  Recorded -> Planned

  No net architectural difference: the plan proposes to restore 2 drift fact
  changes.

  [1mCancelled[0m
    = aws_kms_alias.app  [2mremoved by drift, planned for restoration[0m
        [2mcontribution ->[0m aws_kms_key.primary
    = aws_kms_alias.app  [2madded by drift, planned for removal[0m
        [2mcontribution ->[0m aws_kms_key.standby
```

Reported drift removes the Contribution to the primary key and adds one to the standby key; Planned changes proposes the reverse. Net change compares Recorded with Planned directly, so the two fact changes cancel: it reports no net architectural difference and lists each cancelled fact with what drift did to it and what the plan proposes. The restoration is a proposal of the plan; nothing has been applied.

## Continuity starts with instance identity

An instance Representation keeps its address across stages. A stable address can have changed Rule, Concept, implementation, or provider identity without being treated as removed and added. Indexed instances remain separate. Rootform does not infer that two differently addressed resources are the same physical cloud object because their labels, types, or remote IDs resemble each other.

A move reported in the plan can connect a previous address to its planned address. A reported replacement is `replaced` with its reason; deletion followed by creation can appear as `recreated` in the net view. A cross-input move needs the before side to contain the previous address. External endpoints have document-local ordinals, so cross-input matching uses a recorded identity and Concept, never matching ordinal alone.

## One edit can create several architectural changes

Adding a subnet may add one Representation and one network Context toward a VPC. They answer different questions: the instance exists, and it is placed in that network frame. Fact entries use `added` and `removed`; Representation entries can also report `changed`, `moved`, `replaced`, or `recreated` where the plan evidence supports them. A Context move is a removed old Context and an added new one, not a fact entry named `moved`.

A Terraform replacement can leave architectural meaning unchanged. Conversely, a changed Dialect Rule can change meaning even when infrastructure source stays the same. To isolate infrastructure edits, compare with the same Rootform binary and semantic selection. Comparability problems are explicit; Rootform does not silently turn incompatible semantics into an empty result.

## Indeterminate preserves uncertainty

An added fact is determined only when the Before side can prove its absence; a removed fact needs the same proof on the After side. An indeterminate closure, missing interpretation, withheld external identity, or uncomparable semantic selection can leave a conclusion `indeterminate`. The report counts unresolved closures separately on the Before and After sides, so readers can see where proof is missing. A comparable report may contain determined changes and indeterminate closure entries together. `indeterminate` means neither no change nor a failed comparison.

An invalid Form or a comparison with incompatible semantic selection reports a problem instead of claiming no change. Check `comparable`, `problems`, changed Representations and facts, and `indeterminate` before making a review decision. Status `0` means analysis completed; it does not mean the comparison is empty. [Outputs and exit status](../reference/outputs.md) is the status reference.

## Read the comparison in context

Text and Markdown summarize differences. The comparison Form retains both complete input Forms, selected stages, complete difference entries, and uncertainty. HTML opens the same Before, Differences, and After views as the local Explorer; it is self-contained and makes no network requests. See [Compare architectures](../guides/compare-architectures.md) for a runnable workflow, [Plan inputs](../inputs/plans.md#compare-both-sides-of-one-plan) for plan evidence, and the [Form contract](../../contracts/form.md) for exact fields.
