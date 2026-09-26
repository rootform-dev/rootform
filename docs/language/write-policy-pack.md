---
title: "Write a Policy Pack"
description: "Group portable policies, link them to exact architecture semantics, and package them deterministically."
---

A Policy Pack is an independent source unit. It owns a name, version, and
Policies. This guide uses the public baseline Pack and a plan containing a
Kubernetes cluster and managed database. A Policy observes architectural
facts; it never creates them. Exact RF Vocabulary and Dialect identities are
derived when the Pack is linked.

## Start with one source root

```tree title="Policy Pack source"
baseline/
├── pack.rf.hcl
├── policies/
│   ├── cluster-network-context.rf.hcl
│   └── managed-database-network-context.rf.hcl
├── LICENSE
└── NOTICE
```

Rootform discovers `.rf.hcl` and `.rf.json` recursively. Exactly one
`policy_pack` declaration owns every top-level `policy` below this root.

```rf title="policy-packs/baseline/pack.rf.hcl"
policy_pack "baseline" {
  version = "0.1.0"
}
```

```rf title="policy-packs/baseline/policies/cluster-network-context.rf.hcl"
policy "cluster-network-context" {
  target {
    concept = rf.concept.kubernetes-cluster
  }

  assert = (
    exists(contexts(rf.context.network, rf.concept.virtual-network)) ||
    exists(contexts(rf.context.network, rf.concept.subnet))
  )

  message = "Kubernetes clusters must belong to a network context."
}
```

```rf title="policy-packs/baseline/policies/managed-database-network-context.rf.hcl"
policy "managed-database-network-context" {
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

These fences match public baseline source exactly.

<!-- rootform:steps -->

## Name and version pack

`policy_pack "baseline"` establishes source identity. Policy IDs use
owner-first form, for example `baseline.policy.cluster-network-context`.
Names use lowercase kebab case. Version is exact `MAJOR.MINOR.PATCH`.

No `requires` block exists. Policies use qualified references only. Linking
resolves each referenced owner and symbol against the Rootform document, then
records exact versions and digests in the compiled Pack.

## Define target

Target is one block:

```rf title="Policy target"
target {
  concept  = rf.concept.kubernetes-cluster
  rules    = [aws.rule.eks-cluster]
  dialects = [aws]
}
```

At least `concept` or `rules` is required. Values within each list are OR;
present dimensions combine with AND. `dialects` filters owner of applied Rule.
One selected representation is evaluated once. Base representation without
matching Concept or applied Rule is not selected.

## Evaluate locally

From a checkout of the Rootform repository, run the reviewed commerce plan
against the baseline source. The saved plan verifies the plan JSON and
supplies the traversals needed to decide these network contexts.
[Plan inputs](../inputs/plans.md) shows how to export both files from your own
project with `terraform` or `tofu`. Saved plans and plan JSON can contain
secrets in clear text; keep yours out of Git and public artifacts. Rootform
reads them locally and keeps sensitive values out of its outputs.

<!-- docs-check:docs-language-write-policy-pack-1 -->
```sh
rootform run examples/playground/commerce-platform/head/plan.json \
  --plan-file examples/playground/commerce-platform/head/plan.tfplan \
  --policy-pack ./policy-packs/baseline --no-serve --color always \
  -o analysis.json
rootform list policies --policy-pack ./policy-packs/baseline
rootform show policy baseline.policy.cluster-network-context \
  --policy-pack ./policy-packs/baseline
```

<!-- docs-output:docs-language-write-policy-pack-1 -->
```ansi title="Passing result, excerpt"
[2mPolicies[0m      passed

[1m[38;5;208mPolicies · planned[0m
  [2mResult[0m     passed
  [2mEvaluated[0m  2 policies over 2 targets: 2 passed, 0 violated, 0 indeterminate
```

Status `0` means both selected targets passed. A violation exits `1`;
indeterminate evidence or no selected decision exits `3`. The latter two are
not passes. `list` names both qualified Policies, while `show` prints the
target and assertion without evaluating it. If a context is indeterminate,
inspect the instance closure and confirm that the saved plan matches the JSON.
The local override lasts one command and leaves `rootform.lock` unchanged.

| `Policies · planned` result | Status | What to do |
| --- | --- | --- |
| `Result     passed` | `0` | All evaluated targets passed. Confirm the target count is greater than zero. |
| `Result     violated` | `1` | Read the named target and Policy message, then explain that Policy. |
| `Result     indeterminate` | `3` | Inspect its closure reason; missing or unknown evidence cannot prove a pass. |
| `Result     no decision` | `3` | No selected Policy had a target. Check the Pack target and selected plan stage. |

These are distinct Policy outcomes. The [check walkthrough](../guides/check-architecture.md)
shows violations, indeterminate closures, and no-target results on small plans.

Save the linked Pack against the Rootform document when replay must use that
exact semantic selection. `analysis.json` came from the preceding run:

<!-- docs-check:docs-language-write-policy-pack-2 -->
```sh
rootform compile policy-pack ./policy-packs/baseline --semantics analysis.json \
  --output baseline.compiled.json
rootform run analysis.json --policy-pack baseline.compiled.json --no-serve --color always
```

The compile command prints the Pack, semantic-pin count and destination. The
second run loads the Rootform document without recompiling the plan and again
reports two passes, status `0`. The compiled artifact records the authored
content digest, linked digest, language version, and exact semantic identities.
A mismatch fails closed. When the project should retain the source Pack, use
`rootform add policy-packs ./policy-packs/baseline` from that project root and
commit the Pack source with `rootform.lock`.

## Package and publish a Policy Pack

Packaging is local and offline:

<!-- docs-check:docs-language-write-policy-pack-3 -->
```sh
rootform package policy-packs ./policy-packs/baseline \
  --to ./artifacts/policies \
  --source-url https://example.com/team/policies \
  --documentation-url https://example.com/team/policies/docs \
  --licenses Apache-2.0
```

The result names the Pack and local destination. Record the reviewed source
revision with `--revision` when your publication process requires that
provenance. Packaging itself sends nothing to a registry. Publication is
separate and generic:

<!-- docs-check:docs-language-write-policy-pack-4 -->
```sh
rootform publish policy-packs ./artifacts/policies \
  --to registry.example.com/team/policy-packs
```

V0 has no mutable Policy Pack index. Existing version tag with different
digest is rejected.

## Use published Policy Pack

From the project root, add the published reference, then prepare its exact
selection:

<!-- docs-check:policy-authoring-add-published -->
```sh
cd ./infra
rootform add policy-packs \
  registry.example.com/team/policy-packs:policy-pack-baseline-0.1.0
rootform init . --locked --no-input
```

After exporting a plan for this project, evaluate the selected Pack with `rootform run plan.json --locked --no-serve`.

The registry reference is illustrative; replace it with the published one you
reviewed. `add` records digests without hand editing the lock. Set
`DOCKER_CONFIG` before acquisition if the registry needs credentials. See
[External content storage](../reference/storage.md) for paths.

<!-- rootform:endsteps -->

See [Policy Pack reference](reference/policy-packs.md),
[evaluation](reference/evaluation.md), and
[`compiled-policy-pack.schema.json`](../../schemas/compiled-policy-pack.schema.json).
