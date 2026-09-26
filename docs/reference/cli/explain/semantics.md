---
title: "rootform explain semantics"
description: "Show a Dialect Rule, its emissions, and where it applied."
---

Without `--input`, `explain semantics` shows a Dialect Rule and its
emissions. With a plan, state, or saved Rootform document named by `--input`,
it also shows where that Rule applied in the selected stage. Pass a qualified
definition identifier such as `google.rule.cloud-sql-instance`, or an
unambiguous bare name. This is a semantic definition name, not a Terraform
resource address; use [`explain architecture`](architecture.md) for an
address.

<!-- BEGIN GENERATED CLI: rootform explain semantics -->

## Usage

```text
rootform explain semantics <identifier> [flags]
```

## Flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --dialect ` | ` stringArray ` | ` [] ` | use dialect source `dir`; repeatable |
| ` --format ` | ` string ` | ` text ` | output `format`: text or json |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform explain semantics |
| ` --input ` | ` string ` | ` "" ` | read `path`: a plan, state or Rootform document, or `-` |
| ` --stage ` | ` string ` | ` "" ` | explain the `stage`: planned, refreshed or recorded |

## Inherited flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --color ` | ` mode ` | ` auto ` | color human output: auto, always, never |

<!-- END GENERATED CLI -->

From a checkout of the repository, save the reviewed commerce plan, then
inspect the Azure subnet Rule. Without `--input`, the first explanation shows
the Rule definition; the second also counts where it applied in this plan.

<!-- docs-check:cli-explain-semantics -->
```sh
rootform run examples/playground/commerce-platform/head/plan.json \
  --plan-file examples/playground/commerce-platform/head/plan.tfplan \
  --no-serve -o analysis.json
rootform explain semantics azure.rule.subnet
rootform explain semantics azure.rule.subnet --input analysis.json --color always
```

<!-- docs-output:cli-explain-semantics -->
```ansi title="Rule application, excerpt"
[1mazure.rule.subnet[0m
[2mMatches[0m     resource azurerm_subnet
[2mConcept[0m     rf.concept.subnet
[2mApplied to[0m  7 instances at the planned stage

[1m[38;5;208mEmissions[0m
```

The Rule applies to seven subnet instances in this input. The emission list
names the facts it may create; inspect a specific instance to see its closure
outcome. Text or JSON goes to standard output, diagnostics to standard error. Status
`0` means explained, `1` means definition not found, `2` means incorrect
command use, and `3` means no explanation could be decided. See
[Dialects and RF Vocabulary](../../../concepts/dialects.md) for the meaning of
Rules and [Explore an architecture](../../../guides/explore-architecture.md)
for following their evidence.
