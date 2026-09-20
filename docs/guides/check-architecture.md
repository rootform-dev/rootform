---
title: "Check an architecture"
description: "Evaluate architecture facts against a local or exactly selected Policy Pack."
---

`rootform check` evaluates Architecture IR facts and proof completeness. It
does not inspect live cloud state.

## Write local Policy Pack

Create `policies/` beside tutorial infrastructure:

```hcl title="policies/pack.rf"
policy_pack "tutorial" {
  version = "0.1.0"
}
```

```hcl title="policies/subnet-network-context.rf"
policy "subnet-network-context" {
  target {
    concept = rf.concept.subnet
  }

  assert = exists(contexts(rf.context.network, rf.concept.virtual-network))
  message = "Subnets must have an established virtual network context."
}
```

Policy source carries no semantic dependency versions. Qualified references
are linked against exact Architecture IR semantic snapshot.

## Evaluate locally

<!-- docs-check:policy-local -->
```sh
rootform check . --policy-pack ./policies
```

Local source is compiled for this invocation and never added to
`rootform.lock`. Unchanged tutorial starts with:

```text title="Passed check (excerpt)"
Policies compliant

Policies     1 selected
Evaluations  1
Results      1 passed
```

If subnet `vpc_id` becomes unresolved literal, context emission is incomplete.
Result is indeterminate, not violation:

```text title="Indeterminate check (unresolved traversal)"
Policies indeterminate

Policies     1 selected
Evaluations  1
Results      1 indeterminate
```

Target with no matching representation yields zero evaluations and
`not_evaluated`; it is distinct from no selected Policies. See
[policy outcomes](../concepts/policies.md#zero-evaluations-are-not-approval).

## Inspect Policy and evidence

<!-- docs-check:policy-show -->
```sh
rootform show policy tutorial.policy.subnet-network-context --policy-pack ./policies
```

<!-- docs-check:policy-json -->
```sh
rootform check . --policy-pack ./policies --format json --output policy-result.json
```

Result records Policy identity, representation target, inspected fact IDs,
diagnostics, and source location. Explain architecture provenance separately:

```sh
rootform explain architecture aws_subnet.application --input architecture.json
```

## Use in CI

For repository-owned Policy source, keep selection explicit:

```sh
rootform check . --policy-pack ./policies --format sarif \
  --output policy-result.sarif
```

For published pack, record exact OCI pin in `rootform.lock`, prepare exact
missing bytes, then run locked:

```sh
rootform init . --locked --no-input
rootform check . --locked --format sarif --output policy-result.sarif
```

`init` never discovers or selects a pack. It validates lock and may acquire
only exact OCI digests already recorded. Vendor exact project inputs when
runner must remain offline:

```sh
rootform vendor policy-packs --offline
```

Also run `rootform vendor dialects --offline` when lock selects external
Dialects. Vendored sources live under `.rootform/dialects` and
`.rootform/policy-packs`. Installed sources live under `$ROOTFORM_HOME/dialects`
and `$ROOTFORM_HOME/policy-packs`.

Use `check --plan tfplan.json` for authorized plan input. Continue with
[Write a Policy Pack](../language/write-policy-pack.md),
[Test and validate](../language/test-validate.md), or
[Policy Pack reference](../language/reference/policy-packs.md).
