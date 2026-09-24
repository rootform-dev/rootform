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

```rf title="policies/pack.rf.hcl"
policy_pack "tutorial" {
  version = "0.1.0"
}
```

```rf title="policies/subnet-network-context.rf.hcl"
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

## Require an explicit subnet for instances

Suppose your team requires every EC2 instance to declare a resolvable subnet
reference. The AWS provider 6.62.0 defines
[`aws_instance.subnet_id`](https://registry.terraform.io/providers/hashicorp/aws/6.62.0/docs/resources/instance#subnet_id-1)
as optional, so this is a team convention about facts declared in source. It
does not claim that an instance without this argument has no network at
runtime.

Add a separate Policy for that convention:

```rf title="policies/instance-explicit-subnet-context.rf.hcl"
policy "instance-explicit-subnet-context" {
  target {
    concept = aws.concept.compute-instance
  }

  assert = exists(contexts(rf.context.network, rf.concept.subnet))
  message = "Instances must declare a resolvable subnet reference."
}
```

Create two valid `aws_instance` resources. One refers to the tutorial subnet,
while the other uses the provider's permitted omission:

```hcl title="instances.tf"
resource "aws_instance" "attached" {
  ami           = "ami-0123456789abcdef0"
  instance_type = "t3.micro"
  subnet_id     = aws_subnet.application.id
}

resource "aws_instance" "implicit" {
  ami           = "ami-0123456789abcdef0"
  instance_type = "t3.micro"
}
```

<!-- docs-check:policy-violation -->
```sh
rootform check . --policy-pack ./policies
```

```text title="Mixed check with violation"
Policies violated

Policies     2 selected
Evaluations  3
Results      2 passed, 1 violated

VIOLATED

tutorial.policy.instance-explicit-subnet-context
  Instances must declare a resolvable subnet reference.
  Target  aws_instance.implicit
  Source  instances.tf:7
```

The subnet Policy still passes. The explicit reference from
`aws_instance.attached` resolves to `aws_subnet.application`, so the instance
Policy also passes for that target. Rootform can prove that
`aws_instance.implicit` omits the declared subnet fact, so the team Policy is
violated and the mixed result returns status `1`. A confirmed violation takes
priority over indeterminate or not-evaluated results in the same check.

Inspect why Rootform considered the fact absent:

<!-- docs-check:policy-violation-explain -->
```sh
rootform explain architecture aws_instance.implicit
```

```ansi title="Proven omission"
[1maws_instance.implicit[0m

[2mConcept[0m  aws.concept.compute-instance "implicit"
[2mRule[0m     aws.rule.instance
[2mDefined[0m  instances.tf:7

[1m[38;5;208mOmitted facts[0m
[2m  rf.context.network[0m  rf.concept.subnet
                      not declared in source
```

Remove only the instance scenario file before testing unresolved evidence. Keep
the instance Policy for the next check:

<!-- docs-check:policy-remove-violation -->
```sh
rm instances.tf
```

## Keep unresolved evidence indeterminate

Create an instance whose `subnet_id` is a literal rather than a resolvable
reference:

```hcl title="unresolved-instance.tf"
resource "aws_instance" "unresolved" {
  ami           = "ami-0123456789abcdef0"
  instance_type = "t3.micro"
  subnet_id     = "subnet-0123456789abcdef0"
}
```

<!-- docs-check:policy-indeterminate -->
```sh
rootform check . --policy-pack ./policies
```

```text title="Mixed indeterminate check"
Policies indeterminate

Policies     2 selected
Evaluations  2
Results      1 passed, 1 indeterminate
```

The subnet Policy still passes for `aws_subnet.application`. Rootform cannot
resolve the instance's literal subnet reference, so it does not fabricate a
violation from missing proof. The result returns status `3`.

Restore the initial source again:

<!-- docs-check:policy-remove-indeterminate -->
```sh
rm unresolved-instance.tf
rm policies/instance-explicit-subnet-context.rf.hcl
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
command use returns `2`. See [Outputs and exit status](../reference/outputs.md)
for the full command matrix.

For external Policy Packs, use [Project configuration](../cli.md) to select and
lock the required content. Continue with
[Run in CI](../integrations/ci/README.md) or
[GitHub Actions](../integrations/github-actions.md) when the local results are
ready for automation.
