---
title: "Dialects"
description: "How Rootform gives provider declarations architecture meaning without guessing from resource names."
---

A Dialect is a versioned vocabulary and set of Rootform language rules. It tells
Rootform what provider declarations mean in an architecture.

Terraform parsing alone can find declarations, expressions, and references. It
cannot establish that a resource is a network boundary, that another belongs
inside it, or that a reference represents a particular relation. Dialects supply
those claims; Rootform does not infer them from names.

## Follow one declaration

Consider the subnet from [your first architecture](../getting-started/first-architecture.md):

```hcl title="main.tf"
resource "aws_subnet" "application" {
  vpc_id     = aws_vpc.main.id
  cidr_block = "10.20.1.0/24"
}
```

The AWS Dialect maps this declaration to a subnet scope. Its rule resolves
`vpc_id` to the VPC and records the subnet's network context there:

```hcl title="aws/network/vpc.rf"
rule "subnet" {
  match {
    kind = "resource"
    type = "aws_subnet"
  }
  as = concept.core.subnet

  context {
    as  = context.core.network
    to  = concept.core.virtual-network
    via = source.vpc_id
  }
}
```

The rule supplies interpretation; compilation records the resulting fact and
its provenance in [Architecture IR](architecture-ir.md). The renderer presents
that fact without re-running the rule.

Network context establishes placement, not traffic flow or deployed
connectivity. If `vpc_id` cannot be resolved, Rootform cannot claim that context.

Open the [Commerce platform Playground](https://docs.rootform.dev/playground/?mode=architecture&scenario=commerce-platform),
switch to **Plan**, and select `production_analytics`. Inspector shows the
cluster's network and ownership contexts, its node-pool contribution, and the
evidence behind those facts. The renderer presents established meaning; it does
not add placement from visual proximity.

## What a Dialect defines

A Dialect can represent entities, scopes, and supporting details; establish
contexts and relations; or combine several declarations into one architectural
component. The official `core` Dialect provides shared concepts such as virtual
network, subnet, and managed database. Provider Dialects map declarations to
that vocabulary or define more specific concepts.

Presentation stays separate. A Dialect can name an icon identity, but it cannot
define SVG, coordinates, HTML, or renderer behavior. It also cannot execute a
provider, fetch cloud data, read secrets, or turn unresolved evidence into a
successful fact.

## Select exact Dialects

`rootform init` discovers project providers and proposes compatible Dialects.
Directory forms of `build`, `check`, and `run` use the same preparation. An
unambiguous first run can create `rootform.lock`; it downloads required packages
only when they are not already available locally.

```sh
rootform init . --no-input
rootform list dialects
```

The lock records exact versions and content identities. Commit it so another
engineer can reproduce the interpretation. Installed versions outside this
project do not replace its selection.

Provider version evidence comes from configuration and `.terraform.lock.hcl`.
Unknown evidence produces a warning; known incompatibility blocks selection.
A supported provider can still contain resource types with no matching rule, so
read declaration accounting and diagnostics before claiming coverage.

Use [locks, vendor, and offline operation](../offline-security.md) for source
priority, update, and acquisition behavior. Those mechanics do not change what
a Dialect means.

## Inspect coverage

The public [Dialect catalog](https://github.com/rootform-dev/dialects/blob/main/dialects.json)
lists official packages and their coverage evidence. Inspect the selection used
by a project with:

```sh
rootform list dialects
rootform show dialect aws
```

`list dialects --installed` shows local packages; `--outdated` compares the
project lock with the cached official index. Neither command changes selection.
For an intentional update, follow [reproducible builds](../guides/reproduce-build.md).

## Dialects and policies answer different questions

A Dialect defines what the architecture means. A [Policy Pack](policies.md)
contains assertions evaluated against that architecture. Selecting a Dialect
never selects governance, and a policy cannot rewrite Dialect semantics.

To author a provider Dialect, start with [Write a Dialect](../dialect-authoring.md).
Use the [Language tour](../language/tour.md) for the `.rf` model or the
[Dialect reference](../language/reference/dialects.md) for exact fields.
