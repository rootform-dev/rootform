---
title: "RF Vocabulary"
description: "Complete RF Vocabulary 0.1.0 contract, including every embedded Concept and Context."
---

RF Vocabulary is Rootform's embedded cross-Dialect vocabulary. Its owner is
`rf`; its version is `0.1.0`.

It is not an installable Dialect, local extension, or Policy Pack. Authors do
not declare or download it. Compiler records exact vocabulary dependency when a
Dialect or Policy Pack references an `rf.*` symbol.

## Concepts

| ID | Exact contract |
| --- | --- |
| `rf.concept.kubernetes-cluster` | A declared Kubernetes cluster, excluding namespaces, node pools, and workload groups. |
| `rf.concept.managed-database` | A managed database service or instance, excluding logical tables and databases. |
| `rf.concept.object-storage-container` | An object storage container, excluding multi-service storage accounts. |
| `rf.concept.service-identity` | A principal explicitly intended for a non-human service or workload, excluding generic roles, permissions, bindings, and credentials. |
| `rf.concept.subnet` | A declared native subnet, not a CIDR literal. |
| `rf.concept.virtual-network` | An explicitly declared virtual network. |

These boundaries are normative. For example, a logical database inside a
managed service is not `rf.concept.managed-database`, and a role is not
`rf.concept.service-identity`.

## Contexts

| ID | Exact contract |
| --- | --- |
| `rf.context.network` | A declared network attachment without a connectivity guarantee. |
| `rf.context.runtime` | A declared execution environment or target without proof of effective execution. |

A network Context records declared attachment. It does not prove routing,
reachability, firewall allowance, or runtime traffic. A runtime Context records
declared execution placement. It does not prove that execution happened.

## Unsupported kinds

RF Vocabulary 0.1.0 defines:

- six Concepts;
- two Contexts;
- no Relations;
- no Rules.

Therefore `rf.relation.*` and `rf.rule.*` are invalid references.

## Using RF Vocabulary in a Dialect

```hcl title="subnet.rf.hcl"
rule "subnet" {
  match {
    type = "example_subnet"
  }

  as = rf.concept.subnet

  context {
    as  = rf.context.network
    to  = rf.concept.virtual-network
    via = source.network_id
  }
}
```

Use an RF symbol only when provider-specific meaning satisfies its complete
contract. Frequency or a similar name is insufficient.

## Using RF Vocabulary in a Policy Pack

```hcl title="network policy"
policy "subnet-has-network-context" {
  target {
    concept = rf.concept.subnet
  }

  assert = exists(
    contexts(rf.context.network, rf.concept.virtual-network)
  )

  message = "Each subnet must declare its virtual network."
}
```

Policy references are always owner-qualified, so `rf.` prefix is required.
Linking verifies exact vocabulary version and semantic digest against
Architecture IR.
