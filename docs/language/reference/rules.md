---
title: "Rules and matching"
description: "Rule selection, identity, and endpoint declarations for plan and state instances."
---

A Rule interprets a Terraform or OpenTofu resource instance selected from a plan or state export. Its `match` chooses an instance by kind, type, and optional predicate. `as` classifies it as a Concept; emissions create architectural facts. A resource with no matching Rule remains in the document without an invented classification.

```rf title="A resource Rule"
rule "bucket" {
  match {
    type = "example_bucket"
  }

  as = rf.concept.object-storage-container

  identity {
    attributes = ["name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "name"]
  }
}
```

`match.type` is required and exact. `match.kind` defaults to `"resource"`; it can also be `"data"` for a data source. `where` is an optional predicate over available instance values. Unknown or sensitive values cannot turn an uncertain match into false. If more than one Rule matches one instance, `RULE_MATCH_AMBIGUOUS` reports the conflict. A Rule needs `as`, an emission, or a nonempty composition.

## Identity and endpoint attributes

`identity.attributes` is a nonempty list of distinct attribute names. An emission's `match.by` may name only identity attributes declared by the target Rule. `scope` defaults to `"provider"`: eligible candidates must have compatible provider address and alias. `"global"` allows matching across provider configurations. A missing alias remains uncertain rather than proving compatibility or exclusion.

`endpoint.attributes` is a nonempty list of distinct attribute names whose direct traversal can identify this instance. A verified saved-plan snapshot can pair `source.target_id = target.id` to the target instance even when the evaluated value is unknown or shared. Endpoint declarations do not expose values in output. See [Fact emissions](emissions.md#traversal-evidence).

A Rule may contain `context`, `relation`, and `contribution` emissions and a `composition` block. Their facts and unresolved closures belong to the instance and stage that supplied the evidence. See [Compositions](composition.md) and [Evaluation](evaluation.md).
