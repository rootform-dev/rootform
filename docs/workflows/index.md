---
title: "Git and team workflows"
description: "Choose a reproducible review workflow for local Git changes, CI, and pull requests."
---

A useful review preserves the input revision, exact semantic selection, and
the output being discussed. Commit `rootform.lock`; choose the artifacts your
reviewers need.

## Local Git changes

Build before and after architectures using the same Dialect versions, then
compare the saved files. Separate checkouts let you retain both revisions
without modifying the working copy under review. A changed Dialect selection
requires explicit review before treating the comparison as equivalent.

## Pull requests

Decide whether the question is a source change or a planned infrastructure
change. Use architecture Diff for the former and [plan input](../inputs/plans.md)
for the latter. Neither replaces review of the Terraform/OpenTofu plan itself.

The [GitHub Action](../integrations/github-actions.md) can produce review
artifacts and an explicit PR report. Permissions and event choice matter:
a privileged reporting step must not execute untrusted infrastructure code.

## CI and artifacts

[Portable CI examples](../integrations/ci/README.md) use a verified binary,
a committed lock, and explicit non-interactive preparation. The
[official container](../integrations/oci-image.md) offers the same CLI contract
where your runner expects an image.

An HTML file is useful for human review; JSON supports another tool; SARIF
presents policy findings. Read [outputs and exit status](../reference/outputs.md)
before choosing a job gate. Architecture artifacts can still disclose system
structure, so apply your repository's access and retention rules.
