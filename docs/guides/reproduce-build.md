---
title: "Reproduce an analysis offline"
description: "Replay the same plan or state input and exact Rootform selection in an independent environment."
---

A reproducible analysis needs the same plan or state JSON bytes, Rootform release, active Dialects, and relevant options. For a plan, the same verified saved plan matters when traversals establish facts. `rootform.lock` fixes external selection; it does not store the embedded Dialects, which come from the binary. A saved [Rootform document](../concepts/architecture-ir.md) offers a second path: reopen its recorded facts without the plan or state export or installed Dialects.

This walkthrough uses two copies of one project, `source/` and `replay/`, and a private `evidence/` directory. Both contain the same `plan.json` and `plan.tfplan`. Keep those input files out of Git and public artifacts: saved plans and JSON exports can contain secrets in clear text. Rootform reads them locally and does not run Terraform, contact providers, or publish sensitive values. Its reports still disclose infrastructure topology and names, so keep them internal.

<!-- rootform:steps -->

## Record the original analysis

Create an evidence directory accessible only to this workflow. Record the Rootform version and binary checksum beside it. Then analyze the source export with its saved plan:

<!-- docs-check:reproduce-source -->
```sh
mkdir -p evidence
rootform version > evidence/rootform-version.txt
shasum -a 256 "$(command -v rootform)" > evidence/rootform-binary.sha256
shasum -a 256 source/plan.json source/plan.tfplan > evidence/input.sha256
rootform run source/plan.json --project source \
  --plan-file source/plan.tfplan --require-enrichment \
  --no-serve -o evidence/before.json
```

<!-- docs-output:reproduce-source -->
```text title="Excerpt from analysis summary"
Plan analyzed
Enrichment    saved plan verified against this plan JSON (1 module)
Stages        planned (default)
```

`--require-enrichment` makes an unverified pair fail with status `3` instead of silently relying on plan-only evidence. The saved plan contributes configuration traversal evidence; it is not the analyzed input. On a Linux host without `shasum`, use `sha256sum` for the checksum line. Keep the command flags, standard error, and document with the exact input hashes. [Terraform and OpenTofu plans](../inputs/plans.md#produce-the-accepted-json) gives the export procedure.

## Replay with a fresh Rootform home

Transfer the exact binary for the replay platform and copy the project and input files through your protected channel. An independent Rootform home proves that replay did not use shared installed content. Run the copied input and compare the document bytes:

<!-- docs-check:reproduce-independent -->
```sh
replay_home=$(mktemp -d)
ROOTFORM_HOME="$replay_home" rootform run replay/plan.json \
  --project replay --plan-file replay/plan.tfplan \
  --require-enrichment --no-serve -o evidence/after.json
cmp -s evidence/before.json evidence/after.json
```

Both commands return `0` for this example. `cmp -s` establishes byte identity; the second Rootform summary should again say `Enrichment    saved plan verified against this plan JSON (1 module)`. A different input, release, selection, or saved-plan verification result invalidates the byte comparison. A fresh home alone does not prove network isolation; run replay in the intended network-disabled environment to prove that boundary.

A state JSON uses the same procedure without `--plan-file` or `--require-enrichment`. State input has one `recorded` stage. A plan's default is `planned`, and a plan with prior state may also expose `refreshed`, `recorded`, and drift. Compare like stages when assessing architecture; byte identity is a stricter replay check.

## Reopen a saved Rootform document

When the plan or state files cannot travel, use the saved Rootform document. It contains stage facts, closures, and comparisons already established by the original run. Reopening does not reanalyze the plan:

<!-- docs-check:reproduce-saved -->
```sh
replay_home=$(mktemp -d)
ROOTFORM_HOME="$replay_home" rootform run evidence/before.json \
  --no-serve -o evidence/reopened.md
```

<!-- docs-output:reproduce-saved -->
```text title="Excerpt from standard output"
Rootform plan document loaded
Enrichment    saved plan verified against this plan JSON (1 module)
```

The Markdown file presents the recorded analysis. Loading needs neither the original plan nor its Dialects. It does not repair an unresolved closure or apply newer Dialect Rules; reanalysis requires the plan or state input and the intended selection. Saved documents omit sensitive values but still reveal topology.

## Prepare selected external content

For projects with a nonempty `rootform.lock`, prepare exact content before the offline run. `init` verifies the existing lock and may acquire missing exact OCI bytes while connected. For a disconnected environment, transfer the local source or vendor the selected content with the project. The following commands run from the project root after the reviewed lock exists:

<!-- docs-check:reproduce-vendor-source -->
```sh
rootform init . --locked --no-input
rootform vendor --offline
rootform run plan.json --plan-file plan.tfplan --require-enrichment \
  --locked --no-serve -o before.json
```

`init` leaves the lock unchanged. `vendor --offline` writes selected external Dialects and Policy Packs beneath `.rootform/` from verified local or installed bytes. It does not copy embedded Dialects. The final command writes `before.json` with that selection. Transfer `rootform.lock`, the applicable `.rootform/` families, plan pair, `before.json`, and the exact Rootform release. A lock file alone does not transfer external content.

In the replay project, verify the vendor copy and analyze without acquisition:

<!-- docs-check:reproduce-vendor-replay -->
```sh
rootform init . --locked --offline --no-input
rootform run plan.json --plan-file plan.tfplan --require-enrichment \
  --locked --no-serve -o after.json
cmp -s before.json after.json
```

Status `0` from `cmp` proves the locked analyses wrote identical document bytes. If a vendor family is missing or altered, both preparation and analysis refuse it. Repair the selected family with `rootform vendor dialects --offline` or `rootform vendor policy-packs --offline` only when verified source bytes are present. Otherwise prepare and vendor on the connected source environment, then transfer the complete family again. Do not remove the lock to bypass an integrity failure. [Locks and vendored content](../offline-security.md) gives the ownership rules.

## Keep policy evidence when governance matters

A saved Rootform document is not a substitute for a separate governance decision. If selected policies matter, use the same selection and `--policy` filters on source and replay. Save the report and exact exit status beside each document; compare both, because a status alone hides target coverage. Status `0` means every selected evaluation passed, `1` means a violation, and `3` means indeterminate or no decision. Keep SARIF and reports as internal artifacts. [Run checks](check-architecture.md) explains the evaluation counts; [outputs and exit status](../reference/outputs.md) defines the files.

<!-- rootform:endsteps -->

If replay bytes differ, inspect the plan or state details and Dialect selection in both documents before changing input. [Troubleshooting](../troubleshooting/index.md#saved-plan-verification-fails) starts with the most common pairing failure.
