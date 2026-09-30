---
title: Trace a placement
description: Plan a VPC and subnet, see how a saved plan settles a reference unknown until apply, and read the same evidence in the Explorer and the terminal.
---

A two-resource plan is enough to see what separates a Rootform fact from a
Terraform reference. This tutorial plans a VPC and a subnet, then follows the
subnet's placement from the plan evidence into the Explorer and
`rootform explain`, with and without the saved plan. Read it to understand
*unknown until apply*, saved-plan pairing, and the difference between a
resolved and an indeterminate closure. If you have not opened a Form yet, the
[quickstart](quickstart.md) comes first; if you only want your own plan open,
[Analyze your plan or state](analyze-your-plan.md) is the shorter path.

You need Rootform, Terraform, and the AWS provider download for planning. No
cloud account is involved: the placeholder provider credentials grant no
access, and the provider skips its account and metadata checks. Rootform's
embedded AWS [Dialect](../concepts/dialects.md) interprets these resources, so
there is nothing to configure. With OpenTofu, run `tofu` in place of
`terraform`.

<!-- rootform:steps -->

## Create input

Create an empty directory for the example:

<!-- docs-check:journey-first-directory -->
```sh
mkdir rootform-first-architecture
cd rootform-first-architecture
```

Save this complete configuration as `main.tf` in that directory:

```hcl title="main.tf"
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

resource "aws_vpc" "main" {
  cidr_block = "10.20.0.0/16"
}

resource "aws_subnet" "application" {
  vpc_id     = aws_vpc.main.id
  cidr_block = "10.20.1.0/24"
}
```

The subnet's `vpc_id` references an ID that will be known only after apply.
Rootform can still establish its placement when the saved plan pairs with the export.

## Produce the plan

Run these commands in the directory containing `main.tf`:

```sh
terraform init
terraform plan -out=plan.tfplan
terraform show -json plan.tfplan > plan.json
```

`terraform plan` creates the saved plan; `terraform show -json` exports that
same plan in the JSON shape Rootform accepts. `init` downloads the AWS
provider, which only the planning tool uses. Rootform reads the two exported
files; it never runs Terraform, OpenTofu, or the provider. Keep both plan
files out of Git: in real projects they can contain secrets in clear text.

## Open the architecture

<!-- docs-check:journey-first-serve -->
```sh
rootform run plan.json --plan-file plan.tfplan
```

If your browser does not open automatically, open the Explorer address shown
in the terminal. The command keeps running until you press `Ctrl+C`. The
summary includes this excerpt:

```ansi title="Run output excerpt"
[1mPlan analyzed[0m
[2mEnrichment[0m         Saved plan paired with this plan JSON (1 module)
[2mStage[0m              Planned
[2mStages[0m             Recorded (reconstructed), Refreshed, Planned
[1m[38;5;208mArchitecture[0m
  [2mInstances[0m    2
  [2mInterpreted[0m  2
  [2mContexts[0m     1
```

**Enrichment** means the saved plan paired with this JSON export: their
version, timestamp, and configuration shape agree, so Rootform can read the
configuration reference behind the placement. Pairing enables that
enrichment; it does not prove that both files came from one planning
operation.

**Instances** counts the resource instances in the plan: the VPC and the
subnet. **Interpreted** counts the instances a Rule matched, here both; a
matched Rule does not by itself settle every fact. The context count shows
one placement fact. Inspect the subnet below to see its endpoint and the
closure that justified it.

## Inspect the subnet

The first scene contains the `aws_vpc.main` card. Use **Open aws_vpc.main**,
then select `aws_subnet.application`. In the Inspector's **Details** tab,
**Where** lists `aws_vpc.main`. The subnet appears inside that VPC because
the AWS Dialect established a placement. Rootform does not draw every
Terraform reference as a connection.

## Follow the placement evidence

Open the Inspector's **Evidence** tab. Under **Network context**, expand
**Resolution**. It names Rule `aws.rule.subnet`, `source.vpc_id`, and
**Reference traversal** as the evidence for the fact from the subnet to
`aws_vpc.main`. Under **Closures**, **Network placement to virtual network**
is **Resolved** with one fact. The saved plan's direct
`aws_vpc.main.id` reference identifies the VPC even though its ID is unknown
until apply. Run the same analysis without the saved plan to see the limit:

<!-- docs-check:journey-first-without-plan -->
```sh
rootform run plan.json --no-serve
```

```ansi title="Plan-only excerpt"
[1m[38;5;208mArchitecture[0m
  [2mInstances[0m    2
  [2mInterpreted[0m  2
  [2mFacts[0m        none determined
[1m[38;5;208mUncertainty[0m
                          [2mPlanned[0m
  [2mIndeterminate closures[0m        1
  [2m  Unknown until apply[0m         1
```

The VPC ID is unknown until apply. The JSON export alone does not say which
instance `vpc_id` refers to, so the closure stays `indeterminate` rather
than becoming a guessed placement. See
[saved-plan pairing](../inputs/plans.md#pair-the-saved-plan) for the
pairing check and refusal behavior.

## Save the architecture

<!-- docs-check:journey-first-save -->
```sh
rootform run plan.json --plan-file plan.tfplan --no-serve -o analysis.json
```

```ansi title="Saved architecture excerpt"
[1mPlan analyzed[0m
[2mEnrichment[0m         Saved plan paired with this plan JSON (1 module)
[1m[38;5;208mArchitecture[0m
  [2mInstances[0m    2
  [2mContexts[0m     1
[2mWrote     [0m analysis.json
```

The [Form](../concepts/forms.md) retains the stages,
facts, closures, diagnostics, and evidence. Reopen it with
`rootform run analysis.json` without the plan files.

## Explain the architecture

<!-- docs-check:journey-first-explain -->
```sh
rootform explain instance aws_subnet.application --input analysis.json
```

```ansi title="Subnet explanation excerpt"
[1mInstance explained[0m
[1m[38;5;208maws_subnet.application[0m
  [2mInterpretation[0m  applied aws.rule.subnet as subnet
  [2mConclusion[0m      Interpreted as subnet by aws.rule.subnet: network context to
                  aws_vpc.main.
  [1mFacts[0m
    -> context network  aws_vpc.main  [2mevidence: traversal[0m
  [1mClosures[0m
    context network -> virtual-network
      via source.vpc_id, match exact by id
      [32mresolved, 1 fact[0m
```

The explanation names the interpreting Rule and the evidence behind the
placement. It makes no claim that this infrastructure has been applied.

## Optional: self-contained HTML

<!-- docs-check:journey-first-html -->
```sh
rootform run plan.json --plan-file plan.tfplan --no-serve -o architecture.html
```

Open `architecture.html` in a browser. It contains the interactive Explorer
and its assets in one file and makes no network requests. It still shows
instance names and network placement, so share it only with readers allowed
to see that information.

<!-- rootform:endsteps -->

Every fact in a larger Form works this way: a Rule declares what a reference
means, the evidence settles it or leaves it indeterminate, and the Form keeps
the closure so you can ask why. Rootform describes planned **instances**, so
`count` and `for_each` can make an architecture larger than the number of
declarations. [Choose an input](../inputs/index.md) explains when state or a
saved Form answers your question better.

Next, read [Forms and stages](../concepts/forms.md) for the model behind
closures and stages, or see how the same uncertainty reaches a verdict in
[Understand Policy outcomes](../guides/check-architecture.md).
