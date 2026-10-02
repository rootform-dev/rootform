---
title: "Rootform language"
description: "Learn how Rules turn Terraform and OpenTofu evidence into architecture, then author Dialects and Policies."
---

The Rootform language defines what infrastructure evidence means architecturally.
A **Dialect** supplies Rules that interpret Terraform or OpenTofu instances.
A **Policy Pack** asks bounded questions about the resulting architecture.
Sources use `.rf.hcl` or HCL JSON `.rf.json`; RF accepts a small, closed language,
not general Terraform expressions or HCL programming.

## From evidence to a decision

1. Plan or state instances get **Representations** identified by their addresses.
2. **Rules** select instances and may classify them with **Concepts**.
3. Emissions resolve targets against evidence and establish architectural facts.
   Each **closure** records what was established, absent or still indeterminate.
4. A **Form** retains the stages, facts, closures and provenance.
5. **Policies** evaluate its architectural facts.

Every observed managed and data instance remains represented, including one
with no Rule. A dependency or reference is evidence, not automatically a
Relation. Neither a state snapshot nor a network Context proves live cloud
behavior. The [Form model](../concepts/forms.md) explains stages and portability.

## Learn

Start with the [Language tour](tour.md) for one complete subnet example.
Then follow the explanations where you need more depth:

<!-- rootform:directory -->

- [Read a Rule](learn/read-a-rule.md) Decode a real official Rule, including selection and classification.
- [Choose an architectural fact](learn/facts.md) Distinguish Context, Relation and Contribution.
- [Evidence and target resolution](learn/evidence-targets.md) Understand identity, endpoint, ambiguity and closures.
- [Understand composition](learn/composition.md) Follow implementation members without losing uncertainty.
- [Policies over facts](learn/policies.md) Learn what an assertion can conclude from those facts.

## Author

<!-- rootform:directory -->

- [Edit source](editors.md) Use VS Code or Zed for feedback while authoring.
- [Write a Dialect](../dialect-authoring.md) Define and test provider interpretation.
- [Write a Policy Pack](write-policy-pack.md) Name, link, evaluate and package Policies.
- [Test and validate](test-validate.md) Format source and prove its behavior against evidence.

## Reference

The [Language reference](reference/index.md) is the normative source for accepted
syntax, defaults, evaluation rules, diagnostics and limits. Use it for exact
contracts; the learning pages explain their motivation and consequences.
