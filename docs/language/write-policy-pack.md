---
title: "Write a Policy Pack"
description: "Group related policies behind one reviewed identity, declare their exact vocabulary, and package them deterministically."
---

A Policy Pack is the versioned source and distribution unit for one or more
policies. It declares the exact Dialect vocabulary its assertions use. It does
not add architecture facts, select provider Dialects, or inherit policies from
another pack.

Write and evaluate one policy first with [Write a Policy](../guides/check-architecture.md).
Create a pack boundary when several policies share ownership, release cadence,
and semantic assumptions.

## Start with one source root

A pack source root contains `.rf` or `.rf.json` plus accepted legal files. Keep
its purpose and assumptions reviewable:

```text title="Policy Pack source"
baseline/
├── pack.rf
├── LICENSE
└── NOTICE
```

Rootform discovers language files recursively. Keep one `policy_pack`
declaration in each independently released pack root. To package several packs
in one command, place each pack in its own immediate child directory and pass
their parent. A pack cannot be reopened across declarations. Dialect
declarations and standalone `policy` blocks do not belong in this source family.

The public baseline example is a complete pack:

```hcl title="policy-packs/baseline/pack.rf"
policy_pack "baseline" {
  version = "0.1.0"

  requires {
    core = "0.1.0"
  }

  policy "private-database-reachability" {
    target = concept.core.managed-database

    assert = (
      length(relations("private-reachability", concept.core.virtual-network)) > 0 ||
      length(relations("private-reachability", concept.core.subnet)) > 0
    )

    message = "Managed databases must be privately reachable from a virtual network or subnet."
  }

  policy "cluster-network-context" {
    target = concept.core.kubernetes-cluster

    assert = length(contexts(context.core.network, concept.core.kubernetes-cluster)) > 0

    message = "Kubernetes clusters must belong to a network context."
  }
}
```

This is a demonstration pack, not universal assurance. Its database policy
expects a `private-reachability` relation that every provider Dialect does not
necessarily produce. Document that coverage boundary with any real pack.

<!-- rootform:steps -->

## Name and version the pack

`policy_pack "baseline"` establishes the package name. Policy identities are
`<pack>/<policy>`, such as
`baseline/private-database-reachability`. Names use lower kebab case.

`version` is an exact semantic version. Change it when released policy source,
requirements, or meaning changes. Published version tags are immutable; do not
reuse a version for different bytes.

## Declare direct requirements

Every concept and context reference in a Policy Pack is Dialect-qualified and
must name a directly required Dialect:

```hcl title="pack.rf"
requires {
  core = "0.1.0"
}
```

The value is exact, not a range. Loading a different `core` version makes
evaluation indeterminate because the loaded vocabulary did not necessarily
produce the facts the pack expects.

Requirements expose vocabulary to the compiler. They do not select a provider
Dialect for a project and do not let the pack read that Dialect's source values.

## Keep policies cohesive

Each policy should express one inspectable requirement. Name the target concept
and use a message that tells a reader what requirement failed:

```hcl title="pack.rf"
policy "cluster-network-context" {
  target = concept.core.kubernetes-cluster
  assert = length(contexts(context.core.network, concept.core.kubernetes-cluster)) > 0
  message = "Kubernetes clusters must belong to a network context."
}
```

Do not encode a severity in the name or message. Current policies have no
author-defined severity. A known false assertion is a violation; an unknown
decision is indeterminate.

Before adding a policy, identify which Dialect facts can satisfy it. If the
answer differs by provider or version, narrow the supported environment in the
pack documentation or split ownership rather than implying uniform coverage.

## Evaluate locally

Use a prepared infrastructure project whose lock selects the Dialects needed by
the architecture. Point `check` at the local pack source:

```sh
rootform check ./example --policy-pack ./baseline
```

The directory form compiles the local pack for authoring. It does not install
or lock it. Do not combine a local `--policy-pack` directory with `--locked`.

Inspect the compiled definitions and machine result:

```sh
rootform list policies --policy-pack ./baseline
rootform show policy baseline/cluster-network-context --policy-pack ./baseline
rootform check ./example --policy-pack ./baseline --format json
```

Review evaluation count, outcome, target, inspected fact IDs, diagnostics, and
violations. Include examples that pass, violate, and become indeterminate for
the intended reasons.

## Package deterministically

Compile the source root into a local OCI registry layout. Packaging is offline
and sends nothing to a registry:

```sh
rootform package policy-packs ./baseline \
  --to ./artifacts/policies \
  --source-url https://example.com/team/policies \
  --revision 0123456789abcdef0123456789abcdef01234567 \
  --documentation-url https://example.com/team/policies/docs \
  --licenses Apache-2.0
```

Run packaging twice from identical inputs when establishing a release process
and compare the output. Provenance values are explicit inputs; Rootform does not
discover them from a local Git checkout.

Publishing is a separate network operation:

```sh
rootform publish policy-packs ./artifacts/policies \
  --to registry.example/team/policy-packs
```

Projects select a reviewed OCI reference explicitly with
`rootform init --policy-pack`. Provider discovery never selects governance.

<!-- rootform:endsteps -->

Policy Packs have no inheritance, include, extension, or cross-pack call. A
project can select several independent packs through its CLI workflow. Keep
each pack's source self-contained and its direct vocabulary requirements exact.

See [Policy Pack reference](reference/policy-packs.md) for every field and
[Evaluation](reference/evaluation.md) for decision behavior.
