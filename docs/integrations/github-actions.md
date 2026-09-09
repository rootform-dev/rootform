---
title: "GitHub Actions"
description: "Install an exact Rootform release and attach architecture evidence to a workflow or pull request."
---

The official Action installs a checksum-verified Rootform release and invokes
the CLI. It reports the CLI's results; it does not re-interpret Terraform or
compute its own architecture semantics.

## Install the CLI in a workflow

The setup entrypoint installs the binary for commands you control:

```yaml title=".github/workflows/architecture.yml"
name: Architecture
on: [pull_request]
permissions:
  contents: read
jobs:
  architecture:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1
        with:
          persist-credentials: false
      - uses: rootform-dev/action/setup@71eef759bff5e73b27489b1f7de818a4a76dc2e9
        with:
          version: 0.1.0
      - run: |
          rootform init ./infra --locked --no-input
          rootform build ./infra --locked --no-input --output architecture.json
          rootform check ./infra --locked --no-input --format sarif --output policy-result.sarif
```

This example assumes a prepared project in `infra` with a committed
`rootform.lock` containing reviewed Policy Packs. The first command can recover
exact missing packages; locked does not mean offline. Build and check outputs
remain local runner files until a later step uploads or publishes them.

## Let the Action run the analysis

The main entrypoint uses the same installer and adds a Job Summary and requested
outputs:

```yaml
- uses: rootform-dev/action@71eef759bff5e73b27489b1f7de818a4a76dc2e9
  with:
    version: 0.1.0
    path: ./infra
    locked: true
```

Select outputs and artifact behavior using the
[Action input reference](https://github.com/rootform-dev/action/blob/main/README.md).
The [portable CI guide](ci/README.md) covers equivalent commands on other systems.

## Pull-request reports

The Action's PR reporting is explicit and requires its documented event,
permissions, and inputs. Do not assume that an ordinary analysis step posts a
comment. Follow the
[PR reporting workflow](https://github.com/rootform-dev/action/blob/main/README.md#pull-request-architecture-review)
for the exact supported setup.

Use the `pull_request` event. Fork pull requests receive Summary and artifact
evidence without a write token. Do not switch to `pull_request_target` to grant
an untrusted contribution more privileges.

## Keep the evidence reproducible

Pin the CLI version and Action commit. Review and commit the Rootform lock.
Use `offline` only when the required local content has been supplied. GitHub
artifacts should contain selected Rootform results, not raw Terraform plans,
state, credentials, or the entire working directory.

A policy check with no selected policies is not a compliance review. Confirm
expected evaluation count and preserve indeterminate status `3`. Read
[Policies and Policy Packs](../concepts/policies.md) and
[outputs and exit status](../reference/outputs.md) before choosing your gate.
