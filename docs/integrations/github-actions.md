---
title: "GitHub Actions"
description: "Install an exact Rootform release, publish architecture evidence, and choose a policy gate."
---

Use the `setup` entrypoint when your workflow controls Rootform commands. It
installs and verifies the selected binary, but does not prepare project
content or run analysis. This complete workflow builds an embedded-only
project at `./infra` and keeps its Architecture IR:

```yaml title=".github/workflows/architecture.yml"
name: Architecture
on: [pull_request]
permissions:
  contents: read
jobs:
  architecture:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false
      - uses: rootform-dev/action/setup@71eef759bff5e73b27489b1f7de818a4a76dc2e9
        with:
          version: 0.1.0
      - name: Build architecture
        run: rootform build ./infra --format json --output architecture.json
      - name: Keep architecture
        if: ${{ !cancelled() }}
        uses: actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7.0.1
        with:
          name: rootform-architecture
          path: architecture.json
          if-no-files-found: warn
```

No lock or `init` is needed for this embedded-only build. For a project
with committed `infra/rootform.lock`, replace the build step with:

```yaml title="Locked project steps"
      - name: Prepare selected content
        run: rootform init ./infra --locked --no-input
      - name: Build architecture
        run: rootform build ./infra --locked --format json --output architecture.json
```

Run `rootform add` during project configuration and commit the lock; never
run it in CI. A selected Policy gate then uses `rootform check ./infra
--locked --format json --output policy.json` after the build. Install and
checkout may access the network even though analysis itself does not acquire
content. A build failure
still fails the job. Prepare referenced Terraform or OpenTofu modules before
the build if the project needs them.

To gate a known local pack at `./policies`, insert this step after the build,
then extend the artifact step's `path` list as shown. These are fragments for
the workflow above, not a second complete workflow:

```yaml title="Policy step to insert"
      - name: Check selected Policies
        run: rootform check ./infra --policy-pack ./policies --format json --output policy.json
```

```yaml title="Artifact path list to replace"
          path: |
            architecture.json
            policy.json
```

The artifact step's `if: ${{ !cancelled() }}` runs after a Policy violation, so
`policy.json` remains downloadable while the check's failure remains the job
result. If a pack is selected by `infra/rootform.lock`, use the locked project
steps above and check with `--locked`. Do not combine `--locked` with an
explicit `--policy-pack` override. For the portable script, including separate
diagnostics and an exact `check.status`, use [Run in
CI](ci/README.md#request-a-policy-gate) and the [complete GitHub
recipe](ci/github-actions.yml).

`check --format sarif --output policy.sarif` creates SARIF. Uploading that file
as a workflow artifact stores it for download. Sending it to GitHub code
scanning is a separate, permissioned operation, subject to repository
availability and GitHub's [SARIF upload requirements](https://docs.github.com/en/code-security/how-tos/find-and-fix-code-vulnerabilities/integrate-with-existing-tools/upload-sarif-file).
Do not grant `security-events: write` unless the workflow actually uploads to
code scanning.

## Use the integrated Action for a project Policy gate

The main Action installs Rootform, prepares project selection, builds JSON and
HTML, runs a Policy check, and publishes its own result files and Job Summary.
It always checks. Use it only when the project's reviewed `rootform.lock`
selects a Policy Pack with matching targets. It has no `policy-pack` input
for a one-off local pack and cannot be used as a build-only shortcut.

```yaml title="Integrated Action step"
      - uses: rootform-dev/action@71eef759bff5e73b27489b1f7de818a4a76dc2e9
        with:
          version: 0.1.0
          path: ./infra
          locked: true
```

This step belongs after checkout in a workflow with `contents: read`. The
Action's `locked` input requires an existing valid lock during preparation.
`offline: true` additionally forbids Rootform acquisition, so selected content
must already be local. The `cache` input defaults to `true`, and
`upload-artifact` defaults to `true`. The Action's fixed artifact contains
Architecture IR, HTML, policy JSON, and SARIF, not source, plans, or state.
It exposes `architecture`, `html`, `policy-json`, `sarif`, `exit-code`, and
artifact outputs. A confirmed violation exits `1` and fails by default.
`fail-on-violations: false` affects only status `1`; statuses `2` and `3`
still fail. Verify the evaluation count before accepting `0`.

For source Diff reporting, `report-diff: true` requires `baseline-path` to
name a second checkout. The Action compares that checkout with `path`, using
each revision's own project selection. `fail-on-changes` defaults to `false`,
so a completed Diff does not block every PR. Choose and record exact Before
and After commits as in [Review a pull request](../workflows/index.md#choose-the-revisions).
The default `pull_request` checkout may be a synthetic merge commit, not PR
head. `github.event.pull_request.head.sha` is PR head, while
`github.event.pull_request.base.sha` is target-branch head at event time.
Neither is automatically the merge base. For the Diff meaning and an
informational gate, see [Compare architectures](../guides/compare-architectures.md#use-exit-status-deliberately).

## Keep PR permissions narrow

The Action does not comment by default. On a same-repository `pull_request`,
request commenting explicitly with `pull-request-token` and
`pull-requests: write` only when the workflow and analyzed input are trusted
for that permission. Keep `contents: read` and checkout credentials disabled.
Do not pass a write token or privileged secret to a script from an untrusted
PR, or switch to `pull_request_target` to obtain more permissions. Fork PRs
normally have a read-only token and cannot be promised a comment. The Job
Summary and artifacts are the read-only review path. GitHub documents
[fork token limits](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#changing-the-permissions-in-a-forked-repository).

Artifacts should list only Rootform results. Never upload the workspace, raw
plans, state, or credentials. The integrated Action's published input and
output names are defined by its pinned
[action metadata](https://github.com/rootform-dev/action/blob/71eef759bff5e73b27489b1f7de818a4a76dc2e9/action.yml),
not by a CLI flag assumed to be an Action input.
