---
title: Setup
description: Install and verify an exact published Rootform CLI version for later steps in a GitHub Actions job.
---

Use `rootform-dev/action/setup@v1` when your next step runs Rootform directly.
The `analyze`, `compare`, and `check` Actions install it themselves, so setup
is optional.

```yaml title="Install Rootform for CLI steps"
- uses: rootform-dev/action/setup@v1
  id: installation
  with:
    version: 0.2.0
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

Type describes accepted values. GitHub passes all inputs as strings. An empty default leaves the input unset.

| Input | Type | Default | Description |
| --- | --- | --- | --- |
| `version` | `string` | `""` | Exact published version; omit to reuse a verified version in this job |
| `github-token` | `string` | `${{ github.token }}` | GitHub token for release API requests |

## Outputs

| Output | Description |
| --- | --- |
| `version` | Verified Rootform CLI version |
| `sha256` | SHA-256 of the verified executable |

Exact fields and defaults: [Action metadata](https://github.com/rootform-dev/action/blob/5d4888cf30e59f121f9204d2428006838d15c887/setup/action.yml).

<!-- END GENERATED ACTION -->
