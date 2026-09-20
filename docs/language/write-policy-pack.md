---
title: "Write a Policy Pack"
description: "Group portable policies, link them to exact architecture semantics, and package them deterministically."
---

A Policy Pack is an independent source unit. It owns a name, version, and
Policies. It never adds architecture facts and never declares semantic
dependency versions. Exact RF Vocabulary and Dialect pins are derived during
linking from qualified references.

## Start with one source root

```text title="Policy Pack source"
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

```hcl title="policy-packs/baseline/pack.rf.hcl"
policy_pack "baseline" {
  version = "0.1.0"
}
```

```hcl title="policy-packs/baseline/policies/cluster-network-context.rf.hcl"
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

```hcl title="policy-packs/baseline/policies/managed-database-network-context.rf.hcl"
policy "managed-database-network-context" {
  target {
    concept = rf.concept.managed-database
  }

  assert = exists(contexts(rf.context.network, rf.concept.virtual-network))

  message = "Managed databases must declare a virtual-network context."
}
```

These fences match public baseline source exactly.

<!-- rootform:steps -->

## Name and version pack

`policy_pack "baseline"` establishes source identity. Policy IDs use
owner-first form, for example `baseline.policy.cluster-network-context`.
Names use lowercase kebab case. Version is exact `MAJOR.MINOR.PATCH`.

No `requires` block exists. Policies use qualified references only. Linker
resolves each referenced owner and symbol against the given Architecture IR,
then records exact versions and digests in compiled artifact.

## Define target

Target is one block:

```hcl title="Policy target"
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

Point `check` at local source while authoring:

```sh
rootform check ./example --policy-pack ./baseline
rootform list policies --policy-pack ./baseline
rootform show policy baseline.policy.cluster-network-context --policy-pack ./baseline
```

Local source is neither installed nor written to `rootform.lock`. Save exact
linked form against Architecture IR when replay must not need producer
Dialects:

```sh
rootform compile policy-pack ./baseline --semantics architecture.json \
  --output baseline.compiled.json
rootform check architecture.json --policy-pack baseline.compiled.json
```

Compiled artifact records authored content digest, linked digest, RF Language
version, and exact semantic pins. Any mismatch fails closed.

## Package and publish a Policy Pack

Packaging is local and offline:

```sh
rootform package policy-packs ./baseline \
  --to ./artifacts/policies \
  --source-url https://example.com/team/policies \
  --revision "$(git rev-parse HEAD)" \
  --documentation-url https://example.com/team/policies/docs \
  --licenses Apache-2.0
```

Publication is separate and generic:

```sh
rootform publish policy-packs ./artifacts/policies \
  --to registry.example/team/policy-packs
```

V0 has no mutable Policy Pack index. Existing version tag with different
digest is rejected.

## Use published Policy Pack

Record exact OCI identity in `rootform.lock`, including content, manifest, and
layer digests plus sizes. Then acquire only those pins:

```sh
rootform init ./infra --locked --no-input
rootform check ./infra --locked
```

Installed packs live under `$ROOTFORM_HOME/policy-packs/<name>/<version>`.
Project vendoring uses `.rootform/policy-packs`. Linked execution cache lives
under `$ROOTFORM_HOME/cache/linked-policy-packs` and is always derivable.

<!-- rootform:endsteps -->

See [Policy Pack reference](reference/policy-packs.md),
[evaluation](reference/evaluation.md), and
[`compiled-policy-pack.schema.json`](../../schemas/compiled-policy-pack.schema.json).
