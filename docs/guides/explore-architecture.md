---
title: Explore an architecture
description: Navigate an existing project, inspect resources and evidence, and follow placements and connections.
---

Run Rootform from a Terraform or OpenTofu root module. The local explorer opens
the architecture derived from its declarations and references.

```sh
rootform run .
```

To inspect a saved [Rootform architecture file](../concepts/architecture-ir.md)
instead, pass it directly:

```sh
rootform run architecture.json
```

`run` opens a browser and keeps the terminal process active. Configuration
input is rebuilt when local source changes. Press `Ctrl+C` in that terminal
when you are finished. See [Choose an input](../inputs/index.md) when a plan or
saved file better matches your question.

## Move through architecture levels

The canvas shows one context and its direct contents. A card with nested
objects has an **Open** action. Open it to make that resource the current
context and read its children without the rest of the architecture competing
for space.

Use the controls above the canvas to move without losing your place:

- **Up** returns to the containing context.
- The current-context menu shows the full path and lets you jump to any level.
- **Architecture root** returns to the top level.
- Back and forward revisit your navigation history.

A resource may have more than one proven placement. Its path menu lists other
contexts under **Also placed in**.

## Find and inspect a resource

Search by resource name or displayed type. Results cover the whole
architecture, not only the current context. Choosing a result opens the context
that holds it and reveals the resource when necessary.

Select a resource card to open its inspector:

- **Details** shows its source address, normalized type, and proven placements
  under **Where**.
- **Connections** lists incoming and outgoing architectural relations.
- **Source** shows implementation evidence, semantic facts, source locations,
  and diagnostics.

Use **Center selection** after following several links when you need to bring
the selected object back into view.

## Read a placement

A placement appears as containment on the canvas and as a structural fact under
**Where**. Select a listed context to open it. In the Source tab, expand the
fact's **Resolution** to see which [Dialect](../concepts/dialects.md) Rule and
resolved source evidence established it.

Placement is not a connection. Rootform does not draw a context arrow merely
because one resource appears inside another.

## Read a connection

Select a route on the canvas, or choose a relation from a resource's
Connections tab. The inspector names both endpoints, the relation predicate,
its source location, and its resolution evidence.

When an endpoint is inside a closed context, or several relations share the
same visible endpoints, the canvas can carry them as an aggregate route. The
inspector keeps each real relation available and marks it **Included in
aggregate route**. Use **Reveal endpoints** to show hidden endpoint resources
inside their containing cards, or open the containing context for a full view.

## Follow an external reference

A relation can leave the current context. The outside endpoint then appears as
a dashed reference card labelled with its home context. It is the same
resource, not a copy. Select it to inspect the resource here, or use **Go to**
to open its home context.

External references show only what is needed to read the current scene. They do
not bring the endpoint's surrounding resources into this context.

## Reveal a secondary resource

Some fully resolved association resources contribute implementation detail to
other resources without needing permanent cards. Find such a resource from the
Inspector of an object it contributes to, or search for it by name or type.
Either route reveals the resource so you can inspect it directly.

This presentation does not remove the resource from the architecture or turn
its contribution into a placement or relation.

## Save or share the result

Save a reusable architecture file:

```sh
rootform build . --output architecture.json
```

Open that saved document later:

```sh
rootform run architecture.json
```

To rebuild the architecture from the configuration, run `rootform build .`.
To export that configuration as a self-contained browser artifact, use:

```sh
rootform build . --format html --output architecture.html
```

Review [security and data handling](../security/index.md) before sharing either
file. For exact output behavior and automation contracts, see
[Outputs and exit status](../reference/outputs.md).
