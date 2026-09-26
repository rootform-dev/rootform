---
title: "Your first architecture"
description: "Analyze a saved Terraform or OpenTofu plan and inspect the resulting architecture."
---

Start in a Terraform or OpenTofu project with a valid configuration and provider credentials for planning. Rootform reads the plan export; planning remains a separate producer step.

```sh
terraform init
terraform plan -out=plan.tfplan
terraform show -json plan.tfplan > plan.json
rootform init . --no-input
rootform run plan.json --plan-file plan.tfplan
```

The browser opens a loopback view of the `planned` stage. Select a representation to inspect its Rule, Contexts, Relations, Contributions, closures, and evidence. A relation exists only where an active Dialect emitted it. Unknown or sensitive endpoint evidence remains unresolved rather than becoming a guessed edge.

Save the validated document and a portable report from the same analysis:

```sh
rootform run plan.json --plan-file plan.tfplan --no-serve -o architecture.json -o architecture.html
rootform run architecture.json --no-serve -o architecture.md
```

A saved document reopens without rerunning the producer. Its `kind` is `plan`; a state export produces `kind: "snapshot"`. See [Choose an input](../inputs/index.md) and [Architecture documents](../concepts/architecture-ir.md).
