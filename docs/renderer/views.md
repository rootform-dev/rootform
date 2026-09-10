---
title: "Survey, Plan, Focus, and Inspector"
description: "Choose between structural overview, complete detail, local context, and the evidence behind a selection."
---

Survey and Plan choose how much structure to show. Focus chooses a local context.
Inspector explains a selection. Zoom changes the camera and visual density.
None of these operations changes the architecture's semantic facts.

Try these controls in the
[Commerce platform Playground](https://docs.rootform.dev/playground/?mode=architecture&scenario=commerce-platform).

## Survey

Survey is the starting overview. It summarizes deeper scopes according to the
space available and the density of visible structure and routes. A smaller
viewport can show a different level of disclosure from a larger one while
representing the same architecture.

A collapsed boundary keeps a summary of its contents. Connections to hidden
subjects are represented through the appropriate visible boundary; an aggregate
retains the relations it stands for. Do not infer that hidden resources or
connections have been removed.

Survey on the [Commerce platform](examples.md#commerce-platform) keeps the hub,
spoke, resource-group, and cluster boundaries visible while deeper data and
workload scopes remain available for local disclosure.

### Expand only what you need

Use a scope's nameplate to expand or collapse it. This **local disclosure** changes
one part of the current view. An explicit expansion protects that context from
being immediately summarized again.

Survey and Plan retain separate disclosure choices. Switching modes does not
mean that every scope must retain the same expanded state. Zooming does not
switch modes or expand a scope automatically.

## Plan

Plan starts from the complete graph without Survey's automatic summarization.
You can still collapse scopes explicitly. Use it to trace structure that an
overview summarizes or to inspect how several nearby components fit together.

A large Plan may extend beyond the viewport. Its initial camera keeps a readable
part of the architecture in view; it does not shrink every label until the whole
graph fits. Choose **Fit architecture** for a full overview, then zoom or pan to
the part you need.

Plan is an exploration mode for any supported architecture. It does not run
Terraform or create a [Terraform/OpenTofu plan](../inputs/plans.md).

The same input in Plan exposes private DNS, data, messaging, service-plan, and
namespace scopes. Fitting everything makes labels smaller; Focus is more
useful for reading one area.

## Focus

From Survey or Plan, double-click a component or use its Inspector Focus action
to explore that area. Focusing a scope opens its contents; focusing an entity
shows its neighboring relations with enough enclosing context to explain
placement.

Connections to subjects outside that area appear at its boundary. These boundary
items preserve the external target and direction; they do not assert that the
focused component is isolated. Inspect a boundary connection or focus its external
target to continue the question.

The location path identifies the current context and its ancestors. Use an
ancestor, Back, or Exit to return. Switching to Survey or Plan exits the current
Focus.
Selection and Focus remain distinct: selecting asks what an item is; focusing
changes the context in which you explore it.

Focus opens its root without Survey's automatic summarization.
Explicit disclosure choices still apply inside it. Focusing a very large scope
can therefore require panning or further local disclosure.

Focus on `vnet-commerce-prod` to inspect AKS, data, and Function integration
subnets while preserving connections that cross the focused boundary.

## Inspector

Inspector shows facts available for the selected item. Opening it preserves the
architecture's geometry; the camera can pan to keep the selected item visible.

| Section | What to read there |
| --- | --- |
| Identity | The selected representation or relation and its concept. |
| Where | Established context and placement. |
| Made of / Source | Declarations or contributions behind a representation, when available. |
| Connected | Incoming and outgoing architectural relations. |
| Evidence | Source and rule evidence supporting the facts. |
| Technical | Exact identifiers and details useful for tracing or reporting a result. |

Sections appear when their facts exist. Longer evidence groups can be disclosed
within the panel. An empty section is not filled with inferred information.
You can also open Inspector without a selection for architecture-level context.

Resize the panel if you need more room for evidence. Selecting a relation or an
aggregate can change its contents without changing Focus.

Selecting `aks-commerce-prod` shows network and resource-group context.
**Made of** identifies its node-pool contribution, even though that detail is
not a separate canvas tile.

## Navigate with the keyboard

| Control | Keyboard action |
| --- | --- |
| Search | `Ctrl+K` or `Cmd+K`; use arrows and Enter in results. |
| Component with keyboard focus | Enter selects it. |
| Scope nameplate | Enter or Space expands or collapses it. |
| Focus | Escape returns through Focus history when not editing text. |
| Inspector | Escape within the dock closes it and returns focus to its trigger. |
| Inspector resize handle | Arrow keys resize; Shift uses larger steps; Home/End select bounds. |

Toolbar buttons, including zoom and Fit, are keyboard-focusable. Canvas panning
uses pointer dragging; there are no dedicated keyboard panning shortcuts. Wheel
or pinch controls zoom. At lower zoom, labels and tile detail become quieter;
the chosen projection and its geometry stay the same.

For change annotations in the comparison renderer, read [Diff](diff.md).
