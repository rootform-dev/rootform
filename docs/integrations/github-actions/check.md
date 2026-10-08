---
title: Check
description: Check a plan or state directly, or reuse a Form or Comparison Form, against selected Policies in GitHub Actions.
---

Use `rootform-dev/action/check@v1` to evaluate Policies and gate a job. It can
produce the Form from a raw plan or state before checking; no analyze step is
required. A supplied Form or Comparison Form is reused without new analysis.

```yaml title="Check a plan directly"
- uses: rootform-dev/action/check@v1
  id: checks
  with:
    version: 0.2.0-rc.1
    input: ${{ runner.temp }}/plan.json
    plan-file: ${{ runner.temp }}/plan.tfplan
    policy-pack: ./policies/team
```

`input` is required. Pair a raw plan with its matching saved plan; omit
`plan-file` for state and saved Forms. The example assumes a Policy Pack at
`./policies/team`. `policy-pack` accepts source directories or compiled files,
one path per line. `policy` accepts selectors, one per line, and can narrow
explicitly selected Packs. Without these overrides, check evaluates the
project-selected Policies. No Pack is selected implicitly.

For a Comparison Form, `side` accepts `before`, `after` or `both`; the CLI
default is `both`. `stage` selects an architecture stage where applicable.
Rootform validates these combinations and owns every verdict. See
[Policy selection](../../guides/check-with-policies.md) and
[Policy outcomes](../../guides/check-architecture.md).

`form` exposes the reused or produced Form path. `result`, `report` and `sarif`
are the Policy result, Markdown and SARIF file paths; `exit-code` is the exact
CLI check exit code. Available outputs, Summary and artifacts are published
before a negative gate fails the step. Use GitHub's `continue-on-error` when
later workflow steps should continue; it does not change the verdict.
Summary and upload default to on. This primitive never comments on a PR.

See [installation, version and project content](action.md#installation-and-project-content)
and [permissions, artifact retention and publication](action.md#outputs-and-publication).

<!-- BEGIN GENERATED ACTION -->

## Inputs

Type describes accepted values. GitHub passes all inputs as strings. `bool` accepts `true` or `false`. `int` accepts a whole number. An empty default leaves the input unset.

| Input | Type | Default | Description |
| --- | --- | --- | --- |
| `version` | `string` | `""` | Exact published version; omit to reuse a verified version in this job |
| `github-token` | `string` | `${{ github.token }}` | GitHub token for release API requests |
| `input` | `string` | `""` | Path to plan JSON, state JSON, Form or Comparison Form |
| `plan-file` | `string` | `""` | Matching saved plan for input; pairing must verify |
| `policy` | `string` | `""` | Policy selectors, one per line, within selected Packs |
| `policy-pack` | `string` | `""` | Policy Pack source directories or compiled files, one per line |
| `side` | `string` | `""` | Comparison sides: before, after or both; defaults to both |
| `stage` | `string` | `""` | Architecture stage: planned, refreshed or recorded |
| `project` | `string` | `""` | Project directory for raw evidence or Policy selection; defaults to workspace |
| `locked` | `bool` | `false` | Require and preserve existing rootform.lock |
| `offline` | `bool` | `false` | Prepare selected external content without network access |
| `cache` | `bool` | `true` | Cache verified external sources selected by rootform.lock |
| `summary` | `bool` | `true` | Append CLI Markdown to GitHub Job Summary |
| `upload-artifact` | `bool` | `true` | Upload Form and derived reports as one artifact; never raw inputs |
| `artifact-name` | `string` | `""` | Artifact name; defaults to a unique name per invocation, including matrix jobs |
| `retention-days` | `int` | `7` | Artifact retention: 1–90 days, capped by repository limit |

## Outputs

| Output | Description |
| --- | --- |
| `version` | Verified Rootform CLI version |
| `form` | Path to the supplied or generated Form |
| `result` | Path to Policy result JSON |
| `report` | Path to the complete CLI Markdown report |
| `sarif` | Path to Policy result SARIF |
| `exit-code` | Rootform check exit code, exposed before the gate |
| `artifact-id` | Uploaded artifact ID for cross-job download |
| `artifact-url` | Uploaded artifact URL |

Exact fields and defaults: [Action metadata](https://github.com/rootform-dev/action/blob/5d4888cf30e59f121f9204d2428006838d15c887/check/action.yml).

<!-- END GENERATED ACTION -->
