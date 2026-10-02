---
title: Integrated Action
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
    version: 0.1.0
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
events comment; forks keep Summary/artifacts and skip comments. Business Actions
and init reject `pull_request_target`. Follow the
[comment example](../github-actions.md#add-a-pr-comment) and choose an audience
that may see the topology in Forms and reports.

<!-- BEGIN GENERATED ACTION -->

## Inputs

| Input | Default | Description |
| --- | --- | --- |
| `version` | Omitted | Exact published Rootform version; omit only to reuse an earlier Rootform Action step |
| `github-token` | `${{ github.token }}` | Optional GitHub API token for release rate limits; root comment uses it only when enabled |
| `project` | Omitted | Rootform project directory for raw evidence or Policy Pack selection; default workspace |
| `locked` | `false` | Require and preserve the project rootform.lock for analysis or Policy selection |
| `offline` | `false` | Prepare selected external content without network access |
| `cache` | `true` | Cache verified external Dialect and Policy Pack sources selected by the project lock |
| `input` | Omitted | Plan JSON, state JSON, or saved Form file |
| `plan-file` | Omitted | Optional saved binary plan paired with input; supplied pairing must verify |
| `before` | Omitted | Before operand: plan JSON, state JSON, or single-input Form |
| `after` | Omitted | After operand: plan JSON, state JSON, or single-input Form |
| `before-plan-file` | Omitted | Optional saved plan paired with before; supplied pairing must verify |
| `after-plan-file` | Omitted | Optional saved plan paired with after; supplied pairing must verify |
| `stage` | Omitted | Architecture stage to present or evaluate: planned, refreshed, recorded |
| `before-stage` | Omitted | Before architecture stage: planned, refreshed, recorded; CLI default when omitted |
| `after-stage` | Omitted | After architecture stage: planned, refreshed, recorded; CLI default when omitted |
| `side` | Omitted | Comparison sides to check: before, after, both; CLI default is both |
| `policy` | Omitted | Policy selectors, one per line; narrows explicitly selected Policy Packs |
| `policy-pack` | Omitted | Policy Pack source directories or compiled files, one path per line |
| `check` | `false` | Evaluate all project-selected Policies even without explicit selector or overlay |
| `summary` | `true` | Append CLI Markdown to GitHub Job Summary |
| `upload-artifact` | `true` | Persist only Form and derived reports as one GitHub artifact |
| `artifact-name` | Omitted | Optional stable artifact name; default is unique per invocation, including matrix jobs |
| `retention-days` | `7` | Artifact retention from 1 to 90 days, subject to repository limit |
| `comment` | `false` | Opt in to one current same-repository PR comment; requires serialized reporter job and write permission |

## Outputs

| Output | Description |
| --- | --- |
| `version` | Exact verified Rootform CLI version |
| `form` | Reusable same-job path to the Form; compare returns a Comparison Form |
| `report` | Reusable same-job path to complete CLI Markdown report |
| `html` | Reusable same-job path to self-contained HTML Explorer |
| `result` | Reusable same-job path to Policy result JSON |
| `sarif` | Reusable same-job path to Policy result SARIF |
| `exit-code` | Exact Rootform check exit code, published before applying its gate |
| `artifact-id` | Uploaded GitHub artifact ID for cross-job download |
| `artifact-url` | Uploaded GitHub evidence artifact URL |

Exact fields and defaults: [Action metadata](https://github.com/rootform-dev/action/blob/8b026e9c7268a960ed6f9b48ecea404180ddb151/action.yml).

<!-- END GENERATED ACTION -->
