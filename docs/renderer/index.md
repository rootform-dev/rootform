---
title: "Read an architecture"
description: "Read scopes, entities, relations, and their evidence before exploring a larger architecture."
---

The renderer is a read-only explorer of facts in a Rootform architecture.
It turns those facts into a view you can navigate; it does not re-interpret
Terraform or apply a change from the canvas.

When exploring a source directory, `rootform run` rebuilds the architecture as
files change. Use `--no-watch` to build once; the
[`rootform run` reference](../reference/cli/run.md) lists input and server options.

## Read boundaries before lines

A **scope** provides architectural context: a network, subnet, or another named
boundary. Its nested contents show subjects placed within that context.
An **entity** is an architectural component, such as a workload. Several source
declarations can contribute to one representation, so visible shapes are not a
resource-count report.

A **relation** is a specific claim established by a Dialect. Its type and
direction explain what the line means. Terraform references and `depends_on`
entries are evidence; they do not automatically become architecture relations.
A subnet placed inside a network does not need a fabricated traffic-flow arrow
between the two.

An architecture can have several context dimensions. Network placement answers
a different question from ownership or geography. Change the active dimension
when the available contexts support the question you want to explore. A different
placement view does not change the underlying facts.

Not every context becomes visual nesting. A context whose target is an entity
remains an explicit fact without turning that entity into a scope boundary.
Inspector helps you read those facts and any ambiguous placement.

## Start broad, then inspect a question

**Survey** summarizes deeper scopes to make the structure readable within the
viewport. Begin there to locate a familiar boundary. A collapsed scope represents
contents that still exist in the architecture.

Select a component or scope and open its **Inspector**. Read its identity and
placement, then the connections and evidence relevant to your question. A useful
sequence is: recognize the subnet, check its network context, then inspect the
source reference and Dialect rule that established that context.

Use **Plan** when you need the complete structure. Use **Focus** when the question
is local to one scope or component. [Views and inspection](views.md) explains how
those choices differ from expanding a scope or zooming the camera.

## Follow a connection to its evidence

Select a relation to inspect its participants and supporting facts. When several
relations share visible endpoints after collapse, a route can represent an
aggregate. Inspect it to see the underlying relation identities; do not interpret
one visible line as exactly one source reference.

Relations entirely inside a collapsed scope remain part of its accounted content.
They do not become self-loop arrows on the summary. Expand or focus that scope
when you need to inspect those internal connections.

## Find a component

Search by name, concept, or context path. Search does not index exact
Terraform source addresses as a separate search field. Use Inspector's technical
information or `explain architecture` when you already have an address.

Search can find content beyond the current visible projection. Locate the result,
then inspect it or focus its context. Use the location path to retain your
orientation. **Fit architecture** shows the current projection as an overview;
it can make labels small in a large Plan.

## Read accounting alongside the picture

A scope can be collapsed because of a display choice. A declaration can be absent
from the architecture because no rule supports it. These are different cases.
Read declaration accounting and diagnostics before claiming coverage.

Unsupported, failed, and unresolved input remains explicit. More zoom cannot
create semantic evidence. [Dialects](../concepts/dialects.md) explains coverage;
[Architecture IR](../concepts/architecture-ir.md) explains the saved facts.
