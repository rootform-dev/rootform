---
title: Check a Form with Policies
description: Evaluate a Policy Pack against a saved Form, read the verdict, and keep the result for review.
---

`rootform check` evaluates Policies against one architecture in a Form and
exits with the verdict. Below, you write a one-Policy Pack and run it against
the `analysis.json` saved in the [quickstart](../getting-started/quickstart.md).

Checking is a separate step from `rootform run`, which analyzes and never
evaluates Policies: an analysis that exits `0` says nothing about compliance.

## Write a Policy Pack

A Policy Pack is a directory with one manifest and one or more Policies in
`.rf.hcl` files. Create `policies/` beside `analysis.json`:

```rf title="policies/pack.rf.hcl"
policy_pack "review" {
  version = "0.1.0"
}
```

```rf title="policies/database-network.rf.hcl"
policy "database-network-context" {
  target {
    concept = rf.concept.managed-database
  }

  assert = (
    exists(contexts(rf.context.network, rf.concept.virtual-network)) ||
    exists(contexts(rf.context.network, rf.concept.subnet))
  )

  message = "Managed databases must belong to a network context."
}
```

The target selects every instance a Dialect interpreted as a managed
database, whatever the provider. The assertion asks whether each one has an
established network Context toward a virtual network or a subnet. A Terraform
reference alone cannot satisfy it; only a fact a Rule established can.
[Write a Policy Pack](../language/write-policy-pack.md) covers the language.

## Run the check

<!-- docs-check:check-form-run -->
```sh
rootform check analysis.json --policy-pack ./policies -o results.json -o results.md
```

```ansi title="Check summary, excerpt"
[1mPolicy check completed[0m
[2mOrigin[0m         Plan (saved Form)
[2mStage[0m          Planned
[2mPolicies[0m       1 selected
[2mEvaluations[0m    1
[2mPassed[0m         1
[2mVerdict[0m        [1m[32mPASSED[0m
```

`--policy-pack` selects the Pack for this command only. The plan holds one
managed database, a PostgreSQL flexible server, whose network Context to a
subnet came from the saved plan, so the single evaluation passes and the
command exits `0`.

Read **Policies** and **Evaluations** before trusting the verdict. A Policy
that finds no target makes no decision, and a check that selects no Policy
proves nothing. The summary says so explicitly and exits `3` in both cases.

| Status | Verdict | Meaning |
| --- | --- | --- |
| `0` | PASSED | Every selected Policy evaluated at least one target and every evaluation passed |
| `1` | VIOLATED | At least one evaluation is a confirmed violation |
| `3` | INDETERMINATE or NO DECISION | Evidence could not settle an evaluation, a Policy had no target, or no Policy was selected |

Statuses `2` and `4` report incorrect use and an unreadable or unwritable
file. [Policy check exit status](../reference/outputs.md#policy-check-exit-status)
is the reference.

## Read and keep the result

`results.json` is the Policy result: it names the Form by digest, the evaluated
stage, the selected Policies, and every evaluation with its evidence.
`results.md` is the same result as a review document, and `-o results.sarif`
writes it for a code-scanning tool. Rootform writes them whatever the verdict,
so a violation still produces its report, and none holds sensitive plan values.

To see why an evaluation passed or failed, explain it from the result:

<!-- docs-check:check-form-explain -->
```sh
rootform explain policy review.policy.database-network-context \
  --result results.json --input analysis.json --details
```

```ansi title="Policy explanation, excerpt"
[1mPolicy explained[0m
[2mOutcome[0m        [1m[32mPASSED[0m
  azurerm_postgresql_flexible_server.prod
```

## Check a plan directly

`check` also accepts a plan JSON and compiles it first. Pair the saved plan
so that references unknown until apply can still be settled:

```sh
rootform check plan.json --plan-file plan.tfplan --policy-pack ./policies
```

Without the saved plan, the same Policy can return `INDETERMINATE` on the same
resources: the subnet ID is unknown until apply and Rootform refuses to guess.
Status `3` keeps that uncertainty out of an approval.
[Follow a Policy through every outcome](check-architecture.md) shows a pass, a
violation, an indeterminate result, and a Policy without target on small plans
you produce yourself.

## Make the Pack part of the project

An override is right for trying a Pack. For repeatable checks, record it:

```sh
rootform add policy-packs ./policies
rootform check analysis.json --locked
```

`add` writes the Pack's exact identity to `rootform.lock`; commit the lock
with the project. `--locked` refuses overrides, so a CI job evaluates the
Packs the lock records and fails when the lock is missing. The lock records
the selection; it does not protect it. A pull request can still change the
lock or the Pack, so review both like code, and evaluate a pull request with
the Pack from the base revision when the Policies must not be relaxed by the
change they judge, as [Review a pull request](../workflows/index.md#evaluate-the-saved-comparison-with-policies)
does. [Run in CI](../integrations/ci/README.md) turns this into a gate, and
[Policies and Policy Packs](../concepts/policies.md) explains what a result
proves.
