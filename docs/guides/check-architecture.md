---
title: "Run checks"
description: "Evaluate selected policies against a plan or state architecture."
---

Follow one Policy through a pass, a violation, indeterminate evidence, and no target. You need Rootform, Terraform or OpenTofu, and the AWS provider download for planning. Work from a new `network-review/` directory. The `pass/`, `violation/`, and `no-target/` directories hold separate scenarios; `policies/` holds one local Policy Pack.

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

Run from `network-review/`. Pairing the saved plan lets Rootform follow direct `vpc_id` and `subnet_id` traversals even though their values are unknown until apply. `--policy-pack` selects this Pack for this invocation; selecting a Dialect alone would not select it.

<!-- docs-check:check-architecture-pass -->
```sh
rootform run pass/plan.json --plan-file pass/plan.tfplan \
  --policy-pack ./policies --no-serve \
  -o pass/analysis.json -o pass/results.sarif --color always
```

<!-- docs-output:check-architecture-pass -->
```ansi title="Passing result, excerpt"
[2mPolicies[0m      passed

[1m[38;5;208mPolicies · planned[0m
  [2mResult[0m     passed
  [2mEvaluated[0m  1 policy over 2 targets: 2 passed, 0 violated, 0 indeterminate
```

Status `0` here means both selected targets passed. The VPC itself is not a target. `pass/analysis.json` is a Rootform document preserving the interpreted architecture; `pass/results.sarif` records explicit evaluations and diagnostics for review tools. The files do not contain sensitive plan values. If either Context stays indeterminate, confirm that `--plan-file` names the saved plan used for the JSON export.

## Inspect the proof

Ask why the instance has a network Context. The saved document avoids recompiling the plan:

<!-- docs-check:check-architecture-explain-architecture -->
```sh
rootform explain architecture aws_instance.application \
  --input pass/analysis.json --color always
```

<!-- docs-output:check-architecture-explain-architecture -->
```ansi title="Instance evidence, excerpt"
[1maws_instance.application  [2mat the planned stage[0m[0m
[2mInstance[0m        managed instance of aws_instance; planned (create)
[2mProvider[0m        registry.terraform.io/hashicorp/aws
[2mInterpretation[0m  applied aws.rule.instance as compute-instance

[1m[38;5;208mFacts[0m
  → context network  aws_subnet.application  [2mevidence: traversal[0m

[1m[38;5;208mClosures[0m
  [32m•[0m context network → subnet  via source.subnet_id, match exact by id  [2mresolved, 1 fact[0m
```

The `traversal` label identifies saved-plan evidence, not a network probe. Explain the Policy against the same saved stage:

<!-- docs-check:check-architecture-explain-policy -->
```sh
rootform explain policy tutorial.policy.network-context \
  --policy-pack ./policies --input pass/analysis.json --color always
```

<!-- docs-output:check-architecture-explain-policy -->
```ansi title="Policy explanation, excerpt"
[1m[32mtutorial.policy.network-context: passed[0m
[2mStage[0m     planned
[2mTargets[0m   2: 2 passed, 0 violated, 0 indeterminate
[2mCoverage[0m  complete
[2mTarget[0m    aws.rule.instance, aws.rule.subnet
```

The explanation shows both target evaluations. [Explain a Policy](../reference/cli/explain/policy.md) defines its accepted inputs and flags.

## Distinguish a violation

Run the same Policy on the explicit empty VPC ID:

<!-- docs-check:check-architecture-violation -->
```sh
rootform run violation/plan.json --plan-file violation/plan.tfplan \
  --policy-pack ./policies --no-serve --color always
```

<!-- docs-output:check-architecture-violation -->
```ansi title="Violation, excerpt"
[1m[38;5;208mArchitecture · planned[0m
  [2mClosures[0m     1: 0 resolved, 1 absent, 0 indeterminate

[1m[38;5;208mPolicies · planned[0m
  [2mResult[0m     violated
  [2mEvaluated[0m  1 policy over 1 target: 0 passed, 1 violated, 0 indeterminate
  [31m✗[0m aws_subnet.application  [2mtutorial/network-context: Network resources must have an established network context.[0m
```

The closure is `absent`: a known empty value proves that this subnet has no declared target for the Rule's network emission. The Policy therefore violates and returns status `1`. This says nothing about a deployed subnet; the scenario is an unapplied plan.

## Keep unresolved evidence indeterminate

Run the passing plan again, this time without its saved plan:

<!-- docs-check:check-architecture-indeterminate -->
```sh
rootform run pass/plan.json --policy-pack ./policies --no-serve --color always
```

<!-- docs-output:check-architecture-indeterminate -->
```ansi title="Indeterminate result, excerpt"
[1m[38;5;208mArchitecture · planned[0m
  [2mClosures[0m     2: 0 resolved, 0 absent, 2 indeterminate

[1m[38;5;208mUncertainty · planned[0m
  [2mClosures[0m  2 unknown until apply

[1m[38;5;208mPolicies · planned[0m
  [2mResult[0m     indeterminate
  [2mEvaluated[0m  1 policy over 2 targets: 0 passed, 0 violated, 2 indeterminate
```

The plan values for the new VPC and subnet IDs are unknown until apply. Without verified traversals, Rootform cannot prove either connection or its absence. Status `3` prevents an uncertain result from becoming approval. The saved plan is optional for analysis, but matters to this Policy verdict.

## Separate no target from no selection

The same selected Policy finds no subnet or instance in the VPC-only plan:

<!-- docs-check:check-architecture-no-target -->
```sh
rootform run no-target/plan.json --plan-file no-target/plan.tfplan \
  --policy-pack ./policies --no-serve --color always
```

<!-- docs-output:check-architecture-no-target -->
```ansi title="No target, excerpt"
[1m[38;5;208mPolicies · planned[0m
  [2mResult[0m     no decision
  [2mEvaluated[0m  1 policy over 0 targets: 0 passed, 0 violated, 0 indeterminate
  [2mNo target[0m  1 policy found nothing to evaluate
```

Status `3` means the selected Policy made no decision. Without any Policy selection, a successful `run` exits `0` and explicitly says none was evaluated; that status is analysis success, not compliance. [Policies and Policy Packs](../concepts/policies.md#read-the-aggregate-decision) explains aggregation.

## Use the same gate in CI

The local Pack is an invocation override. To record it as project selection, run these commands from `network-review/`:

<!-- docs-check:check-architecture-lock -->
```sh
rootform add policy-packs ./policies
rootform run pass/plan.json --plan-file pass/plan.tfplan \
  --locked --policy 'tutorial/*' --no-serve -o pass/locked.sarif
```

The first command updates `rootform.lock`; the second evaluates the selected Policy from that lock and returns status `0` for this passing plan. Commit the lock with the project once reviewed. `--locked` refuses `--policy-pack` as a usage error, so CI cannot silently override the recorded selection. [CI integration](../integrations/ci/README.md) shows the gate and artifact handling; [Outputs and exit status](../reference/outputs.md) is the status reference.

<!-- rootform:endsteps -->

Continue with [Review a pull request](../workflows/index.md) to apply these Policies to the head of a pull request, or with [GitHub Actions](../integrations/github-actions.md) to run the same gate in a workflow.
