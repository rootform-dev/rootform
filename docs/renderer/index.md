---
title: "Read an architecture"
description: "Navigate scopes, resources, connections, and their evidence in the Rootform renderer."
---

The renderer is a read-only explorer of a Rootform architecture. Start with
its structure, select something you recognize, then inspect the evidence
behind it. Rootform never applies a change from the canvas.

> These controls describe the current renderer implementation. See the
> [installation note](../installation.md#available-release) for the difference
> from the published v0.1.1 interface.

## Start with structure

Scopes show architectural context as nested boundaries. Their labels identify
what the boundary means; contained items show the resources or nested scopes
inside it. In a large architecture, a scope may summarize content that is not
currently expanded.

**Survey** makes the structure readable at the current viewport size by
summarizing deeper scopes. **Plan** exposes the complete graph, with explicit
scope disclosure still available. Both show the same underlying architecture.
Zoom changes the camera; it does not switch between these views.

The renderer's Plan view is not a Terraform plan. Use the
[plan input guide](../inputs/plans.md) for planned infrastructure changes.

## Select, then inspect

Select a resource or scope to open its **Inspector**. Start with its identity
and placement, then read the sections present for that selection: composition,
connections, and evidence. Technical details provide exact identifiers when
you need to trace a fact.

A selected connection has a specific architectural meaning. A visible line is
not a generic promise of network connectivity. Its relation type and evidence
explain the claim. Collapsed scopes can aggregate several relations; inspect
the aggregate to see the underlying facts.

## Reduce the question with Focus

Use **Focus** when the whole architecture is more than you need. It opens local
context around a selected scope or resource. Connections outside that context
are represented at its boundary. The location path tells you where you are and
lets you navigate back through the architecture.

Focus differs from selection: selection asks what an item is; Focus changes
which context you explore. [Views and inspection](views.md) compares them.

## Find something you already know

Search for a resource name or address. Locate it in the architecture, then
inspect or focus its context. Use the path and scope labels to retain your
orientation. **Fit** shows the whole current projection; a dense Plan may need
panning and zooming to read individual resources.

## Check what is missing

The canvas cannot make unsupported source disappear. Read declaration accounting
and diagnostics alongside the architecture. An unresolved fact is not evidence
that a dependency, resource, or change does not exist.

[Dialects](../concepts/dialects.md) explain how meaning is established.
[Diff](diff.md) explains how to read a comparison.
