---
title: "Check an architecture with a policy"
description: "Write a small Policy Pack, evaluate the first architecture, and inspect the result."
---

Check that the subnet from [your first architecture](../getting-started/first-architecture.md)
has an established virtual network context. This example evaluates a known
Rootform fact; it does not test live connectivity.

## Prepare the example

Use the tutorial directory with its `main.tf` and prepared AWS/core Dialects.
Create a directory for the local pack:

```sh
mkdir policies
```

Save this file:

```hcl title="policies/pack.rf"
policy_pack "tutorial" {
  version = "0.1.0"

  requires {
    core = "0.1.0"
  }

  policy "subnet-network-context" {
    target = concept.core.subnet
    assert = length(contexts(context.core.network, concept.core.virtual-network)) > 0
    message = "Subnets must have an established virtual network context."
  }
}
```

The target is a subnet. For each subnet, the assertion asks whether its network
contexts include a virtual network. The AWS Dialect already established that
fact from `vpc_id`; the policy reads it. `core` supplies the vocabulary named in
the assertion.

## Run the check

<!-- docs-check:policy-local -->
```sh
rootform check . --offline --policy-pack ./policies
```

The local directory form reads this pack directly. It does not install or
publish it and does not add it to `rootform.lock`. Do not combine that authoring
form with `--locked`.

For the unchanged tutorial input, the first line of the text result is:

```text
1 policy, 1 evaluation, 1 passed, 0 violated, 0 indeterminate
```

Declaration accounting follows that summary in the text result. Provider-version
warnings go to standard error. The exit status is `0`. There is one evaluation because the architecture has
one representation with the exact `core/subnet` concept.

## Inspect the policy and machine result

<!-- docs-check:policy-show -->
```sh
rootform show policy tutorial/subnet-network-context --policy-pack ./policies
```

Check its target and assertion before interpreting its outcome. Save structured
results when you need the policy identity, target, and inspected facts:

<!-- docs-check:policy-json -->
```sh
rootform check . --offline --policy-pack ./policies --format json --output policy-result.json
```

Expect `summary.evaluations` and `summary.passed` to be `1`, and both
`summary.violated` and `summary.indeterminate` to be `0`. The evaluation names
`tutorial/subnet-network-context` and `scope:aws_subnet.application`.

For a real failure, read the violation's target and message, then inspect that
target's provenance. A missing or unresolved fact can require correcting the
input or Dialect coverage instead of changing infrastructure. Do not edit an
architecture file to make a policy pass.

## Use a published pack in a project

For a pack you have reviewed, initialization takes its OCI artifact reference.
The published baseline example can be selected with:

```sh
rootform init . --no-input \
  --policy-pack ghcr.io/rootform-dev/policy-packs:policy-pack-baseline-0.1.0
rootform list policy-packs
rootform list policies
```

This selects the **baseline** demonstration pack, not the local `tutorial` pack
above. Review its [coverage limitations](../concepts/policies.md#match-a-policy-to-the-dialects-evidence)
before adopting it. Initialization resolves the reference and locks its exact
content. Commit the reviewed lock, then run:

```sh
rootform check . --locked --offline --no-input
```

The VPC/subnet example has none of baseline's target concepts, so this last
check has zero evaluations. It is not a replacement for the tutorial check.
Use [Policies and Policy Packs](../concepts/policies.md#zero-evaluations-require-attention)
to interpret that distinction and [reproducible builds](reproduce-build.md)
when preparing packages for an offline environment.
