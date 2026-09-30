---
title: "Compare two Forms"
description: "Compare selected stages from two plan, state, or saved Forms and read the differences in the report and the Explorer."
---

Compare two plans with the same Rootform binary and Dialect selection. This guide uses the base and head plans in the [commerce Playground](../../examples/playground/commerce-platform/README.md): the head revision moves the catalog and cache behind private endpoints, adds an order notification pipeline and a payments namespace, and removes the public storage account and the legacy webhooks. Work from `examples/playground/commerce-platform/` in a clone of the Rootform repository. Both sides contain `plan.json` and the saved `plan.tfplan` from the same Terraform run. To see the result before running anything, open the [Playground](https://docs.rootform.dev/playground/?scenario=commerce-platform&mode=comparison) on **Comparison**.

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

The command returns status `0` because the comparison completed, even though it found changes. Read the totals first: the head plan adds 16 resource instances and removes 7, and the fact counts below them say what those instances do to the architecture. The instance list then names each change. The text summary begins as follows (excerpt):

<!-- docs-output:compare-commerce -->
```ansi title="Comparison summary, excerpt"
[1mInputs compared[0m

[2mBefore[0m              base/plan.json
[2mAfter[0m               head/plan.json

                    [2mBefore[0m       [2mAfter[0m
[2mOrigin[0m              Plan         Plan
[2mStage[0m               Planned      Planned
[2mResource instances[0m  144          153
[2mInterpreted[0m         144 of 144   153 of 153
[2mRelations[0m           28           28
[2mContexts[0m            196          207
[2mContributions[0m       37           45

[1m[38;5;208mUncertainty[0m
                          [2mBefore[0m   [2mAfter[0m
  [2mIndeterminate closures[0m       3       3
  [2m  Unknown until apply[0m        3       3

  Values known only after apply stay unknown; they are not guessed.

[1m[38;5;208mDifferences[0m
  Before Planned -> After Planned
  Differences between two inputs are not drift; they do not establish what
  drifted between the two exports.

  [2mResource instances[0m      16 added, 7 removed
  [2mRelations[0m               5 added, 5 removed
  [2mContexts[0m                28 added, 17 removed
  [2mContributions[0m           9 added, 1 removed
  [2mIndeterminate closures[0m  3 in Before Planned, 3 in After Planned

  [1mResource instances[0m
    [32m+[0m azurerm_eventgrid_system_topic.service_bus      [2madded[0m
    [32m+[0m azurerm_eventgrid_system_topic_event_subscription.order_notifications
        [2madded[0m
    [32m+[0m azurerm_linux_function_app.order_notifications  [2madded[0m
    [32m+[0m azurerm_log_analytics_workspace.platform        [2madded[0m
    [32m+[0m azurerm_private_dns_zone.cosmos                 [2madded[0m
    [32m+[0m azurerm_private_dns_zone.redis                  [2madded[0m
    [32m+[0m azurerm_private_dns_zone_virtual_network_link.cosmos_hub  [2madded[0m
    [32m+[0m azurerm_private_dns_zone_virtual_network_link.cosmos_prod  [2madded[0m
    [32m+[0m azurerm_private_dns_zone_virtual_network_link.redis_hub  [2madded[0m
    [32m+[0m azurerm_private_dns_zone_virtual_network_link.redis_prod  [2madded[0m
    [32m+[0m azurerm_private_endpoint.cosmos                 [2madded[0m
    [32m+[0m azurerm_private_endpoint.redis                  [2madded[0m
    [32m+[0m azurerm_service_plan.functions_premium          [2madded[0m
    [32m+[0m azurerm_servicebus_topic.orders_enriched        [2madded[0m
    [32m+[0m kubernetes_namespace_v1.payments                [2madded[0m
    [32m+[0m kubernetes_network_policy_v1.payments           [2madded[0m
    [31m-[0m azurerm_eventgrid_system_topic.public           [2mremoved[0m
    [31m-[0m azurerm_eventgrid_system_topic_event_subscription.legacy_webhooks  [2mremoved[0m
    [31m-[0m azurerm_linux_function_app.legacy_webhooks      [2mremoved[0m
    [31m-[0m azurerm_service_plan.functions                  [2mremoved[0m
    [31m-[0m azurerm_storage_account.public                  [2mremoved[0m
    [31m-[0m azurerm_storage_container.public_assets         [2mremoved[0m
    [31m-[0m azurerm_subnet.prod_legacy                      [2mremoved[0m
```

The instance counts cover observed resource instances. The relation, context, and contribution counts cover facts that Rules established. The Uncertainty table counts indeterminate closures on each side and by cause: evidence that cannot decide a fact, and so cannot decide a change. It does not mean the comparison failed, as [Comparisons](../concepts/comparisons.md#indeterminate-preserves-uncertainty) explains. The text summary lists every change under its exact totals, and on an interactive terminal it opens in a pager ([Outputs](../reference/outputs.md#read-long-reports)). `comparison.md` is a review document instead: each list shows at most ten entries spread across added and removed, states how many it shows, and is folded when longer; `--details` lists every entry there ([Review with Markdown](../reference/outputs.md#review-with-markdown)). If pairing is refused or the counts differ in your own project, inspect the warning and confirm each JSON was exported from its matching saved plan. [Plan inputs](../inputs/plans.md#pair-the-saved-plan) explains pairing.

## Open the comparison in the browser

`comparison.md` is a reviewable summary. To inspect the same result in the Explorer without reopening the plan JSON, make a self-contained HTML copy of the saved comparison:

<!-- docs-check:compare-reopen-html -->
```sh
rootform run comparison.json --no-serve -o comparison.html
```

Open `comparison.html` locally. The selector reads **Differences**, Before to After, and the reading block at the bottom left switches between **Before**, **Differences**, and **After**. Each resource group carries the count of its changed entries, a removed relation is drawn dashed, and the **Added**, **Removed**, **Changed**, and **Indeterminate** filters narrow the canvas to one kind of change. The HTML makes no network requests. A local `rootform run comparison.json --no-browser --port 0` instead serves the same result on loopback; stop that server with `Ctrl+C` when finished. See [Explore a Form](explore-architecture.md) for navigation.

![The Explorer on the Differences view of the commerce comparison: four resource groups with their change counts, a removed Delivers to relation drawn dashed in red, and the filters counting 58 added, 30 removed, and 6 indeterminate entries](../assets/explorer/comparison-differences-light.png#gh-light-mode-only)
![The Explorer on the Differences view of the commerce comparison: four resource groups with their change counts, a removed Delivers to relation drawn dashed in red, and the filters counting 58 added, 30 removed, and 6 indeterminate entries](../assets/explorer/comparison-differences-dark.png#gh-dark-mode-only)

`comparison.json` itself is a Form with `kind: "comparison"`. Its top-level `before` and `after` embed complete state or plan Forms under `form`, each with its selected `stage` and `selected_from`. `comparison.name` is `cross`. Review `comparable` and `problems` before treating entries as comparable, then inspect Representation and fact changes alongside `indeterminate`.

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

Continue with [Review a pull request](../workflows/index.md) to plan both revisions in isolated worktrees, compare them, gate the head with the same Policies, and keep the review evidence. [Check a Form with Policies](check-with-policies.md) selects a Pack and reads the verdict; [Follow a Policy through every outcome](check-architecture.md) explains what each verdict proves.
