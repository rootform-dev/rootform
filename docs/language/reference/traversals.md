---
title: "Traversals and scope"
description: "Attribute paths used by Rules and emissions over plan or state instances."
---

A Rootform traversal reads one path from an instance or candidate. It is distinct from a Concept, Rule, Context, or Relation reference. `source` names the current Rule instance; `target` names a candidate during emission matching; `provider` names the bound provider configuration where available; and `member.<name>` names an earlier composition member.

```rf title="Traversal examples"
source.network_id
source.metadata[0].name
target.name
provider.host
member.proxy.backend_id
```

A path uses attribute steps and static nonnegative integer indexes. Dynamic indexes, splats, and string indexes are not accepted as authored traversal paths. A missing path on an emitted instance produces `EMISSION_PATH_UNDEFINED`, not proof that a relation is absent.

## Value and identity evidence

An emission's `via` reads a value from `source` or `provider`. With a `match` block, `via` is compared to the target Rule's declared identity attributes named by `match.by`. Unknown, sensitive, or unavailable values preserve uncertainty. The target path must be a declared identity attribute; `target` is available only inside that match.

A verified saved-plan snapshot can pair an eligible bare reference or single-interpolation pass-through with a target instance. The target Rule declares endpoint attributes such as `id` or `name` that a traversal may name. This evidence is available for the `planned` stage, including when evaluated values are unknown, duplicated across candidates, or involve different providers. A tuple `[a.id, b.id]` at the emitted attribute or inside one static block pairs its elements separately. Functions, operators, conditionals, dynamic blocks, computed indexes, and transformed references do not establish endpoint identity. They may still remain dependency evidence.

For `provider.<path>`, Rootform follows the named provider block's attribute reference in its module. It can pair a direct managed-resource endpoint or a pass-through through a variable, local, or module output on the planned stage of a verified saved plan. The provider block is not expanded. A literal or transformed provider expression, state input, historical stage, OpenTofu provider `for_each`, or JSON configuration syntax leaves the closure `indeterminate(unavailable)`. Literal provider configuration values are never read.

If value and traversal agree, a fact records `both`; if only one proves the endpoint, it records `value` or `traversal`. A known disagreement produces `EVIDENCE_CONFLICT` and no guessed target. See [Fact emissions](emissions.md) and [Rules](rules.md).
