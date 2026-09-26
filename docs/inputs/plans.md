---
title: Terraform and OpenTofu plans
description: Produce plan and state exports, verify a saved plan, and read evidence limits.
---

Produce a completed plan with your usual Terraform or OpenTofu workflow.
Rootform reads its JSON export locally. It does not plan, refresh, apply,
contact providers, or fetch missing Dialects. Run `rootform run` from the
project whose `rootform.lock` selects the Dialects and Policy Packs you want;
`--project` chooses another project directory explicitly.

## Protect the plan files

> [!WARNING]
> Saved plans and their JSON exports can contain sensitive values in clear
> text, even when terminal output hides them. State JSON has the same risk.
> Keep these files out of Git and public artifacts. Rootform does not modify
> or delete the inputs.

## Produce the accepted JSON

Save the plan and export that same saved plan. OpenTofu users use `tofu`
where Terraform users use `terraform`:

<!-- rootform:tabs Planning tool -->
<!-- rootform:tab Terraform -->

```sh
terraform plan -out=plan.tfplan
terraform show -json plan.tfplan > plan.json
```

<!-- rootform:tab OpenTofu -->

```sh
tofu plan -out=plan.tfplan
tofu show -json plan.tfplan > plan.json
```

<!-- rootform:endtabs -->

Use `show -json` on the saved plan. `plan -json` is a planning event
stream, not the completed export Rootform accepts. Preserve the binary plan
for verification if you need expression evidence. Where state already
exists, export it with `terraform show -json > state.json`, or
`tofu show -json > state.json`. A new working directory has no state to
export.

## Verify the saved plan

Pass both files from the same planning operation:

<!-- docs-check:journey-plans-verify -->
```sh
rootform run plan.json --plan-file plan.tfplan --require-enrichment --no-serve -o analysis.json
```

```ansi title="Verified pair excerpt"
[1mPlan analyzed[0m
[2mInput[0m         plan JSON from Terraform or OpenTofu 1.16.4
[2mCompleteness[0m  complete, as reported by Terraform or OpenTofu
[2mEnrichment[0m    saved plan verified against this plan JSON (1 module)
[2mWrote     [0m analysis.json
```

**Enrichment** confirms that both files come from the same planning
operation; the count is the number of configuration modules read from the
saved plan. **Input** names the export and the version it records. The JSON
does not say which of the two tools wrote it, so Rootform names both unless you
declare the tool with `--producer`. **Completeness** repeats what the plan
itself reports.

`--plan-file` checks the saved plan's recorded tool version, timestamp,
and configuration shape against the JSON export. A verified pair lets Rootform
inspect direct identity traversals in the saved configuration, even when an
endpoint's evaluated ID is unknown until apply. It does not execute the
configuration. The result records `enrichment.snapshot.status` as
`verified`, `refused`, or `absent`.

If the pair is mismatched or unreadable, Rootform reports the refusal on
standard error. Without `--require-enrichment`, analysis continues from JSON
alone and records `refused`; the missing traversal evidence can leave
closures indeterminate. With `--require-enrichment`, refusal exits `3`.
Export the JSON from the saved plan you pass, rather than trying to pair a
new plan with an earlier export.

## Compare both sides of one plan

A plan's `planned` stage shows proposed instances. Where the plan contains
prior state, `refreshed` describes what the tool observed before planning.
`recorded` can be reconstructed from drift records, with a stated scope.
The same plan may report three comparisons: drift
(`recorded` to `refreshed`), planned change (`refreshed` to `planned`),
and net change (`recorded` to `planned`). A state export has only
`recorded`.
The recorded to refreshed comparison is drift; it reports changes made
outside Terraform or OpenTofu when the plan contains that evidence.
[Switch stages and comparisons](../guides/explore-architecture.md#switch-stages-and-comparisons)
shows where the Explorer lists these views.

## Read plan comparisons correctly

`-refresh=false` prevents Terraform or OpenTofu from checking live objects.
“No drift reported in this plan” means the export contains no drift records;
it does not prove that infrastructure is unchanged.
`-target` can omit instances outside its scope. Terraform may report
`complete: false` for such plans, while OpenTofu may omit a completeness
field. Rootform preserves that uncertainty. A missing planned instance is
not automatically a deletion or proof of zero instances. When a fact cannot
be settled on both sides, the comparison records it as undetermined rather
than inventing an addition, removal, or no change. See
[stages and facts](../concepts/architecture-ir.md#stages-and-facts) and
[comparisons and drift](../concepts/architecture-ir.md#comparisons-and-drift).

## Record scope and tool claims

`--plan-complete=attested` records your explicit claim that the plan covers
its intended scope when the export does not establish completeness. It is
not inferred from absent entries. `--producer terraform` or
`--producer opentofu` records the tool you used; the shared
`terraform_version` JSON field alone does not establish that identity.
`--provider-map observed=binding` makes an explicit provider registry
mapping when a Dialect binding needs it. These options record your claims,
not facts independently verified by Rootform. Do not use them to hide a targeted
or partial plan.

## Interpret unknown and sensitive evidence

A planned value can be known, unknown until apply, sensitive, or unavailable.
A verified direct traversal can identify an endpoint despite an unknown ID;
a transformed expression or dependency list alone cannot. Sensitive values
are discarded before document output, reports, SARIF, and the Explorer.
Dialect-declared external identities may still be disclosed at their declared
tier. Read [limitations](../limitations.md) before relying on a missing fact
as a negative conclusion.

## Stream the export

To avoid an intermediate JSON file, pipe the saved-plan export
into Rootform. The binary saved plan still needs protection:

```sh
terraform show -json plan.tfplan | rootform run - --plan-file plan.tfplan --no-serve
```

For OpenTofu, replace `terraform` with `tofu`. The saved plan remains
local. Rootform's outputs still describe infrastructure names, structure,
and relationships, so apply your internal sharing rules.

To compare two plans, or a state snapshot with a later plan, follow
[Compare architectures](../guides/compare-architectures.md). For plans from two
Git revisions, [Review a pull request](../workflows/index.md#choose-the-review-input)
adds isolated checkouts and cleanup.
To review a completed plan in automation, see
[Run in CI](../integrations/ci/README.md#review-a-completed-plan) or
[GitHub Actions](../integrations/github-actions.md#review-a-completed-plan).
