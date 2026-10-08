---
title: Overview
description: Explore, explain, compare, and check the architecture in your Terraform and OpenTofu plans and state.
tableOfContents: false
---

Rootform reads plan and state exports from Terraform or OpenTofu, then shows
the architecture they describe: which resources sit where and what connects
to what. Plans also show what changes.
The result is a [Form](concepts/forms.md), a saved file you can **explore** in a
browser, **question** from the terminal, **compare** with another revision, and
**check** against Policies.

<!-- rootform:video assets/explorer/explorer-tour "The Rootform Explorer on the commerce platform sample: selecting the prod resource group, opening it and its VNet, reading the evidence that places the prod_data subnet, then filtering the entries known only after apply" -->
![The Rootform Explorer on the commerce platform sample: four resource groups with their object counts and the relations between them, the Planned changes selector, and the filters counting added and indeterminate entries](assets/explorer/quickstart-overview-light.webp#gh-light-mode-only)
![The Rootform Explorer on the commerce platform sample: four resource groups with their object counts and the relations between them, the Planned changes selector, and the filters counting added and indeterminate entries](assets/explorer/quickstart-overview-dark.webp#gh-dark-mode-only)

Rootform reads the JSON that `terraform show -json` exports, from a saved plan
or from state. It never runs Terraform or OpenTofu, executes a provider, or
contacts a cloud account, so an export you already have is enough, even
offline. A state export gives a Recorded architecture: a snapshot of the
architecture recorded in state, which you explore, explain, save, and compare
like any other Form.

Every placement and connection it draws is a fact a Dialect Rule established
from that export, and you can ask for the evidence. When a value is unknown
until apply or the evidence is ambiguous, Rootform says so instead of guessing.

## Get started

<!-- rootform:directory -->
- [Quickstart](getting-started/quickstart.md)
  Open a sample Form in the Playground, read the evidence behind one placement, then run the same analysis locally.
- [Install Rootform](installation.md)
  Choose the method for your platform and verify the executable.
- [Analyze your plan or state](getting-started/analyze-your-plan.md)
  Export a completed plan and open its architecture, or open the architecture recorded in state.
- [Glossary](reference/glossary.md)
  Look up terms used in Forms, comparisons, Policy results, and project configuration.

## Work with a Form

<!-- rootform:directory -->
- [Explore a Form](guides/explore-architecture.md)
  Find a resource, read why it is placed or connected, and switch between stages.
- [Explain an architecture](guides/explain-architecture.md)
  Ask the terminal why an instance is placed, what a Rule established, and how a Policy decided.
- [Review planned changes](guides/review-planned-changes.md)
  Read what one plan proposes, what drift it reports, and the net change.
- [Compare two Forms](guides/compare-architectures.md)
  Review the architectural differences between two revisions.
- [Check a Form with Policies](guides/check-with-policies.md)
  Evaluate a Policy Pack, read the verdict, and keep the result for review.
- [Review a pull request](workflows/index.md)
  Bring the same evidence into a review and into CI.

## Use Rootform where you work

<!-- rootform:directory -->

- [GitHub](integrations/github-actions.md)
  Review architecture and Policies in your pull requests and Job Summaries; retain the Form for reuse.
- [VS Code](integrations/vscode.md)
  Author `.rf.hcl` with diagnostics, completion, hover, definitions and formatting.
- [Zed](integrations/zed.md)
  Use the same Rootform source feedback and navigation in Zed.
- [Other CI/CD](integrations/ci/README.md)
  Keep the same Form and review reports in GitLab, Azure Pipelines or a custom runner.

[Integrations](integrations/index.md) brings these workflows together.

## Understand the model

[How Rootform works](concepts.md) explains how instances, Rules, facts, and
closures fit together. [Forms and stages](concepts/forms.md) describes what a
saved Form keeps, and [Trace a placement](getting-started/first-architecture.md)
plans a VPC and a subnet to show how a saved plan settles a reference unknown
until apply. [Comparisons and drift](concepts/comparisons.md) keeps planned
changes, drift, and differences apart, and
[Dialects](concepts/dialects.md) explains where architectural meaning comes
from. Check [provider coverage](reference/provider-coverage.md) for interpreted types,
declared facts and compatibility before installation. Embedded Dialects need
no project configuration. Instances remain in the Form even outside interpretation
coverage; Rootform does not invent architectural meaning for them.

Use [outputs and exit status](reference/outputs.md) for automation,
[limitations](limitations.md) for evidence boundaries, and
[troubleshooting](troubleshooting/index.md) for failed operations.
