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
    version: 0.2.0
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

Type describes accepted values. GitHub passes all inputs as strings. `bool` accepts `true` or `false`. `int` accepts a whole number. An empty default leaves the input unset.

| Input | Type | Default | Description |
| --- | --- | --- | --- |
| `version` | `string` | `""` | Exact published version; omit to reuse a verified version in this job |
| `github-token` | `string` | `${{ github.token }}` | GitHub token for release API requests |
| `input` | `string` | `""` | Path to plan JSON, state JSON, Form or Comparison Form |
| `plan-file` | `string` | `""` | Matching saved plan for input; pairing must verify |
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
| `report` | Path to the complete CLI Markdown report |
| `html` | Path to the self-contained HTML Explorer |
| `artifact-id` | Uploaded artifact ID for cross-job download |
| `artifact-url` | Uploaded artifact URL |

Exact fields and defaults: [Action metadata](https://github.com/rootform-dev/action/blob/5d4888cf30e59f121f9204d2428006838d15c887/analyze/action.yml).

<!-- END GENERATED ACTION -->
