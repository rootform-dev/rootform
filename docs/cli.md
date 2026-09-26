---
title: "Select project content"
description: "Prepare Rootform project selection and analyze a plan or state export."
---

Run `rootform init .` in a project to prepare selected Dialects and Policy Packs. A valid `rootform.lock` records exact external selections. Embedded Dialects need no separate acquisition. Add `--locked --no-input` in automation when selection must already be valid.

```sh
rootform init . --locked --no-input
rootform run plan.json --project . --locked --no-serve -o architecture.json
```

`run` takes a plan JSON export, state JSON export, saved Rootform document, or `-` for standard input. A configuration directory is not an input. `--project` selects Dialects and policies from a directory; it does not make that directory the analyzed evidence. Use `--dialect` or `--policy-pack` for one-run local overrides. See [Choose an input](inputs/index.md), [External content](concepts/external-content.md), and the [CLI reference](reference/cli/index.md).
