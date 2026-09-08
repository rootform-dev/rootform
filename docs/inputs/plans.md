---
title: "Terraform and OpenTofu plans"
description: "Render planned architecture and compare the before and planned facts carried by one JSON plan."
---

A Terraform or OpenTofu plan describes a proposed change. Rootform reads its
JSON representation to build the planned architecture or compare the before
and planned architecture. Rootform does not create, refresh, or apply the plan.

## What a plan adds

Configuration analysis starts with declarations. A plan supplies the resource
instances and before/planned structure from a particular planning operation.
Rootform uses identities, provider evidence, configuration references, and
availability information from that document. It suppresses attribute values;
it does not copy a plan into the architecture.

| Command | Result |
| --- | --- |
| `build --plan` | The planned architecture only. |
| `run --plan` | That planned architecture in the local explorer, without watching source changes. |
| `check --plan` | Selected policies evaluated against the planned architecture. |
| `diff --plan` | Architectural comparison between the before and planned sides of the same plan. |

The renderer's **Plan view** is unrelated to this input type. It controls how
much of any architecture is shown.

## Protect the plan files

> [!WARNING]
> Saved plans and JSON exports can contain sensitive values even when the
> terminal display hides them. Keep both files out of Git and public artifacts.
> Restrict access and retention; delete them when the review no longer needs them.
> Rootform's value suppression does not sanitize the original files on disk.

## Produce the accepted JSON

Start in a Terraform/OpenTofu project where you are authorized to run a plan.
Initialize it through your normal workflow first. Planning can access providers,
backends, state, and credentials; those operations belong to Terraform/OpenTofu.

For Terraform:

```sh
terraform plan -out=tfplan
terraform show -json tfplan > tfplan.json
```

For OpenTofu:

```sh
tofu plan -out=tfplan
tofu show -json tfplan > tfplan.json
```

Use the saved plan from that operation. `plan -json` emits machine events while
planning; it is not a substitute for `show -json` on the completed saved plan.
Rootform also rejects a raw binary plan, a state document, malformed JSON, and
JSON that does not have a recognized plan shape.

## Prepare Rootform, then build

Plan commands use the current directory's prepared Rootform selection. From
that project root:

<!-- docs-check:plan-build -->
```sh
rootform init . --no-input
rootform build --plan tfplan.json --output planned.json
```

Initialization establishes the required Dialects. Unlike directory input,
`--plan` does not infer and acquire a new project selection for you. Read the
build's declaration summary and diagnostics, then inspect the planned resources.
A saved plan can be valid even when Rootform cannot represent every resource in it.

Open the saved result with `rootform run planned.json`.

To export a portable view:

<!-- docs-check:plan-html -->
```sh
rootform build --plan tfplan.json --format html --output planned.html
```

This HTML contains the planned architecture. It is not an interactive comparison.

## Compare both sides of one plan

<!-- docs-check:plan-diff-text -->
```sh
rootform diff --plan tfplan.json
```

To retain the machine report:

<!-- docs-check:plan-diff-json -->
```sh
rootform diff --plan tfplan.json --format json --output delta.json
```

The plan supplies both sides, so do not add positional base/head arguments.
A create plan can have an empty before side; a destroy plan can have an empty
planned side. Empty sides are valid.

You can avoid writing the JSON plan to disk by piping the export directly:

```sh
terraform show -json tfplan | rootform diff --plan -
```

The saved binary plan still exists and needs the same protection. Rootform reads
`-` from standard input; use the OpenTofu equivalent when appropriate.

Differences return status `0` by default. Add `--exit-code` to return `1` for a
nonempty comparison, including undetermined facts. Status `3` means the
comparison could not be completed. A valid report can contain undetermined facts
and still exit `0` without `--exit-code`. The [Diff guide](../renderer/diff.md)
explains the outcomes and the distinction between changes and unavailable evidence.

## Why a replacement can have no architectural change

Terraform may replace a resource because an attribute changed. If the selected
Dialect still establishes the same architectural representation and connections,
Rootform can report `no architectural change`. Rootform compares architectural
facts, not the provider's action list or every attribute value.

Before-side references can also be unavailable for updated or replaced resources.
A reference in planned configuration is not proof that the same reference existed
before. Rootform keeps facts it cannot reconstruct **undetermined** instead of
inventing an addition, removal, or unchanged relationship.

A no-change result therefore says nothing about whether Terraform has actions
to apply. It also does not prove that deployed infrastructure matches source.
Rootform has no independent refresh or Drift feature; any observation represented
in the plan came from the Terraform/OpenTofu operation that produced it.
