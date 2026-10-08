---
title: Compare
description: Compare two plan, state or Form operands and retain one Comparison Form in GitHub Actions.
---

Use `rootform-dev/action/compare@v1` to review architectural differences between
two sets of evidence. It installs Rootform and prepares required content;
setup, init and separate analyze steps are optional.

```yaml title="Compare two completed plans"
- uses: rootform-dev/action/compare@v1
  id: comparison
  with:
    version: 0.1.0
    before: ${{ runner.temp }}/before/plan.json
    before-plan-file: ${{ runner.temp }}/before/plan.tfplan
    after: ${{ runner.temp }}/after/plan.json
    after-plan-file: ${{ runner.temp }}/after/plan.tfplan
```

Both `before` and `after` are required. Each accepts plan JSON, state JSON or a
single-input Form; a Comparison Form cannot be an operand. Each supplied saved
plan must verify against its own JSON export. Omit the saved-plan input on a
state or Form side. `before-stage` and `after-stage` choose available stages;
Rootform supplies their defaults.

`form` is the Comparison Form, which embeds both architectures. There are no
separate before/after Form outputs. `report` and `html` present that same Form;
all three outputs are same-job paths. Reopen it with [analyze](analyze.md) or
evaluate its Policies with [check](check.md). Summary and artifact upload
default to on; the primitive never comments on a PR.

See [installation, version and project content](action.md#installation-and-project-content)
and [permissions, artifact retention and publication](action.md#outputs-and-publication).

<!-- BEGIN GENERATED ACTION -->

## Inputs

Type describes accepted values. GitHub passes all inputs as strings. `bool` accepts `true` or `false`. `int` accepts a whole number. An empty default leaves the input unset.

| Input | Type | Default | Description |
| --- | --- | --- | --- |
| `version` | `string` | `""` | Exact published version; omit to reuse a verified version in this job |
| `github-token` | `string` | `${{ github.token }}` | GitHub token for release API requests |
| `before` | `string` | `""` | Before plan JSON, state JSON or single-input Form |
| `after` | `string` | `""` | After plan JSON, state JSON or single-input Form |
| `before-plan-file` | `string` | `""` | Matching saved plan for before; pairing must verify |
| `after-plan-file` | `string` | `""` | Matching saved plan for after; pairing must verify |
| `before-stage` | `string` | `""` | Before stage: planned, refreshed or recorded |
| `after-stage` | `string` | `""` | After stage: planned, refreshed or recorded |
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
| `form` | Path to the generated Comparison Form |
| `report` | Path to the complete CLI Markdown report |
| `html` | Path to the self-contained HTML Explorer |
| `artifact-id` | Uploaded artifact ID for cross-job download |
| `artifact-url` | Uploaded artifact URL |

Exact fields and defaults: [Action metadata](https://github.com/rootform-dev/action/blob/5d4888cf30e59f121f9204d2428006838d15c887/compare/action.yml).

<!-- END GENERATED ACTION -->
