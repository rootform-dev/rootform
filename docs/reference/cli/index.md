---
title: "CLI command reference"
description: "Find command syntax, inputs, outputs, and exit status."
---

Invoke `rootform <command>` from a project root, or pass an explicit input
where the command accepts one. The syntax blocks below are reference forms:
placeholders such as `[input]` and `[flags]` are not literal arguments. Run
`rootform <command> --help` for terminal help. The tables on command pages
retain the CLI's exported option types and defaults.

For a first result, follow [Your first architecture](../../getting-started/first-architecture.md).
For a complete task, use the [guides](../../guides/explore-architecture.md)
and return here for exact command contracts.

## Find a command

- Build or explore: `build` exports an architecture; `run` serves the local explorer.
- Review: `check` evaluates Policies; `diff` compares two architectures.
- Inspect: `list` shows effective selections, `show` displays a definition, and `explain` traces an interpretation or result.
- Prepare: `init` materializes pinned selections; `vendor` copies them into project-local destinations.
- Validate and author: `validate` checks an object; `fmt`, `test`, `compile`, `package`, `publish`, and `lsp` have their own contracts below.

<!-- BEGIN GENERATED CLI: rootform -->

## Usage

```text
rootform [flags]
```

## Flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --color ` | ` mode ` | ` auto ` | color human output: auto, always, never |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform |
| ` -v, --version ` | ` bool ` | ` false ` | print the rootform version and exit |

## Command inventory

| Command | Purpose |
| --- | --- |
| [` rootform build `](build.md) | Build an architecture |
| [` rootform check `](check.md) | Check architecture policies |
| [` rootform compile `](compile.md) | Compile a Policy Pack for offline checks |
| [` rootform compile policy-pack `](compile/policy-pack.md) | Compile and pin a Policy Pack |
| [` rootform completion `](completion.md) | Generate shell completion |
| [` rootform diff `](diff.md) | Compare two architectures |
| [` rootform explain `](explain.md) | Explain an architecture result |
| [` rootform explain architecture `](explain/architecture.md) | Explain an architecture element |
| [` rootform explain policy `](explain/policy.md) | Explain a policy result |
| [` rootform explain semantics `](explain/semantics.md) | Explain a semantic interpretation |
| [` rootform fmt `](fmt.md) | Format Rootform files |
| [` rootform init `](init.md) | Prepare a Rootform project |
| [` rootform list `](list.md) | List Rootform definitions |
| [` rootform list dialects `](list/dialects.md) | List the dialect catalog |
| [` rootform list policies `](list/policies.md) | List policies |
| [` rootform list policy-packs `](list/policy-packs.md) | List Policy Packs |
| [` rootform lsp `](lsp.md) | Serve Rootform language features over stdio |
| [` rootform package `](package.md) | Package Rootform content for distribution |
| [` rootform package dialects `](package/dialects.md) | Build dialect packages |
| [` rootform package policy-packs `](package/policy-packs.md) | Build Policy Pack packages |
| [` rootform publish `](publish.md) | Publish packaged Rootform content |
| [` rootform publish dialects `](publish/dialects.md) | Publish a verified dialect registry layout |
| [` rootform publish policy-packs `](publish/policy-packs.md) | Publish a verified Policy Pack registry layout |
| [` rootform run `](run.md) | Explore an architecture locally |
| [` rootform show `](show.md) | Show a Rootform definition |
| [` rootform show policy `](show/policy.md) | Show a policy definition |
| [` rootform show policy-pack `](show/policy-pack.md) | Show a Policy Pack |
| [` rootform test `](test.md) | Test dialect fixtures |
| [` rootform validate `](validate.md) | Validate a Rootform object |
| [` rootform validate architecture `](validate/architecture.md) | Validate an architecture |
| [` rootform validate concept `](validate/concept.md) | Validate a concept definition |
| [` rootform validate context `](validate/context.md) | Validate a context dimension |
| [` rootform validate dialects `](validate/dialects.md) | Validate dialect definitions |
| [` rootform validate policy `](validate/policy.md) | Validate a policy definition |
| [` rootform validate relation `](validate/relation.md) | Validate a relation predicate |
| [` rootform validate rule `](validate/rule.md) | Validate a rule definition |
| [` rootform vendor `](vendor.md) | Vendor selected non-embedded content |
| [` rootform vendor dialects `](vendor/dialects.md) | Vendor selected dialects |
| [` rootform vendor policy-packs `](vendor/policy-packs.md) | Vendor selected Policy Packs |
| [` rootform version `](version.md) | Show the Rootform version |

<!-- END GENERATED CLI -->

The complete command inventory above links to every subcommand, including
language-authoring commands. For result formats and non-universal exit codes,
see [Outputs and exit status](../outputs.md).
