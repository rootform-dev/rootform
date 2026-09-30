---
title: Glossary
description: Definitions for reading Forms, comparisons, Policy results, and project configuration.
---

## A

### Architecture

The content of one [stage](../concepts/forms.md#stages-and-facts) in a Form,
including its Representations, architectural facts, closures, and evidence.

## C

### Carried

An instance retained in Planned because the plan neither changes nor deletes
it. The plan did not evaluate it, so missing evidence from a carried instance
cannot establish a Policy pass or violation. See
[partial knowledge](../concepts/forms.md#accounting-keeps-partial-knowledge-honest).

### Closure

A Rule's [record of fact resolution](../concepts/forms.md#stages-and-facts)
for one instance. Each declaration of a Context, Relation, or Contribution
has its own closure:

| Outcome | Meaning |
| --- | --- |
| `resolved` | All relevant evidence is settled and the fact set is nonempty. |
| `absent` | All relevant evidence is settled and the fact set is empty. |
| `indeterminate` | Evidence leaves part of the answer unsettled. Established facts may still be present. |

### Comparison

An [architectural comparison](../concepts/comparisons.md) between selected
stages. One plan can show Planned changes, Reported drift, and Net change;
two separate inputs produce Differences.

### Composition

A Rule-defined [group of implementation members](../language/reference/composition.md)
under one root instance. Members keep their own Representations and do not
inherit the root's Concept.

### Concept

An [architectural classification](../concepts/dialects.md#interpretation-enriches-an-instance-base)
assigned by a Rule, such as subnet or managed database. An instance can be
represented without a Concept.

### Context

A fact that places an instance in an
[architectural frame](../concepts.md#read-each-architectural-connection-precisely),
such as a subnet in a virtual network. Network placement alone does not
establish runtime reachability.

### Contribution

A [directed fact](../concepts.md#read-each-architectural-connection-precisely)
stating that one Representation contributes to another. Contributor and
target remain distinct.

### Current context

The [location open in the Explorer](../guides/explore-architecture.md#where-is-this-resource),
whose direct contents appear on the canvas. This navigation label identifies
the current scene; Context names an architectural placement fact.

## D

### Deferred

An instance whose action the plan leaves for later. Its population remains
unverified, and a Policy evaluation that needs evidence from it stays
indeterminate. See
[incomplete plans and deferred actions](../limitations.md#what-do-incomplete-plans-and-deferred-actions-mean).

### Dialect

A named, versioned [unit of interpretation](../concepts/dialects.md) whose
Rules match Terraform or OpenTofu instances and establish architectural
meaning. Changing the active Dialects can change the interpretation of the
same input.

### Differences

The [comparison between two separate inputs](../concepts/comparisons.md#choose-the-stage-pair),
using one selected stage from each. It shows how their architectures differ
without establishing what drifted between the exports.

### Drift report

The plan's [reported drift records and their architectural consequences](../concepts/forms.md#comparisons-and-drift).
It is separate from the Reported drift comparison; an empty report does not
prove that live infrastructure is unchanged.

## E

### Embedded

Content that [ships inside the Rootform binary](../concepts/external-content.md#four-states).
The official Dialects and RF Vocabulary are embedded and available without
installation.

### Enrichment

Additional configuration evidence read from a
[paired saved plan](../inputs/plans.md#pair-the-saved-plan). It can identify
a direct reference when the planned value is unknown until apply.

### Evidence

The [information available to establish architecture](../concepts.md#from-evidence-to-architecture):
plan or state instances, evaluated values, sensitivity masks, and supported
references. A paired saved plan adds configuration traversals; Evidence in
the Inspector shows the basis and limits of an instance's interpretation.

### External endpoint

A [target outside the input's represented inventory](../language/reference/emissions.md#external-and-data-endpoints)
that a Dialect explicitly permits a fact to reference. Its recorded identity
follows the Dialect's disclosure limits and does not verify a remote object's
existence or health.

## F

### Form

The complete [portable architectural result](../concepts/forms.md) compiled
from plan or state evidence. It contains supported stages, comparisons,
reported drift, evidence, and the interpretation used; a saved Form reopens
without the original input or installed Dialects.

## I

### Indeterminate

Evidence cannot [settle a fact, change, or Policy assertion](../concepts/forms.md#stages-and-facts).
An indeterminate result establishes neither absence nor no change, and it
cannot count as a Policy pass.

### Installed

Verified OCI content [stored in the Rootform home](../concepts/external-content.md#install-prepares-a-machine)
on one machine. Installation makes a Dialect or Policy Pack available;
project selection determines whether it is used.

### Instance

One managed or data resource instance in Terraform or OpenTofu evidence,
identified by its [instance address](../concepts.md#every-observed-instance-starts-with-a-representation).
Indexed instances, such as `aws_subnet.application[0]` and
`aws_subnet.application[1]`, are distinct.

## N

### Net change

The plan comparison from [Recorded to Planned](../concepts/comparisons.md#choose-the-stage-pair).
Drift that the plan proposes to reverse cancels out of this comparison.

## P

### Pairing

The [checks that allow a saved plan to enrich a plan JSON export](../inputs/plans.md#pair-the-saved-plan):
matching recorded tool version, timestamp, and configuration shape. A
verified pair permits traversal evidence but does not prove one planning
operation.

### Plan JSON

The [completed plan export](../inputs/plans.md#produce-the-accepted-json)
produced by `terraform show -json plan.tfplan` or the corresponding `tofu`
command. Rootform reads this export as input; the event stream from
`plan -json` has a different format and is refused.

### Planned

The [stage describing what a plan proposes](../concepts/forms.md#stages-and-facts).
Values unknown until apply remain unknown, although paired saved-plan
evidence can establish some references.

### Planned changes

The plan comparison from [Refreshed to Planned](../concepts/comparisons.md#choose-the-stage-pair),
showing the proposed architectural changes from the plan's starting state.

### Policy

A named, authored [assertion over one architecture stage](../concepts/policies.md)
within a Form. `rootform check` evaluates selected Policies; analysis with
`rootform run` does not evaluate them.

### Policy Pack

A [unit that owns and selects related Policies](../concepts/policies.md#definition-selection-and-evaluation).
Projects select Policy Packs separately from Dialects.

### Policy result

The [separate artifact produced by a Policy check](../concepts/policies.md#what-a-policy-result-proves),
recording selection, targets, outcomes, and diagnostics. It identifies the
Form evaluated and does not change that Form.

### Provenance

The [recorded justification for an architectural fact](../concepts/forms.md#facts-preserve-bounded-provenance):
its Rule, declaration, closure, and evidence kind. Evidence kinds distinguish
evaluated values, verified saved-plan traversals, and agreement between both.

## R

### Recorded

The [stage describing recorded state](../concepts/forms.md#stages-and-facts).
For state JSON, it reflects the export; in a plan, Rootform reconstructs it
from drift records, and that reconstruction may be partial.

### Refreshed

The [stage describing the state a plan starts from](../concepts/forms.md#stages-and-facts).
The plan does not establish whether or how far refresh ran.

### Relation

A [directed architectural connection](../concepts.md#read-each-architectural-connection-precisely)
whose meaning a Dialect declares. Terraform references and dependencies
alone do not establish Relations.

### Representation

An [entry in a stage's architecture](../concepts.md#every-observed-instance-starts-with-a-representation)
for a managed instance, data instance, or permitted external endpoint. A
resource remains represented without a matching Rule. The Explorer can reveal
[secondary resources on demand](../guides/explore-architecture.md#reveal-a-secondary-resource).

### Resolution

The [evidence detail for a fact in the Explorer](../guides/explore-architecture.md#why-is-it-placed-here),
showing the Rule and source evidence that established its endpoint. The
closure records whether the relevant fact set is complete.

### RF Vocabulary

The [shared architectural definitions](../concepts/dialects.md#rf-vocabulary-provides-shared-terms)
in the reserved `rf` namespace, including common Concepts and Contexts. It
has no provider binding or Rules and is always embedded.

### Rootform language

The [language used to author Dialects and Policies](../language/index.md),
written in `.rf.hcl` or `.rf.json` files. Its declarations describe
architectural interpretation and assertions.

### rootform.lock

The [project selection file](../offline-security.md#what-does-the-lock-fix),
recording exact external Dialects and Policy Pack sources, plus exclusions
and replacements of embedded Dialects. Embedded versions come from the
binary, and Terraform or OpenTofu provider versions belong to their own lock.

### Rule

A [Dialect declaration](../concepts/dialects.md#how-a-rule-establishes-a-fact)
that matches eligible instances and can assign a Concept, establish facts,
or define composition members. Matching a Rule does not settle every fact;
each declared fact still needs evidence.

## S

### Saved plan

The [binary plan file](../inputs/plans.md#produce-the-accepted-json) written
by `terraform plan -out=plan.tfplan` or the corresponding `tofu` command.
Export its plan JSON for analysis and optionally pass the same saved plan
with `--plan-file` for enrichment.

### Selected

External content whose exact identity and source are
[recorded in the project's lock](../concepts/external-content.md#four-states).
The selected bytes must be available from their recorded source or vendored
copy before analysis.

### Stage

The [role of one architecture within a Form](../concepts/forms.md#stages-and-facts):
Recorded, Refreshed, or Planned. A stage the input does not support is
unavailable; it must not be read as empty architecture.

### State JSON

The [state export](../inputs/index.md#choose-state-for-a-recorded-architecture)
produced by `terraform show -json` or the corresponding `tofu` command. It
supplies one Recorded stage with evaluated values and sensitivity masks;
raw `terraform.tfstate` is a different format and is refused.

## V

### Vendored

Selected external content [copied into the project's `.rootform/` directory](../concepts/external-content.md#vendor-keeps-the-bytes-in-the-repository).
For a vendored family, Rootform reads only that copy and rejects missing,
extra, or changed content.
