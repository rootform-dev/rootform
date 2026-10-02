---
title: GitHub
description: Review architecture and Policy results in pull requests and workflow summaries, and keep the Form for reuse.
---

Bring architectural changes into the review where your team already works.
Rootform turns a completed plan or state export into a Form, presents its
architecture in the Job Summary, and can keep one Rootform comment current
on the pull request. Add Policies when the review also needs a gate.

## See the review

The report keeps changes and uncertainty together. This excerpt comes from
a [real Rootform PR comment](https://github.com/rootform-dev/action-qualification/pull/3#issuecomment-5954262030)
on a synthetic architecture:

**76 instances, 18 Relations, 68 Contexts, and 14 Contributions added.**

| Change | Instances | Relations | Contexts | Contributions |
| --- | :---: | :---: | :---: | :---: |
| + Added | 76 | 18 | 68 | 14 |
| − Removed | 0 | 0 | 0 | 0 |

**? Uncertainty**

| Stage | Indeterminate closures | Unavailable | Unknown until apply |
| --- | :---: | :---: | :---: |
| Planned | 27 | 26 | 1 |

Read the architecture report to see planned changes, reported drift and net
change when the input contains those stages. A comparison reviews two
architectures. Policy reports show their verdict and the facts behind it;
indeterminate evidence remains explicit. Long lists and audit provenance are
secondary to the review result.

## Quick start

Add this step after your existing job produces `plan.tfplan` and its `plan.json`
export. It also accepts
state JSON or a saved Form. Choose an exact [published Rootform version](https://github.com/rootform-dev/rootform/releases).

```yaml title="Step after your plan export"
- uses: rootform-dev/action@v1
  id: rootform
  with:
    version: 0.1.0
    input: ${{ runner.temp }}/plan.json
    plan-file: ${{ runner.temp }}/plan.tfplan
```

The Action installs and verifies Rootform, prepares any selected project
content, and produces the Form, Markdown review and self-contained Explorer
HTML. Job Summary and artifact upload are enabled by default. No separate
setup or init step is required.

Keep the matching saved plan beside its JSON export: the pairing is verified
and preserves evidence that the export alone cannot retain. Set `project: ./infra` when the
project's Rootform configuration is there. With a committed `rootform.lock`,
use `locked: true` to require and preserve that selection.
The [complete plan workflow](ci/github-actions-plan.yml) includes the export
step; [Review a pull request](../workflows/index.md) explains which evidence to
choose and how to read it.

Your planning step owns Terraform or OpenTofu and its credentials. Rootform
only reads completed evidence: it never runs either tool, executes providers,
or contacts clouds or backends. Pairing a saved plan must verify against its
JSON export. See [plan inputs](../inputs/plans.md).

## Compare and check

To compare two revisions, give the same Action both operands instead of
`input`. Each may be a plan, state or single-input Form:

```yaml title="Compare saved Forms and check the proposed architecture"
- uses: rootform-dev/action@v1
  id: rootform
  with:
    version: 0.1.0
    before: before/form.json
    after: after/form.json
    policy-pack: ./policies
    side: after
```

The example assumes `./policies` contains your Policy Pack. It produces a
Comparison Form and evaluates that Pack against
After. A Comparison Form can be reopened as `input`, but cannot be a
comparison operand. Saved Forms retain their evidence and selection; they
are reused without analyzing the original plan again.

For a single plan or state, add `policy-pack: ./policies` to the quick start
to analyze and check in one step. For project-selected Packs in a lock, use
`check: true`, optionally narrowed by `policy` selectors, instead of a local
Pack override. No Policies are selected implicitly. The
[Policy guide](../guides/check-with-policies.md) explains selection and verdicts.

When a check fails, Rootform publishes its available outputs, reports and
enabled review channels before failing the step. The Action preserves the
CLI's verdict; use GitHub's `continue-on-error` only when the workflow should
continue after that result.

## Keep and reuse the evidence

- **Step outputs** such as `${{ steps.rootform.outputs.form }}` are file paths
  for later steps in the same job. `report` and `html` expose the review and
  Explorer; a check also exposes `result`, `sarif` and `exit-code`.
- **Artifacts** keep the Form and derived reports for download or another job.
  Raw plans, state exports and saved binary plans are never uploaded by the
  Action. Default retention is seven days; use `upload-artifact: false` to
  disable upload. Default names avoid matrix collisions; make a custom
  `artifact-name` unique per invocation.
- **Job Summary** lets reviewers read the CLI reports from the workflow run.
  Use `summary: false` to disable it.

Download `explorer.html` to explore the same Form without installing Rootform.
For another job, download the artifact rather than reusing a runner-local
step path. Treat all derived evidence as architecture information: it still
reveals topology and names. Choose publication and retention for the audience
that can read the repository.

SARIF is retained as a Policy result artifact. GitHub code-scanning ingestion
is not qualified; this integration does not automatically upload it there.

## Add a PR comment

On GitHub.com, comments are opt-in. Add `comment: true` to the root Action step, grant the
reporter write permission, and serialize every job that can comment on that
PR with the same concurrency group:

```yaml title="Workflow permissions and reporter job"
permissions:
  contents: read
  actions: read
  pull-requests: write

jobs:
  review:
    runs-on: ubuntu-24.04
    concurrency:
      group: rootform-pr-${{ github.event.pull_request.number }}
      cancel-in-progress: false
    steps:
      # Checkout and export your input before this step.
      - uses: rootform-dev/action@v1
        with:
          version: 0.1.0
          input: ${{ runner.temp }}/plan.json
          plan-file: ${{ runner.temp }}/plan.tfplan
          comment: true
```

Use this reporter on `pull_request`. Rootform updates one comment and checks
the PR HEAD and run identity to keep an older run from replacing a newer
review. Shared concurrency is part of that protection. Without commenting,
normal workflows need only `contents: read`.

Fork PRs keep summaries and artifacts but skip comments. A fork may lack the
credentials needed to produce a plan; obtain that evidence in a trusted
planning context. Do not run untrusted PR code with secrets through
`pull_request_target`; Rootform's business Actions reject that event.
Public Rootform downloads need no separate token.

## Compose a custom workflow

Use the primitives when another step owns presentation or you need to reuse
installation or project preparation. Business Actions remain autonomous:

| Action | Use it to |
| --- | --- |
| [`setup@v1`](github-actions/setup.md) | Install and verify Rootform without analysis |
| [`init@v1`](github-actions/init.md) | Prepare a locked selection or warm content for an offline step |
| [`analyze@v1`](github-actions/analyze.md) | Produce or reopen a Form and export its reports |
| [`compare@v1`](github-actions/compare.md) | Compare two operands and retain the Comparison Form |
| [`check@v1`](github-actions/check.md) | Check a plan/state directly or reuse a Form/Comparison Form |

Analyze, compare and check produce Markdown and Job Summaries but never
comment on PRs. Setup installs Rootform; init prepares selected content.
The [integrated Action reference](github-actions/action.md) and the pages above
describe every input, default and output, with examples and usage conditions.
On GitLab, Azure Pipelines or a custom runner, use
[Other CI/CD](ci/README.md).
