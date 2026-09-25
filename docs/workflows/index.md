---
title: "Review a pull request"
description: "Compare source revisions or review a completed plan, and keep architecture evidence for the pull request."
---

A pull request can be reviewed from two inputs. Comparing source revisions
shows what the branch changed in the configuration. Reviewing a completed
Terraform or OpenTofu plan shows what applying the branch would change against
the prior state recorded in the plan. Both produce the same kinds of Rootform
evidence: an Architecture Diff, a Policy result when a check is requested, and
an interactive comparison.

Use one Rootform binary throughout. Both procedures on this page write every
result outside the checkout under review.

## Choose the review input

| Review input | Before and After | Choose it when |
| --- | --- | --- |
| Source revisions | Merge base and head, each built from its committed source | No plan exists, or the question is what the branch changed in source |
| Completed plan | Prior state and planned values carried by one plan | CI already plans the pull request, or the question is what applying it changes against the prior state |

A source comparison needs no backend, credentials, or state. It answers the
review question for a branch that has not been planned, and it isolates the
configuration change from drift. A plan review needs only the completed plan
export, which the planning step produced with its own credentials. It reflects
drift, imported resources, and instances that exist only in state, and it is
the natural choice when the pipeline already runs `terraform plan` or
`tofu plan`. When both inputs are available, the source comparison explains
the change and the plan review confirms its effect.

Rootform never runs Terraform or OpenTofu. It reads the completed plan export
that your workflow produced. [Terraform and OpenTofu plans](../inputs/plans.md)
is the canonical plan procedure; this page applies it to a pull request.

## Compare source revisions

Build review evidence without switching, resetting, or cleaning the working
copy under review. This procedure uses detached Git worktrees in a new temporary
directory and writes every Rootform result outside them. The same root module
path must exist in both revisions.

### Choose the revisions

This procedure uses merge base with `origin/main` as Before and current `HEAD`
as After:

<!-- docs-check:review-revisions -->
```sh
target_ref=origin/main
head_ref=HEAD
base_commit=$(git merge-base "$target_ref" "$head_ref")
head_commit=$(git rev-parse "$head_ref")
printf 'Before: %s\nAfter:  %s\n' "$base_commit" "$head_commit"
```

`HEAD` names committed changes only. Uncommitted modifications in the current
checkout are not included. Ensure that `target_ref` exists locally and update it
when the review requires the latest target state before resolving either
commit.

That comparison answers: what architectural meaning did this branch introduce
since it diverged from the target branch? To compare the current target head
against the branch head instead, set
`base_commit=$(git rev-parse "$target_ref")`. That answers a different question
and can include changes made on the target branch after divergence.

Record both full commit IDs with the review artifacts.

### Create isolated worktrees

<!-- docs-check:review-worktrees -->
```sh
review_root=$(mktemp -d /tmp/rootform-review.XXXXXX)
git worktree add --detach "$review_root/base" "$base_commit"
git worktree add --detach "$review_root/head" "$head_commit"
mkdir "$review_root/results"
printf 'Review directory: %s\n' "$review_root"
```

These commands do not switch the current checkout. Set the root module path
relative to the repository root. Before building, make every referenced module
and external Dialect or Policy Pack selection available in each worktree. A Git
worktree does not inherit the current checkout's `.terraform/` directory. Use
[Reproduce a build](../guides/reproduce-build.md) and
[external content](../guides/external-content.md) to prepare each revision from
its own committed selection.

Build both revisions into the results directory:

<!-- docs-check:review-build -->
```sh
root_module=infra
rootform version
rootform build "$review_root/base/$root_module" \
  --output "$review_root/results/before.json"
rootform build "$review_root/head/$root_module" \
  --output "$review_root/results/after.json"
```

Each directory build reads its own project selection. To isolate source
changes, use the same binary and comparable Dialect selection. When
`rootform.lock` changes in the pull request, do not copy one revision's lock
into the other. Build each revision as committed, then treat the resulting semantic
difference as part of review. Architecture Diff can preserve source continuity
while reporting affected conclusions as undetermined. See
[semantic changes](../concepts/diff.md#undetermined-preserves-uncertainty).

### Compare and save review artifacts

Read the comparison in the terminal first:

<!-- docs-check:review-diff -->
```sh
rootform diff "$review_root/results/before.json" \
  "$review_root/results/after.json"
```

Then save Markdown for reviewers and JSON for automation:

<!-- docs-check:review-reports -->
```sh
rootform diff "$review_root/results/before.json" \
  "$review_root/results/after.json" \
  --format markdown --output "$review_root/results/architecture-diff.md"
rootform diff "$review_root/results/before.json" \
  "$review_root/results/after.json" \
  --format json --output "$review_root/results/architecture-diff.json"
```

Choose the gate independently of the report format:

- Use ordinary `rootform diff` for an informational report. A completed comparison returns `0` even when changes exist
- Use `rootform diff before.json after.json --exit-code` to block on any determined or undetermined difference
- Use `rootform check` to block on governance results after confirming the expected Policy Pack selection and target coverage

An architectural change informs the review, but it is not automatically a
defect. Likewise, a completed command does not approve the change. Read the
report contents and policy coverage before deciding.

### Add policy and architecture evidence

When the repository keeps a local pack at `policies/`, evaluate the head
revision and save the result:

<!-- docs-check:review-policy -->
```sh
rootform check "$review_root/head/$root_module" \
  --policy-pack "$review_root/head/policies" \
  --format json --output "$review_root/results/policy-result.json"
```

Use project-selected Policy Packs instead when the lock owns governance selection.
[Run checks](../guides/check-architecture.md) explains outcomes and evidence.

Export the comparison as one page when visual inspection helps:

<!-- docs-check:review-html -->
```sh
rootform diff "$review_root/results/before.json" \
  "$review_root/results/after.json" \
  --format html --output "$review_root/results/architecture-diff.html"
```

Reviewers should read:

| Artifact | Review question |
| --- | --- |
| `architecture-diff.md` | Which architectural representations and facts changed? |
| `architecture-diff.json` | Which determined and undetermined entries should automation process? |
| `policy-result.json` | Which Policies ran, which targets they evaluated, and what outcomes resulted? |
| `architecture-diff.html` | Where does each change sit in the Before and After architecture? |

The HTML page opens from disk without a running server. It carries the same
comparison as the reports, with Before, Diff, and After stages. To inspect the
comparison while the worktrees still exist, run the same `rootform diff` with
`--serve` instead of `--format` and `--output`.

### Preserve results and clean temporary files

Copy the desired files from the results directory into an approved review
location. Then remove only the two worktrees and temporary files created above:

<!-- docs-check:review-cleanup -->
```sh
git worktree remove "$review_root/base"
git worktree remove "$review_root/head"
rm -f \
  "$review_root/results/before.json" \
  "$review_root/results/after.json" \
  "$review_root/results/architecture-diff.md" \
  "$review_root/results/architecture-diff.json" \
  "$review_root/results/policy-result.json" \
  "$review_root/results/architecture-diff.html"
rmdir "$review_root/results"
rmdir "$review_root"
```

These commands work whether or not you created the optional Policy and HTML
artifacts. They do not reset the branch, delete untracked files in the current
checkout, or remove paths outside the temporary directory created by `mktemp`.

Architecture reports can reveal resource names, source paths, relations, and
project structure. Never attach raw plans, state, credentials, or secrets.
Apply repository access and retention rules before publishing any artifact.

## Review a completed plan

Run these commands from the root module directory of the head checkout, the
directory where the plan is produced. With `--plan`, Rootform reads the
project selection from the current working directory, so a `rootform.lock`
there applies. In CI, run them in the job that produced the plan; the export
never needs to leave that job.

### Export the plan

Create a directory outside the checkout for the plan and every result:

<!-- docs-check:review-plan-directory -->
```sh
plan_root=$(mktemp -d /tmp/rootform-plan-review.XXXXXX)
printf 'Plan review directory: %s\n' "$plan_root"
```

Create the saved plan through the usual workflow, then export it as JSON:

```sh
terraform plan -out="$plan_root/tfplan"
terraform show -json "$plan_root/tfplan" > "$plan_root/tfplan.json"
```

Use `tofu` for OpenTofu. Keeping both files outside the checkout keeps them out
of an accidental commit or artifact upload. They can contain sensitive values;
see [Protect the plan files](../inputs/plans.md#protect-the-plan-files).

### Compare the planned architecture

Read the comparison in the terminal first:

<!-- docs-check:review-plan-diff -->
```sh
rootform diff --plan "$plan_root/tfplan.json"
```

Then save Markdown for reviewers and JSON for automation:

<!-- docs-check:review-plan-reports -->
```sh
rootform diff --plan "$plan_root/tfplan.json" \
  --format markdown --output "$plan_root/plan-diff.md"
rootform diff --plan "$plan_root/tfplan.json" \
  --format json --output "$plan_root/plan-diff.json"
```

The plan supplies both sides, so do not add positional Before and After
arguments. A create plan can have an empty Before side. Entries reported as
undetermined are not no-change results;
[Read plan comparisons correctly](../inputs/plans.md#read-plan-comparisons-correctly)
explains them. The gate choice is the same as for a source comparison: an
informational `rootform diff`, `--exit-code` to block on any determined or
undetermined difference, or `rootform check` to block on governance results.

### Check and export the planned architecture

When the repository keeps a local pack at `policies/` beside the root module
directory, evaluate the planned architecture and save the result:

<!-- docs-check:review-plan-check -->
```sh
rootform check --plan "$plan_root/tfplan.json" \
  --policy-pack ../policies \
  --format json --output "$plan_root/plan-policy.json"
```

When `rootform.lock` in the root module selects the Policy Pack instead, run
`rootform init . --locked --no-input` first and check with `--locked` in
place of `--policy-pack`. The check evaluates the planned architecture only,
not the prior state.

Export the comparison as one page when visual inspection helps:

<!-- docs-check:review-plan-html -->
```sh
rootform diff --plan "$plan_root/tfplan.json" \
  --format html --output "$plan_root/plan-diff.html"
```

The page opens from disk with the same Before, Diff, and After stages. To
inspect the comparison while the plan still exists, run
`rootform diff --plan "$plan_root/tfplan.json" --serve` instead.
`plan-diff.md`, `plan-diff.json`, `plan-policy.json`, and `plan-diff.html`
answer the same review questions as the source artifacts above, for the
planned change.

### Remove the plan files

Copy the desired Rootform results into an approved review location. Then
remove the plan, its export, and the results:

<!-- docs-check:review-plan-cleanup -->
```sh
rm -f \
  "$plan_root/tfplan" \
  "$plan_root/tfplan.json" \
  "$plan_root/plan-diff.md" \
  "$plan_root/plan-diff.json" \
  "$plan_root/plan-policy.json" \
  "$plan_root/plan-diff.html"
rmdir "$plan_root"
```

Never attach `tfplan` or `tfplan.json` to the pull request or an artifact.
Rootform results omit raw plan values, but they still reveal resource names,
source paths, and architecture structure, so the same access and retention
rules apply to them.

Use [Run in CI](../integrations/ci/README.md) for a portable runner workflow
that accepts either input, or [GitHub Actions](../integrations/github-actions.md)
for a workflow that plans, exports, and reviews in one job.
