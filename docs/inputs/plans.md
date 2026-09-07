---
title: "Terraform and OpenTofu plans"
description: "Use a JSON execution plan as evidence for architecture and change review."
---

Rootform reads the JSON representation of a Terraform or OpenTofu plan.
You create the plan with your IaC tool; Rootform does not invoke that tool or
apply the plan.

## Prepare the JSON document

From an initialized project, export an existing saved plan:

```sh
terraform show -json tfplan > tfplan.json
```

For OpenTofu, use `tofu show -json tfplan > tfplan.json`. This file can contain
sensitive values. Keep it local or within the protected job that needs it;
do not upload the raw plan as a documentation or review artifact.

## Build or compare

From the prepared Rootform project context:

```sh
rootform build --plan tfplan.json --output planned.json
rootform diff --plan tfplan.json
```

`build` describes the planned architecture. `diff --plan` compares before and
planned architecture from the same plan. Required Dialect semantics must
already be available for plan input.

Rootform rejects unsupported plan formats and retains unresolved evidence.
A missing value is not proof of no change. The renderer's **Plan view** is an
exploration mode and is separate from this input format.
