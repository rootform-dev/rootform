---
title: "GitHub Actions"
description: "Analyze a Terraform or OpenTofu plan in a pull request workflow."
---

The [plan workflow](ci/github-actions-plan.yml) exports a saved Terraform plan and its JSON, then passes both to `rootform run`. Rootform does not start Terraform and needs no producer credentials. The saved plan verifies against its JSON export before traversal evidence is used.

```yaml
- name: Analyze plan
  run: |
    rootform run "$RUNNER_TEMP/plan.json" \
      --plan-file "$RUNNER_TEMP/plan.tfplan" \
      --require-enrichment --project ./infra --no-serve \
      -o analysis.json -o report.md -o results.sarif
```

Add `--policy-pack ./policies` to evaluate a Pack. A violation exits `1`; indeterminate or unevaluated selection exits `3`. Keep the producer plan and JSON out of public artifacts because they may contain secrets. The JSON, Markdown, and SARIF outputs from Rootform contain sanitized architecture and policy evidence.

The [portable script](ci/rootform-ci.sh) writes results into a fresh directory so a failed run cannot expose stale files. [Run in CI](ci/README.md) covers inputs, status, and OpenTofu substitution. The integrated Action consumes a published Rootform release; see its own input contract when choosing that path.
