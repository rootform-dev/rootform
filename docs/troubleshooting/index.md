---
title: "Troubleshooting"
description: "Find the next action for missing Dialects, locked or offline failures, incomplete coverage, and unavailable comparisons."
---

Start with the exact diagnostic and the command's exit status. Rootform
separates incorrect usage from a run that could not reach a decision. An
unavailable result must not be interpreted as an empty architecture or a pass.

## The command is not found

Check the executable's directory on `PATH`. Use `command -v rootform` on
macOS/Linux or `Get-Command rootform` in PowerShell. Open a new terminal after
changing a persistent environment setting. See [Install](../installation.md).

## A non-interactive run stops at a prompt

Use `--no-input` for automation. It accepts only a deterministic selection.
If Rootform reports ambiguity, make the selection explicitly; do not pipe an
unconditional answer into the prompt.

## No project Dialects are available

Run from the intended Terraform/OpenTofu root, then prepare it:

```sh
rootform init . --no-input
```

Installed content in your home does not select it for this project. Read
[CLI lifecycle](../cli.md) if the command needs an existing lock or vendor.

## A locked or offline run is missing content

`--locked` preserves selection and can acquire exact missing artifacts.
`--offline` prevents network access. A cold offline machine needs verified
local content supplied beforehand.

An existing project vendor is exclusive. Do not delete the lock or silently
fall back to another store to make a check pass. Use the explicit vendor repair
workflow in [locks and offline operation](../offline-security.md).

## Provider compatibility is unverified

Rootform could not establish reliable provider-version evidence. Refresh
`.terraform.lock.hcl` with your IaC tool when appropriate for the project.
A warning about unknown evidence differs from a reliable incompatibility,
which blocks the affected Dialect.

## The picture is incomplete

Read declaration accounting and diagnostics. A collapsed Survey scope is a
presentation choice; an unsupported declaration is a coverage limitation.
[Dialects](../concepts/dialects.md) explain the difference. More zoom cannot
create missing semantic evidence.

## Diff cannot compare the inputs

Check that both architectures are valid and use the same exact Dialect set.
Invalid or incompatible inputs return an indeterminate result. Do not convert
status `3` into an empty diff. Remember that ordinary differences return `0`
unless `--exit-code` was supplied.

If the documented next action does not resolve the issue,
[report a synthetic reproduction](../contributing/index.md#report-a-semantic-gap).
Keep raw plans, credentials, and customer infrastructure out of the report.
