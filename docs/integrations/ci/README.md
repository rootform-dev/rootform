---
title: "Run in CI"
description: "Analyze a completed plan in a runner, retain review evidence, and choose an explicit policy gate."
---

Decide what the job must produce before choosing a gate. An analysis keeps architecture evidence for review without claiming compliance. A policy gate is a separate, explicit decision.

Install an exact Rootform release, then copy the [portable script](rootform-ci.sh) into your repository as `ci/rootform-ci.sh`. The script accepts a completed plan or state JSON and writes one set of results to a fresh directory. It does not run Terraform or OpenTofu, install packages, or choose project content. The [GitHub](github-actions-plan.yml), [GitLab](gitlab-ci.yml), [Azure Pipelines](azure-pipelines.yml), and [generic](generic-ci.sh) examples call that same script.

Use a single job when Terraform or OpenTofu and Rootform can share a protected workspace. A separate analysis job must receive the exact saved plan and JSON through a protected transfer; both can contain cleartext secrets. Keep those files out of Git, public artifacts, job summaries, and pull request comments. Rootform outputs omit sensitive values but describe topology and names, so retain them as internal review evidence.

<!-- rootform:steps -->

## Review a completed plan

From the Terraform root `./infra`, export the saved plan in a private runner directory that the job never uploads. OpenTofu users replace `terraform` with `tofu` in these commands:

```sh
(
  cd infra
  terraform init -input=false
  terraform plan -input=false -out="$RUNNER_TEMP/plan.tfplan"
  terraform show -json "$RUNNER_TEMP/plan.tfplan" > "$RUNNER_TEMP/plan.json"
)
```

`$RUNNER_TEMP` is GitHub's per-job temporary directory; [Use the runner recipes](#use-the-runner-recipes) shows where the other recipes keep these files. Rootform never uses provider or backend credentials. Keep them in this plan step and give the analysis step access only to the two completed files. [Terraform and OpenTofu plans](../../inputs/plans.md) explains why the saved plan must match its export. To compare base and head revisions of a pull request instead, follow [Review a pull request](../../workflows/index.md#choose-the-review-input).

## Prepare a locked selection before analysis

A project without `rootform.lock` uses the embedded Dialects and needs no preparation: continue with the next step. When `infra/rootform.lock` names external content, prepare it before the script:

<!-- docs-check:ci-init-locked -->
```sh
rootform init ./infra --locked --no-input
```

<!-- docs-output:ci-init-locked -->
```text title="Output with one locked Policy Pack"
Project prepared

External dialects      0
External Policy Packs  1
```

`init` verifies the local, installed, or vendored content that the lock selects and reports how many external Dialects and Policy Packs are ready. It may acquire only the exact OCI digests in the lock, and `--no-input` keeps it from prompting. Add `--offline`, or set `ROOTFORM_OFFLINE=1`, when that content is already present and acquisition must be disabled. Offline mode governs Rootform acquisition only, not checkout, binary installation, caches, or artifact upload. A private registry needs credentials from the runner's `DOCKER_CONFIG` for this step only, never in the lock or on the command line; see [private registry credentials](../oci-image.md#use-private-registry-credentials).

Run `rootform add` during project configuration and commit the reviewed lock. Never run `add` in CI: a job verifies the committed selection instead of choosing one. The script adds `--locked` to `run` whenever `infra/rootform.lock` exists and never creates or updates the lock, so missing selected content stops analysis. [Select Dialects and Policy Packs](../../cli.md) explains the difference between selection and preparation.

## Run the portable recipe

Run from the repository root. `ROOTFORM_PROJECT` names the Terraform root whose Rootform selection applies. Name a fresh output directory for each job attempt:

<!-- docs-check:ci-run -->
```sh
ROOTFORM_PROJECT=./infra \
ROOTFORM_INPUT="$RUNNER_TEMP/plan.json" \
ROOTFORM_PLAN_FILE="$RUNNER_TEMP/plan.tfplan" \
ROOTFORM_OUTPUT_DIR=.rootform-ci-123 \
sh ./ci/rootform-ci.sh
```

The script prints nothing itself. Open `summary.txt` and confirm that Rootform verified the pair and reports the planned stage:

<!-- docs-output:ci-run -->
```text title="Excerpt from summary.txt"
Plan analyzed
Enrichment    saved plan verified against this plan JSON (1 module)
Forms         planned (default)
```

The script passes `--plan-file --require-enrichment --no-serve` to `rootform run`. It writes the summary to `summary.txt`, diagnostics to `run.stderr`, and the exact exit code to `run.status`. A refused pair exits `3` rather than turning a missing traversal into an apparently complete review. With state JSON, omit `ROOTFORM_PLAN_FILE`: the result has one `recorded` stage.

| File in `ROOTFORM_OUTPUT_DIR` | Use |
| --- | --- |
| `analysis.json` | Rootform document with stages, facts, closures, drift, and selection details. It stores no policy results. |
| `report.md` | Human review of the same run, including the policy outcome when policies were selected. |
| `results.sarif` | Diagnostics and explicitly evaluated policy results. |
| `summary.txt` | The terminal summary, including the policy outcome when policies were selected. |
| `run.stderr` | Progress and failure diagnostics. |
| `run.status` | Exit status of the Rootform command, recorded even when the job fails. |

The script refuses an existing or symbolic-link output path before running. Do not reuse a prior result directory: a fresh path keeps stale files out of a failed run. A write failure may leave files already written; use `run.status` and `run.stderr` to distinguish partial results from a complete report. [Script settings](#script-settings) lists every variable, and [Outputs and exit status](../../reference/outputs.md) defines each format.

## Request a policy gate

Without a selected Policy Pack, analysis can exit `0` but makes no compliance claim. For a project without `rootform.lock`, pass a reviewed local pack for one run:

<!-- docs-check:ci-pack-override -->
```sh
ROOTFORM_POLICY_PACK=./policies \
ROOTFORM_PROJECT=./infra \
ROOTFORM_INPUT="$RUNNER_TEMP/plan.json" \
ROOTFORM_PLAN_FILE="$RUNNER_TEMP/plan.tfplan" \
ROOTFORM_OUTPUT_DIR=.rootform-ci-policy-123 \
sh ./ci/rootform-ci.sh
```

The policy section of `summary.txt` states the result and how many targets each evaluation covered. With two policies that both found their targets, it reads:

<!-- docs-output:ci-pack-override -->
```text title="Excerpt from summary.txt"
Policies · planned
  Result     passed
  Evaluated  2 policies over 2 targets: 2 passed, 0 violated, 0 indeterminate
```

The script refuses `ROOTFORM_POLICY_PACK` when the project has a lock. For a locked project, add the pack during project configuration, commit the lock, then use `ROOTFORM_POLICY` to select named policies or patterns. The script accepts space-separated selectors and repeats `--policy` for each; quote the environment value so the shell does not expand `*`:

<!-- docs-check:ci-locked-policy -->
```sh
ROOTFORM_POLICY='baseline/*' \
ROOTFORM_PROJECT=./infra \
ROOTFORM_INPUT="$RUNNER_TEMP/plan.json" \
ROOTFORM_PLAN_FILE="$RUNNER_TEMP/plan.tfplan" \
ROOTFORM_OUTPUT_DIR=.rootform-ci-policy-123 \
sh ./ci/rootform-ci.sh
```

`run.status` is `0` when analysis completed and every selected policy passed, `1` when a selected policy was violated, `2` when the command was used incorrectly, `3` when input was refused or a policy was indeterminate or decided nothing, and `4` when a file could not be written or the server could not start. If `ROOTFORM_BIN` cannot be found, the shell records `127` instead and `run.stderr` holds the shell error. Status `0` with no selected policies makes no compliance claim. Read the `Evaluated` line in `summary.txt` or `report.md`: a selected policy with zero targets is not approval. [Run checks](../../guides/check-architecture.md) explains the policy path.

## Retain results without changing the gate

Upload only the six named Rootform result files, even when `run.status` is `1` or `3`. Keep the script's nonzero exit as the job result. Do not upload the raw plan, JSON export, state JSON, `.terraform/`, or the whole runner directory.

Reviewers who want the Explorer without installing Rootform can open a self-contained HTML export. After the script, write it from the saved document and add `review.html` to the files you upload:

<!-- docs-check:ci-review-html -->
```sh
rootform run .rootform-ci-123/analysis.json --no-serve \
  -o .rootform-ci-123/review.html
```

<!-- docs-output:ci-review-html -->
```text title="Standard error"
Loading    .rootform-ci-123/analysis.json (Rootform document; no recompilation)
Wrote      .rootform-ci-123/review.html
```

`no recompilation` confirms that Rootform reopened the document instead of analyzing the plan again, so this step needs neither the plan nor the project. The HTML file opens from disk and makes no network requests. It shows the architecture, stages, and drift; policy results stay in `summary.txt`, `report.md`, and `results.sarif`. Skip the step when `analysis.json` is absent because the input was refused.

If you send `results.sarif` to a code-scanning service, configure that as a separate permissioned step; a downloadable artifact alone does not publish code-scanning findings.

## Use the runner recipes

Each recipe exports the plan, runs the script, and keeps the named results when the gate fails. Adapt the Terraform root, the policy variables, and the installation steps to your project.

The [GitHub recipe](github-actions-plan.yml) installs Terraform with a pinned action and Rootform with the `setup` action, then keeps plan files in `$RUNNER_TEMP`. Its upload step uses `if: ${{ !cancelled() }}`, so the results stay downloadable after a policy failure while the job remains failed; GitHub's [status check functions](https://docs.github.com/en/actions/reference/workflows-and-actions/expressions#always) explain why. [GitHub Actions](../github-actions.md) covers the job summary, fork trust, and optional SARIF upload.

The [GitLab recipe](gitlab-ci.yml) needs a shell runner with Terraform and a verified Rootform `0.1.0` binary on `PATH`. It writes the saved plan, its JSON export, and the result directory `.rootform-ci-$CI_JOB_ID` inside `CI_PROJECT_DIR`, so it first checks that the runner user can write there. Only the six Rootform files are listed as artifacts, and `artifacts: when: always` keeps them after a policy failure without changing the job status. See GitLab's [artifact rules](https://docs.gitlab.com/ci/yaml/#artifactswhen).

The [Azure Pipelines recipe](azure-pipelines.yml) runs one Bash step on a Microsoft-hosted Ubuntu agent. Add steps before it that install Terraform and a checksum-verified Rootform release, as in [manual installation](../../installation.md#manual-installation). The step writes plan files to `$(Agent.TempDirectory)` and results to a build-specific directory, which `condition: succeededOrFailed()` publishes even when the gate fails. That directory holds only Rootform results because the script requires a fresh path.

The [generic script](generic-ci.sh) assumes a checked-out project and an installed, checksum-verified Rootform. Export `ROOTFORM_INPUT` (and `ROOTFORM_PLAN_FILE` for a plan), then call it from the repository root. It defaults `ROOTFORM_PROJECT` to `./infra` and passes every other setting through. Archive the named files even when it exits `1` or `3`, and keep that exit code as the job status.

<!-- rootform:endsteps -->

## Script settings

The script reads its settings from the environment:

| Variable | Default | Use |
| --- | --- | --- |
| `ROOTFORM_INPUT` | Required | Plan JSON or state JSON to analyze. |
| `ROOTFORM_PLAN_FILE` | Unset | Saved plan behind that plan JSON. Adds `--plan-file` and `--require-enrichment`; omit it for state JSON. |
| `ROOTFORM_PROJECT` | `./infra` | Directory whose Rootform selection applies. Adds `--locked` when it contains `rootform.lock`. |
| `ROOTFORM_OUTPUT_DIR` | `.rootform-ci` | Result directory. It must not exist yet. |
| `ROOTFORM_POLICY_PACK` | Unset | Local Policy Pack for this run only. Refused when the project has `rootform.lock`. |
| `ROOTFORM_POLICY` | Unset | Space-separated policy names or patterns, each passed as `--policy`. |
| `ROOTFORM_BIN` | `rootform` | Rootform command to call. |

Relative paths resolve from the directory where you run the script. The script never changes directory, so quoted paths containing spaces are safe. Before it creates the result directory, the script checks the input, project, saved plan, and output path, and refuses a local Pack in a project with `rootform.lock`. Each refusal exits `2` with a message that names the setting, such as `ROOTFORM_OUTPUT_DIR must be a fresh directory`. Later problems, such as a policy selection Rootform refuses or a missing `ROOTFORM_BIN`, are recorded in `run.status` and `run.stderr`.

For a network-disabled analysis job, [reproduce the selection offline](../../guides/reproduce-build.md) first. [Troubleshooting](../../troubleshooting/index.md#locked-project-selection-fails) covers missing locks and content.
