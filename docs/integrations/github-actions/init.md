---
title: Init
description: Prepare the external Dialects and Policy Packs selected by a Rootform project before later GitHub Actions steps.
---

Use `rootform-dev/action/init@v1` to prepare project content before analysis,
checking or an offline step. It installs Rootform itself. Business Actions
prepare content when needed, so a separate init step is optional.

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

| Input | Default | Description |
| --- | --- | --- |
| `version` | Omitted | Exact published Rootform version; omit only to reuse an earlier Rootform Action step |
| `github-token` | `${{ github.token }}` | Optional GitHub API token for release rate limits; root comment uses it only when enabled |
| `project` | Omitted | Rootform project directory for raw evidence or Policy Pack selection; default workspace |
| `locked` | `false` | Require and preserve the project rootform.lock for analysis or Policy selection |
| `offline` | `false` | Prepare selected external content without network access |
| `cache` | `true` | Cache verified external Dialect and Policy Pack sources selected by the project lock |

## Outputs

| Output | Description |
| --- | --- |
| `version` | Exact verified Rootform CLI version |

Exact fields and defaults: [Action metadata](https://github.com/rootform-dev/action/blob/8b026e9c7268a960ed6f9b48ecea404180ddb151/init/action.yml).

<!-- END GENERATED ACTION -->
