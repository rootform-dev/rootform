---
title: "Test and validate"
description: "Format and compile Dialect source, replay plan fixtures, and evaluate a Policy Pack."
---

Use a small plan fixture to prove what a Dialect actually says about instances. Source validation checks language contracts; `rootform test` compares produced Rootform documents with reviewed `analysis.golden` files. A passing compile alone cannot prove that a provider attribute has the architectural meaning you intended.

The example below follows a local `network-review` Dialect that interprets one `random_pet` instance. Start in a project containing this source and a plan fixture. The full source and plan setup appear in [Write a local Dialect](../guides/local-dialect.md). The layout at the point of testing is:

```tree title="Project and fixture"
.
├── dialects/
│   └── network-review/
│       └── dialect.rf.hcl
├── fixtures/
│   └── network/
│       ├── plan.json
│       ├── plan.tfplan
│       └── analysis.golden
├── main.tf
├── plan.json
└── plan.tfplan
```

The plan JSON comes from `terraform show -json plan.tfplan`; OpenTofu users run `tofu show -json plan.tfplan`. Keep the saved plan and plan JSON together: they may contain clear-text secrets, so do not commit them from a real environment. The synthetic fixture shown here is safe for review. `rootform test --update` writes or replaces a golden, so review its change before accepting it.

| Command | Question answered |
| --- | --- |
| `rootform fmt --check` | Is source in canonical format? |
| `rootform validate dialects` | Does the complete Dialect source compile? |
| `rootform validate rule` | Is one selected Rule valid? |
| `rootform test` | Do plan fixtures still produce reviewed documents? |
| `rootform run` | What does a real plan and optional Policy Pack decide? |

<!-- rootform:steps -->

## Format native and JSON source

Check without rewriting it:

<!-- docs-check:language-test-format -->
```sh
rootform fmt --check ./dialects/network-review
```

Exit `0` and no output mean canonical formatting. Exit `1` lists files that would change. Run `rootform fmt ./dialects/network-review` during authoring, review the edit, then repeat the check. Formatting neither validates references nor establishes architecture meaning.

## Compile a Dialect source set

Validate all definitions under the source root:

<!-- docs-check:language-test-validate -->
```sh
rootform validate dialects ./dialects/network-review --color always
```

<!-- docs-output:language-test-validate -->
```ansi title="Valid Dialect output"
[1m[32mDialect set valid[0m

[1m[38;5;208mDialects[0m
  network-review@0.1.0
```

Exit `0` proves accepted syntax, identities, references, Rule shapes, and a valid compiled artifact. An invalid definition exits `1`; incorrect command use exits `2`; a result that cannot be decided exits `3`. CI can use `--format json` for stable diagnostic codes. To inspect just one selected Rule, `rootform validate rule network-review.rule.service-name --dialect ./dialects/network-review` applies that source override for the command only. [Rules and matching](reference/rules.md) defines what validation checks.

## Compare a Dialect fixture

A fixture directory contains one `plan.json` or `state.json` and an `analysis.golden`. Keep the matching `plan.tfplan` beside plan JSON when reference identity matters. First review the produced architecture, then record the golden once with `rootform test ./fixtures --dialect ./dialects/network-review --update`. The `--update` flag writes every missing or differing golden; it is an authoring action, not a passing assertion.

Now replay the reviewed case:

<!-- docs-check:language-test-replay -->
```sh
rootform test ./fixtures --dialect ./dialects/network-review --color always
```

<!-- docs-output:language-test-replay -->
```ansi title="Fixture replay output"
[1m[32mTests passed[0m
1 case
```

Exit `0` means every selected fixture matched its golden. `--run network` narrows by case-name substring while iterating. Exit `1` means a difference or fixture error; inspect the source address, interpretation, facts, closures, diagnostics, and sensitive-value bounds before updating the golden. Exit `3` means the run could not start or no fixture matched. A golden is a Rootform document, not a Terraform plan or state export.

## Inspect the plan result

Run the same plan pair with the Dialect override to understand the fixture's result:

<!-- docs-check:language-test-run -->
```sh
rootform run ./plan.json --plan-file ./plan.tfplan \
  --dialect ./dialects/network-review --no-serve --color always
```

<!-- docs-output:language-test-run -->
```ansi title="Plan summary excerpt"
[1mPlan analyzed[0m
[2mInput[0m         plan JSON from Terraform or OpenTofu 1.16.4
[2mEnrichment[0m    saved plan verified against this plan JSON (1 module)

[1m[38;5;208mPlanned Form[0m
  [2mInstances[0m    1 (1 managed, 0 data)
  [2mInterpreted[0m  1 of 1 instances
  [2mFacts[0m        0: 0 relations, 0 contexts, 0 contributions
  [2mClosures[0m     0: 0 resolved, 0 absent, 0 indeterminate
```

The one instance has an applied Rule. This Rule classifies it and emits nothing, so zero facts and closures are expected. The export identifies the Terraform/OpenTofu family and version, but not which tool produced it. `--producer terraform` records which tool made the export when that distinction matters. The verified saved plan can supply traversal evidence for Rules that emit facts. If these counts change, inspect the document and golden before accepting a new result. The `--no-serve` flag exits after the summary; without it, `run` serves the Explorer on loopback.

## Evaluate policies over known facts

The fixture proves interpretation, not compliance. Follow [Evaluate locally](write-policy-pack.md#evaluate-locally) to select a Policy Pack against known facts and inspect a passing and failing decision. A passing exit requires at least one selected evaluation. A confirmed violation exits `1`; indeterminate evidence or zero targets exits `3`. Do not edit a generated Rootform document to make a policy pass.

| Case | Expected result to assert |
| --- | --- |
| Passing target | At least one selected evaluation with a known-true assertion and exit `0` |
| Violating target | Known-false assertion, Policy message, target identity, and exit `1` |
| Zero targets | `no_decision`, zero evaluations, `POLICY_NO_DECISION`, and exit `3` |
| Incomplete evidence | `indeterminate` with the closure or coverage reason, and exit `3` |
| Missing required vocabulary | Link diagnostic, with no guessed policy decision |

## Inspect diagnostic ranges

Keep the diagnostic code and sanitized source range in assertions. For a match-only Rule, `rootform validate dialects` exits `1` and reports:

```ansi title="Invalid Rule excerpt"
[1m[31mDialect set invalid (1 error)[0m

[1m[38;5;208mdialect.rf.hcl[0m
  9:1  RULE_NO_ARCHITECTURE  rule must add a classification, emission, or non-empty composition
```

The range identifies the Rule declaration; the code is stable for automation. `HCL_PARSE` instead reports invalid source syntax, while `EMISSION_PATH_UNDEFINED` means an emitted instance lacked the declared path. See [Diagnostics and limits](reference/diagnostics.md) for severity and recovery.

## Verify the package boundary

After source, fixture, and policy behavior pass, follow [Dialect packaging](../dialect-authoring.md) or [Policy Pack authoring](write-policy-pack.md) for distribution checks. Packaging does not replace a reviewed golden or a real policy decision.

<!-- rootform:endsteps -->
