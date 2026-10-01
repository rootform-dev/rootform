---
title: Edit Rootform source
description: Use VS Code or Zed with the Rootform language server.
---

Open `.rf.hcl` files with the [Rootform editor integrations](https://github.com/rootform-dev/editors).
Configure a local Rootform executable in the editor; the integration starts
[`rootform lsp`](../reference/cli/lsp.md). Extensions do not include or download
Rootform. Their READMEs provide editor-specific installation and path settings.

The language server supplies diagnostics, contextual completion, hover, go to
definition and formatting. It uses the same parser, compiler and formatter as
the CLI. Unsaved buffers override disk files, and source-file or workspace
notifications refresh the result. Document synchronization is full text, with
UTF-16 positions negotiated through LSP.

Keep each Dialect or Policy Pack in its own source root. A workspace can contain
several roots; an individual source file uses its directory. Dialect and Policy
Pack source use their respective compilers. Source authoring needs no provider
execution, project preparation or dependency acquisition.

Policy source validation does not prove its references link against a Form.
Use [`rootform compile policy-pack --semantics`](../reference/cli/compile/policy-pack.md)
with a saved Form for that check. The language server does not evaluate Policies.
