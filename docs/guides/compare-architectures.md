---
title: "Compare two Forms"
description: "Compare selected stages from two plan, state, or saved Forms and read the differences in the report and the Explorer."
---

Compare two plans with the same Rootform binary and Dialect selection. This guide uses the base and head plans in the [commerce Playground](../../examples/playground/commerce-platform/README.md): `base` is the existing platform planned with no changes, and `head` is the proposed change planned against the same state, which moves AKS monitoring to a new platform workspace, replaces container insights, and retires the legacy blob webhook pipeline. Work from `examples/playground/commerce-platform/` in a clone of the Rootform repository. Each side pairs `plan.json` with the saved `plan.tfplan` exported from its own Terraform run. To see the result before running anything, open the [Playground](https://rootform.dev/playground/?scenario=commerce-platform&mode=comparison) on **Comparison**.

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

The command returns status `0` because the comparison completed, even though it found changes. The text summary sets the two inputs side by side, then reports uncertainty, then the differences (excerpt):

<!-- docs-output:compare-commerce -->
```ansi title="Comparison summary, excerpt"
[1mInputs compared[0m

[2mBefore[0m         base/plan.json
[2mAfter[0m          head/plan.json

               [2mBefore[0m    [2mAfter[0m
[2mOrigin[0m         Plan      Plan
[2mStage[0m          Planned   Planned
[2mInstances[0m      99        97
[2mInterpreted[0m    99        97
[2mRelations[0m      17        15
[2mContexts[0m       114       110
[2mContributions[0m  37        37
[1m[38;5;208mDifferences[0m
  [2mInstances[0m               1 added, 3 removed
  [2mRelations[0m               1 added, 3 removed
  [2mContexts[0m                1 added, 5 removed
  [2mContributions[0m           1 added, 1 removed
  [2mIndeterminate closures[0m  0

  [1mInstances[0m
    [32m+[0m azurerm_log_analytics_workspace.platform       [2madded[0m
    [31m-[0m azurerm_eventgrid_system_topic.public[0]       [2mremoved[0m
    [31m-[0m azurerm_eventgrid_system_topic_event_subscription.legacy_webhooks[0]
        [2mremoved[0m
    [31m-[0m azurerm_linux_function_app.legacy_webhooks[0]  [2mremoved[0m
```

Read the table first. **Before** and **After** name the two inputs and the stage compared on each side, here Planned on both. The instance counts cover observed resource instances; the Relation, Context, and Contribution counts cover facts that Rules established.

**Uncertainty** counts indeterminate closures on each side and by cause: evidence that cannot decide a fact, and so cannot decide a change. This comparison has none on either side; when a side has any, they wait on values unknown until apply. That does not mean the comparison failed, as [Comparisons](../concepts/comparisons.md#indeterminate-preserves-uncertainty) explains.

**Differences** counts what differs between the two inputs. The report never calls these differences drift: they do not establish what drifted between the two exports. The head plan adds 1 resource instance and removes 3, and the text summary names each of the 4 under the totals. The excerpt keeps four: the new platform workspace the cluster reports to, and three removals, the public system topic, its legacy webhook subscription, and the legacy webhooks function.

If pairing is refused or the counts differ in your own project, inspect the warning and confirm each JSON was exported from its matching saved plan. [Plan inputs](../inputs/plans.md#pair-the-saved-plan) explains pairing.

## Open the comparison in the browser

To inspect the same result in the Explorer without reopening the plan JSON, make a self-contained HTML copy of the saved comparison:

<!-- docs-check:compare-reopen-html -->
```sh
rootform run comparison.json --no-serve -o comparison.html
```

Open `comparison.html` locally. The selector reads **Differences**, Before to After, and the reading block at the bottom left switches between **Before**, **Differences**, and **After**. Each resource group carries the count of its changed entries, a removed relation is drawn dashed, and the **Added**, **Removed**, **Changed**, and **Indeterminate** filters narrow the canvas to one kind of change. The HTML makes no network requests. A local `rootform run comparison.json --no-browser --port 0` instead serves the same result on loopback; stop that server with `Ctrl+C` when finished. See [Explore a Form](explore-architecture.md) for navigation.

![The Explorer on the Differences view of the commerce comparison: four resource groups with their change counts, the relations between them, and the filters counting 4 added and 12 removed entries](../assets/explorer/comparison-differences-light.webp#gh-light-mode-only)
![The Explorer on the Differences view of the commerce comparison: four resource groups with their change counts, the relations between them, and the filters counting 4 added and 12 removed entries](../assets/explorer/comparison-differences-dark.webp#gh-dark-mode-only)

## Read every change

The text summary lists every change under its exact totals, and on an interactive terminal it opens in a pager ([Outputs](../reference/outputs.md#read-long-reports)). `comparison.md` is written for review instead: each list shows at most ten entries spread across added and removed, states how many it shows, and is folded when longer. Add `--details` to the command to list every entry there ([Review with Markdown](../reference/outputs.md#review-with-markdown)).

`comparison.json` keeps the exact entries. It is itself a Form with `kind: "comparison"`. Its top-level `before` and `after` embed complete state or plan Forms under `form`, each with its selected `stage` and `selected_from`. `comparison.name` is `cross`. Review `comparable` and `problems` before treating entries as comparable, then inspect Representation and fact changes alongside `indeterminate`.

## Compare other stage pairs

A plan Form defaults to Planned, while a state Form has only a Recorded stage. For plans with a Recorded stage, `--before-stage recorded --after-stage recorded` compares Recorded architectures of separate inputs. Use `refreshed` for the state the plan starts from; the plan does not record whether or how far refresh ran. Rootform refuses a requested stage that the input does not contain; it does not treat it as empty.

To compare your own state JSON with a later saved plan, export each with the same Terraform or OpenTofu binary. OpenTofu users replace `terraform` with `tofu` in these commands:

```sh
terraform show -json > state.json
terraform show -json later.tfplan > later-plan.json
```

The first file is state JSON; the second describes the later plan. Keep both private. Compare the state with the later proposed outcome:

```sh
rootform run state.json --diff later-plan.json \
  --diff-plan-file later.tfplan --no-serve -o state-to-plan.json
```

This selects `recorded` before and `planned` after. The saved plan adds verified traversal evidence only to the second input. Cross-input Differences do not establish drift. To review drift reported in one plan, inspect its `recorded` to `refreshed` comparison and separate drift report, as in [Compare both sides of one plan](../inputs/plans.md#compare-both-sides-of-one-plan). [Comparisons](../concepts/comparisons.md#choose-the-stage-pair) explains these boundaries.

## Use exit status deliberately

Status `0` proves the comparison ran, not that its report is empty; `run` has no status that reports changes. Read `comparison.md` for review and keep `comparison.json` for the exact entries. `run` never evaluates Policies. To block a review on an architectural condition, check the saved comparison: `rootform check comparison.json` evaluates selected Policies on both Before and After by default. Use `--side before` or `--side after` to gate one side; a violation on either evaluated side exits `1`. [Outputs and exit status](../reference/outputs.md) defines export formats and failures.

<!-- rootform:endsteps -->

Continue with [Review a pull request](../workflows/index.md) to plan both revisions in isolated worktrees, compare them, gate the head with the same Policies, and keep the review evidence. [Check a Form with Policies](check-with-policies.md) selects a Pack and reads the verdict; [Understand Policy outcomes](check-architecture.md) explains what each verdict proves.
