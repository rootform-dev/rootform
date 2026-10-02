---
title: Edit Rootform source
description: Author Dialects and Policy Packs with editor feedback, then test them against evidence.
---

Use [VS Code](../integrations/vscode.md) or [Zed](../integrations/zed.md) to
write `.rf.hcl` with diagnostics, completion, hover, go to definition and
formatting. Follow your editor's guide to install and configure it.

## Open a source root

Keep each Dialect or Policy Pack in its own source root. Open that directory
in your editor so related files are checked together. A workspace may contain
several roots; when you open an individual file, its directory supplies the
source root. `.rf.json` source is also supported.

Editor diagnostics use the same parser and compiler as the CLI, including
unsaved changes. Authoring needs no infrastructure plan, provider execution,
project preparation or dependency acquisition.

## Validate the behavior

Diagnostics help you correct source; they do not prove what it concludes from
an input. [Test and validate](test-validate.md) covers fixture analysis,
formatting and compilation. A Policy must also link against the facts in a
Form and be evaluated there; the language server does not evaluate Policies.

Continue with [Write a Dialect](../dialect-authoring.md) or
[Write a Policy Pack](write-policy-pack.md).
