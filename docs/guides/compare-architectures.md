---
title: "Compare architectures"
description: "Compare selected stages from two plan, state, or saved Rootform documents."
---

Compare two plans with the same Rootform binary and Dialect selection. This guide uses the base and head plans in the [commerce Playground](../../examples/playground/commerce-platform/README.md). Work from `examples/playground/commerce-platform/` in a clone of the Rootform repository. Both sides contain `plan.json` and the saved `plan.tfplan` from the same Terraform run.

Plan JSON and saved plans can contain secrets in clear text. Keep them out of Git and public artifacts. Rootform reads both locally; its reports omit sensitive values but still reveal topology and resource names.

<!-- rootform:steps -->

## Compare the proposed outcomes

Pair each JSON export with its saved plan to recover direct identity traversals, then compare the two `planned` stages. The flags for the second input begin with `--diff-`. `--no-serve` writes the requested files and exits.

<!-- docs-check:compare-commerce -->
```sh
rootform run base/plan.json --plan-file base/plan.tfplan \
  --diff head/plan.json --diff-plan-file head/plan.tfplan \
  --no-serve -o comparison.json -o comparison.md --color always
```

The command returns status `0` because the comparison completed, even though it found changes. The text summary begins as follows (excerpt):

<!-- docs-output:compare-commerce -->
```ansi title="Comparison summary, excerpt"
[1mInputs compared[0m
[2mBefore[0m  input 1 · plan JSON from Terraform or OpenTofu 1.16.4 · planned stage
[2mAfter[0m   input 2 · plan JSON from Terraform or OpenTofu 1.16.4 · planned stage

[1m[38;5;208mBefore · planned[0m
  [2mInstances[0m    144 (144 managed, 0 data)
  [2mInterpreted[0m  144 of 144 instances
  [2mFacts[0m        261: 28 relations, 196 contexts, 37 contributions
  [2mClosures[0m     273: 261 resolved, 9 absent, 3 indeterminate

[1m[38;5;208mAfter · planned[0m
  [2mInstances[0m    153 (153 managed, 0 data)
  [2mInterpreted[0m  153 of 153 instances
  [2mFacts[0m        280: 28 relations, 207 contexts, 45 contributions
  [2mClosures[0m     292: 280 resolved, 9 absent, 3 indeterminate

[1m[38;5;208mChanges · before planned → after planned[0m
  [2mInstances[0m     16 added, 7 removed, 0 changed
  [2mFacts[0m         42 added, 23 removed
  [2mUndetermined[0m  3 closures before (3 unknown until apply) · 3 closures after (3 unknown until apply)
```

The instance counts cover observed resource instances, while facts count the Relations, Contexts, and Contributions that Rules established. `Undetermined` keeps closures whose evidence cannot decide a change; it does not mean the comparison failed, as [Architecture comparisons](../concepts/diff.md#undetermined-preserves-uncertainty) explains. If pairing is refused or the counts differ in your own project, inspect the warning and confirm each JSON was exported from its matching saved plan. [Plan inputs](../inputs/plans.md#verify-the-saved-plan) explains pairing.

## Open the comparison in the browser

`comparison.json` is a Rootform document with `kind: "comparison"`. Its top-level `before` and `after` hold complete input documents; `comparison.name` is `cross`. `comparison.before` and `comparison.after` name the selected stages. Review `comparable` and `problems` before treating entries as comparable, then inspect Representation and fact changes alongside `undetermined`.

`comparison.md` is a reviewable summary. To inspect the same result in the Explorer without reopening the plan JSON, make a self-contained HTML copy:

<!-- docs-check:compare-reopen-html -->
```sh
rootform run comparison.json --no-serve -o comparison.html
```

Open `comparison.html` locally. The Before, Diff, and After views place each change in its architecture. The HTML makes no network requests. A local `rootform run comparison.json --no-browser --port 0` instead serves the same result on loopback; stop that server with `Ctrl+C` when finished. See [Explore an architecture](explore-architecture.md) for navigation.

## Compare other stage pairs

A plan defaults to `planned`, while a state snapshot has only `recorded`. For plans with prior state, `--before-stage recorded --after-stage recorded` compares recorded stages of separate inputs. Use `refreshed` when the question concerns the prior snapshot after refresh. Rootform refuses a requested stage that the input does not contain; it does not treat it as empty.

To compare your own state JSON with a later saved plan, export each with the same Terraform or OpenTofu binary. OpenTofu users replace `terraform` with `tofu` in these commands:

```sh
terraform show -json > state.json
terraform show -json later.tfplan > later-plan.json
```

The first file is a state snapshot; the second describes the later plan. Keep both private. Compare the state with the later proposed outcome:

```sh
rootform run state.json --diff later-plan.json \
  --diff-plan-file later.tfplan --no-serve -o state-to-plan.json
```

This selects `recorded` before and `planned` after. The saved plan adds verified traversal evidence only to the second input. A cross-input difference may include intervening drift, but these separate exports cannot prove its cause. To review drift reported in one plan, inspect its `recorded` to `refreshed` comparison, as in [Compare both sides of one plan](../inputs/plans.md#compare-both-sides-of-one-plan). [Architecture comparisons](../concepts/diff.md#choose-the-stage-pair) explains these boundaries.

## Use exit status deliberately

Status `0` proves the comparison ran, not that its report is empty; `run` has no status that reports changes. Read `comparison.md` for review and keep `comparison.json` for the exact entries. To block a review on an architectural condition, select a Policy: with `--diff`, selected Policies evaluate the after side, and a violation returns `1`. [Outputs and exit status](../reference/outputs.md) defines export formats and failures.

<!-- rootform:endsteps -->

Continue with [Review a pull request](../workflows/index.md) to plan both revisions in isolated worktrees, compare them, gate the head with the same Policies, and keep the review evidence. [Run checks](check-architecture.md) explains how to select Policies and read their proof.
