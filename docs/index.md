---
title: "Rootform documentation"
description: "Turn Terraform and OpenTofu into architecture you can inspect, explain, and review."
---

Rootform turns Terraform and OpenTofu into an architecture you can inspect in
your browser, save as a file, and compare in a review. It reads your configuration
without applying it. Dialects supply the meaning behind the picture.

## Start with a real architecture

[Install Rootform](installation.md), then [render your first architecture](getting-started/first-architecture.md).
The example is a VPC and subnet. You need no cloud account, credentials, or
running infrastructure.

Already have a project? From its Terraform or OpenTofu root, run:

```sh
rootform run .
```

Rootform prepares missing Dialects, records their exact selection in
`rootform.lock`, and starts a local browser explorer. Read the proposal before
confirming. [Understand project preparation](cli.md) before automating it.

## Read what the architecture means

Start with [the renderer](renderer/index.md) to navigate the result.
[Dialects](concepts/dialects.md) explain why a declaration becomes a scope,
entity, or relation. [Architecture IR](concepts/architecture-ir.md) explains
what a saved architecture contains and which evidence it preserves.

The diagram describes your declared architecture. It does not verify deployed
infrastructure or turn every Terraform dependency into an architecture relation.
Unknown and unsupported input remain explicit.

## Bring it into a review

[Compare architectures](renderer/diff.md), [use a Terraform or OpenTofu plan](inputs/plans.md),
or [run Rootform in GitHub Actions](integrations/github-actions.md).
Use [Policies and Policy Packs](concepts/policies.md) to evaluate the
architecture against governance rules you select.

## Find an exact answer

Use [CLI reference](reference/index.md) for commands and outputs,
[troubleshooting](troubleshooting/index.md) for failures, and
[locks and offline operation](offline-security.md) for reproducible runs.
[Contributions](contributing/index.md) to the public docs and Dialects are welcome.
