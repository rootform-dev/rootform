---
title: "Run checks"
description: "Evaluate a known architecture with a local Policy Pack, distinguish every outcome, and inspect its evidence."
---

Start from a fresh copy of [Your first architecture](../getting-started/first-architecture.md).
Its `main.tf` must contain the VPC and application subnet shown there, without
files left by another guide. Run every command below from the
`rootform-first-architecture` directory.

This guide uses one local [Policy Pack](../concepts/policies.md) in `policies/`.
The pack is selected explicitly for each check and does not require a
`rootform.lock`.

## Create the Policy Pack

```hcl title="policies/pack.rf.hcl"
policy_pack "tutorial" {
  version = "0.1.0"
}
```

```hcl title="policies/subnet-network-context.rf.hcl"
policy "subnet-network-context" {
  target {
    concept = rf.concept.subnet
  }

  assert = exists(contexts(rf.context.network, rf.concept.virtual-network))
  message = "Subnets must have an established virtual network context."
}
```

The Policy evaluates every Representation classified as a subnet. It passes
only when Rootform has established at least one virtual network Context for
that target. See [Write a Policy Pack](../language/write-policy-pack.md) for
authoring beyond this example.

## Evaluate locally

<!-- docs-check:policy-local -->
```sh
rootform check . --policy-pack ./policies
```

```text title="Passed check"
Policies compliant

Policies     1 selected
Evaluations  1
Results      1 passed
```

One Policy was selected, its target matched `aws_subnet.application`, and its
assertion passed. Status `0` means every selected Policy was evaluated and
passed.

Save the architecture used by later evidence commands:

<!-- docs-check:policy-architecture -->
```sh
rootform build . --output architecture.json
```

## Produce a real violation

Create a separate scenario file. This subnet has no declared `vpc_id`, so the
AWS Dialect can prove its network Context was omitted rather than unresolved:

```hcl title="orphan.tf"
resource "aws_subnet" "orphan" {
  cidr_block = "10.20.3.0/24"
}
```

<!-- docs-check:policy-violation -->
```sh
rootform check . --policy-pack ./policies
```

```text title="Mixed check with violation"
Policies violated

Policies     1 selected
Evaluations  2
Results      1 passed, 1 violated

VIOLATED

tutorial.policy.subnet-network-context
  Subnets must have an established virtual network context.
  Target  aws_subnet.orphan
  Source  orphan.tf:1
```

The application subnet still passes. The proven omission makes the same Policy
false for `aws_subnet.orphan`, so the mixed result returns status `1`. A
confirmed violation takes priority over indeterminate or not-evaluated results
in the same check.

Inspect why Rootform considered the fact absent:

<!-- docs-check:policy-violation-explain -->
```sh
rootform explain architecture aws_subnet.orphan
```

```text title="Proven omission"
aws_subnet.orphan

Concept  rf.concept.subnet "orphan"
Rule     aws.rule.subnet
Defined  orphan.tf:1

Omitted facts
  rf.context.network  rf.concept.virtual-network
                      not declared in source
```

Restore the initial scenario before continuing. Remove only the file created in
this step:

<!-- docs-check:policy-remove-violation -->
```sh
rm orphan.tf
```

## Keep unresolved evidence indeterminate

Create a distinct subnet whose `vpc_id` is a literal rather than a resolvable
reference:

```hcl title="unresolved.tf"
resource "aws_subnet" "unresolved" {
  vpc_id     = "vpc-0123456789abcdef0"
  cidr_block = "10.20.4.0/24"
}
```

<!-- docs-check:policy-indeterminate -->
```sh
rootform check . --policy-pack ./policies
```

```text title="Mixed indeterminate check"
Policies indeterminate

Policies     1 selected
Evaluations  2
Results      1 passed, 1 indeterminate
```

Rootform cannot resolve evidence for the literal reference. It does not turn
that missing proof into a violation. The result returns status `3`.

Restore the initial source again:

<!-- docs-check:policy-remove-indeterminate -->
```sh
rm unresolved.tf
```

## Distinguish no selection from no target

Running without a selected pack evaluates nothing:

<!-- docs-check:policy-none -->
```sh
rootform check .
```

```text title="No Policy Pack selected"
Policies not evaluated

Policies     0 selected
Evaluations  0

No policy was selected.
```

This returns status `3`, never compliance. A selected Policy can also have no
matching target. To reproduce that distinct case, create an architecture with
only a VPC:

```hcl title="no-subnet/main.tf"
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "= 6.62.0"
    }
  }
}

resource "aws_vpc" "only" {
  cidr_block = "10.30.0.0/16"
}
```

<!-- docs-check:policy-no-target -->
```sh
rootform check ./no-subnet --policy-pack ./policies
```

```text title="Selected Policy without a target"
Policies not evaluated

Policies     1 selected
Evaluations  0
Results      1 not evaluated

NOT EVALUATED

tutorial.policy.subnet-network-context
  Subnets must have an established virtual network context.
  Reason  no matching target in this architecture
```

The pack and Policy were selected, but no subnet matched its target. Status is
still `3`. Restore the workspace by removing only the scenario files:

<!-- docs-check:policy-remove-no-target -->
```sh
rm no-subnet/main.tf
rmdir no-subnet
```

## Inspect definition, result, and architecture evidence

Show the Policy definition selected from local source:

<!-- docs-check:policy-show -->
```sh
rootform show policy tutorial.policy.subnet-network-context --policy-pack ./policies
```

Save structured evaluation result:

<!-- docs-check:policy-json -->
```sh
rootform check . --policy-pack ./policies --format json --output policy-result.json
```

The JSON result records selected Policies, each target and outcome, inspected
fact IDs, diagnostics, and violation details. Explain architectural evidence
separately from the saved architecture:

<!-- docs-check:policy-explain-architecture -->
```sh
rootform explain architecture aws_subnet.application --input architecture.json
```

`show policy` displays authored target, assertion, message, and source.
`explain architecture` traces established facts and provenance.
`explain policy` instead explains one evaluation from the current project
selection. It reads architecture and Policy Pack selection from the current
directory and accepts neither `--input` nor `--policy-pack`. See its
[exact reference](../reference/cli/explain/policy.md) before using it with a
project-selected pack.

## Use in CI

Use JSON for automation or SARIF for a compatible code-review surface:

```sh
rootform check . --policy-pack ./policies --format sarif \
  --output policy-result.sarif
```

Review the selected Policy count and evaluation coverage with status. Invalid
command use returns `2`. [Outputs and exit status](../reference/outputs.md)
owns the full command matrix.

For external Policy Packs, follow
[Project configuration](../cli.md) instead of duplicating lock, OCI, and vendor
steps here. Continue with [Run in CI](../integrations/ci/README.md) or
[GitHub Actions](../integrations/github-actions.md) when the local results are ready
for automation.
