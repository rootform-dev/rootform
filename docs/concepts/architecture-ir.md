---
title: "Architecture IR"
description: "Understand the architecture document, its evidence, and the boundary between semantics and rendering."
---

Architecture IR is Rootform's saved, provider-neutral architecture document.
It records what the selected Dialects could establish from your inputs. The
renderer reads this document; it does not re-interpret Terraform.

## From declarations to architecture

A Terraform resource declaration names a provider object. A Dialect rule assigns
its architectural meaning. For example, an `aws_vpc` can become a virtual-network
scope, and an `aws_subnet` can become a subnet scope within its network context.
The result retains the declaration and rule that explain each conclusion.

| Part | Question it answers |
| --- | --- |
| Source accounting | What happened to every discovered declaration? |
| Semantic snapshot | Which exact Dialect versions, semantic digests, vocabulary, rules, and emissions interpret this document? |
| Architecture | Which entities, scopes, details, contexts, contributions, relations, and proven omissions were established? |
| Resolutions and provenance | Which evidence supports those facts? |
| Diagnostics | What could not be established? |

A declaration is **represented** when it creates an architectural subject,
**supporting a composition** when it contributes to a combined subject,
**filtered** when a matching rule intentionally omits it, **unsupported** when
no rule covers it, or **failed** when Rootform cannot establish its outcome.
A small graph therefore does not prove complete coverage. Read the accounting
alongside it.

## Meaning stays separate from layout

An **entity** is an architectural thing, such as a compute workload. A **scope**
is a boundary that provides context, such as a virtual network. A **context**
relates a subject to a context-providing representation along a named dimension.
That target can be a scope or an entity: a cluster entity can provide runtime
context without becoming a scope. Network and runtime are different dimensions;
a subject can have both without one replacing the other.

A **relation** connects architectural participants with a declared meaning.
Its direction and qualified predicate matter. A **detail** is a supporting representation; a
**contribution** attaches that detail to an entity or scope. Several Terraform
declarations can therefore support one visible component; one shape does not
necessarily equal one resource block.

The document contains stable identities and semantic facts. It contains no
canvas coordinates, route geometry, or UI state. Changing from Survey to Plan,
opening Focus, or moving the camera does not change the architecture.

A context asserts a dimension such as network placement. A relation asserts
its declared architectural meaning. Neither is interchangeable with a raw
Terraform dependency. See [Dialects](dialects.md) for the rule boundary.

## Follow a fact back to its evidence

For the first tutorial, the subnet's source address is
`aws_subnet.application`. Its `vpc_id` expression refers to `aws_vpc.main`.
The AWS Dialect uses that evidence to resolve the subnet's network context.
Inspector exposes the supporting source and rule; the document retains the
successful resolution behind that conclusion.

Provenance explains the claim without embedding the raw configuration or its
values. A source address and file location can still reveal infrastructure
structure, so review saved documents before sharing them.

If a reference cannot be resolved, Rootform attaches a diagnostic to authored
emission. It does not create a plausible target or claim no target exists.
Known optional absence records an omission. Facts, omissions, and diagnostics
together distinguish proven zero from unknown.

## Save and reuse a document

```sh
rootform build . --locked --output architecture.json
rootform run architecture.json
rootform explain architecture aws_subnet.application --input architecture.json
```

Serving a saved architecture does not acquire Dialects or re-read its Terraform
source. The explanation above uses the address from the first tutorial. The
file can also be an input to `check`, `diff`, and `explain architecture --input`.
Policy evaluation still needs selected compiled Policy Packs. A compiled pack
and saved IR evaluate offline without producer Dialects or recompilation.

Equivalent inputs and exact semantic selections produce deterministic output.
A comparison must reject incompatible Dialect selections and invalid documents;
it cannot report an empty diff when comparison was unavailable.

The file is a generated artifact. Change Terraform/OpenTofu to change declared
infrastructure, then rebuild. Editing JSON by hand can break identities,
references, accounting, or provenance; consumers validate those constraints.

The Architecture IR format version is independent of the executable version.
Use `rootform version` to identify your binary and the document's
`format_version` to identify its data contract.

## Read the contract

The [Architecture IR contract](../../contracts/architecture-ir.md) and
[JSON Schema](../../schemas/architecture-ir.schema.json) define the public
format. Use them when building a consumer. Use the [renderer guide](../renderer/index.md)
when you want to understand the picture.
