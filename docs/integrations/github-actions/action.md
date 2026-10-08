---
title: Action
description: Analyze or compare evidence, check Policies and publish a Rootform review in one GitHub Actions step.
---

Use `rootform-dev/action@v1` for the complete review: a Form, architecture
Markdown, Explorer HTML, Job Summary and downloadable evidence. Add Policies
for a gate and opt in to a PR comment when reviewers need the report there.
Start with the [GitHub quick start](../github-actions.md#quick-start).

## Choose the evidence

Provide either `input` or both `before` and `after`, never both modes.
`input` accepts plan JSON, state JSON, a Form or a Comparison Form.
Each comparison operand accepts plan JSON, state JSON or a single-input Form;
a Comparison Form cannot be an operand. Saved Forms are reopened without
reinterpreting the original exports.

```yaml title="Review a plan and check a local Policy Pack"
- uses: rootform-dev/action@v1
  id: rootform
  with:
    version: 0.2.0-rc.1
    input: ${{ runner.temp }}/plan.json
    plan-file: ${{ runner.temp }}/plan.tfplan
    policy-pack: ./policies/team
```

The example assumes your planning step has exported the saved plan and
`./policies/team` contains a Policy Pack. Rootform verifies the plan pairing.
For comparison, replace the input pair with `before` and `after`, pairing
each raw plan with `before-plan-file` or `after-plan-file`.

`check: true` evaluates project-selected Policies; `policy` narrows an explicit
selection and `policy-pack` supplies local Packs. Selectors and Pack paths
accept one value per line. No Pack is selected implicitly. `stage` selects a
single architecture; `before-stage` and `after-stage` select comparison stages.
`side` applies to a Comparison Form check and defaults to `both`.
See [Policy selection](../../guides/check-with-policies.md).

## Installation and project content

Set an exact published `version`; `latest` and version ranges are not accepted.
Omit it only after an earlier Rootform Action step in the same job installed
and verified a version. An unrelated executable on `PATH` is not reused.
Release archive checksum and executable version are verified. Public releases
need no separate token; `github-token` can increase GitHub API rate limits.
It is not passed to Rootform. All entrypoints use Node 24 and require Actions
Runner 2.327.1 or newer.

`project` locates Rootform configuration for raw evidence or Policy selection;
it defaults to the workspace. Reopening a Form preserves its evidence and
selection. `locked: true` requires and preserves an existing `rootform.lock`.
The Action never creates or edits that lock.

The job shares `ROOTFORM_HOME` between Rootform steps. The default cache retains
only external Dialect and Policy Pack sources selected by the lock; restored
content is verified again. `offline: true` prepares verified local content
without network access. It does not prevent installation from downloading
the CLI when no earlier verified Rootform step is available.
Rootform never runs Terraform/OpenTofu, providers, clouds or backends.

## Outputs and publication

`form`, `report` and `html` are paths usable by later steps in the same job.
`form` contains a Comparison Form when comparing. When a check runs, `result`,
`sarif` and `exit-code` are also available. Unproduced outputs are empty.
`version` and `exit-code` are values; no Form or report body enters step outputs.

Summary and artifact upload default to on. Artifacts persist the Form and
derived reports for download or another job; raw plans, states and saved binary
plans are never uploaded. `artifact-id` and `artifact-url` exist only after
upload. Retention defaults to seven days, accepts 1–90 days, and is capped by
the repository limit. Default names avoid matrix collisions; a custom
`artifact-name` must be unique per invocation. On GitHub Enterprise Server,
disable this artifact transport with `upload-artifact: false`.

Available evidence is published before applying a nonzero check exit code.
Use step-level `continue-on-error` if later workflow steps should continue.
SARIF is a retained result file; this Action does not upload code-scanning results.

Normal use needs `contents: read`. A PR comment needs `comment: true`,
`pull-requests: write`, `actions: read`, and shared job-level concurrency keyed
by PR number with cancellation disabled. Only same-repository `pull_request`
events comment; forks keep Summary/artifacts and skip comments. On GitHub
Enterprise Server, leave `comment` off. The `analyze`,
`compare`, and `check` Actions, along with the `init` Action, reject
`pull_request_target`. Follow the
[comment example](../github-actions.md#add-a-pr-comment) and choose an audience
that may see the topology in Forms and reports.

<!-- BEGIN GENERATED ACTION -->

## Inputs

Type describes accepted values. GitHub passes all inputs as strings. `bool` accepts `true` or `false`. `int` accepts a whole number. An empty default leaves the input unset.

| Input | Type | Default | Description |
| --- | --- | --- | --- |
| `version` | `string` | `""` | Exact published version; omit to reuse a verified version in this job |
| `github-token` | `string` | `${{ github.token }}` | GitHub token for release API requests and enabled PR comments |
| `project` | `string` | `""` | Project directory for raw evidence or Policy selection; defaults to workspace |
| `locked` | `bool` | `false` | Require and preserve existing rootform.lock |
| `offline` | `bool` | `false` | Prepare selected external content without network access |
| `cache` | `bool` | `true` | Cache verified external sources selected by rootform.lock |
| `input` | `string` | `""` | Path to plan JSON, state JSON, Form or Comparison Form |
| `plan-file` | `string` | `""` | Matching saved plan for input; pairing must verify |
| `before` | `string` | `""` | Before plan JSON, state JSON or single-input Form |
| `after` | `string` | `""` | After plan JSON, state JSON or single-input Form |
| `before-plan-file` | `string` | `""` | Matching saved plan for before; pairing must verify |
| `after-plan-file` | `string` | `""` | Matching saved plan for after; pairing must verify |
| `stage` | `string` | `""` | Architecture stage: planned, refreshed or recorded |
| `before-stage` | `string` | `""` | Before stage: planned, refreshed or recorded |
| `after-stage` | `string` | `""` | After stage: planned, refreshed or recorded |
| `side` | `string` | `""` | Comparison sides: before, after or both; defaults to both |
| `policy` | `string` | `""` | Policy selectors, one per line, within selected Packs |
| `policy-pack` | `string` | `""` | Policy Pack source directories or compiled files, one per line |
| `check` | `bool` | `false` | Check all project-selected Policies without explicit selectors or overlays |
| `summary` | `bool` | `true` | Append CLI Markdown to GitHub Job Summary |
| `upload-artifact` | `bool` | `true` | Upload Form and derived reports as one artifact; never raw inputs |
| `artifact-name` | `string` | `""` | Artifact name; defaults to a unique name per invocation, including matrix jobs |
| `retention-days` | `int` | `7` | Artifact retention: 1–90 days, capped by repository limit |
| `comment` | `bool` | `false` | Update one same-repository PR comment; requires write permission and job serialization |

## Outputs

| Output | Description |
| --- | --- |
| `version` | Verified Rootform CLI version |
| `form` | Path to the supplied or generated Form |
| `report` | Path to the complete CLI Markdown report |
| `html` | Path to the self-contained HTML Explorer |
| `result` | Path to Policy result JSON |
| `sarif` | Path to Policy result SARIF |
| `exit-code` | Rootform check exit code, exposed before the gate |
| `artifact-id` | Uploaded artifact ID for cross-job download |
| `artifact-url` | Uploaded artifact URL |

Exact fields and defaults: [Action metadata](https://github.com/rootform-dev/action/blob/5d4888cf30e59f121f9204d2428006838d15c887/action.yml).

<!-- END GENERATED ACTION -->
