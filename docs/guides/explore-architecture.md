---
title: "Explore an architecture"
description: "Open a plan, state, or saved Rootform document and inspect its evidence."
---

Run an exported plan or state JSON to open the loopback Explorer:

```sh
rootform run plan.json
```

A plan opens its default `planned` stage. Switch stages to inspect a prior snapshot or reported drift when the plan supplies them. Select a represented instance to read its Rule, Concept, Contexts, Relations, Contributions, closure outcomes, and diagnostics. Unknown or sensitive evidence appears as unresolved; a dependency is not drawn as an architectural relation unless a Dialect emitted one.

## Reveal a secondary resource

Use search or a related fact in the Inspector to reveal a resource that has no permanent card in the current scene. Its representation and provenance remain in the document.

For a saved document, run `rootform run architecture.json`. To share a standalone interactive report, write `rootform run plan.json --no-serve -o architecture.html`. The HTML contains a sanitized display copy. See [Architecture documents](../concepts/architecture-ir.md).
