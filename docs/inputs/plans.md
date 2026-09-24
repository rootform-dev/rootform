---
title: "Terraform and OpenTofu plans"
description: "Explore planned architecture and compare the before and planned facts carried by one JSON plan."
---

Start with a project that is ready for its usual Terraform or OpenTofu planning
workflow. Rootform reads the completed plan export. It does not create, refresh,
or apply a plan, execute a provider, or contact a backend.

Run Rootform from the project directory. With `--plan`, Rootform reads any
project selection present in the current working directory. Projects that use
only the embedded Dialects need neither `rootform.lock` nor a
`.rootform/` directory. Rootform does not infer a project root from the
directory containing the plan file.

## Protect the plan files

> [!WARNING]
> Saved plan files and their JSON exports can contain sensitive values, even when
> Terraform or OpenTofu hides them in terminal output. Keep both out of Git and
> public artifacts. Rootform does not modify, sanitize, or delete either input.

## Produce the accepted JSON

Create a saved plan through your normal workflow, then export that completed
plan as JSON.

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

Use `show -json` on the saved plan. `plan -json` emits an event stream while
planning and is not the same input. Rootform also rejects a raw binary plan, a
state document, malformed JSON, and JSON without a recognized plan shape.

## Explore the planned architecture

```sh
rootform run --plan tfplan.json
```

The local explorer opens the architecture the plan would produce. Inspect the
planned resource instances, their interpretations, and established facts.
Keep this server running while you use a second terminal for later commands, or
press `Ctrl+C` before continuing.

## Save the planned architecture

<!-- docs-check:plan-build -->
```sh
rootform build --plan tfplan.json --output planned.json
```

`planned.json` contains the planned architecture only, not a comparison. Read
the declaration summary and diagnostics, then inspect the saved resource
instances, interpretations, and facts.

## Compare both sides of one plan

<!-- docs-check:plan-diff-text -->
```sh
rootform diff --plan tfplan.json
```

The text report separates determined architecture changes from facts Rootform
could not determine. To retain the machine report:

<!-- docs-check:plan-diff-json -->
```sh
rootform diff --plan tfplan.json --format json --output delta.json
```

Inspect `changes`, `undetermined`, and their summary counts in `delta.json`.
The plan supplies both sides, so do not add positional Before and After
arguments. A create plan can have an empty Before side, and a destroy plan can
have an empty planned side. Both are valid.

To review the comparison in the browser, serve it:

```sh
rootform diff --plan tfplan.json --serve
```

The interface opens on the planned architecture with the comparison beside it.
Switch between the Before, Diff, and After stages to place each planned change.
`rootform diff --plan tfplan.json --format html --output plan-diff.html` writes
the same view as one self-contained page. See
[Open the comparison in the browser](../guides/compare-architectures.md#open-the-comparison-in-the-browser)
for the server and page behavior.

## Check the planned architecture

```sh
rootform check --plan tfplan.json
```

This evaluates the planned architecture against Policy Packs selected for the
current project. Select an appropriate pack in `rootform.lock` or pass an
explicit `--policy-pack` source before treating the result as a governance
claim. See [Run checks](../guides/check-architecture.md) for the
Policy Pack workflow and outcome interpretation.

## Read plan comparisons correctly

`build --plan` and `run --plan` use the planned side only. `diff --plan`
derives both Before and planned architecture from the same plan.

For updated, replaced, and deleted resources, the plan may not carry the
references needed to reconstruct the Before configuration. A reference present
in the planned configuration does not prove that it existed before. Rootform
reports conclusions it cannot establish as **undetermined** instead of
inventing an addition, removal, or unchanged relationship.

An undetermined entry is not a no-change result, and it does not necessarily
mean the comparison failed. A completed comparison returns status `0` by
default even when its report contains changes or undetermined entries. With
`--exit-code`, either condition returns status `1`. Status `3` means the
comparison could not be completed. See the exact
[`rootform diff` exit contract](../reference/cli/diff.md#exit-status).

Terraform may replace a resource because an attribute changed while Rootform
reports no architectural change. This means both sides establish the same
architectural representations and facts. It does not mean Terraform has no
actions, or that deployed infrastructure matches source.

## Stream the export

You can avoid writing the JSON export to disk by piping it directly:

```sh
terraform show -json tfplan | rootform diff --plan -
```

Use `tofu show -json` for OpenTofu. The pipe avoids an intermediate JSON file,
but the saved binary plan still exists and needs the same protection.

Rootform outputs omit raw plan values, but they can still reveal resource
names, source paths, and architecture structure. They are not automatically
anonymized. Review [security and data handling](../security/index.md) before
sharing architecture files or Diff reports.
