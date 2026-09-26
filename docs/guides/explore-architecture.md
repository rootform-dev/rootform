---
title: Explore an architecture
description: Navigate scenes, inspect evidence, and read stages or comparisons in the Explorer.
---

Start with a plan JSON, state JSON, or saved Rootform document.
For a plan, pair the saved plan when direct traversal evidence matters.
The default `run` command starts a loopback server and opens a browser:

<!-- docs-check:journey-explore-open -->
```sh
rootform run plan.json --plan-file plan.tfplan --no-browser --port 0
```

Read the address printed on standard error, open it in your browser, and
press `Ctrl+C` in the terminal when finished. `--no-browser` leaves browser
launch to you; `--port 0` asks the operating system for an available port.
A saved document opens the same way with `rootform run analysis.json`.

## Move through architecture levels

The canvas shows the current context and its direct contents. Open a card
with nested objects to make it the current context. The **Place** controls
show your path: **Architecture root** returns to the top, **Back** and
**Forward** revisit locations, and the current-context menu jumps to any
ancestor. Use the parent name to move up one level. When a resource has more
than one established placement, its path menu lists **Also placed in**.

The Explorer draws architectural contexts and relations emitted by Dialect
Rules. Terraform dependencies remain evidence; they do not become connection
arrows on their own.

## Find and inspect a resource

**Search** covers the whole architecture, including objects outside the
current scene. Search by name or type, then select a result to open its
containing context and reveal it. The footer shows the displayed range and
total matches, so a short visible list is not the full result set.

Select a card to open the Inspector. **Details** shows the instance address,
its interpretation, status, and provider, and lists proven placements under
**Where**. **Connections** lists architectural relations. **Evidence** shows
facts, closures, dependencies, and diagnostics. **Center selection** brings
the selected object back into view after navigation.

The **Analysis** panel lists changes, all instances, and evidence beyond the
current scene. Its instance count includes objects without an applied
architecture reading, which may have no canvas card.

## Read a placement and its evidence

A placement appears as containment on the canvas and a context fact under
**Where**. In **Evidence**, inspect the fact and its **Resolution** to see
the emitting Rule and source evidence. Read its closure outcome too:
`resolved` establishes the fact; `absent` records a supported absence;
`indeterminate` keeps a reason such as unknown until apply or sensitive
evidence. A closure may remain indeterminate even when an instance is
represented on the canvas.

For the VPC and subnet tutorial, the saved-plan traversal in
`aws_subnet.application.vpc_id` establishes the network context while the
planned VPC ID is unknown. [Verify the saved plan](../inputs/plans.md#verify-the-saved-plan)
explains the pairing requirement.

## Read a connection

Select a route or a relation in **Connections**. The Inspector identifies
its endpoints, predicate, and evidence. If several relations share visible
endpoints or an endpoint is inside a closed context, the canvas may show an
aggregate route. Select the route to inspect its members, then use
**Reveal endpoints** or open the containing context to see the actual
resources. A route's visual shape is not a claim of live network reachability.

A relation that leaves the current context can show an outside reference
card with its home context. It points to the same resource. Use **Go to** to
open the home context.

## Switch stages and comparisons

Open **Reading** to choose a stage or comparison. A plan normally opens at
**Planned**; available **Refreshed** and **Recorded** stages depend on the
plan evidence. A state document has **Recorded** only. Under
**Comparisons**, a plan may offer Reported drift, Planned changes, and Net change. An
input comparison shows **Before**, **Diff**, and **After** views of its
selected stages; [Compare architectures](compare-architectures.md#open-the-comparison-in-the-browser)
opens one. The **Analysis** panel's **Changes** tab lists determined changes
and indeterminate closures; **Drift report** names drift reported by the plan
with its scope.

Do not read “No drift reported in this plan” as proof that no infrastructure
changed. Terraform or OpenTofu may have skipped refresh or limited scope. See
[comparisons and drift](../concepts/forms.md#comparisons-and-drift).

## Reveal a secondary resource

Some association resources contribute implementation detail without a
permanent card in every scene. Find one through search or from the object
it contributes to, then reveal it for inspection. Its per-instance entry and
provenance remain in the document even when the scene leaves it collapsed.

## Export and share

Save a reusable document or standalone browser view from the same input:

<!-- docs-check:journey-explore-export -->
```sh
rootform run plan.json --plan-file plan.tfplan --no-serve -o analysis.json -o architecture.html
```

The HTML file embeds the Explorer and the analysis, makes no network requests,
and needs no server. The JSON file can reopen in `run` or feed `explain`.
Neither contains sensitive values, but both reveal infrastructure names and
topology to anyone who receives them. Review
[security and data handling](../security/index.md) and
[output formats](../reference/outputs.md) before sharing.

## Use the keyboard

Shortcuts apply when focus is outside a text field. `Alt` is `Option` on
macOS.

| Key | Action |
| --- | --- |
| `Escape` | Clear the selection, or move up one level when nothing is selected |
| `Backspace` or `Alt+Left` | Go back |
| `Alt+Right` | Go forward |
| `+` and `-` | Zoom in and out while the canvas has focus |
| `0` or `f` | Fit the architecture in view |
| `c` | Center the selection |

To choose evidence for another question, [choose an input](../inputs/index.md).
