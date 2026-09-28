---
title: "Check an architecture"
description: "Evaluate selected Policies against a plan or state Form."
---

Follow one Policy through a pass, a violation, indeterminate evidence, and no target. `rootform run` analyzes an input and saves its Form; `rootform check` evaluates Policies against the Form's selected architecture and exits with the verdict. You need Rootform, Terraform or OpenTofu, and the AWS provider download for planning. Work from a new `network-review/` directory. The `pass/`, `violation/`, and `no-target/` directories hold separate scenarios; `policies/` holds one local Policy Pack.

Plans, their JSON exports, and state files can contain secrets in clear text. Keep them out of Git and public artifacts. Rootform reads them locally and does not contact AWS. Its reports omit sensitive values but still describe topology and names.

<!-- rootform:steps -->

## Write one Policy Pack

Create the Pack manifest and one Policy under `policies/`:

```rf title="policies/pack.rf.hcl"
policy_pack "tutorial" {
  version = "0.1.0"
}
```

```rf title="policies/network-context.rf.hcl"
policy "network-context" {
  target {
    rules = [aws.rule.subnet, aws.rule.instance]
  }

  assert  = exists(contexts(rf.context.network))
  message = "Network resources must have an established network context."
}
```

The target selects instances interpreted by either named AWS Rule. The assertion asks whether each selected instance has a proven network Context. A source reference alone cannot satisfy it. [Write a Policy Pack](../language/write-policy-pack.md) covers the syntax beyond this example.

## Prepare the three plans

Use the same AWS provider configuration in each scenario. As in [Your first architecture](../getting-started/first-architecture.md), placeholder credentials grant no account access and skipped validation lets these examples plan without an AWS account. Never copy these placeholder settings into a real project. In each directory, save this provider block as `provider.tf`:

```hcl title="provider.tf"
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "= 6.62.0"
    }
  }
}

provider "aws" {
  region                      = "us-east-1"
  access_key                  = "example"
  secret_key                  = "example"
  max_retries                 = 1
  skip_credentials_validation = true
  skip_metadata_api_check     = true
  skip_region_validation      = true
  skip_requesting_account_id  = true
}
```

For the passing case, save these three connected resources:

```hcl title="pass/main.tf"
resource "aws_vpc" "main" {
  cidr_block = "10.20.0.0/16"
}

resource "aws_subnet" "application" {
  vpc_id     = aws_vpc.main.id
  cidr_block = "10.20.1.0/24"
}

resource "aws_instance" "application" {
  ami           = "ami-0123456789abcdef0"
  instance_type = "t3.micro"
  subnet_id     = aws_subnet.application.id
}
```

The violation has a subnet with an explicitly empty VPC ID. Terraform can export this plan, but the declaration cannot establish the required network Context. Do not apply this synthetic plan:

```hcl title="violation/main.tf"
resource "aws_subnet" "application" {
  vpc_id     = ""
  cidr_block = "10.20.1.0/24"
}
```

The no-target case has only a VPC, so neither Policy target Rule applies:

```hcl title="no-target/main.tf"
resource "aws_vpc" "main" {
  cidr_block = "10.20.0.0/16"
}
```

Initialize and save a plan in each scenario, then export JSON from that exact saved plan. OpenTofu users replace `terraform` with `tofu` in these commands:

```sh
for scenario in pass violation no-target; do
  (cd "$scenario" && terraform init -input=false && \
    terraform plan -out=plan.tfplan && \
    terraform show -json plan.tfplan > plan.json)
done
```

Each directory now contains matching `plan.tfplan` and `plan.json`. If Terraform or OpenTofu rejects a scenario before writing the saved plan, inspect its diagnostic; Rootform cannot analyze a plan that was never exported. [Plan inputs](../inputs/plans.md) explains the input boundary.

## Observe a pass

Run from `network-review/`. First analyze the plan and save its Form. Pairing the saved plan lets Rootform follow direct `vpc_id` and `subnet_id` traversals even though their values are unknown until apply. Then check the saved Form: `check` reads it without compiling the plan again. `--policy-pack` selects this Pack for this command only; selecting a Dialect alone would not select it.

<!-- docs-check:check-architecture-pass -->
```sh
rootform run pass/plan.json --plan-file pass/plan.tfplan \
  --no-serve -o pass/analysis.json
rootform check pass/analysis.json --policy-pack ./policies \
  -o pass/results.json -o pass/results.sarif --color always
```

<!-- docs-output:check-architecture-pass -->
```ansi title="Passing check, excerpt"
[1mPolicy check completed[0m

[2mInput[0m          pass/analysis.json
[2mOrigin[0m         Plan (saved Form)
[2mStage[0m          Planned
[2mPolicies[0m       1 selected

[2mEvaluations[0m    2
[2mPassed[0m         2
[2mViolated[0m       0
[2mIndeterminate[0m  0

[2mVerdict[0m        [1m[32mPASSED[0m

All selected evaluations passed.
```

Status `0` means every selected Policy was evaluated and passed, here on both targets. The VPC itself is not a target. `pass/analysis.json` is the Form preserving the interpreted architecture. `pass/results.json` is the Policy result: it identifies that Form by digest and records the evaluated stage, the selected Policies, and every evaluation. `pass/results.sarif` presents the same result to review tools. None of these files contains sensitive plan values. If either target stays indeterminate, confirm that `--plan-file` names the saved plan used for the JSON export.

## Inspect the proof

Ask why the instance has a network Context. The saved Form avoids recompiling the plan:

<!-- docs-check:check-architecture-explain-architecture -->
```sh
rootform explain instance aws_instance.application \
  --input pass/analysis.json --color always
```

<!-- docs-output:check-architecture-explain-architecture -->
```ansi title="Instance evidence, excerpt"
[1mInstance explained[0m

[2mInput[0m  pass/analysis.json
[2mStage[0m  Planned

[1m[38;5;208maws_instance.application[0m
  [2mInstance[0m        managed instance of aws_instance; planned (create)
  [2mProvider[0m        registry.terraform.io/hashicorp/aws
  [2mInterpretation[0m  applied aws.rule.instance as compute-instance
  [2mConclusion[0m      Interpreted as compute-instance by aws.rule.instance: network
                  context to aws_subnet.application.

  [1mFacts[0m
    -> context network  aws_subnet.application  [2mevidence: traversal[0m

  [1mClosures[0m
    context network -> subnet
      via source.subnet_id, match exact by id
      [32mresolved, 1 fact[0m
```

The `traversal` label identifies saved-plan evidence, not a network probe. Explain the Policy outcome that `check` recorded in `pass/results.json`:

<!-- docs-check:check-architecture-explain-policy -->
```sh
rootform explain policy tutorial.policy.network-context \
  --result pass/results.json --input pass/analysis.json --color always
```

<!-- docs-output:check-architecture-explain-policy -->
```ansi title="Policy explanation, excerpt"
[1mPolicy explained[0m

[2mPolicy[0m         tutorial.policy.network-context
[2mResult[0m         pass/results.json
[2mInput[0m          pass/analysis.json
[2mOrigin[0m         Plan (saved Form)
[2mStage[0m          Planned

[2mEvaluations[0m    2
[2mPassed[0m         2
[2mViolated[0m       0
[2mIndeterminate[0m  0
[2mCoverage[0m       Complete

[2mOutcome[0m        [1m[32mPASSED[0m

[1m[38;5;208mRequirement[0m
  Network resources must have an established network context.

  [2mAssertion[0m  exists(contexts(rf.context.network))
  [2mTarget[0m     Rules aws.rule.instance, aws.rule.subnet

All 2 evaluations passed.
```

`explain policy` reads the saved result and evaluates nothing again. The Requirement block quotes the Policy message and the assertion and target the result records. The optional `--input` must be the Form that result was computed from; Rootform refuses any other Form. Add `--details` to list each evaluation with its recorded evidence and conclusion; the evidence itself is described only when `--input` supplies that Form. [Explain a Policy](../reference/cli/explain/policy.md) defines its accepted inputs and options.

## Distinguish a violation

Check the same Policy against the explicit empty VPC ID. `check` also accepts a plan JSON directly and compiles it first:

<!-- docs-check:check-architecture-violation -->
```sh
rootform check violation/plan.json --plan-file violation/plan.tfplan \
  --policy-pack ./policies --color always
```

<!-- docs-output:check-architecture-violation -->
```ansi title="Violation, excerpt"
[1mPolicy check completed[0m

[2mInput[0m          violation/plan.json
[2mOrigin[0m         Plan
[2mStage[0m          Planned
[2mPolicies[0m       1 selected

[2mEvaluations[0m    1
[2mPassed[0m         0
[2mViolated[0m       1
[2mIndeterminate[0m  0

[2mVerdict[0m        [1m[31mVIOLATED[0m

[1m[31mVIOLATED[0m
  [2mPolicy[0m       tutorial.policy.network-context
  [2mResource[0m     aws_subnet.application
  [2mRequirement[0m  Network resources must have an established network context.
  [2mEvidence[0m     context network -> virtual-network via source.vpc_id: absent
```

`Requirement` quotes what the Policy declares; `Evidence` is the recorded observation that decided the verdict. A known empty value proves that this subnet has no declared target for the Rule's network emission, so its network closure through `source.vpc_id` is absent and the Policy is violated: `check` returns status `1`. Reports requested with `-o` are written whatever the verdict. This says nothing about a deployed subnet; the scenario is an unapplied plan.

## Keep unresolved evidence indeterminate

Check the passing plan again, this time without its saved plan:

<!-- docs-check:check-architecture-indeterminate -->
```sh
rootform check pass/plan.json --policy-pack ./policies --color always
```

<!-- docs-output:check-architecture-indeterminate -->
```ansi title="Indeterminate result, excerpt"
[1mPolicy check completed[0m

[2mInput[0m          pass/plan.json
[2mOrigin[0m         Plan
[2mStage[0m          Planned
[2mPolicies[0m       1 selected

[2mEvaluations[0m    2
[2mPassed[0m         0
[2mViolated[0m       0
[2mIndeterminate[0m  2

[2mVerdict[0m        [1m[33mINDETERMINATE[0m

[1m[33mINDETERMINATE[0m
  [2mPolicy[0m       tutorial.policy.network-context
  [2mResource[0m     aws_instance.application
  [2mRequirement[0m  Network resources must have an established network context.
  [2mEvidence[0m     context network -> subnet via source.subnet_id:
                 indeterminate (unknown until apply)

  [2mPolicy[0m       tutorial.policy.network-context
  [2mResource[0m     aws_subnet.application
  [2mRequirement[0m  Network resources must have an established network context.
  [2mEvidence[0m     context network -> virtual-network via source.vpc_id:
                 indeterminate (unknown until apply)
```

The plan values for the new VPC and subnet IDs are unknown until apply. Without verified traversals, Rootform cannot prove either connection or its absence. Status `3` prevents an uncertain result from becoming approval. The saved plan is optional for analysis, but matters to this Policy verdict.

## Separate no target from no selection

The same selected Policy finds no subnet or instance in the VPC-only plan:

<!-- docs-check:check-architecture-no-target -->
```sh
rootform check no-target/plan.json --plan-file no-target/plan.tfplan \
  --policy-pack ./policies --color always
```

<!-- docs-output:check-architecture-no-target -->
```ansi title="No target, excerpt"
[1mPolicy check completed[0m

[2mInput[0m          no-target/plan.json
[2mOrigin[0m         Plan
[2mStage[0m          Planned
[2mPolicies[0m       1 selected

[2mEvaluations[0m    0
[2mPassed[0m         0
[2mViolated[0m       0
[2mIndeterminate[0m  0

[2mVerdict[0m        [1mNO DECISION[0m

[1mWITHOUT TARGET[0m
  [2mPolicy[0m  tutorial.policy.network-context
  [2mTarget[0m  Rules aws.rule.instance, aws.rule.subnet
```

Status `3` means the selected Policy made no decision: a Policy without target never counts as passed, and a check that selects no Policy also returns `3`. `rootform run` never evaluates Policies, so its status `0` is analysis success, not compliance. [Policies and Policy Packs](../concepts/policies.md#read-the-aggregate-decision) explains aggregation.

## Write a review document

A pull request or CI job summary reads Markdown. This script saves the violating plan's Form with its architecture review, writes the Policy review from that Form, joins both reviews, and ends with the status of `check`:

<!-- docs-check:check-architecture-review -->
```sh
rootform run violation/plan.json --plan-file violation/plan.tfplan \
  --no-serve -o violation/analysis.json -o violation/architecture.md || exit
check_status=0
rootform check violation/analysis.json --policy-pack ./policies \
  -o violation/policies.md || check_status=$?
case $check_status in
  0 | 1 | 3) ;;
  *) exit "$check_status" ;;
esac
{ cat violation/architecture.md && printf '\n' && cat violation/policies.md; } \
  > violation/review.md || exit 4
exit "$check_status"
```

Save it as a script, for example `review.sh` run with `sh review.sh`, or use it as a CI step: each `exit` ends the shell that runs it, so do not paste it into an interactive terminal. It behaves the same with or without `set -e`.

- If `run` fails, the script stops with the status of `run` and joins nothing.
- `check` writes its report whatever the verdict: `0` passed, `1` violated, `3` no verdict. The script keeps that status and returns it last.
- Status `2` (incorrect use) or `4` (a file could not be read or written) stops the script with that status before anything is joined.
- `printf '\n'` leaves a blank line between the two reports. If `violation/review.md` cannot be written, the script exits `4`, so a write failure never reads as a Policy verdict.

Here `check` returns `1`: the script writes `violation/review.md`, then exits `1`.

<!-- docs-output:check-architecture-review -->
```text title="violation/review.md"
## Rootform architecture

**1 resource instance added.**

Plan analyzed. Planned changes compare **Refreshed** with **Planned**.

| Category | Added | Removed |
| --- | ---: | ---: |
| Resource instances | 1 | 0 |

### Reported drift

No drift reported in this plan. The export does not establish the refresh scope.

### Net change

Same determined changes as Planned changes.

### Planned changes

**Resource instances: 1 added**

- `aws_subnet.application`

### Planned architecture

- **Resource instances:** 1
- **Interpreted:** 1 of 1 instance matched a Rule
- **Facts:** none determined

### Provenance

- **Input:** `violation/plan.json`
- **Producer:** Terraform or OpenTofu 1.16.4
- **Plan completeness:** Complete, as reported in the plan
- **Enrichment:** Saved plan paired with this plan JSON \(1 module\); only version, timestamp, and configuration shape are compared
- **Stage:** Planned
- **Stages:** Recorded \(reconstructed\), Refreshed, Planned

## Rootform Policies

**VIOLATED: Planned architecture**

1 Policy selected. 1 evaluation violated.

### `tutorial.policy.network-context`

**Requirement:** Network resources must have an established network context.

**Violated: 1 evaluation**

- `aws_subnet.application`: The network context toward virtual-network through `source.vpc_id` is absent.

### Provenance

- **Input:** `violation/analysis.json`
- **Origin:** Plan \(saved Form\)
```

The architecture review leads with its conclusion and counts; the Policy review leads with the verdict and the evaluated stage, then states each Policy's requirement once above its evaluations. Neither links to other files: keep `analysis.json`, and any Policy result or SARIF, as artifacts when reviewers need them. [Review with Markdown](../reference/outputs.md#review-with-markdown) explains how long reports are shortened and how `--details` lists every entry.

## Use the same gate in CI

The local Pack is an invocation override. To record it as project selection, run these commands from `network-review/`:

<!-- docs-check:check-architecture-lock -->
```sh
rootform add policy-packs ./policies
rootform check pass/analysis.json --locked --policy 'tutorial/*' \
  -o pass/locked.sarif
```

The first command updates `rootform.lock`; the second evaluates the selected Policy from that lock against the saved Form and returns status `0`. Commit the lock with the project once reviewed. `--locked` refuses `--policy-pack` as a usage error, so CI cannot silently override the recorded selection. Let the status of `check` decide the job: [CI integration](../integrations/ci/README.md) shows the gate and artifact handling, [rootform check](../reference/cli/check.md) is the command reference, and [Outputs and exit status](../reference/outputs.md) is the status reference.

<!-- rootform:endsteps -->

Continue with [Review a pull request](../workflows/index.md) to apply these Policies to the head of a pull request, or with [GitHub Actions](../integrations/github-actions.md) to run the same gate in a workflow.
