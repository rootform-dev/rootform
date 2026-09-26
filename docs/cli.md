---
title: "Select Dialects and Policy Packs"
description: "Choose the content a project uses, inspect the active catalog, and prepare an exact selection."
---

Most projects need no Rootform configuration. The binary embeds the RF Vocabulary and 19 [Dialects](concepts/dialects.md). A plan or state JSON is still required: `--project` selects content from a directory; it never analyzes that directory as evidence.

| Need | Selection |
| --- | --- |
| Analyze with embedded Dialects | No lock or preparation. |
| Try a local Dialect or Policy Pack once | Pass `--dialect` or `--policy-pack` to `run`. |
| Keep external content selected across runs | Record it with `add`, commit `rootform.lock`, and prepare it with `init`. |
| Exclude or replace an embedded Dialect owner | Record the decision with `remove --embedded` or `add --replace`. |

## Use embedded Dialects

With a plan JSON in the current project, run an analysis to see the default catalog. No `rootform init` is needed.

<!-- docs-check:selection-embedded-run -->
```sh
rootform run plan.json --no-serve
```

<!-- docs-output:selection-embedded-run -->
```text title="Excerpt from standard output"
Plan analyzed
Forms         planned (default)
Semantics     19 Dialects, 1 vocabulary
```

`Semantics` counts the active Dialects, not the number that matched this plan. The architecture section reports interpreted instances. If a resource has no matching Rule, inspect its Representation and [coverage limits](limitations.md#instances-without-rules).

To inspect one embedded owner before relying on it, list its catalog entry:

<!-- docs-check:selection-list-aws -->
```sh
rootform list dialects aws -o wide
```

<!-- docs-output:selection-list-aws -->
```text title="Embedded Dialect"
NAME  VERSION  ORIGIN    CONCEPTS  CONTEXTS  RELATIONS  RULES
aws   0.1.0    embedded        64         0          1    108
```

`embedded` means the Dialect ships in this binary. Its version changes with the Rootform release, not with a project lock. Use `rootform show aws` for its declarations or `rootform explain semantics aws.rule.vpc` for a Rule's meaning. [Dialect concepts](concepts/dialects.md) explains how Rules turn instance evidence into architecture.

## Try one local Policy Pack

An override lets you evaluate a reviewed local pack without changing project selection. This command uses a plan export and a pack at `./policies`:

<!-- docs-check:selection-pack-override -->
```sh
rootform run plan.json --plan-file plan.tfplan --require-enrichment \
  --policy-pack ./policies --no-serve -o report.md
```

The command verifies the saved plan, writes a Markdown report, and exits `0` only when all selected evaluations pass. A violation exits `1`; indeterminate or zero evaluated targets exits `3`. Read the report's target counts before calling the result compliant. The override applies only to this run. A lock remains unchanged. [Run checks](guides/check-architecture.md) gives a complete Policy example.

## Keep external content selected

Use `rootform.lock` when the project needs an external Dialect or Policy Pack on every machine. Run `add` from the project root, then commit the lock with the selected local source or exact OCI identity. A local source path is recorded relative to that root; OCI entries carry exact digests. Terraform and OpenTofu provider selections remain in their own lock file.

`rootform init` prepares an existing selection. It verifies selected local, installed, or vendored content and may acquire a missing exact OCI pin unless `--offline` forbids network access. It does not detect providers, choose packages, or write `rootform.lock`. Check the selection in automation without allowing an absent lock:

<!-- docs-check:selection-init-locked -->
```sh
rootform init . --locked --offline --no-input
```

<!-- docs-output:selection-init-locked -->
```text title="Prepared project"
Project ready

External content  none
```

For this embedded-only example, the committed empty lock requires no external content. `--locked` requires a valid lock even when its arrays are empty; `--offline` prevents acquisition; `--no-input` refuses an interactive decision. Omit `--locked` for an ordinary embedded-only project with no lock.

Inspect what the selected project loads before analysis:

<!-- docs-check:selection-list-selection -->
```sh
rootform list dialects -o wide
rootform list policy-packs
rootform list policies
```

The first command lists embedded and selected Dialects. The other two show selected packs and policies; an empty policy list means there is no governance decision. A lock selecting only Dialects does not select a Policy Pack. [Add external content](guides/external-content.md) gives the full `add`, `update`, `vendor`, and registry procedure.

## Use project selection in a run

Point `--project` at the root containing `rootform.lock`. Add `--locked` when this run must refuse a missing or drifted selection:

<!-- docs-check:selection-project-run -->
```sh
rootform run plan.json --project ./infra --locked --no-serve -o analysis.json
```

The Rootform document records the active Dialects, selection, plan or state input, stages, and closures. The standard-output summary names the active count and any policy outcome. `--dialect` and `--policy-pack` are one-run overrides; the CLI refuses an override with `--locked`. Use an override while authoring, then add the reviewed content to the lock for repeatable work.

## Exclude or replace an embedded owner

An exclusion removes one embedded owner's Rules from the active catalog. A replacement selects another Dialect with the same owner and explicitly authorizes that collision. The reserved `rf` vocabulary cannot be excluded or replaced. These changes belong in the lock and can change interpretation without changing the plan JSON. Review the resulting document before adopting them. [Replace or exclude an embedded Dialect](guides/external-content.md#replace-or-exclude-an-embedded-dialect) has the commands; [reproduce an analysis offline](guides/reproduce-build.md) shows how to move the exact selection.
