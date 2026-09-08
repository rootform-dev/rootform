---
title: "Dialects"
description: "How Rootform turns provider declarations into architecture meaning, without guessing from resource names."
rendererLesson:
  example: azure
  title: "See the semantic result"
  description: "Explore a larger Azure architecture: select a resource, then inspect the rules and references behind its placement."
---

A Dialect is a versioned set of Rootform Language definitions and rules.
It tells Rootform what provider declarations mean in an architecture.
Selecting a Dialect changes the semantics used to build the document.

Generic Terraform reading can find declarations, expressions, and references.
It cannot establish what each provider's resources mean architecturally.
A Dialect supplies the rules for network placement, a declaration's role in a
larger component, or a particular relation. Rootform does not infer those rules
from resource names.

## Follow one declaration

Consider the subnet from the [first architecture](../getting-started/first-architecture.md):

```hcl title="main.tf"
resource "aws_subnet" "application" {
  vpc_id     = aws_vpc.main.id
  cidr_block = "10.20.1.0/24"
}
```

The AWS Dialect maps this declaration to a subnet scope. Its rule resolves
`vpc_id` to the declared VPC and records a network context between the two
scopes. The architecture retains that successful resolution as provenance.

Here is the actual subnet rule from the official AWS Dialect:

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

The `.rf` rule supplies the interpretation. Compilation establishes architecture
facts in the [IR](architecture-ir.md); the renderer presents those facts. It does
not reinterpret the Terraform or execute this rule itself.

This is a network-placement fact. It does not establish traffic flow or prove
that a deployed subnet can reach another service. If the reference cannot be
resolved, Rootform must not invent that context.

<!-- rootform:lesson -->

The example above uses Azure's own Dialect rules. The same separation holds:
source declarations, semantic facts, then their visual presentation.

## What a Dialect can express

Rootform Language separates representations from the facts connecting them.
An entity represents a component; a scope can provide context; a detail can
contribute supporting information. Contexts describe placement by dimension.
Relations carry declared domain meaning. Compositions can combine multiple
source declarations into one architectural representation.

These definitions belong to the semantic layer. Icons are separate presentation
identities. A Dialect cannot specify SVG, HTML, coordinates, or behavior for
the renderer.

Dialects can share vocabulary through exact requirements. The official
`core` Dialect defines concepts such as virtual network, subnet, and managed
database. Provider Dialects map their own declarations to those shared concepts
or define more specific ones. This lets a reader recognize a network across
providers without pretending that every provider exposes the same capabilities.

A Dialect cannot execute a provider, fetch missing cloud data, read arbitrary
secrets, or make a deployment claim. It cannot turn an unresolved reference into
a successful fact. A declared relation type and a plausible resource name are
not sufficient evidence that a relation exists.

## Selection is part of the architecture

`rootform init` discovers providers and selects compatible Dialects from the
configured sources. Directory forms of `build`, `check`, and `run` share this
preparation. An unambiguous first run can create `rootform.lock` and continue.

```sh
rootform init . --no-input
rootform list dialects
```

Run the listing from the prepared project root. Installed versions elsewhere
in your Rootform home are not a substitute for the project's selection.
The lock records exact versions and content identities. Commit it so another
engineer can reproduce the same interpretation.

Provider version evidence comes from Terraform/OpenTofu configuration and
`.terraform.lock.hcl`. Unknown evidence produces a warning; reliable incompatible
evidence blocks that Dialect. An uncovered provider remains explicit rather
than acquiring guessed semantics.

### How selection reaches a decision

Rootform discovers provider source addresses in the chosen root, then considers
the official index and any explicitly configured sources. A candidate's provider
compatibility and exact Dialect requirements constrain the resolved set. One set
contains at most one version of each Dialect.

An additional source does not get priority over another source. Conflicting
identities or ambiguous candidates need an explicit resolution; no-input mode
fails rather than choosing arbitrarily. A coherent existing lock is reused.
Upgrade is an explicit initialization operation.

The lock fixes semantic content and presentation separately. Rebuilding with
the same input and selections produces deterministic architecture facts.
Changing an icon does not change semantic content; changing a rule can change
the architecture. [Architecture IR](architecture-ir.md) records which semantics
established the result and preserves its provenance.

### Missing coverage stays visible

A provider can be recognized while some of its resource types have no matching
rule. For example, the `secrets` Dialect supports `random_password`; provider
support does not imply that every `hashicorp/random` resource is represented.

Read declaration accounting to distinguish represented, supporting, filtered,
unsupported, and failed input. An uncovered provider in a partly supported
project can leave unsupported declarations in an otherwise built architecture.
A project containing only uncovered providers cannot build from the empty
Dialect selection recorded during initialization. See
[limitations](../limitations.md) and [troubleshooting](../troubleshooting/index.md).

## Discover and inspect Dialects

The public [Dialect catalog](https://github.com/rootform-dev/dialects/blob/main/dialects.json)
lists official packages. Coverage extends beyond cloud infrastructure to
Kubernetes and services such as Grafana, Datadog, Vault, and Kestra. Read each
Dialect's definitions and coverage evidence before relying on a specific resource.

Local inspection answers a different question:

```sh
rootform list dialects
rootform show dialect aws
rootform list dialects --installed
rootform list dialects --outdated
```

The first listing reports this project's selection; `show` inspects a selected
Dialect (use its actual name). `--installed` lists local installed versions.
`--outdated` compares the lock with the cached official index. These listings
do not contact a registry or upgrade anything. A missing cached index is reported
as unavailable.

For an intentional update, follow [reproducible builds](../guides/reproduce-build.md).
The [generated CLI reference](../reference/cli/list/dialects.md) gives the exact
listing and output flags.

## Distribution and offline use

Official Dialects are maintained in the public
[Dialects repository](https://github.com/rootform-dev/dialects).
OCI registries distribute immutable artifacts; an index supports discovery.
A registry location is a source of bytes, not a source of architectural truth.
Rootform verifies the selected artifact before using it.

[Locked runs and vendoring](../offline-security.md) separate exact selection
from acquisition. `--locked` can still download an exact missing artifact.
`--offline` prevents that download. When a project vendor directory exists,
it is the exclusive execution source: incomplete vendor content is an error.

## Governance is separate

A Dialect defines what the architecture means. A
[Policy Pack](policies.md) defines policies that evaluate that architecture.
Selecting a Dialect never selects governance. Policy Packs cannot rewrite
Dialect semantics.

To extend provider coverage, start with [Write a Dialect](../dialect-authoring.md).
Rootform Language (`.rf`) is the authoring surface shared by Dialects and
Policy Packs; this page explains the Dialect's role rather than teaching that language.
Follow the [Language tour](../language/tour.md) to connect real definitions to
their consequences, or use the [Dialect reference](../language/reference/dialects.md)
for exact fields. To inspect generated facts, read
[Architecture IR](architecture-ir.md).
