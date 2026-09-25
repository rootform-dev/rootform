---
title: "Write a Policy Pack"
description: "Group portable policies, link them to exact architecture semantics, and package them deterministically."
---

A Policy Pack is an independent source unit. It owns a name, version, and
Policies. It never adds architecture facts and never declares semantic
dependency versions. Exact RF Vocabulary and Dialect pins are derived during
linking from qualified references.

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

Point `check` at local source while authoring:

<!-- docs-check:docs-language-write-policy-pack-1 -->
```sh
rootform check ./example --policy-pack ./baseline
rootform list policies --policy-pack ./baseline
rootform show policy baseline.policy.cluster-network-context --policy-pack ./baseline
```

The override lasts one command and leaves `rootform.lock` unchanged. When the
project should retain the pack, run `rootform add policy-packs ./baseline` from
the project root and commit the source with the lock. Save exact
linked form against Architecture IR when replay must not need producer
Dialects:

<!-- docs-check:docs-language-write-policy-pack-2 -->
```sh
rootform compile policy-pack ./baseline --semantics architecture.json \
  --output baseline.compiled.json
rootform check architecture.json --policy-pack baseline.compiled.json
```

Compiled artifact records authored content digest, linked digest, RF Language
version, and exact semantic pins. Any mismatch fails closed.

## Package and publish a Policy Pack

Packaging is local and offline:

<!-- docs-check:docs-language-write-policy-pack-3 -->
```sh
rootform package policy-packs ./baseline \
  --to ./artifacts/policies \
  --source-url https://example.com/team/policies \
  --revision "$(git rev-parse HEAD)" \
  --documentation-url https://example.com/team/policies/docs \
  --licenses Apache-2.0
```

Publication is separate and generic:

<!-- docs-check:docs-language-write-policy-pack-4 -->
```sh
rootform publish policy-packs ./artifacts/policies \
  --to registry.example/team/policy-packs
```

V0 has no mutable Policy Pack index. Existing version tag with different
digest is rejected.

## Use published Policy Pack

From the project root, add the published reference, then prepare its exact
selection:

<!-- docs-check:policy-authoring-add-published -->
```sh
cd ./infra
rootform add policy-packs registry.example.com/acme/baseline:0.1.0
rootform init . --locked --no-input
rootform check . --locked
```

The registry reference is illustrative; replace it with the published one you
reviewed. `add` records digests without hand editing the lock. Set
`DOCKER_CONFIG` before acquisition if the registry needs credentials. See
[External content storage](../reference/storage.md) for paths.

<!-- rootform:endsteps -->

See [Policy Pack reference](reference/policy-packs.md),
[evaluation](reference/evaluation.md), and
[`compiled-policy-pack.schema.json`](../../schemas/compiled-policy-pack.schema.json).
