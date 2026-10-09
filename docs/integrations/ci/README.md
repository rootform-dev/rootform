---
title: "Other CI/CD"
description: "Review architecture and Policy results in GitLab, Azure Pipelines or a custom runner, and retain the Form for reuse."
---

Bring architecture review to GitLab, Azure Pipelines or another runner.
Rootform saves a Form and Markdown report from completed plan or state
evidence; reviewers can also open its Explorer HTML. Add an explicit Policy
gate when the job must check architectural requirements. Analysis alone makes
no compliance claim.

On GitHub, start with the [GitHub integration](../github-actions.md): its
Action handles Job Summary, artifacts and optional PR comments.

## Add Rootform to your pipeline

Install an exact [Rootform release](../../installation.md), then copy the
[portable script](rootform-ci.sh) into your repository as `ci/rootform-ci.sh`.
The [GitLab](gitlab-ci.yml), [Azure Pipelines](azure-pipelines.yml), and
[generic](generic-ci.sh) recipes call that script after producing their input.
It accepts a completed plan or state JSON and writes one set of results to a
fresh directory. It does not run Terraform or OpenTofu, install packages, or
choose project content.

Use a single job when Terraform or OpenTofu and Rootform can share a protected workspace. A separate analysis job must receive the exact saved plan and JSON through a protected transfer; both can contain cleartext secrets. Keep those files out of Git, public artifacts, job summaries, and pull request comments. Rootform outputs omit sensitive values but describe topology and names, so retain them as internal review evidence.

<!-- rootform:steps -->

## Review a completed plan

From the Terraform root `./infra`, export the saved plan in a private runner directory that the job never uploads. OpenTofu users replace `terraform` with `tofu` in these commands:

```sh
(
  set -eu
  umask 077
  cd infra
  terraform init -input=false
  mkdir ../build
  terraform plan -input=false -out=../build/plan.tfplan
  terraform show -json ../build/plan.tfplan > ../build/plan.json
)
```

Use a private checkout, keep `build/` out of Git and artifact uploads, and remove these two files after retaining the Rootform results. [Use the runner recipes](#use-the-runner-recipes) provides runner-specific cleanup. Rootform never uses provider or backend credentials. Keep them in this plan step and give the analysis step access only to the two completed files. [Terraform and OpenTofu plans](../../inputs/plans.md) explains why the saved plan must match its export. To compare base and head revisions of a pull request instead, follow [Review a pull request](../../workflows/index.md#choose-the-review-input).

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

Run `rootform add` during project configuration and commit the reviewed lock. Never run `add` in CI: a job verifies the committed selection instead of choosing one. The required-check mode needs a lock or an explicit trusted local Policy Pack. It always runs `check` after successful analysis. An absent lock, empty selection, missing Pack or Policy without targets cannot become an approved analysis. Both commands preserve locked selection when a lock was present at the start. [Select Dialects and Policy Packs](../../cli.md) explains the difference between selection and preparation.

## Run the portable recipe

Run from the repository root. `ROOTFORM_PROJECT` names the Rootform project whose selection applies; it need not be the Terraform root. Name a fresh output directory for each job attempt:

<!-- docs-check:ci-run -->
```sh
ROOTFORM_MODE=analyze \
ROOTFORM_PROJECT=./infra \
ROOTFORM_INPUT=./build/plan.json \
ROOTFORM_PLAN_FILE=./build/plan.tfplan \
ROOTFORM_OUTPUT_DIR=.rootform-ci-123 \
sh ./ci/rootform-ci.sh
```

The script prints nothing itself. Open `summary.txt` and confirm that the saved plan paired with the export, a check of version, timestamp, and configuration shape only, and that the summary reports the Planned stage:

<!-- docs-output:ci-run -->
```text title="Excerpt from summary.txt"
Plan analyzed

Enrichment         Saved plan paired with this plan JSON (1 module)
Stage              Planned
Stages             Recorded (reconstructed from Refreshed; no drift entry to
                   reverse), Refreshed, Planned
```

The analysis phase runs `rootform run` with `--plan-file --require-enrichment --no-serve` when a saved plan is supplied. It writes `analysis.json` and `report.md`, with standard output in `summary.txt`, standard error in `run.stderr`, and the exact status in `run.status`. A failed analysis exits immediately without running a gate. With state JSON, omit `ROOTFORM_PLAN_FILE`: the result has one `recorded` stage.

| File in `ROOTFORM_OUTPUT_DIR` | Use |
| --- | --- |
| `analysis.json` | Form with stages, facts, closures, drift, and selection details. It stores no Policy results. |
| `report.md` | Human review of the analyzed Form. |
| `summary.txt` | Standard output from analysis. |
| `run.stderr` | Analysis progress and failure diagnostics. |
| `run.status` | Recipe-recorded analysis exit status, recorded even when the job fails. |
| `policy.json` | Structured Policy result when the gate runs. |
| `policy.md` | Policy report when the gate runs. |
| `results.sarif` | SARIF 2.1.0 Policy result when the gate runs. |
| `check.txt` | Standard output from the Policy gate. |
| `check.stderr` | Gate progress and failure diagnostics. |
| `check.status` | Recipe-recorded gate exit status, recorded even when the job fails. |

The script refuses an existing or symbolic-link output path before running. Do not reuse a prior result directory: a fresh path keeps stale files out of a failed run. A write failure may leave files already written; use `run.status` and `run.stderr` to distinguish partial results from a complete report. [Script settings](#script-settings) lists every variable, and [Outputs and exit status](../../reference/outputs.md) defines each format.

## Request a policy gate

Analysis alone can exit `0` but makes no compliance claim. The default `ROOTFORM_MODE=check` always runs `rootform check` after successful analysis and requires a Policy decision. Choose `analyze` only in a trusted workflow that intentionally requests architecture review without a gate. Keep this setting and the script under protected review, outside changes supplied by an untrusted pull request. For a project without `rootform.lock`, pass a reviewed local Policy Pack to the gate:

<!-- docs-check:ci-pack-override -->
```sh
ROOTFORM_MODE=check \
ROOTFORM_POLICY_PACK=./policies \
ROOTFORM_PROJECT=./infra \
ROOTFORM_INPUT=./build/plan.json \
ROOTFORM_PLAN_FILE=./build/plan.tfplan \
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

```

The script refuses `ROOTFORM_POLICY_PACK` when the project has a lock. For a locked project, add the Policy Pack during project configuration, commit the lock, then use `ROOTFORM_POLICY` to select named Policies or patterns. The script accepts space-separated selectors and repeats `--policy` for each; quote the environment value so the shell does not expand `*`:

<!-- docs-check:ci-locked-policy -->
```sh
ROOTFORM_MODE=check \
ROOTFORM_POLICY='baseline/*' \
ROOTFORM_PROJECT=./infra \
ROOTFORM_INPUT=./build/plan.json \
ROOTFORM_PLAN_FILE=./build/plan.tfplan \
ROOTFORM_OUTPUT_DIR=.rootform-ci-policy-123 \
sh ./ci/rootform-ci.sh
```

The script exits with the analysis status if analysis fails. Otherwise `check` mode returns the check status, and explicit `analyze` mode returns `0`. Check status `0` means every selected Policy passed, `1` means a violation, `2` means incorrect use, `3` means no verdict, and `4` means a report could not be written after the verdict. If `ROOTFORM_BIN` cannot be found, the failing phase records `127` and its stderr file holds the shell error. Read `check.txt` and `policy.md`: a selected Policy with zero targets is not approval. [Understand Policy outcomes](../../guides/check-architecture.md) explains the policy path.

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

After your runner has retained the results, remove the private files created
above. The fresh `build/` directory must hold only these inputs:

```sh
rm -- build/plan.tfplan build/plan.json
rmdir build
```

## Use the runner recipes

The portable recipes export the plan, run the script, and keep the named
results when the gate fails. Adapt the Terraform root, Policy variables, and
installation steps to your project.

The [GitHub recipe](github-actions-plan.yml) uses the integrated Rootform
Action instead of the script. It keeps plan files in `$RUNNER_TEMP` and lets
the Action publish the Form and reports, including before a Policy failure.
The [GitHub integration](../github-actions.md) covers summaries, comments and
fork trust.

The [generic script](generic-ci.sh) installs the exact `ROOTFORM_VERSION` into a temporary directory using the checksum-verifying installer, verifies the executable version, and prepares the committed lock with `init --locked --no-input`. Set `ROOTFORM_BIN` only when the runner already has a checksum-verified executable of that exact version. The wrapper cleans only its own temporary tools and Rootform home, preserves the gate status, and leaves results for the runner to upload. Local selected source must be present at its recorded relative path; OCI selections need registry access during preparation, or an already prepared home for offline use.

The [GitLab recipe](gitlab-ci.yml) and [Azure Pipelines recipe](azure-pipelines.yml) call this wrapper on a fresh runner. Both require Terraform or OpenTofu, Git, curl, tar and a SHA-256 tool. Install the producer with your organization's reviewed setup before these steps; Rootform never installs or runs it. GitLab retains only this job's named Rootform outputs, including after failure, and limits artifact access to project developers. `expire_in: 7 days` controls expiry; GitLab may keep the latest pipeline on each ref longer under its retention policy. See [GitLab artifact retention](https://docs.gitlab.com/ci/jobs/job_artifacts/#with-an-expiry). Azure publishes the fresh result directory with `succeededOrFailed()`; set the pipeline's retention to seven days in its [retention settings](https://learn.microsoft.com/en-us/azure/devops/pipelines/policies/retention?view=azure-devops). Each recipe removes its own private plan directory after analysis, while keeping the result directory until artifact collection.

Keep the workflow, these scripts, `ROOTFORM_MODE=check`, and the selected Dialect and Policy sources on a protected revision. A candidate branch supplies evidence, not permission to alter or remove the gate. For untrusted merge requests, use a separate checkout of that protected revision for `ROOTFORM_PROJECT` and scripts, and transfer completed evidence through a private channel. Authenticate external-content registries during `init` through `DOCKER_CONFIG`; never store tokens in a lock, report, or command argument. See [data handling](../../security/index.md) for output disclosure and [offline preparation](../../guides/reproduce-build.md) for acquisition without network access.

<!-- rootform:endsteps -->

## Script settings

The portable script reads these settings from the environment. The installation wrapper also accepts `ROOTFORM_VERSION` (default `0.2.0`) and `ROOTFORM_HOME` for a prepared home; these are wrapper settings, not CLI flags.

| Variable | Default | Use |
| --- | --- | --- |
| `ROOTFORM_MODE` | `check` | Required Policy decision; `analyze` explicitly requests architecture review only. Set in the trusted workflow. |
| `ROOTFORM_INPUT` | Required | Plan JSON or state JSON to analyze. |
| `ROOTFORM_PLAN_FILE` | Unset | Saved plan behind that plan JSON. Adds `--plan-file` and `--require-enrichment`; omit it for state JSON. |
| `ROOTFORM_PROJECT` | `./infra` | Directory whose Rootform selection applies. Adds `--locked` when it contains `rootform.lock`. |
| `ROOTFORM_OUTPUT_DIR` | `.rootform-ci` | Result directory. It must not exist yet. |
| `ROOTFORM_POLICY_PACK` | Unset | Local Policy Pack for the gate only. Refused when the project has `rootform.lock`. |
| `ROOTFORM_POLICY` | Unset | Space-separated Policy names or patterns, each passed to `check` as `--policy`. |
| `ROOTFORM_BIN` | `rootform` | Rootform command to call. |

Relative paths resolve from the directory where you run the script. The script never changes directory, so quoted paths containing spaces are safe. Before it creates the result directory, the script checks the input, project, saved plan, and output path, and refuses a local Pack in a project with `rootform.lock`. Each refusal exits `2` with a message that names the setting, such as `ROOTFORM_OUTPUT_DIR must be a fresh directory`. Analysis errors are recorded in `run.status` and `run.stderr`; gate errors are recorded in `check.status` and `check.stderr`.

For a network-disabled analysis job, [reproduce the selection offline](../../guides/reproduce-build.md) first. [Troubleshooting](../../troubleshooting/index.md#locked-project-selection-fails) covers missing locks and content.
