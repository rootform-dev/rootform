---
title: "Run Rootform in CI"
description: "Reproduce architecture builds, Diffs, and policy gates in a non-interactive runner."
---

CI should reproduce the semantics reviewed locally: pin Rootform, commit
`rootform.lock`, and disable prompts. A typical project job is:

```text
verified exact Rootform binary or image
→ rootform init . --locked --no-input
→ rootform build . --locked --no-input
→ rootform check . --locked --no-input
```

Copy [`rootform-ci.sh`](rootform-ci.sh) to `ci/rootform-ci.sh`. It requires
committed `rootform.lock`, writes deterministic JSON under `.rootform-ci/`, and
does not prompt or update selection.

- Connected locked job may download exact artifacts pinned by lock.
- Vendored job sets `ROOTFORM_OFFLINE=1`; `.rootform/dialects/` and, when
  selected, `.rootform/policy-packs/` become exclusive. No store, index, or
  registry fallback exists for a present vendor family.
- `ROOTFORM_PROJECT` selects project directory and defaults to literal `.`.
- `ROOTFORM_BIN` selects already verified executable and defaults to
  `rootform`.

The script builds Architecture IR and runs selected policies. Status `1` means a
policy violation; status `3` means evaluation was indeterminate or required
evidence was unavailable. Check policy and evaluation counts before accepting
status `0`. Use [Diff in review](../../renderer/diff.md#use-diff-in-local-and-pull-request-review)
when the job compares revisions or both sides of a plan.

Examples:

- [GitHub Actions](github-actions.yml) installs exact release through
  checksum-verifying setup Action.
- [GitLab CI](gitlab-ci.yml) and
  [Azure Pipelines](azure-pipelines.yml) use exact official image tag.
- [Generic CI](generic-ci.sh) assumes exact checksum-verified binary is already
  on `PATH`.

For private image, Dialect, or Policy Pack repositories, configure the runner's
Docker credential file or helper. Rootform uses standard `DOCKER_CONFIG`; the CI
example never places credentials in arguments, locks, output, or vendor content.
