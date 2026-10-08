# Policy Pack examples

Rootform separates architecture semantics from governance. Dialects interpret
plan and state instances; Policy Packs evaluate established architecture
facts. A Policy belongs to exactly one pack and never to a Dialect.

This directory contains synthetic public Policy Pack sources. Each pack root
has one `policy_pack` declaration, `.rf.hcl` or `.rf.json` source, and only allowed
license or notice files. File paths do not create Policy identity.

Policy Pack source declares no semantic dependency versions. References to the
RF Vocabulary and Dialect-owned symbols are qualified owner-first; exact
semantic dependencies are derived when the pack links against an Form.

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

## Check a saved Form

```sh
rootform fmt --check policy-packs/baseline
rootform list policies --policy-pack ./policy-packs/baseline
rootform check ./examples/playground/commerce-platform/head/plan.json \
  --plan-file ./examples/playground/commerce-platform/head/plan.tfplan \
  --project ./examples/playground/commerce-platform/head \
  --policy-pack ./policy-packs/baseline
```

Save the analyzed Form once and reuse it for later checks. To select this local
Pack for a project, run `rootform add policy-packs ./policy-packs/baseline`.
To select published content instead, use its OCI repository and version with
the same command; [Add external content](../docs/guides/external-content.md)
shows both workflows.

## Generic package and publication

Packaging and publication remain separate for explicitly distributed Policy
Packs:

`LAYOUT` is a fresh local OCI layout directory; `REV` is the exact source
commit. Replace the source and documentation `URL` values with their public
URLs, and `registry.example/team/policy-packs` with your writable OCI repository.
Publishing requires TLS and registry authentication through `DOCKER_CONFIG`.

```text
rootform package policy-packs policy-packs/baseline \
  --to LAYOUT --source-url URL --revision REV --documentation-url URL \
  --licenses Apache-2.0
rootform publish policy-packs LAYOUT --to registry.example/team/policy-packs
```

Packaging is local and offline. Publication validates the complete layout and
writes immutable `policy-pack-<name>-<version>` tags. Provenance is supplied
explicitly; Rootform never discovers it from Git or local machine paths.

Project selection comes from `rootform.lock`, which records either a local
source path and content digest or an exact OCI identity. `rootform init` acquires only that existing digest
pin. It never resolves a tag, selects a pack, or writes the lock.

See the [Policy Pack distribution contract](../contracts/policy-pack-distribution.md)
and [Policy Pack authoring guide](../docs/language/write-policy-pack.md).
