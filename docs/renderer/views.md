---
title: "Survey, Plan, Focus, and Inspector"
description: "Choose the right level of detail without confusing a view change with an architecture change."
---

Use Survey to orient yourself, Plan to examine the complete structure, and
Focus to follow one local question. Use Inspector for the facts behind your
selection. These controls change what you see, not what the source declares.

See the [release note](../installation.md#available-release) for availability of
the current renderer controls.

## Survey

Survey summarizes deeper scopes to keep the architecture readable at the current
viewport size. A larger viewport can expose more context. Collapsed content is
still accounted for; it is not removed from the architecture.

Expand a scope when you need its contents. Search helps locate a resource that
is not currently visible. Do not infer absence from a collapsed boundary.

## Plan

Plan uses the complete graph. It is useful for tracing structure that Survey
summarizes. You can still explicitly collapse scopes, and a large architecture
may require panning. Fit provides an overview rather than guaranteeing that
every label is readable at once.

Plan is a renderer projection. It does not run `terraform plan`, predict a
provider action, or change the input document.

## Focus

Focus opens local context around a scope or resource. The location path shows
the focused context and its ancestors. External connections remain represented
at the boundary so that the local picture does not imply isolation.

Use the path to return to an ancestor or the whole architecture. Focus is useful
when the question is local even if Plan can show everything.

## Inspector

Select an item to inspect its identity, placement, connections, composition,
and provenance. Sections appear when the selection has those facts. Evidence
explains the semantic conclusion; technical details expose exact identifiers.

Opening Inspector does not re-interpret your source. It may adjust the camera
to keep the selected item visible. Selection can highlight a connection without
opening a different Focus.

| Your question | Start here |
| --- | --- |
| How is this architecture organized? | Survey |
| What is the full structure? | Plan |
| What surrounds this component? | Focus |
| Why is this fact shown? | Inspector, then Evidence |

For a comparison, the same exploration model applies. Read the
[Diff guide](diff.md) before interpreting its change annotations.
