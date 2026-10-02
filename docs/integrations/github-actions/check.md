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
    version: 0.1.0
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

| Input | Default | Description |
| --- | --- | --- |
| `version` | Omitted | Exact published Rootform version; omit only to reuse an earlier Rootform Action step |
| `github-token` | `${{ github.token }}` | Optional GitHub API token for release rate limits; root comment uses it only when enabled |
| `input` | Omitted | Plan JSON, state JSON, or saved Form file |
| `plan-file` | Omitted | Optional saved binary plan paired with input; supplied pairing must verify |
| `policy` | Omitted | Policy selectors, one per line; narrows explicitly selected Policy Packs |
| `policy-pack` | Omitted | Policy Pack source directories or compiled files, one path per line |
| `side` | Omitted | Comparison sides to check: before, after, both; CLI default is both |
| `stage` | Omitted | Architecture stage to present or evaluate: planned, refreshed, recorded |
| `project` | Omitted | Rootform project directory for raw evidence or Policy Pack selection; default workspace |
| `locked` | `false` | Require and preserve the project rootform.lock for analysis or Policy selection |
| `offline` | `false` | Prepare selected external content without network access |
| `cache` | `true` | Cache verified external Dialect and Policy Pack sources selected by the project lock |
| `summary` | `true` | Append CLI Markdown to GitHub Job Summary |
| `upload-artifact` | `true` | Persist only Form and derived reports as one GitHub artifact |
| `artifact-name` | Omitted | Optional stable artifact name; default is unique per invocation, including matrix jobs |
| `retention-days` | `7` | Artifact retention from 1 to 90 days, subject to repository limit |

## Outputs

| Output | Description |
| --- | --- |
| `version` | Exact verified Rootform CLI version |
| `form` | Reusable same-job path to the Form; compare returns a Comparison Form |
| `result` | Reusable same-job path to Policy result JSON |
| `report` | Reusable same-job path to complete CLI Markdown report |
| `sarif` | Reusable same-job path to Policy result SARIF |
| `exit-code` | Exact Rootform check exit code, published before applying its gate |
| `artifact-id` | Uploaded GitHub artifact ID for cross-job download |
| `artifact-url` | Uploaded GitHub evidence artifact URL |

Exact fields and defaults: [Action metadata](https://github.com/rootform-dev/action/blob/8b026e9c7268a960ed6f9b48ecea404180ddb151/check/action.yml).

<!-- END GENERATED ACTION -->
