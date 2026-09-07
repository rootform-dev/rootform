---
title: "Architecture IR"
description: "Understand the architecture document, its evidence, and the boundary between semantics and rendering."
---

Architecture IR is Rootform's saved, provider-neutral architecture document.
It records what the selected Dialects could establish from your inputs. The
renderer reads this document; it does not re-interpret Terraform.

## From declarations to architecture

A Terraform declaration names a provider resource. A Dialect rule assigns its
architectural meaning. For example, an `aws_vpc` can become a virtual-network
scope, and an `aws_subnet` can become a subnet scope within its network context.
The result retains the declaration and rule that explain each conclusion.

| Part | Question it answers |
| --- | --- |
| Source accounting | What happened to every discovered declaration? |
| Dialect identities | Which exact semantics produced this document? |
| Architecture | Which entities, scopes, details, contexts, contributions, and relations were established? |
| Resolutions and provenance | Which evidence supports those facts? |
| Diagnostics | What could not be established? |

A declaration can be represented, support a composition, be filtered by an
accepted rule, remain unsupported, or fail with a diagnostic. A small graph
therefore does not prove complete coverage. Read the accounting alongside it.

## Meaning stays separate from layout

The document contains stable identities and semantic facts. It contains no
canvas coordinates, route geometry, or UI state. Changing from Survey to Plan,
opening Focus, or moving the camera does not change the architecture.

A context asserts a dimension such as network placement. A relation asserts
its declared architectural meaning. Neither is interchangeable with a raw
Terraform dependency. See [Dialects](dialects.md) for the rule boundary.

## Save and reuse a document

```sh
rootform build . --locked --output architecture.json
rootform run architecture.json
```

Serving a saved architecture does not acquire Dialects or re-read its Terraform
source. The file can also be an input to `check`, `diff`, and `explain`.
Policy evaluation still needs the Policy Packs selected for that operation.

Equivalent inputs and exact semantic selections produce deterministic output.
A comparison must reject incompatible Dialect selections and invalid documents;
it cannot report an empty diff when comparison was unavailable.

## Read the contract

The [Architecture IR contract](../../contracts/architecture-ir.md) and
[JSON Schema](../../schemas/architecture-ir.schema.json) define the public
format. Use them when building a consumer. Use the [renderer guide](../renderer/index.md)
when you want to understand the picture.
