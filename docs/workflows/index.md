---
title: "Review a pull request"
description: "Compare two Git revisions from isolated worktrees and prepare architecture evidence for review."
---

Build review evidence without switching, resetting, or cleaning the working
copy under review. This procedure uses detached Git worktrees in a new temporary
directory and writes every Rootform result outside them.

Use one Rootform binary throughout. The same root module path must exist in both
revisions, and every required module must already be available in each
checkout.

## Choose the revisions

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

That comparison answers: what architectural meaning did this branch introduce
since it diverged from target branch? To compare current target head against
branch head instead, set `base_commit=$(git rev-parse "$target_ref")`. That
answers a different question and can include changes made on target branch
after divergence.

Record both full commit IDs with review artifacts.

## Create isolated worktrees

<!-- docs-check:review-worktrees -->
```sh
review_root=$(mktemp -d /tmp/rootform-review.XXXXXX)
git worktree add --detach "$review_root/base" "$base_commit"
git worktree add --detach "$review_root/head" "$head_commit"
mkdir "$review_root/results"
printf 'Review directory: %s\n' "$review_root"
```

These commands do not switch current checkout. Set root module path relative to
repository root, then build both revisions into results directory:

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
changes, use same binary and comparable Dialect selection. When
`rootform.lock` changes in pull request, do not copy one revision's lock into
other. Build each revision as committed, then treat resulting semantic
difference as part of review. Architecture Diff can preserve source continuity
while reporting affected conclusions as undetermined. See
[semantic changes](../concepts/diff.md#semantic-changes-need-separate-review).

## Compare and save review artifacts

Read comparison in terminal first:

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

Choose gate separately from report format:

- Publish informative report with ordinary `rootform diff`. Completed comparison returns `0` even when changes exist
- Block on any determined or undetermined difference with `rootform diff before.json after.json --exit-code`
- Block on governance result with `rootform check` and expected Policy Pack selection and target coverage

Architectural change is review information, not automatically defect. Likewise,
completed process is not automatically approval. Read report contents and
policy coverage before deciding.

## Add policy and architecture evidence

When repository keeps local pack at `policies/`, evaluate head revision and
save result:

<!-- docs-check:review-policy -->
```sh
rootform check "$review_root/head/$root_module" \
  --policy-pack "$review_root/head/policies" \
  --format json --output "$review_root/results/policy-result.json"
```

Use project-selected Policy Packs instead when lock owns governance selection.
[Run checks](../guides/check-architecture.md) explains outcomes and evidence.

Export head architecture when visual inspection helps:

<!-- docs-check:review-html -->
```sh
rootform build "$review_root/head/$root_module" --format html \
  --output "$review_root/results/after.html"
```

Reviewers should read:

| Artifact | Review question |
| --- | --- |
| `architecture-diff.md` | Which architectural representations and facts changed? |
| `architecture-diff.json` | Which determined and undetermined entries should automation process? |
| `policy-result.json` | Which Policies ran, which targets they evaluated, and what outcomes resulted? |
| `after.html` | What does After architecture contain and how is it organized? |

HTML shows one architecture. It is not an interactive Diff report.

## Preserve results and clean temporary files

Copy desired files from results directory into approved review location. Then
remove only two worktrees and temporary files created above:

<!-- docs-check:review-cleanup -->
```sh
git worktree remove "$review_root/base"
git worktree remove "$review_root/head"
rm "$review_root/results/before.json"
rm "$review_root/results/after.json"
rm "$review_root/results/architecture-diff.md"
rm "$review_root/results/architecture-diff.json"
rm "$review_root/results/policy-result.json"
rm "$review_root/results/after.html"
rmdir "$review_root/results"
rmdir "$review_root"
```

No command resets branch, deletes untracked files in current checkout, or
removes paths outside temporary directory created by `mktemp`.

Architecture reports can reveal resource names, source paths, relations, and
project structure. Never attach raw plans, state, credentials, or secrets.
Apply repository access and retention rules before publishing any artifact.

Continue with [Run in CI](../integrations/ci/README.md) for portable runner
workflow or [GitHub Actions](../integrations/github-actions.md) for GitHub setup
and reporting. Those pages own automation details.
