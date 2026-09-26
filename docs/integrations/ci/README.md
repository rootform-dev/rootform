---
title: "Run in CI"
description: "Export a Terraform or OpenTofu plan and analyze it with Rootform in CI."
---

Plan with Terraform or OpenTofu first, then pass the JSON export to `rootform run`. Rootform does not use the producer credentials and never invokes the producer itself.

```sh
terraform init -input=false
terraform plan -input=false -out=plan.tfplan
terraform show -json plan.tfplan > plan.json
rootform run plan.json --plan-file plan.tfplan --require-enrichment --no-serve -o analysis.json -o report.md -o results.sarif
```

The saved plan must pair with its JSON export for traversal enrichment. If you only have JSON, omit `--plan-file` and `--require-enrichment`; unresolved values may limit facts. `--policy-pack ./policies` evaluates that Pack on the default planned stage. Exit `1` means violation, `3` means refused input or no determinate policy decision, and `4` means output failure.

The [portable CI script](rootform-ci.sh) takes `ROOTFORM_INPUT`, optional `ROOTFORM_PLAN_FILE`, `ROOTFORM_PROJECT`, optional `ROOTFORM_POLICY_PACK`, and a fresh `ROOTFORM_OUTPUT_DIR`. It writes a JSON document, Markdown report, SARIF log, text summary, stderr, and status. Keep producer plan files protected and exclude them from public artifacts. Use `tofu` instead of `terraform` for OpenTofu.

Provider initialization may need network or credentials. Rootform analysis reads the finished export and selected local content. See [Offline and security](../../offline-security.md) for package preparation.
