---
title: Explain an architecture
description: Ask the terminal why an instance is placed or connected, what a Rule established, and how a Policy decided.
---

`rootform explain` answers the Inspector's questions in the terminal. It reads
a saved Form, so it needs no plan files and recompiles nothing.

The examples below use the `analysis.json` written in the
[quickstart](../getting-started/quickstart.md). A state Form or another plan
Form works the same way; a comparison Form holds two architectures, so
`explain instance` and `explain rule` need `--side before` or
`--side after` to name one.

## Why is this instance placed here?

Name the instance address and the Form:

<!-- docs-check:explain-instance -->
```sh
rootform explain instance azurerm_subnet.prod_data --input analysis.json
```

```ansi title="Instance explanation, excerpt"
[1mInstance explained[0m
[1m[38;5;208mazurerm_subnet.prod_data[0m
  [2mInterpretation[0m  applied azure.rule.subnet as subnet
  [1mFacts[0m
    -> context network
      azurerm_virtual_network.prod
      evidence: both
  [1mClosures[0m
    context network -> virtual-network
      via source.virtual_network_name, match exact by name
      [32mresolved, 1 fact[0m; candidates: 1 known equal, 0 unknown, 1 excluded
```

**Interpretation** names the Rule that matched and the Concept it assigned.
Each fact under **Facts** points to another instance and says what evidence
settled it: `value` for evaluated plan or state values, `traversal` for a
verified saved-plan reference, `both` when they agree. Facts arriving from
other instances, such as the private endpoints in this subnet, use `<-`.

**Closures** is where uncertainty lives. Each line is one closure the Rule
opened on this instance, one for each Context or Relation the Rule can
establish: the attribute it followed, how candidates were
matched, and whether the closure is `resolved`, `absent`, or
`indeterminate` with its reason. An indeterminate closure means the evidence
could not settle the fact; it does not mean the fact is missing.
[Forms and stages](../concepts/forms.md#stages-and-facts) lists the reasons.

## What did this Rule establish?

Ask the Rule itself to see every instance it interpreted in this Form and
the outcome of each closure it opened:

<!-- docs-check:explain-rule -->
```sh
rootform explain rule azure.rule.subnet --input analysis.json
```

```ansi title="Rule explanation, excerpt"
[1mRule explained[0m
[2mRule[0m        azure.rule.subnet
[2mMatches[0m     resource azurerm_subnet
[2mApplied to[0m  7 instances
```

The **Emissions** section shows, for each Context or Relation the Rule can
establish, how many closures resolved, were absent, or stayed indeterminate
across the Form. Read it to see whether a Dialect covers your resources the
way you expect. `rootform show azure.rule.subnet` prints the Rule's
declaration instead of its results.

## How did a Policy decide?

After `rootform check` writes a result file, explain the Policy from that
result. The Form is optional; with it, Rootform describes the evidence
behind each evaluation:

<!-- docs-check:explain-policy -->
```sh
rootform explain policy review.policy.database-network-context \
  --result results.json --input analysis.json --details
```

The output quotes the requirement, the assertion, and the target, then lists
each evaluation as passed, violated, or indeterminate with the recorded
evidence and conclusion. Nothing is evaluated again; the command reads what
`check` recorded. [Check a Form with Policies](check-with-policies.md) produces
the result file, and [Explain a Policy](../reference/cli/explain/policy.md)
defines the accepted inputs.

Each explanation describes the Form, not deployed infrastructure. A resolved
network context is a proven architectural fact in the plan; it says nothing
about runtime reachability. To see the same facts drawn in context, open the
Form in the [Explorer](explore-architecture.md); to read what one plan
changes, continue with [Review planned changes](review-planned-changes.md).
