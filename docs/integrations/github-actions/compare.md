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

| Input | Default | Description |
| --- | --- | --- |
| `version` | Omitted | Exact published Rootform version; omit only to reuse an earlier Rootform Action step |
| `github-token` | `${{ github.token }}` | Optional GitHub API token for release rate limits; root comment uses it only when enabled |
| `before` | Omitted | Before operand: plan JSON, state JSON, or single-input Form |
| `after` | Omitted | After operand: plan JSON, state JSON, or single-input Form |
| `before-plan-file` | Omitted | Optional saved plan paired with before; supplied pairing must verify |
| `after-plan-file` | Omitted | Optional saved plan paired with after; supplied pairing must verify |
| `before-stage` | Omitted | Before architecture stage: planned, refreshed, recorded; CLI default when omitted |
| `after-stage` | Omitted | After architecture stage: planned, refreshed, recorded; CLI default when omitted |
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

Exact fields and defaults: [Action metadata](https://github.com/rootform-dev/action/blob/8b026e9c7268a960ed6f9b48ecea404180ddb151/compare/action.yml).

<!-- END GENERATED ACTION -->
