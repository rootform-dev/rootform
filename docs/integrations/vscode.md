---
title: VS Code
description: Write Rootform source with diagnostics, completion, hover, go to definition and formatting in VS Code.
---

Write `.rf.hcl` files with feedback as you edit. Rootform supplies diagnostics
for invalid source, completion in context, hover information, go to definition
and document formatting. Syntax highlighting, bracket matching and folding
help you navigate a Dialect or Policy Pack.

## Start editing

1. [Install Rootform](../installation.md) and confirm `rootform version` works.
2. Install the Rootform VSIX in VS Code with **Extensions: Install from VSIX…**.
   Use VS Code 1.133 or later. The package can be built from the
   [editor source](https://github.com/rootform-dev/editors/tree/dev/vscode)
   with the commands below.
3. Open a trusted workspace containing `.rf.hcl` files. Select the **Rootform**
   language mode if VS Code has not selected it automatically.

<details>
<summary>Build the VSIX from source</summary>

Install [Bun](https://bun.sh/docs/installation), then package the public
extension:

```sh
git clone --branch dev https://github.com/rootform-dev/editors.git
cd editors
bun install --frozen-lockfile
bun run --cwd vscode package --out ../rootform.vsix
```

Select `rootform.vsix` in **Extensions: Install from VSIX…**.

</details>

Rootform must be on VS Code's `PATH`. If it is installed elsewhere, set
**Rootform: Server Path** in Settings, or use:

```json title="settings.json"
{
  "rootform.server.path": "/absolute/path/to/rootform"
}
```

The extension uses your local executable; it does not bundle or download one.
It starts it only in a trusted workspace.

## Work on a Dialect or Policy Pack

Open a source root and use completion while writing declarations and
expressions. Hover a symbol for its information; use **Go to Definition** to
follow a reference and **Format Document** to format the file. Diagnostics
update as you edit, including unsaved changes.

The editor uses the same Rootform parser, compiler and formatter as the CLI
through `rootform lsp`. It validates source without planning infrastructure,
running providers or downloading project content. Valid Policy source still
needs to be linked and evaluated against a Form; the editor does not perform
a Policy check.

[Edit Rootform source](../language/editors.md) explains source roots and the
next authoring steps. [Test and validate](../language/test-validate.md) covers
behavior and Policy semantics beyond editor diagnostics.

## If language features do not start

Check that the workspace is trusted, `.rf.hcl` uses the Rootform language mode,
and the configured executable supports `rootform lsp`. An absolute server
path avoids differences between terminal and desktop application `PATH`.
After changing or replacing the executable, run
**Rootform: Restart Language Server** from the Command Palette.

Use the [extension README](https://github.com/rootform-dev/editors/tree/dev/vscode#readme)
for launch diagnostics and the [LSP reference](../reference/cli/lsp.md) for
the server contract.
