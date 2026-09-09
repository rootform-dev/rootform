---
title: "Check an architecture"
description: "Evaluate a real architecture policy locally, inspect its evidence, and promote it to a CI gate."
---

Use `rootform check` to evaluate architecture facts against selected policies.
Unlike a Terraform syntax lint, this check runs after Dialects establish
components, placement, composition, relations, and provenance. It does not test
live cloud state.

This example checks whether the subnet from
[your first architecture](../getting-started/first-architecture.md) has an
established virtual network context. Work from that tutorial directory with its
`main.tf` and prepared AWS/core Dialects.

## Write the local policy

Create a `policies/` directory with one pack manifest and one top-level policy:

```hcl title="policies/pack.rf"
policy_pack "tutorial" {
  version = "0.1.0"

  requires {
    core = "0.1.0"
  }
}
```

```hcl title="policies/subnet-network-context.rf"
policy "subnet-network-context" {
  target = concept.core.subnet
  assert = exists(contexts(context.core.network, concept.core.virtual-network))
  message = "Subnets must have an established virtual network context."
}
```

Rootform discovers both files under `policies/`. The manifest assigns the policy
to pack `tutorial`; filenames and subdirectories do not affect ownership. The
policy runs once for each `core/subnet` representation. Its assertion reads
network contexts already established by the AWS Dialect and asks whether at
least one points to a virtual network. `requires` makes the `core` vocabulary
available for validation; it does not add facts to the architecture.

## Evaluate it locally

<!-- docs-check:policy-local -->
```sh
rootform check . --offline --policy-pack ./policies
```

The local directory form reads the pack without installing or publishing it.
It does not add the pack to `rootform.lock`. For the unchanged tutorial input,
the result starts with:

```text title="Passed check (excerpt)"
1 policy, 1 evaluation, 1 passed, 0 violated, 0 indeterminate
```

Status is `0`. One evaluation exists because the architecture contains one
representation with the exact `core/subnet` concept.

If the subnet no longer has a resolvable reference to the declared VPC, the same
policy produces a real violation:

```text title="Violated check (excerpt)"
scope:aws_subnet.application
  Subnets must have an established virtual network context.
1 policy, 1 evaluation, 0 passed, 1 violated, 0 indeterminate
```

Status is `1`. The message states which required architecture fact is absent;
it does not claim that deployed connectivity is broken.

To reproduce this outcome, replace the tutorial subnet reference with a literal,
then run the same check:

```hcl title="main.tf (temporary change)"
vpc_id = "vpc-0123456789abcdef0"
```

Rootform can still represent the subnet, but no longer has reference evidence that
establishes its network context. Restore `vpc_id = aws_vpc.main.id` afterward.

If required vocabulary cannot be loaded or validated, Rootform cannot evaluate
the assertion:

```text title="Indeterminate check (excerpt)"
1 policy, 0 evaluations, 0 passed, 0 violated, 1 indeterminate
```

Status is `3`, accompanied by a diagnostic explaining unavailable evidence.
Treat that as a blocked decision, not a pass. A selected policy with no matching
target instead has zero evaluations; see
[policy outcomes](../concepts/policies.md#zero-evaluations-are-not-approval)
to understand why that reports `not_evaluated` and status `3`.

To reproduce the indeterminate result, temporarily change the pack requirement
to `core = "9.9.9"` and rerun the check. The loaded architecture does not provide that
required vocabulary version, so Rootform refuses to guess. Restore `0.1.0`
before continuing.

## Inspect policy and evidence

<!-- docs-check:policy-show -->
```sh
rootform show policy tutorial/subnet-network-context --policy-pack ./policies
```

Check target and assertion before interpreting results. Save structured output
when a reviewer or another tool needs exact identities and inspected facts:

<!-- docs-check:policy-json -->
```sh
rootform check . --offline --policy-pack ./policies --format json --output policy-result.json
```

For this example, `summary.evaluations` and `summary.passed` are `1`. The
evaluation identifies policy `tutorial/subnet-network-context` and target
`scope:aws_subnet.application`.

A violation path points to the assertion in Policy Pack source. Use target
provenance to trace the Terraform declaration and Dialect rule behind the facts;
do not edit generated architecture JSON to make a check pass.

```sh
rootform explain architecture aws_subnet.application --input architecture.json
```

## Promote the check to CI and pull requests

### Keep the pack in the repository

Commit `policies/` alongside the tutorial input and reviewed `rootform.lock`.
CI must keep the local pack selection explicit:

```sh
rootform check . --policy-pack ./policies --no-input --format sarif --output policy-result.sarif
```

The policy source comes from the checked-out commit. A local `--policy-pack`
replaces the project's Policy Pack selection for that invocation and cannot be
combined with `--locked`. Dropping the flag would use only the project's
selected packs, which may mean zero policies are evaluated.

### Use a published pack

To distribute the same reviewed tutorial pack, follow
[Write a Policy Pack](../language/write-policy-pack.md#package-and-publish-a-policy-pack).
Set `POLICY_PACK_REF` to the pack's published OCI tag or digest reference, then
select it from the project root:

```sh
rootform init . --no-input --policy-pack "$POLICY_PACK_REF"
rootform list policies
```

Confirm that the selection includes `tutorial/subnet-network-context`, review
the lock diff, and commit `rootform.lock`. CI now reads that exact published
selection:

```sh
rootform check . --locked --no-input --format sarif --output policy-result.sarif
```

For either path, add `--offline` when required Dialects are available locally.
The published-pack path also needs its exact Policy Pack available locally;
[vendoring](reproduce-build.md#carry-packages-with-the-project) can carry both
package families into CI. Preserve status `1` for violations and `3` for
indeterminate results, and verify expected policy and evaluation counts.
Publishing SARIF or JSON gives reviewers the policy, target, message, and
evidence instead of only a red job.

Use `check --plan tfplan.json` to evaluate planned architecture from an authorized
Terraform/OpenTofu plan. [Run in CI](../integrations/ci/README.md) covers portable
automation; [GitHub Actions](../integrations/github-actions.md) covers PR evidence.

For more policies, continue with
[Write a Policy Pack](../language/write-policy-pack.md) and
[Test and validate](../language/test-validate.md). Exact query signatures and
evaluation rules live in the
[Policy Pack reference](../language/reference/policy-packs.md).
