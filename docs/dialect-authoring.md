---
title: "Write a Dialect"
description: "Define provider interpretation in RF, prove it with fixtures, and package reviewed source."
---

A Dialect adds architectural meaning to normalized source declarations. Build
Rules from provider evidence, not names or desired diagram shape.

For each Rule prove:

1. exact source declaration eligibility;
2. architectural classification, emission, or composition it contributes;
3. source path proving each result.

<!-- rootform:steps -->

## Create source root

```tree title="Dialect package"
example/
├── dialect.rf.hcl
├── vocabulary.rf.hcl
├── network/
│   └── virtual-network.rf.hcl
└── presentation.json
```

Files organize reviews only. Exactly one `dialect` declaration identifies
whole recursive root.

## Declare identity and provider

```rf title="aws/dialect.rf.hcl"
dialect "aws" {
  version = "0.1.0"

  provider "hashicorp/aws" {
    version = "= 6.62.0"
  }
}
```

No Dialect imports another. References may target local owner or embedded RF
Vocabulary. RF dependency is derived automatically from `rf.*` references.
Provider constraint must match tested evidence.

## Define only local vocabulary needed

Use RF Vocabulary where contract is exact:

- `rf.concept.virtual-network` and `rf.concept.subnet`;
- `rf.concept.kubernetes-cluster`, `rf.concept.managed-database`,
  `rf.concept.object-storage-container`, and `rf.concept.service-identity`;
- `rf.context.network` and `rf.context.runtime`.

Define distinct local meaning without Concept kind:

```rf title="vocabulary.rf.hcl"
concept "load-balancer" {
  description = "A load-balancing service."
}

context "project" {
  description = "Placement in a provider project."
}
```

Local IDs become `example.concept.load-balancer` and
`example.context.project`. Descriptions document contract; they do not control
architectural structure or establish facts.

## Add smallest complete Rule

```rf title="aws/network/vpc.rf.hcl"
rule "vpc" {
  match {
    kind = "resource"
    type = "aws_vpc"
  }

  as = rf.concept.virtual-network
}

rule "subnet" {
  match {
    kind = "resource"
    type = "aws_subnet"
  }

  as = rf.concept.subnet

  context {
    as  = rf.context.network
    to  = rf.concept.virtual-network
    via = source.vpc_id
  }
}
```

Match-only Rules are invalid. `match.kind` defaults to resource;
`match.type` is required exact adapter type. `where` may narrow with bounded
typed expression, but unknown value never becomes match.

Every normalized resource already has base representation. Rule enriches same
identity. Data source requires successful Rule to gain representation.

## Add facts and composition deliberately

Use context for named placement, relation for directed domain predicate, and
contribution for non-absorbing support. `to` accepts Concept or applied Rule;
`via` starts at source or provider. Explicit scalar matching supports only
`exact` and `dot-ancestor`.

Common placement patterns stay small:

```rf title="Direct parent proved by a resource reference"
context {
  as  = context.ownership
  to  = concept.parent
  via = source.parent_id
}
```

- Use an ownership Context for an API or lifecycle parent when the traversal
  resolves that exact parent. A resource-group name is administrative
  placement only when the provider contract says the resource is created in
  that group.
- Use a domain Context such as `rf.context.network` when the reference proves
  placement in that domain. It may coexist with administrative ownership.
- Keep an association with several beneficiaries as Contributions when no
  unique parent exists. If the API independently proves one parent, emit that
  Context and retain the distinct Contributions.
- Add a Relation only for a documented interaction. A shared traversal may
  prove both placement and interaction when those facts have different
  meanings.

Literal, missing, dynamic, incompatible, or ambiguous evidence establishes no
placement. Test those cases beside the successful parent and full ancestor
path; never add a fallback parent from resource type or naming.

Composition members are required, ordered, and exclusive. Failure rejects
whole composite Rule application. Resource root and resource members keep base
representations; members do not inherit root Rule or Concept.

## Compile and inspect definitions

<!-- docs-check:docs-dialect-authoring-1 -->
```sh
rootform fmt --check .
rootform validate dialects .
rootform validate rule aws.rule.subnet
rootform show aws.rule.subnet
rootform show rf.concept.subnet
```

Named commands use owner-first IDs. Bare name works only when unambiguous.

## Prove consequences with fixtures

```tree title="Dialect fixture"
fixtures/example/minimal/
├── main.tf
└── architecture.golden
```

<!-- docs-check:docs-dialect-authoring-2 -->
```sh
rootform test ./fixtures
rootform test ./fixtures --run example/minimal
```

The active catalog includes embedded Dialects, project selections, and any
override. While authoring, pass `--dialect ./dialects/payments` to `build`,
`test`, `validate rule`, `list`, `show`, or `explain` to try a source directory
without changing the lock. Every command that reads Dialects accepts the same
flag. Use `rootform add dialects ./dialects/payments` when the project should
retain it. Review
base representations, interpretations, facts, omissions, memberships,
diagnostics, and deterministic bytes.

## Keep presentation separate

Optional `presentation.json` maps source resource identities independently of
Rule coverage. Real Rules and Concepts may also receive identities and labels:

```json title="aws/presentation.json"
{
  "format_version": "1",
  "resources": {
    "resource/aws_vpc": "generic/network",
    "resource/aws_subnet": "generic/subnet"
  },
  "rules": {
    "vpc": "generic/network",
    "subnet": "generic/subnet"
  },
  "concepts": {},
  "resource_labels": {
    "resource/aws_vpc": "Amazon VPC",
    "resource/aws_subnet": "Amazon VPC subnet"
  },
  "rule_labels": {
    "vpc": "Amazon VPC",
    "subnet": "Amazon VPC subnet"
  },
  "concept_labels": {}
}
```

Resource mappings work even when type has no Rule. Manifest contains no SVG,
HTML, URL, style, layout, architecture fact, or behavior. Normal runs warn and
ignore invalid presentation; `rootform package dialects` rejects it. See
[presentation contract](../contracts/presentation-manifest.md).

## Package and publish a Dialect

Packaging stays local and offline. Package a Dialect with its own owner, such
as the local `payments` Dialect; embedded owners such as `aws` cannot be
packaged:

<!-- docs-check:docs-dialect-authoring-3 -->
```sh
rootform package dialects ./dialects/payments --to artifacts/oci \
  --source-url https://example.com/team/dialects \
  --revision "$(git rev-parse HEAD)" \
  --documentation-url https://example.com/team/dialects/docs \
  --licenses MPL-2.0
```

Generic publication is separate:

<!-- docs-check:docs-dialect-authoring-4 -->
```sh
rootform publish dialects artifacts/oci \
  --to registry.example/team/dialects
```

V0 has no official Dialect index and no mutable discovery tag.

## Use a published Dialect

From the project root, add the published reference. Rootform resolves and
records the exact identity:

<!-- docs-check:authoring-add-published -->
```sh
cd ./infra
rootform add dialects \
  registry.example.com/team/dialects:dialect-payments-0.1.0
rootform init . --locked --no-input
rootform build . --locked
```

The reference is illustrative; use the published reference you reviewed.
Run `add` from the same project root that `init` and `build` use. Set
`DOCKER_CONFIG` before acquisition if the registry needs credentials. `init`
acquires only recorded exact pins. See
[External content storage](reference/storage.md) for locations.

<!-- rootform:endsteps -->

See [Test and validate](language/test-validate.md),
[Dialect reference](language/reference/dialects.md), and
[Rules](language/reference/rules.md).
