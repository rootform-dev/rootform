---
title: "GitHub Actions"
description: "Review a completed plan in a pull request with a verified Rootform release and protected artifacts."
---

The [setup action](https://github.com/rootform-dev/action/tree/main/setup) installs and verifies a published Rootform release, then puts its CLI on `PATH`. It does not run analysis or prepare selected content. Use the CLI after Terraform has produced a saved plan and JSON export. The [portable CI script](ci/rootform-ci.sh) gives this workflow the same files and exit status as other runners.

## Review a completed plan

Copy [the plan workflow](ci/github-actions-plan.yml) and [the portable script](ci/rootform-ci.sh) into your repository. This complete example assumes the Terraform root is `infra` and the script is `ci/rootform-ci.sh`:

```yaml title=".github/workflows/plan-review.yml"
name: Rootform plan review

on: [pull_request]

permissions:
  contents: read

jobs:
  plan-review:
    runs-on: ubuntu-24.04
    env:
      ROOTFORM_OUTPUT_DIR: .rootform-ci-${{ github.run_id }}-${{ github.run_attempt }}
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false
      - uses: hashicorp/setup-terraform@dfe3c3f87815947d99a8997f908cb6525fc44e9e # v4.0.1
        with:
          terraform_version: 1.16.4
          terraform_wrapper: false
      - uses: rootform-dev/action/setup@71eef759bff5e73b27489b1f7de818a4a76dc2e9
        with:
          version: 0.1.0
      # Terraform or OpenTofu produces the plan. Give this step the backend and
      # provider credentials it needs; Rootform never receives them.
      - name: Export plan
        working-directory: infra
        run: |
          terraform init -input=false
          terraform plan -input=false -out="$RUNNER_TEMP/plan.tfplan"
          terraform show -json "$RUNNER_TEMP/plan.tfplan" > "$RUNNER_TEMP/plan.json"
      # Rootform reads the completed export only. It runs no Terraform command.
      - name: Analyze plan
        env:
          ROOTFORM_PROJECT: ./infra
          ROOTFORM_INPUT: ${{ runner.temp }}/plan.json
          ROOTFORM_PLAN_FILE: ${{ runner.temp }}/plan.tfplan
          # Evaluate policies from a Policy Pack recorded in infra/rootform.lock:
          # ROOTFORM_POLICY: baseline/*
        run: sh ./ci/rootform-ci.sh
      # Upload Rootform results only, never the saved plan or its JSON export.
      - name: Keep Rootform results
        if: ${{ !cancelled() }}
        uses: actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7.0.1
        with:
          name: rootform-plan-results
          path: |
            ${{ env.ROOTFORM_OUTPUT_DIR }}/analysis.json
            ${{ env.ROOTFORM_OUTPUT_DIR }}/report.md
            ${{ env.ROOTFORM_OUTPUT_DIR }}/results.sarif
            ${{ env.ROOTFORM_OUTPUT_DIR }}/summary.txt
            ${{ env.ROOTFORM_OUTPUT_DIR }}/run.stderr
            ${{ env.ROOTFORM_OUTPUT_DIR }}/run.status
          if-no-files-found: warn
```

OpenTofu users replace `terraform` with `tofu` and use their verified setup method. The plan step writes into `$RUNNER_TEMP`, outside the checkout. Rootform never invokes Terraform or OpenTofu, refreshes state, contacts providers, or uses backend credentials. Keep those credentials in the plan step. Saved plans and JSON exports can contain cleartext secrets, so do not add them to artifacts, step summaries, or comments. [Plan inputs](../inputs/plans.md) explains why the pair matters.

## Interpret the analysis result

The script calls `rootform run` with `--plan-file` and `--require-enrichment` when `ROOTFORM_PLAN_FILE` is set. Observe `summary.txt` for `Enrichment    saved plan verified against this plan JSON`. `analysis.json` is the Rootform document with the planned architecture, any earlier stages and drift, and closures. `report.md` is the human review. Policy outcomes appear in `summary.txt` and `report.md`, and in `results.sarif` with the diagnostics. If verification fails, the step exits `3`; re-export JSON from the exact saved plan before trusting the review. On a `pull_request` event, `actions/checkout` checks out a merge of the branch into its target by default, so the plan describes that merge result rather than the pull request head. [Review a completed plan](../workflows/index.md#review-a-completed-plan) shows how reviewers read these artifacts, and [Choose the revisions](../workflows/index.md#choose-the-revisions) explains how to compare the branch with its merge base instead.

The upload step runs after a policy failure and names only Rootform outputs. A violation or no decision still fails the job; upload does not turn it green. Read `run.status`, `run.stderr`, and the `Evaluated` line of `summary.txt` before treating status `0` as a governance result. The outputs describe topology and names even though sensitive values are omitted, so retain them as internal artifacts. Never upload the whole checkout or `$RUNNER_TEMP`.

## Show the review in the workflow run

Reviewers can read the report on the workflow run page and open the Explorer without installing Rootform. Insert this step after **Analyze plan**, then add `review.html` to the upload list:

```yaml title="Review step to insert after Analyze plan"
      - name: Prepare the review
        if: ${{ !cancelled() }}
        run: |
          if [ -f "$ROOTFORM_OUTPUT_DIR/analysis.json" ]; then
            cat "$ROOTFORM_OUTPUT_DIR/report.md" >> "$GITHUB_STEP_SUMMARY"
            rootform run "$ROOTFORM_OUTPUT_DIR/analysis.json" --no-serve \
              -o "$ROOTFORM_OUTPUT_DIR/review.html"
          fi
```

```yaml title="Line to add to the upload path list"
            ${{ env.ROOTFORM_OUTPUT_DIR }}/review.html
```

The job summary then shows the sections of `report.md`: input, stages, counts, drift, uncertainty, and the policy outcome. `review.html` is a self-contained Explorer export built from the saved document without analyzing the plan again, and it makes no network requests. `if: ${{ !cancelled() }}` runs the step after a policy violation, and the file test skips it when the input was refused and no document exists. Anyone with read access to the repository can read job summaries and download artifacts; in a public repository, that is any signed-in GitHub user. Publish only what that audience may see.

## Prepare selection and choose a policy gate

A committed `infra/rootform.lock` fixes external Dialects and Policy Packs. Add a preparation step before analysis when it selects content:

```yaml title="Step to insert before Analyze plan"
      - name: Prepare selected content
        run: rootform init ./infra --locked --no-input
```

The portable script passes `--locked` when that file exists. It does not run `init` or change the lock. For a locked Policy Pack, set `ROOTFORM_POLICY` in the Analyze step to a reviewed selector such as `baseline/*`. For a project without a lock, `ROOTFORM_POLICY_PACK=./policies` supplies a one-run local override. The script refuses a pack override with a lock. No selected policies means no compliance claim even when architecture analysis succeeds. [Run in CI](ci/README.md#request-a-policy-gate) gives the full status and file contract.

## Upload SARIF only when needed

A downloadable SARIF artifact is separate from GitHub code scanning. To send findings to code scanning, add GitHub's [SARIF upload action](https://docs.github.com/en/code-security/how-tos/find-and-fix-code-vulnerabilities/integrate-with-existing-tools/upload-sarif-file) on a trusted event, point `sarif_file` at `results.sarif`, and grant `security-events: write` only to that upload job. Repository eligibility and upload permissions are GitHub settings. Keep ordinary pull request analysis at `contents: read`; do not grant write access just to produce Rootform artifacts.

## Handle forks without exposing credentials

A fork pull request receives a read-only token and normally cannot access repository secrets. A plan needing private backend or provider credentials may therefore be unavailable. Run that plan step only in a trusted context or review a protected plan produced elsewhere; do not move untrusted pull request code into a privileged `pull_request_target` job. The Rootform setup action may need a token only for a private release, while the public release path does not require an application token. Keep PR permissions narrow and avoid comments that expose topology. See GitHub's [fork event rules](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#workflows-in-forked-repositories) and [pull_request_target guidance](https://docs.github.com/en/actions/reference/security/securely-using-pull_request_target).

For GitLab, Azure Pipelines, or a local runner, use the same [portable recipe](ci/README.md#use-the-runner-recipes). For review outside CI, [reopen the saved Rootform document](../guides/reproduce-build.md#reopen-a-saved-rootform-document).
