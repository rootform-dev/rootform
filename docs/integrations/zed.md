---
title: Zed
description: Write Rootform source with diagnostics, completion, hover, go to definition and formatting in Zed.
---

Write `.rf.hcl` in Zed with Rootform diagnostics, completion, hover,
go to definition and formatting. Syntax highlighting, bracket matching,
indentation and folding keep Dialects and Policy Packs readable.

## Start editing

1. [Install Rootform](../installation.md) and confirm `rootform version` works.
2. Clone the [public editor source](https://github.com/rootform-dev/editors):

   ```sh
   git clone --branch dev https://github.com/rootform-dev/editors.git
   ```

3. In Zed's Command Palette, run `zed: install dev extension` and select the
   checkout's `zed` directory. Open a `.rf.hcl` file.

The extension finds `rootform` on the workspace `PATH` and starts the language
server. It uses your local executable; it does not bundle or download one.
Building the extension may need network access for its pinned syntax grammar
and Zed's build tools.

If Rootform is installed elsewhere, set both the path and arguments in Zed's
settings:

```json title="settings.json"
{
  "lsp": {
    "rootform": {
      "binary": {
        "path": "/absolute/path/to/rootform",
        "arguments": ["lsp"]
      }
    }
  }
}
```

Keep `arguments: ["lsp"]` with a path override so Zed starts the server
rather than the default CLI command.

## Work on a Dialect or Policy Pack

Use completion while writing declarations and expressions, hover to inspect
symbols, and go to definition to follow their references. Format the document
with Zed's formatting command. Diagnostics update as you edit, including
unsaved changes.

The editor uses the same Rootform parser, compiler and formatter as the CLI
through `rootform lsp`. Source validation runs without Terraform, OpenTofu,
providers or project content downloads. A Policy still needs a Form for
semantic validation and evaluation; editor diagnostics are not a Policy verdict.

[Edit Rootform source](../language/editors.md) explains source roots and the
authoring workflow. Continue with [Test and validate](../language/test-validate.md)
to prove behavior against evidence.

## If language features do not start

Check the executable path and the `lsp` argument together. An absolute path
avoids differences between a terminal and the workspace `PATH`. After fixing
a launch error or replacing Rootform, run `editor: restart language server`.

Use the [extension README](https://github.com/rootform-dev/editors/tree/dev/zed#readme)
for launch settings and the [LSP reference](../reference/cli/lsp.md) for the
server contract.
