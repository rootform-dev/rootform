---
title: "Dialects and RF Vocabulary"
description: "Understand how Dialects interpret plan and state instances using shared architectural terms."
---

A Dialect is a named, versioned interpretation unit. Its Rules match Terraform or OpenTofu instances from a plan or state export and can classify them with Concepts or emit architectural facts. Every managed and data instance remains represented even without a matching Rule; no missing interpretation is invented.

A subnet's `vpc_id` may name a VPC. That reference is evidence, while an AWS Dialect Rule supplies the architectural meaning of a network Context. Provider type, dependency metadata, and similar names do not create Contexts or Relations on their own. A fact cites the Rule, emission, closure, and evidence that established it.

RF Vocabulary is an embedded language contract owned by `rf`. It supplies shared Concepts and Contexts such as `rf.concept.subnet`, `rf.concept.virtual-network`, and `rf.context.network`. It is not a provider Dialect and has no Rules. The [RF Vocabulary reference](../language/reference/rf-vocabulary.md) defines its exact terms.

```sh
rootform list dialects
rootform show aws.rule.subnet
```

The executable includes official Dialects. `rootform.lock` records explicit external selections, exclusions, and replacements. A saved architecture document keeps the semantic selection used to produce it; reopening that document does not reinterpret it with currently selected Dialects. See [External content](external-content.md) and [Write a Dialect](../dialect-authoring.md).
