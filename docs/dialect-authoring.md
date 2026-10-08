---
title: "Write a Dialect"
description: "Define provider interpretation in RF, prove it with fixtures, and package reviewed source."
---

A Dialect adds architectural meaning to plan or state instances. Start with a
small provider case whose exported plan you can inspect. Build Rules from
that evidence, not names or a desired diagram shape.

For each Rule, verify:

1. exact instance eligibility;
2. architectural classification, emission, or composition it contributes;
3. source path proving each result.

Start with [Read a Rule](language/learn/read-a-rule.md) and
[Evidence and target resolution](language/learn/evidence-targets.md) if the
connection between a provider attribute and an architectural fact is unclear.

<!-- rootform:steps -->

## Create source root

```tree title="Dialect package"
project/
└── dialects/
    └── payments/
        ├── dialect.rf.hcl
        ├── vocabulary.rf.hcl
        ├── network/
        │   └── virtual-network.rf.hcl
        └── presentation.json
```

Run the commands below from `project/`. Files can divide the source for review,
but one `dialect` declaration owns the entire recursive source tree.

## Declare identity and provider

```rf title="dialects/payments/dialect.rf.hcl"
dialect "payments" {
  version = "0.1.0"

  provider "hashicorp/aws" {
    version = "= 6.62.0"
  }
}
```

A Dialect cannot import another. References can target its own definitions or
the embedded RF Vocabulary; Rootform records the latter dependency from
`rf.*` references. The provider constraint should match versions you tested.

## Add local terms when needed

Use the RF Vocabulary when its terms match what your provider evidence can
establish:

- `rf.concept.virtual-network` and `rf.concept.subnet`;
- `rf.concept.kubernetes-cluster`, `rf.concept.managed-database`,
  `rf.concept.object-storage-container`, and `rf.concept.service-identity`;
- `rf.context.network` and `rf.context.runtime`.

Use a local Concept or Context for a term outside that shared vocabulary:

```rf title="dialects/payments/vocabulary.rf.hcl"
concept "load-balancer" {
  description = "A load-balancing service."
}

context "project" {
  description = "Placement in a provider project."
}
```

With the `payments` owner above, these IDs are
`payments.concept.load-balancer` and `payments.context.project`. Descriptions
document meaning; they do not create architectural facts.

## Write a complete Rule

```rf title="dialects/payments/network/virtual-network.rf.hcl"
rule "vpc" {
  match {
    kind = "resource"
    type = "aws_vpc"
  }

  as = rf.concept.virtual-network

  identity {
    attributes = ["id"]
  }

  endpoint {
    attributes = ["id"]
  }
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

    match {
      by       = target.id
      strategy = "exact"
    }
  }
}
```

Match-only Rules are invalid. `match.kind` defaults to `resource`.
`match.type` must name the exact resource type exposed by the input adapter.
`where` can narrow eligibility with a bounded, typed expression, but an
unknown value does not establish a match.

Every observed managed and data instance already has a Representation. A Rule
enriches that same instance; lack of a matching Rule never erases it.

## Add facts and composition deliberately

Use a Context for named placement, a Relation for a directed domain predicate,
and a Contribution for support that does not absorb its source. First identify
the target Concept or Rule in `to`, then choose a `via` path backed by the provider's
evaluated value. Set `on_null` and `on_empty` on every emission: they say whether
those values prove absence or leave the [closure indeterminate](language/reference/emissions.md#omission-and-uncertainty).

When a value identifies a target by attribute rather than a direct traversal,
declare that target's identity attributes on its Rule. List alternative
`match.by` paths in priority order. The supported comparison modes and their
limits belong to [explicit attribute matching](language/reference/emissions.md#explicit-attribute-match).
An unknown, sensitive, incompatible, or ambiguous candidate leaves the closure
indeterminate. Do not turn it into a guessed edge.

Use a `provider.<path>` only when the provider configuration names a managed
resource through a direct reference in a paired saved plan. Rootform can
follow simple pass-through variables, locals, and module outputs for the
`planned` stage. A literal, transformed expression, state input, historical
stage, OpenTofu provider `for_each`, or JSON configuration syntax provides no
such proof; the closure stays `indeterminate (unavailable)`. Rootform does not
read literal provider configuration values, whose sensitivity the plan export
cannot identify. See [traversal evidence](language/reference/traversals.md).

Allow an external endpoint only when the referenced object may truly be outside
the plan's inventory. Choose its identity disclosure level deliberately; it
never permits a sensitive value into a Form.

Choose a fact whose meaning matches what the provider evidence proves:

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

For the direct-reference pattern above, a literal has no reference proof.
An explicit identity match can establish a known literal value instead.
Test missing, unknown, sensitive, transformed and ambiguous evidence beside
the successful parent; never add a fallback parent from type or naming.

Composition members are ordered. An unresolved member stays on its root with
a reason; dependent later members remain unresolved, while independent ones
may resolve. The root keeps its classification and emissions. Members keep
their Representations and do not inherit the root Rule or Concept. See
[Understand composition](language/learn/composition.md).

## Compile and inspect definitions

Check the source before interpreting a plan. The validation result identifies
the first invalid path; `show` then confirms which qualified Rule and Concept
the active catalog contains.

The `aws_vpc` and `aws_subnet` types also match Rules in embedded `aws`. A
`--dialect` override adds a source for one command; it does not exclude that
embedded owner. For this walkthrough, select `payments` and exclude embedded
`aws` in the project lock once, before analyzing or testing:

<!-- docs-check:docs-dialect-authoring-1 -->
```sh
rootform fmt --check ./dialects/payments
rootform validate dialects ./dialects/payments
rootform validate rule payments.rule.subnet --dialect ./dialects/payments
rootform show payments.rule.subnet --dialect ./dialects/payments
rootform show rf.concept.subnet
rootform add dialects ./dialects/payments
rootform remove dialects aws --embedded
rootform init . --locked --offline --no-input
```

Named commands use owner-first IDs. Bare names work only when unambiguous. The
following plan and fixture commands use this recorded selection, without a
`--dialect` override. `test` reads selection from the directory under test.
Use `test .` from `project/` to keep the authoring selection while discovering
nested fixtures.

## Prove consequences with fixtures

```tree title="Dialect fixture"
fixtures/payments/minimal/
├── main.tf
├── plan.json
├── plan.tfplan
└── analysis.golden
```

Export `plan.json` from a saved `plan.tfplan` and keep both beside the exact
`main.tf` used to produce them. OpenTofu users run the same commands with
`tofu`. Saved plans and plan JSON can contain secrets in clear text; keep
them out of Git and public artifacts. Rootform reads them locally; it never
runs Terraform or OpenTofu and never contacts providers. The golden is a Form,
not a copy of the plan. [Plan inputs](inputs/plans.md) covers the export.

Inspect one `rootform run fixtures/payments/minimal/plan.json --plan-file fixtures/payments/minimal/plan.tfplan --no-serve`
result before recording the golden. Look for the expected instance, Rule,
facts, and closure outcomes; a successful exit alone does not prove the Rule
created the intended fact. Then record or compare fixtures:

<!-- docs-check:docs-dialect-authoring-2 -->
```sh
rootform test . --update
rootform test .
rootform test . --run payments/minimal
```

`--update` writes the expected Form for review. The next command compares
the Form of a real run against it; status `0` means every selected case passed,
`1` means a case differed, and `3` means `rootform.lock` is invalid or no case
matched. `--run` narrows cases by name. Review the golden diff before accepting
a changed Rule. A `--dialect` override lasts one command and leaves
`rootform.lock` unchanged; `run`, `test`, `validate`, `list`, `show`, and
`explain` accept it. This walkthrough uses the lock because it must exclude the
overlapping embedded owner.

## Keep presentation separate

Optional `presentation.json` maps source resource identities independently of
Rule coverage. It can also assign icons and labels to Rules and Concepts:

```json title="dialects/payments/presentation.json"
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

Resource mappings work even when a resource type has no Rule. The manifest
accepts no SVG, HTML, URLs, styling, layout, architectural facts, or behavior.
Normal runs warn and ignore invalid presentation; `rootform package dialects`
rejects it. See
[presentation contract](../contracts/presentation-manifest.md).

## Package and publish a Dialect

Packaging stays local and offline. This example binds the `payments` owner to
the AWS provider; the owner and provider are separate identities. Package the
same source root you validated and tested:

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

Rootform has no official Dialect index or mutable discovery tag.

## Use a published Dialect

Continue from the same `project/` directory with its plan fixture and lock.
Replace the local `payments` selection with the published reference. The lock
keeps the exclusion of embedded `aws`, so its Rules do not overlap with the
published Dialect:

<!-- docs-check:authoring-add-published -->
```sh
rootform remove dialects payments
rootform add dialects \
  registry.example.com/team/dialects:dialect-payments-0.1.0
rootform init . --locked --no-input
rootform run fixtures/payments/minimal/plan.json \
  --plan-file fixtures/payments/minimal/plan.tfplan \
  --require-enrichment --project . --locked --no-serve -o published-form.json
```

Inspect `published-form.json` for the same `payments` Rules and facts you
reviewed before packaging. Rootform uses the recorded published identity;
the local source directory no longer controls this run.

The reference is illustrative; use the published reference you reviewed.
Run `add` from the same project root that `init` and `run` use. Set
`DOCKER_CONFIG` before acquisition if the registry needs credentials. `init`
acquires only recorded exact pins. See
[External content storage](reference/storage.md) for locations.

<!-- rootform:endsteps -->

See [Test and validate](language/test-validate.md),
[Dialect reference](language/reference/dialects.md), and
[Rules](language/reference/rules.md).
