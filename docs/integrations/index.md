---
title: Integrations
description: Review architecture in GitHub, author Rootform source in your editor, and keep Forms in CI/CD.
---

Use Rootform where you review changes and write source. A Form remains the
saved architecture evidence across these tools: GitHub presents its reports,
CI retains it for reuse, and the Explorer provides an interactive view of it.
Editor integrations help you author the Dialects and Policies that give that
evidence meaning.

## Choose your workflow

<!-- rootform:directory -->

- [GitHub](github-actions.md)
  Review architecture and Policy results in Job Summaries and optional PR comments; keep the Form and Explorer as artifacts.
- [VS Code](vscode.md)
  Write `.rf.hcl` with diagnostics, completion, hover, definitions and formatting.
- [Zed](zed.md)
  Use the same Rootform authoring features in Zed.
- [Other CI/CD](ci/README.md)
  Analyze completed evidence, retain Forms and reports, and apply an explicit Policy gate in GitLab, Azure Pipelines or another runner.

## Start from the evidence you have

Plan and state exports are sources of evidence. A saved Form lets you reopen
or compare the architecture without analyzing those inputs again. Rootform
never runs Terraform or OpenTofu, executes providers, or contacts clouds
during analysis. Unknown or ambiguous evidence stays explicit in the result.

For the review itself, follow [Review a pull request](../workflows/index.md).
For source authoring, follow [Edit Rootform source](../language/editors.md),
then [test and validate](../language/test-validate.md).
