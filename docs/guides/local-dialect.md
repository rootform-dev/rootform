---
title: "Use a local Dialect while authoring"
description: "Try a Dialect against a real plan, test its evidence, then record it in the project selection."
---

A [Dialect](../concepts/dialects.md) interprets provider instances. Keep its source beside the project while authoring, pass `--dialect` for one run, and add it to `rootform.lock` only after reviewing the resulting facts. This example uses `random_pet` to keep the plan small; the same sequence applies to a provider-specific Dialect with architectural Contexts and Relations.

Prerequisites: Rootform, Terraform, and a project directory you control. OpenTofu users run the Terraform commands with `tofu`. Run commands below from that directory. The plan JSON and saved plan can carry cleartext secrets in a real project; keep them out of Git. [Plan inputs](../inputs/plans.md) gives the complete export and protection procedure.

<!-- rootform:steps -->

## Write the source beside the project

Use this small project and Dialect source to observe one interpretation:

```tree title="Project files"
.
├── main.tf
└── dialects/
    └── network-review/
        └── dialect.rf.hcl
```

```hcl title="main.tf"
terraform {
  required_providers {
    random = {
      source  = "hashicorp/random"
      version = "= 3.9.1"
    }
  }
}

resource "random_pet" "service" {
  length = 2
}
```

```rf title="dialects/network-review/dialect.rf.hcl"
dialect "network-review" {
  version = "0.1.0"

  provider "hashicorp/random" {
    version = "= 3.9.1"
  }
}

concept "generated-identifier" {
  description = "An identifier generated for a service."
}

rule "service-name" {
  match {
    kind = "resource"
    type = "random_pet"
  }

  as = concept.generated-identifier
}
```

The manifest binds the provider and the Rule identifies eligible instances. `as` gives an interpreted instance a Concept; this example emits no Context or Relation. [Write a Dialect](../dialect-authoring.md) explains Rules, endpoint identity, null handling, and evidence tests.

## Export and analyze a plan

Produce a saved plan and its JSON export. Rootform reads the completed export; it never runs Terraform or contacts the provider:

```sh
terraform init
terraform plan -out=plan.tfplan
terraform show -json plan.tfplan > plan.json
```

Try the source for this run without changing the project selection:

<!-- docs-check:local-dialect-run -->
```sh
rootform run plan.json --plan-file plan.tfplan --require-enrichment \
  --dialect ./dialects/network-review --no-serve -o analysis.json
```

<!-- docs-output:local-dialect-run -->
```text title="Excerpt from analysis summary"
Plan analyzed
Enrichment    saved plan verified against this plan JSON (1 module)
Semantics     20 Dialects, 1 vocabulary

Planned Form
  Instances    1 (1 managed, 0 data)
  Interpreted  1 of 1 instances
```

The count rose from 19 to 20 active Dialects. The instance is interpreted, while `Facts 0` is expected because the Rule only classifies it. Inspect the document or `rootform explain architecture random_pet.service --input analysis.json` when the result differs. `--dialect` compiles current source each run and never writes the lock.

## Inspect and test the Rule

Check the Dialect source and show the Rule before recording a golden:

<!-- docs-check:local-dialect-inspect -->
```sh
rootform validate dialects ./dialects/network-review
rootform show network-review.rule.service-name \
  --dialect ./dialects/network-review
```

<!-- docs-output:local-dialect-inspect -->
```text title="Excerpt from definition"
network-review.rule.service-name

Matches   resource "random_pet"
Produces  network-review.concept.generated-identifier
Defined   dialect.rf.hcl:13
```

`validate` compiles the source; `show` confirms the selected Rule's match and output. Neither proves what a particular plan instance did. Keep a fixture for that proof:

```tree title="Dialect fixture"
fixtures/network/
├── plan.json
├── plan.tfplan
└── analysis.golden
```

Copy the plan pair to the fixture. Record a reviewed golden once with `rootform test ./fixtures --dialect ./dialects/network-review --update`; then run the ordinary test after each Rule change:

<!-- docs-check:local-dialect-test -->
```sh
rootform test ./fixtures --dialect ./dialects/network-review
```

<!-- docs-output:local-dialect-test -->
```text title="Fixture result"
Tests passed
1 case
```

The test analyzes `plan.json`, verifies the adjacent saved plan, and compares the resulting document with `analysis.golden`. A mismatch is a review signal: inspect changed interpretations, facts, closures, and diagnostics before updating the golden. [Test and validate](../language/test-validate.md) covers fixture behavior.

## Add the reviewed Dialect

Once its result is right, select it for this project:

<!-- docs-check:local-dialect-add -->
```sh
rootform add dialects ./dialects/network-review
```

<!-- docs-output:local-dialect-add -->
```text title="Selection result"
rootform.lock updated

  add      dialect network-review 0.1.0  (dialects/network-review)
```

The lock records the owner, version, digest, and project-relative local path. Commit it with Dialect source and reviewed fixture. Future runs use the selection through `--project` without the override; `--locked` checks that it has not drifted. If the source changes later, try it with `--dialect`, then run `rootform update dialect network-review` to record the new digest. `init` never adopts source drift. If your owner collides with an embedded Dialect, `add` requires an explicit `--replace`; review the loss of that embedded owner's Rules first.

<!-- rootform:endsteps -->

## Record later changes

After selection, a source edit changes the compiled content digest. A normal locked run refuses it instead of silently adopting new meaning. Continue testing the edited source with `--dialect`; when its fixture and analysis are right, run `rootform update dialect network-review` from the project root and review the lock diff. Commit the updated source, golden, and lock together.

## Share the Dialect with other projects

A local lock path works only where that relative source path exists. For an independent environment, [vendor the exact selection](../guides/external-content.md) with the project. For several repositories, [package and publish the Dialect](../dialect-authoring.md#package-and-publish-a-dialect), then select its reviewed OCI reference in each project. Recheck the fixture against that selected content.

## Remove the Dialect

If the project no longer needs this interpretation, remove its selection:

<!-- docs-check:local-dialect-remove -->
```sh
rootform remove dialects network-review
```

<!-- docs-output:local-dialect-remove -->
```text title="Selection result"
rootform.lock updated

  remove   dialect network-review 0.1.0  (dialects/network-review)
```

The source directory remains. A later analysis can still show the base Representation for `random_pet.service`, but no Rule interprets it. [Reproduce an analysis offline](reproduce-build.md) shows how to prove another environment loaded a reviewed selection.
