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

External Dialects      0
External Policy Packs  1
```

`init` verifies the local, installed, or vendored content that the lock selects and reports how many external Dialects and Policy Packs are ready. It may acquire only the exact OCI digests in the lock, and `--no-input` keeps it from prompting. Add `--offline`, or set `ROOTFORM_OFFLINE=1`, when that content is already present and acquisition must be disabled. Offline mode governs Rootform acquisition only, not checkout, binary installation, caches, or artifact upload. A private registry needs credentials from the runner's `DOCKER_CONFIG` for this step only, never in the lock or on the command line; see [private registry credentials](../oci-image.md#use-private-registry-credentials).

Run `rootform add` during project configuration and commit the reviewed lock. Never run `add` in CI: a job verifies the committed selection instead of choosing one. The script adds `--locked` to both commands whenever `infra/rootform.lock` exists and never creates or updates the lock: a missing Dialect stops analysis, and a missing Policy Pack stops the gate. [Select Dialects and Policy Packs](../../cli.md) explains the difference between selection and preparation.

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

The script prints nothing itself. Open `summary.txt` and confirm that the saved plan paired with the export, a check of version, timestamp, and configuration shape only, and that the summary reports the Planned stage:

<!-- docs-output:ci-run -->
```text title="Excerpt from summary.txt"
Plan analyzed

Enrichment         Saved plan paired with this plan JSON (1 module)
                   Only version, timestamp, and configuration shape are compared
Stage              Planned
Stages             Recorded (reconstructed), Refreshed, Planned
```

The analysis phase runs `rootform run` with `--plan-file --require-enrichment --no-serve` when a saved plan is supplied. It writes `analysis.json` and `report.md`, with standard output in `summary.txt`, standard error in `run.stderr`, and the exact status in `run.status`. A failed analysis exits immediately without running a gate. With state JSON, omit `ROOTFORM_PLAN_FILE`: the result has one `recorded` stage.

| File in `ROOTFORM_OUTPUT_DIR` | Use |
| --- | --- |
| `analysis.json` | Form with stages, facts, closures, drift, and selection details. It stores no Policy results. |
| `report.md` | Human review of the analyzed Form. |
| `summary.txt` | Standard output from analysis. |
| `run.stderr` | Analysis progress and failure diagnostics. |
| `run.status` | Analysis exit status, recorded even when the job fails. |
| `policy.json` | Structured Policy result when the gate runs. |
| `policy.md` | Policy report when the gate runs. |
| `results.sarif` | SARIF 2.1.0 Policy result when the gate runs. |
| `check.txt` | Standard output from the Policy gate. |
| `check.stderr` | Gate progress and failure diagnostics. |
| `check.status` | Gate exit status, recorded even when the job fails. |

The script refuses an existing or symbolic-link output path before running. Do not reuse a prior result directory: a fresh path keeps stale files out of a failed run. A write failure may leave files already written; use `run.status` and `run.stderr` to distinguish partial results from a complete report. [Script settings](#script-settings) lists every variable, and [Outputs and exit status](../../reference/outputs.md) defines each format.

## Request a policy gate

Analysis alone can exit `0` but makes no compliance claim. The script runs `rootform check` when a policy variable is set or the project lock selects at least one Policy Pack. For a project without `rootform.lock`, pass a reviewed local Policy Pack to the gate:

<!-- docs-check:ci-pack-override -->
```sh
ROOTFORM_POLICY_PACK=./policies \
ROOTFORM_PROJECT=./infra \
ROOTFORM_INPUT="$RUNNER_TEMP/plan.json" \
ROOTFORM_PLAN_FILE="$RUNNER_TEMP/plan.tfplan" \
ROOTFORM_OUTPUT_DIR=.rootform-ci-policy-123 \
sh ./ci/rootform-ci.sh
```

The gate writes its text summary to `check.txt`. With two Policies that both found their targets, the summary excerpt is:

<!-- docs-output:ci-pack-override -->
```text title="Excerpt from check.txt"
Policy check completed

Origin         Plan (saved Form)
Stage          Planned
Policies       2 selected

Evaluations    2
Passed         2
Violated       0
Indeterminate  0

Verdict        PASSED

All selected evaluations passed.
```

The script refuses `ROOTFORM_POLICY_PACK` when the project has a lock. For a locked project, add the Policy Pack during project configuration, commit the lock, then use `ROOTFORM_POLICY` to select named Policies or patterns. The script accepts space-separated selectors and repeats `--policy` for each; quote the environment value so the shell does not expand `*`:

<!-- docs-check:ci-locked-policy -->
```sh
ROOTFORM_POLICY='baseline/*' \
ROOTFORM_PROJECT=./infra \
ROOTFORM_INPUT="$RUNNER_TEMP/plan.json" \
ROOTFORM_PLAN_FILE="$RUNNER_TEMP/plan.tfplan" \
ROOTFORM_OUTPUT_DIR=.rootform-ci-policy-123 \
sh ./ci/rootform-ci.sh
```

The script exits with the analysis status if analysis fails. Otherwise, when a gate runs, it exits with the check status; if no gate runs, it exits `0`. Check status `0` means every selected Policy passed, `1` means a violation, `2` means incorrect use, `3` means no verdict, and `4` means a report could not be written after the verdict. If `ROOTFORM_BIN` cannot be found, the failing phase records `127` and its stderr file holds the shell error. Read `check.txt` and `policy.md`: a selected Policy with zero targets is not approval. [Follow a Policy through every outcome](../../guides/check-architecture.md) explains the policy path.

## Retain results without changing the gate

Upload the five analysis files and six gate files when present, including after a nonzero status. Keep the script's nonzero exit as the job result. Do not upload the raw plan, JSON export, state JSON, `.terraform/`, or the whole runner directory.

Reviewers who want the Explorer without installing Rootform can open a self-contained HTML export. After the script, write it from the saved Form and add `review.html` to the files you upload:

<!-- docs-check:ci-review-html -->
```sh
rootform run .rootform-ci-123/analysis.json --no-serve \
  -o .rootform-ci-123/review.html
```

<!-- docs-output:ci-review-html -->
```text title="Standard error"
Loading    .rootform-ci-123/analysis.json (saved Form; no recompilation)
Wrote      .rootform-ci-123/review.html
```

`no recompilation` confirms that Rootform reopened the Form instead of analyzing the plan again, so this step needs neither the plan nor the project. The HTML file opens from disk and makes no network requests. It shows the architecture, stages, and drift; Policy results stay in `policy.md` and `results.sarif`. Skip the step when `analysis.json` is absent because analysis failed.

The SARIF log uses logical locations only, and ingestion by a code-scanning service is not tested; keep SARIF as a build artifact.

## Use the runner recipes

Each recipe exports the plan, runs the script, and keeps the named results when the gate fails. Adapt the Terraform root, the policy variables, and the installation steps to your project.

The [GitHub recipe](github-actions-plan.yml) installs Terraform with a pinned action and Rootform with the `setup` action, then keeps plan files in `$RUNNER_TEMP`. Its upload step uses `if: ${{ !cancelled() }}`, so the results stay downloadable after a policy failure while the job remains failed; GitHub's [status check functions](https://docs.github.com/en/actions/reference/workflows-and-actions/expressions#always) explain why. [GitHub Actions](../github-actions.md) covers the job summary and fork trust.

The [GitLab recipe](gitlab-ci.yml) needs a shell runner with Terraform and a verified Rootform `0.1.0` binary on `PATH`. It writes the saved plan, its JSON export, and the result directory `.rootform-ci-$CI_JOB_ID` inside `CI_PROJECT_DIR`, so it first checks that the runner user can write there. The analysis and gate files are listed as artifacts, and `artifacts: when: always` keeps them after a policy failure without changing the job status. See GitLab's [artifact rules](https://docs.gitlab.com/ci/yaml/#artifactswhen).

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
| `ROOTFORM_POLICY_PACK` | Unset | Local Policy Pack for the gate only. Refused when the project has `rootform.lock`. |
| `ROOTFORM_POLICY` | Unset | Space-separated Policy names or patterns, each passed to `check` as `--policy`. |
| `ROOTFORM_BIN` | `rootform` | Rootform command to call. |

Relative paths resolve from the directory where you run the script. The script never changes directory, so quoted paths containing spaces are safe. Before it creates the result directory, the script checks the input, project, saved plan, and output path, and refuses a local Pack in a project with `rootform.lock`. Each refusal exits `2` with a message that names the setting, such as `ROOTFORM_OUTPUT_DIR must be a fresh directory`. Analysis errors are recorded in `run.status` and `run.stderr`; gate errors are recorded in `check.status` and `check.stderr`.

For a network-disabled analysis job, [reproduce the selection offline](../../guides/reproduce-build.md) first. [Troubleshooting](../../troubleshooting/index.md#locked-project-selection-fails) covers missing locks and content.
