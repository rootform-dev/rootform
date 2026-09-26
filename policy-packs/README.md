# Policy Pack examples

Rootform separates architecture semantics from governance. Dialects interpret
plan and state instances; Policy Packs evaluate established architecture
facts. A Policy belongs to exactly one pack and never to a Dialect.

This directory contains synthetic public Policy Pack sources. Each pack root
has one `policy_pack` declaration, `.rf.hcl` or `.rf.json` source, and only allowed
license or notice files. File paths do not create Policy identity.

Policy Pack source declares no semantic dependency versions. References to the
RF Vocabulary and Dialect-owned symbols are qualified owner-first; exact
semantic dependencies are derived when the pack links against an Architecture
IR snapshot.

## `baseline/`

`baseline` is a portable example with two Policies:

- `baseline.policy.managed-database-network-context` requires managed
  databases to have a virtual-network or subnet context;
- `baseline.policy.cluster-network-context` requires Kubernetes clusters to
  have a virtual-network or subnet context.

These Policies demonstrate authoring and evaluation shape. They are not an
authoritative security baseline. Provider-neutral targets do not guarantee
equal Dialect coverage; inspect evaluation coverage before treating any result
as a gate.

## Validate and evaluate

```sh
rootform fmt --check policy-packs/baseline
rootform list policies --policy-pack ./policy-packs/baseline
rootform run ./examples/playground/commerce-platform/head/plan.json \
  --plan-file ./examples/playground/commerce-platform/head/plan.tfplan \
  --project ./examples/playground/commerce-platform/head \
  --policy-pack ./policy-packs/baseline --no-serve
```

Repository verification compiles this source with the exact Rootform binary,
packages it twice to prove deterministic OCI bytes, and validates publication
through an offline dry-run.

## Generic package and publication

Packaging and publication remain separate for explicitly distributed Policy
Packs:

```text
rootform package policy-packs policy-packs/baseline \
  --to LAYOUT --source-url URL --revision REV --documentation-url URL \
  --licenses Apache-2.0
rootform publish policy-packs LAYOUT --to registry.example/team/policy-packs
```

Packaging is local and offline. Publication validates the complete layout and
writes immutable `policy-pack-<name>-<version>` tags. Provenance is supplied
explicitly; Rootform never discovers it from Git or local machine paths.

Project selection comes only from an exact `rootform.lock` entry containing
pack name, version, content digest, tagless repository, manifest digest, layer
digest, and bounded sizes. `rootform init` acquires only that existing digest
pin. It never resolves a tag, selects a pack, or writes the lock.

See the [Policy Pack distribution contract](../contracts/policy-pack-distribution.md)
and [Policy Pack authoring guide](../docs/language/write-policy-pack.md).
