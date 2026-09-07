---
title: "Dialects"
description: "How Rootform turns provider declarations into architecture meaning, without guessing from resource names."
---

A Dialect is a versioned set of Rootform Language definitions and rules.
It tells Rootform what provider declarations mean in an architecture.
Selecting a Dialect changes the semantics used to build the document.

A provider schema can tell you that a field exists. A Dialect tells Rootform
whether that field establishes network placement, contributes to a larger
component, or supports a particular relation.

## Follow one declaration

Consider the subnet from the [first architecture](../getting-started/first-architecture.md):

```hcl title="main.tf (excerpt)"
resource "aws_subnet" "application" {
  vpc_id     = aws_vpc.main.id
  cidr_block = "10.20.1.0/24"
}
```

The AWS Dialect maps this declaration to a subnet scope. Its rule resolves
`vpc_id` to the declared VPC and records a network context between the two
scopes. The architecture retains that successful resolution as provenance.

This is a network-placement fact. It does not establish traffic flow or prove
that a deployed subnet can reach another service. If the reference cannot be
resolved, Rootform must not invent that context.

## What a Dialect can express

Rootform Language separates representations from the facts connecting them.
An entity represents a component; a scope can provide context; a detail can
contribute supporting information. Contexts describe placement by dimension.
Relations carry declared domain meaning. Compositions can combine multiple
source declarations into one architectural representation.

These definitions belong to the semantic layer. Icons are separate presentation
identities. A Dialect cannot specify SVG, HTML, coordinates, or behavior for
the renderer.

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

To extend provider coverage, start with [Dialect authoring](../dialect-authoring.md).
To inspect the generated facts, read [Architecture IR](architecture-ir.md).
