---
title: "Rootform documentation"
description: "Read, understand and review the architecture in your Terraform and OpenTofu configuration."
tableOfContents: false
---

Rootform builds an architecture from Terraform or OpenTofu. Explore it in your
browser, follow facts back to their source, compare changes and check selected
policies. Your configuration stays the source of truth.

## Get your first result

<!-- rootform:directory -->
- [Install Rootform](installation.md)
  Choose an executable for your system and verify the version.
- [Your first architecture](getting-started/first-architecture.md)
  Render a VPC and subnet. No cloud account, credentials or running infrastructure required.

## Use an existing project

From its Terraform or OpenTofu root:

```sh
rootform run .
```

Rootform prepares missing Dialects, records their selection in `rootform.lock`
and opens a local explorer. Read the proposal before confirming. The
[preparation guide](cli.md) explains what can change and how to automate it.

Rootform does not apply configuration, execute providers or verify deployed
infrastructure. Read [supported inputs](inputs/index.md) before moving to a
project with modules or plans.

## Understand what you see

<!-- rootform:directory -->
- [Read an architecture](renderer/index.md)
  Learn the visual grammar, then try Survey, Plan, Focus and Inspector.
- [Dialects](concepts/dialects.md)
  Understand why a declaration becomes a scope, entity or relation.
- [Architecture IR](concepts/architecture-ir.md)
  Follow a saved fact through its identity, source and evidence.
- [Rootform Language](language/index.md)
  Learn how `.rf` definitions create those facts and evaluate policies over them.
- [Diff](renderer/diff.md)
  See what changed, what remained the same and what cannot be determined.

[Explore Azure and multicloud examples](renderer/examples.md), including
Kubernetes workloads, Vault authentication and Grafana data sources.

## Check and reproduce a result

Use [Policies and Policy Packs](concepts/policies.md) to evaluate architecture
facts against rules you choose. Use [locks, vendor and offline operation](offline-security.md)
to control the inputs that make a result reproducible. A
[Terraform/OpenTofu plan](inputs/plans.md) can supply the evidence for a planned
architecture or comparison.

For an exact command or flag, open the [CLI reference](reference/cli/index.md).
For a failed operation, start with [troubleshooting](troubleshooting/index.md).
