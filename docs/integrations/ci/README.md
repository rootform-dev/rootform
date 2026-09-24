---
title: "Run Rootform in CI"
description: "Build architecture evidence, request a policy gate, and prepare exact external selections in a runner."
---

Decide what the job must produce before choosing a gate. A build can preserve
architecture evidence without claiming Policy compliance. A check is a separate,
explicit decision.

Copy [the portable script](rootform-ci.sh) into your repository as
`ci/rootform-ci.sh`. The [GitHub](github-actions.yml),
[GitLab](gitlab-ci.yml), [Azure](azure-pipelines.yml), and
[generic runner](generic-ci.sh) recipes show how to invoke that copy. Install
an exact Rootform version first. Run the script from the repository root, with
the Terraform or OpenTofu root module at `./infra` in the examples below.

## Build and keep architecture evidence

For a project using embedded Dialects, no `rootform.lock` or `init` is needed:

<!-- docs-check:docs-integrations-ci-readme-1 -->
```sh
ROOTFORM_PROJECT=./infra sh ./ci/rootform-ci.sh
```

The script writes `.rootform-ci/architecture.json` and
`.rootform-ci/build.stderr` relative to the repository root. A successful
build exits `0`. Invalid source, missing referenced modules, or unavailable
selected content stops the job with the build's own status and diagnostic.
Prepare Terraform or OpenTofu modules separately when the source needs them.
Rootform does not run `terraform init` for you.

If `infra/rootform.lock` exists, the same command first runs
`rootform init ./infra --locked --no-input` to prepare its exact external
selection, then builds with `--locked`. It writes `init.json` and
`init.stderr` as well. A lock selecting only Dialects changes architecture
meaning, not the decision to check Policies. The script neither creates nor
rewrites the lock. See [Project configuration](../../cli.md) for the active
set and [reproduce a build](../../guides/reproduce-build.md) for
preparing content on another runner.

## Request a Policy gate

Set `ROOTFORM_CHECK=1` when governance is part of the job. A project lock may
select Policy Packs, or you can choose one local pack for this invocation:

<!-- docs-check:docs-integrations-ci-readme-2 -->
```sh
ROOTFORM_PROJECT=./infra ROOTFORM_CHECK=1 sh ./ci/rootform-ci.sh
```

<!-- docs-check:docs-integrations-ci-readme-3 -->
```sh
ROOTFORM_PROJECT=./infra ROOTFORM_CHECK=1 \
  ROOTFORM_POLICY_PACK=./policies sh ./ci/rootform-ci.sh
```

The second command also works without a lock. `./policies` is relative to the
repository root, not to `./infra`. An explicit pack overlays a selected pack of
the same name for this check; other selected packs remain active. Overrides
cannot be combined with `--locked`, so this script omits `--locked` on an
override check while the lock still controls preparation and build. A lock still
controls the build and preparation of selected Dialects. Follow [Run
checks](../../guides/check-architecture.md) to create a pack with Policies and
effective targets. A check requested with no selected Policy or no evaluated
target returns `3`, not approval.

After a successful build, the script writes `check.json`, `check.stderr`, and
`check.status` under `.rootform-ci/`. The final file contains the exact check
exit code, which is also the script exit code. `0` means all selected Policies
were evaluated and compliant, `1` means a confirmed violation, `2` means
invalid command use, and `3` means indeterminate or not evaluated. Read
coverage and diagnostics in JSON before calling a result compliant. Preserve
these files even when the job fails. Preparation or build failure is not a
Policy result and does not produce `check.status`. See
[Outputs and exit status](../../reference/outputs.md) for the full distinction.

## Prepare external selections deliberately

Run `rootform add` during project configuration and commit the reviewed
`rootform.lock`. Never run `add` in CI: a job should verify the committed
selection, not choose one. With a lock, the script runs `init --locked
--no-input` before `build --locked` and, for a project-selected Policy gate,
`check --locked`. That operation verifies local entries and may fetch only the
exact OCI content pinned by the lock. Set `ROOTFORM_OFFLINE=1` when required
content is already installed or vendored and acquisition must be disabled:

<!-- docs-check:docs-integrations-ci-readme-4 -->
```sh
ROOTFORM_PROJECT=./infra ROOTFORM_OFFLINE=1 sh ./ci/rootform-ci.sh
```

The lock alone does not request a Policy gate. Add `ROOTFORM_CHECK=1` only if
that is the job's purpose. A local `ROOTFORM_POLICY_PACK` needs no lock or
acquisition. Private OCI sources use the runner's `DOCKER_CONFIG`, never
credentials in a lock or command line. `offline` governs Rootform acquisition,
not checkout, binary installation, hosted cache, or artifact upload.

Relative paths resolve from the script's invocation directory, while absolute
paths retain their meaning:
`ROOTFORM_PROJECT` defaults to `.`, `ROOTFORM_OUTPUT_DIR` defaults to
`.rootform-ci`, and `ROOTFORM_POLICY_PACK` is optional. `ROOTFORM_BIN` defaults
to `rootform` on `PATH`. `ROOTFORM_CHECK` defaults to `0` and accepts only `0`
or `1`. Supplying a pack without requesting a check is an error. The script
never changes directory, so paths containing spaces are safe when quoted.
Before each invocation, the script clears only its named result files in the
chosen output directory, including when the requested check configuration is
invalid. Files from an earlier run cannot become this run's reports. Other
files stay untouched. The script rejects a symbolic-link destination, traversal
through writable symbolic links, or a directory containing the working
directory or project. The CI recipes also use a job-specific result directory
and collect named files only.

An Architecture Diff is usually review evidence, not a default PR blocker.
[Review a pull request](../../workflows/index.md#choose-the-revisions) shows
how to choose Before and After commits and
[choose a gate](../../workflows/index.md#compare-and-save-review-artifacts)
without treating every architectural change as a violation.

## Use the runner recipes

Each recipe is build-only as written. To gate Policies, set
`ROOTFORM_CHECK=1` in the script's environment and supply a reviewed project
selection or `ROOTFORM_POLICY_PACK`. Keep the same artifact list: files not
produced by a build-only run can be absent.

The [GitHub recipe](github-actions.yml) uses `setup` and uploads named results
from its run-specific directory after failure without changing the job's
failed status. GitHub's [step conditions](https://docs.github.com/en/actions/reference/workflows-and-actions/expressions#always)
explain why the upload step can run after `check` fails.

The [GitLab recipe](gitlab-ci.yml) requires a shell runner with a verified
Rootform `0.1.0` binary on `PATH`. GitLab checks out the project into
`CI_PROJECT_DIR`; that directory must be writable by the runner user for
its job-specific result directory. `artifacts: when: always` retains listed
files after a Policy failure without changing the script's exit status. An image running as
Rootform's non-root UID `65532` cannot be assumed to write into GitLab's
checkout mount. Use a runner with compatible ownership rather than granting
world-write access. See GitLab's [artifact rules](https://docs.gitlab.com/ci/yaml/#artifactswhen)
and [Docker executor user behavior](https://docs.gitlab.com/runner/executors/docker/#specify-which-user-runs-the-job).

The [Azure recipe](azure-pipelines.yml) uses an Ubuntu agent with Docker and
invokes the exact Rootform image for one step. It mounts the checked-out
project at `/workspace`, runs with the agent's UID and GID so reports are
writable on the mount, and uses `/tmp/rootform-home` for Rootform content
during that invocation. After the command, the pipeline packages only named
results into a fresh archive, then publishes that archive even if a check
failed. Other files in the result directory are excluded. The image is Alpine
with a non-root user and lacks Bash, `glibc`, Node runtime, and privileges
required for an Azure [container job](https://learn.microsoft.com/en-us/azure/devops/pipelines/process/container-phases?view=azure-devops#requirements-for-container-jobs).
It is a CLI image, not an agent image. Ensure Docker is available on the agent
and the project mount is readable before using this recipe. The pipeline sets
`ROOTFORM_CHECK` to `0` and forwards it to the container. Change it to `1`
for a gate. `ROOTFORM_POLICY_PACK` and `ROOTFORM_OFFLINE` are forwarded when
set by the pipeline. Private OCI acquisition also needs a narrowly mounted
credential configuration, which this minimal recipe does not supply.

The [generic recipe](generic-ci.sh) assumes the runner has installed and
checksum-verified Rootform `0.1.0` and checked out the project. Run it from
the repository root. It inherits the script's `ROOTFORM_CHECK`, project, pack,
and output settings. Archive the named files in `ROOTFORM_OUTPUT_DIR` (default
`.rootform-ci`) even when the script exits `1` or `3`, while retaining that
exit code as the job status.
