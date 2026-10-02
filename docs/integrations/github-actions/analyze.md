---
title: Analyze
description: Produce or reopen a Form and export architecture Markdown and Explorer HTML in GitHub Actions.
---

Use `rootform-dev/action/analyze@v1` when you need a Form and architecture
reports without comparison or a Policy gate. It installs and verifies Rootform
and prepares required project content itself; setup and init are optional.

```yaml title="Analyze a completed plan export"
- uses: rootform-dev/action/analyze@v1
  id: analysis
  with:
    version: 0.1.0
    input: ${{ runner.temp }}/plan.json
    plan-file: ${{ runner.temp }}/plan.tfplan
```

`input` is required and accepts plan JSON, state JSON, a Form or a Comparison
Form. Pair a raw plan with its matching saved plan; supplied pairing must
verify. Omit `plan-file` for state and saved Forms. A saved Form is reused with
its original path and bytes; it is not analyzed again. `stage` selects an
available architecture stage where applicable; Rootform supplies the default.

`form`, `report` and `html` are file paths for later steps in this job.
The `form` output preserves the supplied Form or exposes the generated Form.
Summary and artifact upload default to on. Artifacts contain the Form and
derived reports, never raw inputs. This primitive never comments on a PR.

See the integrated reference for [installation, version and project content](action.md#installation-and-project-content)
and [permissions, artifact retention and publication](action.md#outputs-and-publication).
Use [compare](compare.md) for two operands or [check](check.md) for Policies.

<!-- BEGIN GENERATED ACTION -->

## Inputs

| Input | Default | Description |
| --- | --- | --- |
| `version` | Omitted | Exact published Rootform version; omit only to reuse an earlier Rootform Action step |
| `github-token` | `${{ github.token }}` | Optional GitHub API token for release rate limits; root comment uses it only when enabled |
| `input` | Omitted | Plan JSON, state JSON, or saved Form file |
| `plan-file` | Omitted | Optional saved binary plan paired with input; supplied pairing must verify |
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
| `report` | Reusable same-job path to complete CLI Markdown report |
| `html` | Reusable same-job path to self-contained HTML Explorer |
| `artifact-id` | Uploaded GitHub artifact ID for cross-job download |
| `artifact-url` | Uploaded GitHub evidence artifact URL |

Exact fields and defaults: [Action metadata](https://github.com/rootform-dev/action/blob/8b026e9c7268a960ed6f9b48ecea404180ddb151/analyze/action.yml).

<!-- END GENERATED ACTION -->
