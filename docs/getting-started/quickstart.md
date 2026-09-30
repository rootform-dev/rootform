---
title: Quickstart
description: Open a sample Form in the Explorer, find one resource, and read the evidence behind its placement, then run the same analysis on your machine.
---

Open a synthetic Azure commerce platform of 153 planned resources in the
Explorer, find one resource, and read the evidence behind its placement. The
first half needs only a browser; the second half installs Rootform and
produces the same result on your machine.

Rootform turns a Terraform or OpenTofu plan, or a state export, into a
[Form](../concepts/forms.md): a portable saved result you can explore,
explain, compare, and check. The Explorer is the Form's interactive view.
Nothing here runs Terraform, since the sample plan is already exported.

<!-- rootform:steps -->

## Open the sample Form

Open the [Playground](https://docs.rootform.dev/playground/) and keep
**Commerce platform** with **Plan** selected. The canvas shows the top level
of the planned architecture: four resource groups, the relations between
them, and a few resources that no group holds.

![The Explorer at the top level of the commerce platform plan: four resource group blocks with their object counts, relation labels such as Peers with and Delivers to, and the Planned changes selector](../assets/explorer/quickstart-overview-light.png#gh-light-mode-only)
![The Explorer at the top level of the commerce platform plan: four resource group blocks with their object counts, relation labels such as Peers with and Delivers to, and the Planned changes selector](../assets/explorer/quickstart-overview-dark.png#gh-dark-mode-only)

The selector at the top left reads **Planned changes**, Refreshed to Planned:
this plan starts from an empty state, so everything it proposes is added. The
counters at the bottom count the added, removed, and changed entries, and the
placements the evidence could not settle.

## Find one resource

Press **Search** (`⌘K` on macOS, `Ctrl+K` elsewhere) and type `prod_data`. The
first result is the subnet `azurerm_subnet.prod_data` with its path
`prod / prod`: resource group `prod`, virtual network `prod`. Choose it, and
the Explorer opens the virtual network that holds the subnet. Select the
**prod_data** card to open the Inspector on the right.

## Read why it is placed there

In **Details**, **Where** lists two placements: the resource group `prod` and
the VNet `prod`. **Made of** lists the six private endpoints that sit in this
subnet.

Open the **Evidence** tab. Under **Evidence**, the entry
`azurerm_subnet.prod_data → azurerm_virtual_network.prod` is the network
placement. Expand its **Resolution**: it names the Rule
`azure.rule.subnet`, the attribute it followed, `source.virtual_network_name`,
and the kind of evidence that settled it. Under **Closures**, **Network
placement to virtual network** is **Resolved** with one fact.

![The Inspector for azurerm_subnet.prod_data on the Evidence tab: the network placement fact, its expanded Resolution naming the Rule and attribute, and the resolved closure](../assets/explorer/quickstart-evidence-light.png#gh-light-mode-only)
![The Inspector for azurerm_subnet.prod_data on the Evidence tab: the network placement fact, its expanded Resolution naming the Rule and attribute, and the resolved closure](../assets/explorer/quickstart-evidence-dark.png#gh-dark-mode-only)

That one fact carries the whole idea. Rootform did not draw the subnet inside
the VNet because Terraform references it: a Rule in the Azure
[Dialect](../concepts/dialects.md) declares what the reference means, and the
plan evidence proved it. Under **Dependencies**, the same reference appears as
producer evidence, marked as something that never draws a relation by itself.

## Run the same analysis locally

[Install Rootform](../installation.md), then download the two files that
produced this Form: the plan JSON export and the saved plan it was exported
from.

```sh
mkdir rootform-quickstart && cd rootform-quickstart
curl -fsSLO https://raw.githubusercontent.com/rootform-dev/rootform/dev/examples/playground/commerce-platform/head/plan.json
curl -fsSLO https://raw.githubusercontent.com/rootform-dev/rootform/dev/examples/playground/commerce-platform/head/plan.tfplan
```

Analyze the plan. Rootform reads both files, prints a summary, and opens the
Explorer in your browser from a local server:

<!-- docs-check:quickstart-run -->
```sh
rootform run plan.json --plan-file plan.tfplan
```

```ansi title="Run output excerpt"
[1mPlan analyzed[0m
[2mEnrichment[0m         Saved plan paired with this plan JSON (1 module)
[2mStage[0m              Planned
[1m[38;5;208mArchitecture[0m
  [2mInstances[0m      153
  [2mInterpreted[0m    153
  [2mContexts[0m       207
```

The terminal also shows the Explorer address; press `Ctrl+C` when you are
done. **Enrichment** records that the saved plan paired with the JSON export,
which is how Rootform followed references whose values are unknown until apply.
**Instances** counts the resource instances in the plan, and **Interpreted**
counts those a Rule matched: all 153 here. The 207 contexts are placements
like the one you just read.

## Keep the Form

Write the Form to a file instead of serving it:

<!-- docs-check:quickstart-save -->
```sh
rootform run plan.json --plan-file plan.tfplan --no-serve -o analysis.json
```

```ansi title="Saved Form excerpt"
[2mWrote     [0m analysis.json
```

`analysis.json` reopens with `rootform run analysis.json` without the plan
files. [Explain an architecture](../guides/explain-architecture.md) questions it
from the terminal, [Check a Form with Policies](../guides/check-with-policies.md)
evaluates Policies against it, and
[Compare two Forms](../guides/compare-architectures.md) sets it against another
revision. It holds no sensitive plan values, but it names resources and
describes topology.

<!-- rootform:endsteps -->

Next, move to your own files with
[Analyze your plan or state](analyze-your-plan.md), or stay with this sample
in [Explore a Form](../guides/explore-architecture.md).
