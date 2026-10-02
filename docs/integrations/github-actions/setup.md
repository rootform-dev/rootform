---
title: Setup
description: Install and verify an exact published Rootform CLI version for later steps in a GitHub Actions job.
---

Use `rootform-dev/action/setup@v1` when your next step runs Rootform directly.
Business Actions install it themselves, so setup is optional.

```yaml title="Install Rootform for CLI steps"
- uses: rootform-dev/action/setup@v1
  id: installation
  with:
    version: 0.1.0
- run: rootform version
```

Set an exact published `version`. Omit it only when an earlier Rootform Action
step in the same job already installed and verified a version. Setup verifies
the release checksum and executable version, then adds Rootform to `PATH`.
An unrelated executable already on `PATH` does not replace verification.

`version` and `sha256` are values: the installed version and executable digest.
Setup does not create `ROOTFORM_HOME`, prepare project content, analyze inputs,
produce reports or upload artifacts. Use [init](init.md) for preparation.

Public releases need no separate token; `github-token` is optional for API
rate limits and is not passed to Rootform. See
[runner and version requirements](action.md#installation-and-project-content).

<!-- BEGIN GENERATED ACTION -->

## Inputs

| Input | Default | Description |
| --- | --- | --- |
| `version` | Omitted | Exact published Rootform version; omit only to reuse an earlier Rootform Action step |
| `github-token` | `${{ github.token }}` | Optional GitHub API token for release rate limits; root comment uses it only when enabled |

## Outputs

| Output | Description |
| --- | --- |
| `version` | Exact verified Rootform CLI version |
| `sha256` | SHA-256 of the verified installed executable |

Exact fields and defaults: [Action metadata](https://github.com/rootform-dev/action/blob/8b026e9c7268a960ed6f9b48ecea404180ddb151/setup/action.yml).

<!-- END GENERATED ACTION -->
