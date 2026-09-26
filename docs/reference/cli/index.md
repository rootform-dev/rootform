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

- Analyze or explore: `run` analyzes a plan or state JSON, or reopens a saved Rootform document, then serves the local Explorer or writes reports.
- Review: `run --policy-pack` or `run --policy` evaluates Policies; `run --diff` compares two inputs.
- Inspect: `list` shows active content, `show` displays a definition, and `explain` traces an interpretation or result.
- Prepare: `init` verifies selected content and can fetch missing OCI units; `vendor` copies selected content into the project.
- Validate and author: `validate` checks an object; `fmt`, `test`, `compile`, `package`, `publish`, and `lsp` have their own contracts below.

<!-- BEGIN GENERATED CLI: rootform -->

## Usage

```text
rootform [command]
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
| [` rootform add `](add.md) | Add content to rootform.lock |
| [` rootform add dialects `](add/dialects.md) | Add dialects to rootform.lock |
| [` rootform add policy-packs `](add/policy-packs.md) | Add Policy Packs to rootform.lock |
| [` rootform compile `](compile.md) | Compile a Policy Pack for offline checks |
| [` rootform compile policy-pack `](compile/policy-pack.md) | Compile and pin a Policy Pack |
| [` rootform completion `](completion.md) | Generate shell completion |
| [` rootform explain `](explain.md) | Explain an architecture result |
| [` rootform explain architecture `](explain/architecture.md) | Explain an instance |
| [` rootform explain policy `](explain/policy.md) | Explain a policy result |
| [` rootform explain semantics `](explain/semantics.md) | Explain a rule |
| [` rootform fmt `](fmt.md) | Format Rootform files |
| [` rootform init `](init.md) | Prepare a Rootform project |
| [` rootform install `](install.md) | Install registry content in the Rootform home |
| [` rootform install dialects `](install/dialects.md) | Install dialects from registry references |
| [` rootform install policy-packs `](install/policy-packs.md) | Install Policy Packs from registry references |
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
| [` rootform remove `](remove.md) | Remove content from rootform.lock |
| [` rootform remove dialects `](remove/dialects.md) | Remove dialects from rootform.lock |
| [` rootform remove policy-packs `](remove/policy-packs.md) | Remove Policy Packs from rootform.lock |
| [` rootform run `](run.md) | Analyze a plan or state, or open a saved Rootform document |
| [` rootform show `](show.md) | Show a Rootform definition |
| [` rootform show policy `](show/policy.md) | Show a policy definition |
| [` rootform show policy-pack `](show/policy-pack.md) | Show a Policy Pack |
| [` rootform test `](test.md) | Test Dialect fixtures |
| [` rootform uninstall `](uninstall.md) | Delete installed versions from the Rootform home |
| [` rootform uninstall dialects `](uninstall/dialects.md) | Delete installed dialect versions |
| [` rootform uninstall policy-packs `](uninstall/policy-packs.md) | Delete installed Policy Pack versions |
| [` rootform update `](update.md) | Change a selection in rootform.lock |
| [` rootform update dialect `](update/dialect.md) | Change one selected dialect |
| [` rootform update policy-pack `](update/policy-pack.md) | Change one selected Policy Pack |
| [` rootform validate `](validate.md) | Validate a Rootform object |
| [` rootform validate architecture `](validate/architecture.md) | Validate a saved Rootform document |
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
