---
title: Init
description: Prepare the external Dialects and Policy Packs selected by a Rootform project before later GitHub Actions steps.
---

Use `rootform-dev/action/init@v1` to prepare project content before analysis,
checking or an offline step. It installs Rootform itself. The `analyze`,
`compare`, and `check` Actions install Rootform and prepare selected content
when needed, so a separate init step is optional.

```yaml title="Prepare an existing locked project"
- uses: rootform-dev/action/init@v1
  with:
    version: 0.1.0
    project: ./infra
    locked: true
```

The example requires `infra/rootform.lock`. `project` defaults to the workspace;
`locked: true` requires and preserves the existing lock. The Action never
creates or edits it. It prepares only external Dialect and Policy Pack sources,
not Terraform modules, plans or provider credentials.

Later Rootform steps share the job's `ROOTFORM_HOME`. The default cache retains
only external source payloads selected by that lock, and restored content is
verified again. `offline: true` prepares verified local content only; it does
not prevent a required CLI installation download. Use a prior setup step when
installation must happen before the offline phase.

Init's only output is `version`. It produces no Form, report, Summary, artifact
or PR comment. It rejects `pull_request_target` before installation. See
[installation and project content](action.md#installation-and-project-content).

<!-- BEGIN GENERATED ACTION -->

## Inputs

Type describes accepted values. GitHub passes all inputs as strings. `bool` accepts `true` or `false`. An empty default leaves the input unset.

| Input | Type | Default | Description |
| --- | --- | --- | --- |
| `version` | `string` | `""` | Exact published version; omit to reuse a verified version in this job |
| `github-token` | `string` | `${{ github.token }}` | GitHub token for release API requests |
| `project` | `string` | `""` | Project directory for raw evidence or Policy selection; defaults to workspace |
| `locked` | `bool` | `false` | Require and preserve existing rootform.lock |
| `offline` | `bool` | `false` | Prepare selected external content without network access |
| `cache` | `bool` | `true` | Cache verified external sources selected by rootform.lock |

## Outputs

| Output | Description |
| --- | --- |
| `version` | Verified Rootform CLI version |

Exact fields and defaults: [Action metadata](https://github.com/rootform-dev/action/blob/5d4888cf30e59f121f9204d2428006838d15c887/init/action.yml).

<!-- END GENERATED ACTION -->
