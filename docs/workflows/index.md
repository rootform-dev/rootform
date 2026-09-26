---
title: Review a pull request
description: Plan base and head revisions in isolated worktrees, compare them, evaluate policies, and keep review artifacts private.
---

A pull request can be reviewed from two kinds of plan evidence. Comparing the
plans of the base and head revisions shows how the branch changes the planned
architecture. Reviewing the one completed plan that CI made for the head shows
what that planning operation proposes and any drift it recorded. Both give the
same kinds of Rootform evidence: an analysis or comparison, Policy results when
a Pack is selected, and an interactive view.

Rootform never runs Terraform or OpenTofu. Planning uses your backend,
providers, and credentials; Rootform then reads the exported files locally.
[Terraform and OpenTofu plans](../inputs/plans.md) is the canonical plan
procedure; this page applies it to a pull request. Use one Rootform binary
throughout.

## Choose the review input

| Evidence | Use it when | Limit |
| --- | --- | --- |
| Base and head plans | Review the architectural difference between revisions | The plans may also reflect drift between their execution times |
| One head plan | Review Planned changes against its own Refreshed and Recorded evidence | It does not isolate the source revision change |
| Saved Rootform documents | Reopen or compare prior analyses without raw plans | Each document retains its original evidence and semantic selection |

Plan both revisions against an intentionally comparable backend, workspace,
variables, and provider selection. Record the base and head commit IDs,
Terraform or OpenTofu versions, and plan times with the review. A change in any
of these can explain a difference unrelated to the proposed source edit.

## Compare two revisions

This procedure plans each revision in a detached Git worktree inside a new
temporary directory, so it never switches, resets, or cleans the working copy
under review. Plans and results stay in that directory until the cleanup step.
The same root module path must exist in both revisions.

### Choose the revisions

This procedure uses the merge base with `origin/main` as Before and the current
`HEAD` as After:

<!-- docs-check:journey-review-revisions -->
```sh
target_ref=origin/main
head_ref=HEAD
base_commit=$(git merge-base "$target_ref" "$head_ref")
head_commit=$(git rev-parse "$head_ref")
printf 'Before: %s\nAfter:  %s\n' "$base_commit" "$head_commit"
```

`HEAD` names committed changes only; uncommitted edits in the current checkout
are not included. Update `target_ref` first when the review needs the latest
target branch. This comparison answers what the branch changed since it
diverged from the target branch. Setting
`base_commit=$(git rev-parse "$target_ref")` instead compares with the current
target head, which can include changes merged there after divergence. Record
both full commit IDs with the review artifacts.

### Create isolated worktrees

<!-- docs-check:journey-review-worktrees -->
```sh
review_root=$(mktemp -d /tmp/rootform-review.XXXXXX)
git worktree add --detach "$review_root/base" "$base_commit"
git worktree add --detach "$review_root/head" "$head_commit"
results="$review_root/results"
mkdir "$results"
printf 'Review directory: %s\n' "$review_root"
```

These commands do not switch the current checkout. A worktree does not inherit
the current checkout's `.terraform/` directory, installed modules, or provider
selection, so each revision is initialized from its own committed
configuration.

### Plan each revision

Set the root module path relative to the repository root, then initialize,
plan, and export each revision with your usual backend, workspace, and variable
options. OpenTofu users replace `terraform` with `tofu`:

```sh
root_module=infra
for side in base head; do
  module_dir="$review_root/$side/$root_module"
  terraform -chdir="$module_dir" init -input=false
  terraform -chdir="$module_dir" plan -input=false -out="$results/$side.tfplan"
  terraform -chdir="$module_dir" show -json "$results/$side.tfplan" > "$results/$side.json"
done
```

`-chdir` runs each command in that revision's root module, while the saved
plan and its JSON export land in the results directory. Keeping each saved plan
beside its export lets Rootform verify the pair.

> [!WARNING]
> Saved plans and JSON exports can contain cleartext secrets. Keep the results
> directory private, and never attach these files to the pull request or to a
> general CI artifact. [Protect the plan files](../inputs/plans.md#protect-the-plan-files)
> explains the risk.

To try the procedure without planning, copy the
[commerce Playground](../../examples/playground/commerce-platform/README.md)
plans instead: its `base/plan.json` and `base/plan.tfplan` become
`$results/base.json` and `$results/base.tfplan`, and its `head` files become
`$results/head.json` and `$results/head.tfplan`. The excerpts below come from
those plans.

### Compare and save review artifacts

Run the Rootform commands from the repository root. Rootform reads both plans
with one project selection: the current directory's, or the directory named by
`--project`. These commands use the embedded Dialects. When the root module
records Dialects or Policy Packs in `rootform.lock`, prepare that selection as
described in [Reproduce an analysis offline](../guides/reproduce-build.md) and
add `--project "$review_root/base/$root_module"`, so the selection already
reviewed on the target branch reads both sides. If the pull request changes
`rootform.lock`, repeat the comparison with the head root module to see what
that change does.

Record the Rootform version, then read the comparison in the terminal:

<!-- docs-check:journey-review-compare -->
```sh
rootform version
rootform run "$results/base.json" --plan-file "$results/base.tfplan" \
  --diff "$results/head.json" --diff-plan-file "$results/head.tfplan" --no-serve
```

The first input is Before; the `--diff` input is After. Both default to the
`planned` stage; choose `--before-stage` and `--after-stage` when the review
question concerns other available stages. For the commerce plans, the summary
includes:

```ansi title="Comparison excerpt"
[1mInputs compared[0m
[1m[38;5;208mDifferences · Before Planned → After Planned[0m
  [2mInstances[0m     16 added, 7 removed, 0 changed
  [2mFacts[0m         42 added, 23 removed
  [2mIndeterminate[0m  3 closures before (3 unknown until apply) · 3 closures after (3 unknown until apply)
```

Here the branch adds 16 planned instances and removes 7. Inspect determined
changes and indeterminate closures together: an
[indeterminate closure](../concepts/comparisons.md#indeterminate-preserves-uncertainty)
is not proof of no change. A successful comparison returns `0` even when
changes exist, so the status alone is not an approval gate. Two separately
produced plans cannot establish drift between their runs. For a plan's own
recorded-to-refreshed drift, inspect that plan's
[comparison views](../concepts/forms.md#comparisons-and-drift).

Then save a reusable comparison, a readable report, and a standalone
interactive view from the same run:

<!-- docs-check:journey-review-save -->
```sh
rootform run "$results/base.json" --plan-file "$results/base.tfplan" \
  --diff "$results/head.json" --diff-plan-file "$results/head.tfplan" \
  --no-serve -o "$results/comparison.json" -o "$results/comparison.md" \
  -o "$results/comparison.html"
```

| Artifact | Review question |
| --- | --- |
| `comparison.md` | Which instances and facts changed or remain indeterminate? |
| `comparison.json` | Which structured comparison entries should automation process? |
| `comparison.html` | Where does each change sit in the **Before**, **Diff**, and **After** views? |

The HTML file opens from disk, includes its assets, and makes no network
requests. To explore the comparison in the browser while the plans still exist,
run the same command without `--no-serve` and the `-o` options. These
outputs omit sensitive values but retain infrastructure names, addresses, and
topology; restrict access and retention accordingly.

### Evaluate the head with policies

Evaluate the head plan with the Policy Pack from the base revision, so the pull
request cannot relax the policies that judge it. This example assumes that the
repository keeps its approved Pack in `policies/`:

<!-- docs-check:journey-review-policy -->
```sh
rootform run "$results/head.json" --plan-file "$results/head.tfplan" \
  --policy-pack "$review_root/base/policies" \
  --no-serve -o "$results/policy.md" -o "$results/policy.sarif"
```

With the commerce head plan and the two Policies of the
[baseline example Pack](../../policy-packs/README.md) in `policies/`, the summary
includes:

```ansi title="Policy excerpt"
[2mPolicies[0m      passed
[1m[38;5;208mPolicies · planned[0m
  [2mResult[0m     passed
  [2mEvaluated[0m  2 policies over 2 targets: 2 passed, 0 violated, 0 indeterminate
```

Both Policies found a target in the head plan and passed, so the command exits
`0`. Read **Evaluated** before trusting the status: `0` is a passing gate only
when the selected Policies evaluated targets and every evaluation passed.
Status `1` blocks on a confirmed violation; `3` means no compliant verdict,
including indeterminate results and Policies that found no target. A run
without selected Policies makes no compliance claim. When `rootform.lock`
selects the Policy Packs, use `--locked` with the same `--project` in place of
`--policy-pack`. [Run policy checks](../guides/check-architecture.md) explains
target coverage and result interpretation.

### Preserve results and clean temporary files

Copy the reports you want to keep to an approved review location. Then remove
the worktrees, the plan files, and the temporary results:

<!-- docs-check:journey-review-cleanup -->
```sh
git worktree remove --force "$review_root/base"
git worktree remove --force "$review_root/head"
rm -f \
  "$results/base.tfplan" "$results/base.json" \
  "$results/head.tfplan" "$results/head.json" \
  "$results/comparison.json" "$results/comparison.md" "$results/comparison.html" \
  "$results/policy.md" "$results/policy.sarif"
rmdir "$results" "$review_root"
```

`--force` is needed because `terraform init` writes files into each temporary
worktree. These commands work whether or not you created the optional policy
and HTML artifacts. They remove only the paths created above; they do not reset
the branch or delete files in the current checkout.

## Review a completed plan

When CI already plans the pull request head, review that one completed plan in
the job that produced it; the plan files never need to leave that job. Run
Rootform from the root module directory where the plan was produced, so the
project's `rootform.lock` applies:

<!-- docs-check:journey-review-one-plan -->
```sh
rootform run plan.json --plan-file plan.tfplan --no-serve
```

For the commerce head plan, the summary includes:

```ansi title="Completed plan excerpt"
[2mForms[0m        planned (default)
[1m[38;5;208mPlanned Form[0m
  [2mInstances[0m    153 (153 managed, 0 data)
[1m[38;5;208mReported drift[0m
  No drift reported in this plan.
```

This example plan was made without prior state, so **Forms** lists only
`planned` and there is nothing to report as drift. A plan made against
existing state also lists `refreshed` and `recorded`, and **Reported drift** then lists
what refresh found changed outside Terraform or OpenTofu. If no drift is
reported, the plan may still have skipped or limited refresh; the
[plan guide](../inputs/plans.md#read-plan-comparisons-correctly) explains that
boundary. This review shows what one planning operation proposes; it does not
isolate the branch change from a base plan. Save reports and evaluate policies
with the same `-o`, `--policy-pack`, or `--locked` options as above.

## Keep CI artifacts deliberate

Run plan production and Rootform analysis in a job with the required planning
credentials; Rootform itself needs no cloud credentials. Upload only approved
Rootform reports, with restricted audience and retention. Never upload
`plan.tfplan`, `plan.json`, state JSON, provider credentials, or `.terraform/`.
Preserve the CLI exit status separately from artifact upload so a violation or
refusal cannot be hidden by a successful upload step. SARIF is useful for
consumers that accept SARIF 2.1.0; the Markdown report remains readable without
a platform integration.

For a portable CI job, see [Run in CI](../integrations/ci/README.md). For
GitHub-specific permissions and artifact handling, see
[GitHub Actions](../integrations/github-actions.md).
