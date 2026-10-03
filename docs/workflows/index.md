---
title: Review a pull request
description: Plan base and head revisions in isolated worktrees, compare them, evaluate Policies, and keep review artifacts private.
---

A pull request can be reviewed from two kinds of plan evidence. Reviewing the
one completed plan that CI made for the head shows what that planning
operation proposes and any drift it recorded; most teams start there, because
the plan already exists. Comparing the plans of the base and head revisions
isolates how the branch changes the planned architecture. Both give the same
kinds of Rootform evidence: a Form or a comparison, Policy results when a
Pack is selected, and an interactive view.

Rootform never runs Terraform or OpenTofu. Planning uses your backend,
providers, and credentials; Rootform then reads the exported files locally.
[Terraform and OpenTofu plans](../inputs/plans.md) is the canonical plan
procedure; this page applies it to a pull request. Use one Rootform binary
throughout.

For GitHub setup, use the [GitHub integration](../integrations/github-actions.md).
This workflow explains which evidence to choose and how to review it;
[Other CI/CD](../integrations/ci/README.md) covers other runners.

## Choose the review input

| Evidence | Use it when | Limit |
| --- | --- | --- |
| One head plan | Review Planned changes against its own Refreshed and Recorded evidence | It does not isolate the source revision change |
| Base and head plans | Review the architectural difference between revisions | Differences can also reflect planning inputs or infrastructure changes between runs |
| Saved Forms | Reopen or compare prior results without raw plans | Each Form retains its original evidence and semantic selection |

For source attribution, plan both revisions against comparable backend state,
workspace, input variables, provider sources and versions, Terraform or
OpenTofu version, and planning options. Run the plans close together because
infrastructure can change between runs. Rootform compares the exported plans;
it cannot verify those conditions or prove that a difference came from the Git
change. Record both commit IDs, the workspace, variable-set identity (never
secret values), provider and tool versions, relevant options, and plan times
with the review.

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
[2mStage[0m              Planned
[2mStages[0m             Recorded (reconstructed), Refreshed, Planned
[1m[38;5;208mArchitecture[0m
  [2mInstances[0m      153
[1m[38;5;208mReported drift[0m
  No drift reported in this plan.
```

This example plan starts from an empty state, so **Stages** includes an empty
Refreshed architecture and a reconstructed Recorded architecture. Its Reported
drift section lists no records. A plan made against existing state can list reported
drift records and their architectural consequences. If no drift is
reported, the plan may still have skipped or limited refresh; the
[plan guide](../inputs/plans.md#read-plan-comparisons-correctly) explains that
boundary. This review shows what one planning operation proposes; it does not
isolate the branch change from a base plan. When you need that isolation,
plan both revisions and compare them.

To keep the result, save the Form and a report, then evaluate the project's
locked Packs against the Form:

```sh
rootform run plan.json --plan-file plan.tfplan --no-serve -o analysis.json -o review.md
rootform check analysis.json --locked -o policy.json -o policy.md -o policy.sarif
```

`--policy-pack ./policies` replaces `--locked` when the project has no
`rootform.lock` yet; `--locked` fails rather than checking nothing when the
lock is missing. The same outputs and exit status rules as the comparison
procedure below apply.

## Compare two revisions

This procedure plans each revision in a detached Git worktree inside a new
temporary directory, so it never switches, resets, or cleans the working copy
under review. Plans and results stay in that directory until the cleanup step.
The same root module path must exist in both revisions.

Put every shell block from revision selection through cleanup, in order, in
`review-pr.sh`, then run `sh review-pr.sh`. Variables, functions, and traps
must persist between steps. Running the script keeps its `exit` trap from
closing an interactive shell.

### Choose the revisions

This procedure uses the merge base with `origin/main` as Before and the current
`HEAD` as After:

<!-- docs-check:journey-review-revisions -->
```sh
set -eu
target_ref=origin/main
head_ref=HEAD
base_commit=$(git merge-base "$target_ref" "$head_ref")
head_commit=$(git rev-parse "$head_ref")
printf 'Before: %s\nAfter:  %s\n' "$base_commit" "$head_commit"
```

`HEAD` names committed changes only; uncommitted edits in the current checkout
are not included. Update `target_ref` first when the review needs the latest
target branch. The merge base selects the common ancestor for these source
revisions; attribute plan differences to the branch only when the comparable
planning conditions above hold. Setting
`base_commit=$(git rev-parse "$target_ref")` instead compares with the current
target head, which can include changes merged there after divergence. Record
both full commit IDs with the review artifacts.

### Create isolated worktrees

<!-- docs-check:journey-review-worktrees -->
```sh
set -eu
review_root=$(mktemp -d "${TMPDIR:-/tmp}/rootform-review.XXXXXX")
review_root=$(cd "$review_root" && pwd -P)
results="$review_root/results"
printf 'Review directory: %s\n' "$review_root"

remove_review_worktree() {
  worktree_path=$1
  if git worktree list --porcelain | grep -Fqx "worktree $worktree_path"; then
    git worktree remove --force "$worktree_path" || cleanup_status=1
  elif [ -d "$worktree_path" ]; then
    rmdir "$worktree_path" 2>/dev/null || cleanup_status=1
  fi
}

cleanup_review() {
  cleanup_status=0
  remove_review_worktree "$review_root/base"
  remove_review_worktree "$review_root/head"
  if [ -d "$results" ]; then
    for name in base.tfplan base.json head.tfplan head.json \
      comparison.json comparison.md comparison.html policy.json policy.md policy.sarif; do
      rm -f "$results/$name" || cleanup_status=1
    done
    rmdir "$results" 2>/dev/null || cleanup_status=1
  fi
  if [ -d "$review_root" ]; then
    rmdir "$review_root" 2>/dev/null || cleanup_status=1
  fi
  if [ "$cleanup_status" -ne 0 ]; then
    printf 'Cleanup left temporary review files under %s\n' "$review_root" >&2
  fi
  return "$cleanup_status"
}

review_on_exit() {
  review_status=$?
  trap - 0 HUP INT TERM
  if [ "$review_status" -ne 0 ]; then
    cleanup_review || :
  fi
  exit "$review_status"
}

trap review_on_exit 0
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

git worktree add --detach "$review_root/base" "$base_commit"
git worktree add --detach "$review_root/head" "$head_commit"
mkdir "$results"
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
beside its export lets Rootform pair them.

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
Inputs compared
Uncertainty
                          Before   After
  Indeterminate closures       3       3
    Unknown until apply        3       3
Differences
  Instances               16 added, 7 removed
  Relations               5 added, 5 removed
  Contexts                28 added, 17 removed
  Contributions           9 added, 1 removed
  Indeterminate closures  3 before, 3 after
```

When the planning conditions above are comparable, the head plan reports 16
instances added and 7 removed relative to the base plan. Otherwise, describe
these as plan differences and investigate the other inputs and any
infrastructure change between runs. Inspect determined changes and
indeterminate closures together: an
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
| `comparison.html` | Where does each change sit in the **Before**, **Differences**, and **After** views? |

The HTML file opens from disk, includes its assets, and makes no network
requests. To explore the comparison in the browser while the plans still exist,
run the same command without `--no-serve` and the `-o` options. These
outputs omit sensitive values but retain infrastructure names, addresses, and
topology; restrict access and retention accordingly.

### Evaluate the saved comparison with Policies

The saved comparison contains the analyzed head architecture. Evaluate its
After side with the Policy Pack from the base revision, so the pull request
cannot relax the Policies that judge it. This example assumes that the
repository keeps its approved Pack in `policies/`:

<!-- docs-check:journey-review-policy -->
```sh
rootform check "$results/comparison.json" --side after \
  --policy-pack "$review_root/base/policies" \
  -o "$results/policy.json" -o "$results/policy.md" -o "$results/policy.sarif"
```

<!-- docs-output:journey-review-policy -->
```ansi title="Policy check summary, excerpt"
Policy check completed

Side           After
Origin         Plan
Stage          Planned
Policies       2 selected

Evaluations    2
Passed         2
Violated       0
Indeterminate  0

Verdict        PASSED

All selected evaluations passed.
```

With the commerce plans and the two Policies of the
[baseline example Pack](../../policy-packs/README.md) in `policies/`, both
Policies found a target in the head architecture and passed, so the command
exits `0`. Read **Policies** and **Evaluations** before trusting the status:
`0` is a passing gate only when every selected Policy evaluated a target and
every evaluation passed.
Status `1` blocks on a confirmed violation; `3` means no compliant verdict,
including indeterminate results and Policies that found no target. A check
without selected Policies makes no compliance claim. When `rootform.lock`
selects the Policy Packs, pass `--locked --project <dir>` in place of
`--policy-pack`. [Understand Policy outcomes](../guides/check-architecture.md) explains
target coverage and result interpretation.

### Preserve results and clean temporary files

Copy the reports you want to keep to an approved review location. Then remove
the worktrees, the plan files, and the temporary results:

<!-- docs-check:journey-review-cleanup -->
```sh
cleanup_review
```

`--force` is needed because `terraform init` writes files into each temporary
worktree. Cleanup removes only registered worktrees and the named plan and
report files under the directory created by `mktemp`. It uses `rmdir` for the
temporary directories, so unexpected files remain in place. If a command fails
or the shell is interrupted, the exit trap attempts the same cleanup and
returns the original command status.

## Keep CI artifacts deliberate

Run plan production and Rootform analysis in a job with the required planning
credentials; Rootform itself needs no cloud credentials. Upload only approved
Rootform reports, with restricted audience and retention. Never upload
`plan.tfplan`, `plan.json`, state JSON, provider credentials, or `.terraform/`.
Preserve the CLI exit status separately from artifact upload so a violation or
refusal cannot be hidden by a successful upload step. Rootform SARIF uses
logical locations only, and ingestion by a code-scanning service is not tested.
Keep the SARIF log as an artifact.

For a portable CI job, see [Other CI/CD](../integrations/ci/README.md). For
GitHub-specific permissions and artifact handling, see
[GitHub](../integrations/github-actions.md).
