---
title: "Write a Dialect"
description: "Define provider interpretation in RF, prove it with fixtures, and package reviewed source."
---

A Dialect adds architectural meaning to plan or state instances. Start with a
small provider case whose exported plan you can inspect. Build Rules from
that evidence, not names or a desired diagram shape.

For each Rule prove:

1. exact instance eligibility;
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
    as       = rf.context.network
    to       = rf.concept.virtual-network
    via      = source.vpc_id
    on_null  = "absent"
    on_empty = "absent"
  }
}
```

Match-only Rules are invalid. `match.kind` defaults to resource;
`match.type` is required exact adapter type. `where` may narrow with bounded
typed expression, but unknown value never becomes match.

Every observed managed and data instance already has a representation. A Rule
enriches that same instance; lack of a matching Rule never erases it.

## Add facts and composition deliberately

Use context for named placement, relation for a directed domain predicate, and
contribution for support that does not absorb its source. First identify the
target Concept or Rule in `to`, then choose a `via` path backed by the provider's
evaluated value. Set `on_null` and `on_empty` on every emission: they say whether
those values prove absence or leave the [closure indeterminate](language/reference/emissions.md#omission-and-uncertainty).

When a value identifies a target by attribute rather than a direct traversal,
declare that target's identity attributes on its Rule. List alternative
`match.by` paths in priority order. The supported comparison modes and their
limits belong to [explicit attribute matching](language/reference/emissions.md#explicit-attribute-match).
An unknown, sensitive, incompatible, or ambiguous candidate leaves the closure
indeterminate. Do not turn it into a guessed edge.

Use a `provider.<path>` only when the provider configuration names a managed
resource through a direct reference in a verified saved plan. Rootform can
follow simple pass-through variables, locals, and module outputs for the
`planned` stage. A literal, transformed expression, state input, historical
stage, OpenTofu provider `for_each`, or JSON configuration syntax provides no
such proof; the closure stays `indeterminate (unavailable)`. Rootform does not
read literal provider configuration values, whose sensitivity the plan export
cannot identify. See [traversal evidence](language/reference/traversals.md).

Allow an external endpoint only when the referenced object may truly be outside
the plan's inventory. Choose its identity disclosure level deliberately; it
never permits a sensitive value into a Rootform document.

Common placement patterns stay small:

```rf title="Direct parent proved by a resource reference"
context {
  as       = context.ownership
  to       = concept.parent
  via      = source.parent_id
  on_null  = "absent"
  on_empty = "absent"
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

Check the source before interpreting a plan. The validation result identifies
the first invalid path; `show` then confirms which qualified Rule and Concept
the active catalog contains.

<!-- docs-check:docs-dialect-authoring-1 -->
```sh
rootform fmt --check .
rootform validate dialects .
rootform validate rule aws.rule.subnet --dialect .
rootform show aws.rule.subnet --dialect .
rootform show rf.concept.subnet
```

Named commands use owner-first IDs. Bare name works only when unambiguous.

## Prove consequences with fixtures

```tree title="Dialect fixture"
fixtures/example/minimal/
├── main.tf
├── plan.json
├── plan.tfplan
└── analysis.golden
```

Export `plan.json` from a saved `plan.tfplan` and keep both beside the exact
`main.tf` used to produce them. OpenTofu users run the same commands with
`tofu`. Saved plans and plan JSON can contain secrets in clear text; keep
them out of Git and public artifacts. Rootform reads them locally; it never
runs Terraform or OpenTofu and never contacts providers. The golden is a Rootform document,
not a copy of the plan. [Plan inputs](inputs/plans.md) covers the export.

Inspect one `rootform run plan.json --plan-file plan.tfplan --dialect . --no-serve`
result before recording the golden. Look for the expected instance, Rule,
facts, and closure outcomes; a successful exit alone does not prove the Rule
created the intended fact. Then record or compare fixtures:

<!-- docs-check:docs-dialect-authoring-2 -->
```sh
rootform test ./fixtures --dialect . --update
rootform test ./fixtures --dialect .
rootform test ./fixtures --dialect . --run example/minimal
```

`--update` writes the expected document for review. The next command compares
the real analysis against it; status `0` means every selected case passed,
`1` means a case differed, and `3` means no case matched. `--run` narrows cases
by name. Review the golden diff before accepting a changed Rule. The local
`--dialect` override lasts one command and leaves `rootform.lock` unchanged;
`run`, `test`, `validate`, `list`, `show`, and `explain` accept it. Select the
source with `rootform add dialects` only when the project should retain it.

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

Packaging stays local and offline. The `aws` source above teaches Rule
authoring, but an embedded owner cannot be packaged. For distribution, finish
and test a Dialect under your own owner, such as `./dialects/payments`, then
package that reviewed source. The following commands assume it exists:

<!-- docs-check:docs-dialect-authoring-3 -->
```sh
rootform package dialects ./dialects/payments --to artifacts/oci \
  --source-url https://example.com/team/dialects \
  --documentation-url https://example.com/team/dialects/docs \
  --licenses MPL-2.0
```

The result names the packaged Dialect and local destination. Before publishing,
record the reviewed source revision with `--revision` when your publication
process requires that provenance. Packaging itself sends nothing to a registry.
Generic publication is separate:

<!-- docs-check:docs-dialect-authoring-4 -->
```sh
rootform publish dialects artifacts/oci \
  --to registry.example.com/team/dialects
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
```

After exporting a plan for this project, analyze it with `rootform run plan.json --project . --locked --no-serve`.

The reference is illustrative; use the published reference you reviewed.
Run `add` from the same project root that `init` and `run` use. Set
`DOCKER_CONFIG` before acquisition if the registry needs credentials. `init`
acquires only recorded exact pins. See
[External content storage](reference/storage.md) for locations.

<!-- rootform:endsteps -->

See [Test and validate](language/test-validate.md),
[Dialect reference](language/reference/dialects.md), and
[Rules](language/reference/rules.md).
