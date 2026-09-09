---
title: Your first architecture
description: Render a VPC and subnet, inspect their evidence, and save the architecture.
---

Render a VPC and subnet from Terraform, inspect why they appear together, and
save the result as JSON and self-contained HTML. You need no cloud account,
credentials, or running infrastructure.

## Before you start

[Install Rootform](../installation.md). The first run needs network access only
when required [Dialects](../concepts/dialects.md) are not already local.
Terraform, OpenTofu, and the AWS provider are not needed for this tutorial.

<!-- rootform:steps -->

## Create the input

Create a working directory:

```sh
mkdir rootform-first-architecture
cd rootform-first-architecture
```

Save the following configuration as `main.tf`:

```hcl title="main.tf"
terraform {
  required_version = ">= 1.14.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "= 6.62.0"
    }
  }
}

resource "aws_vpc" "main" {
  cidr_block = "10.20.0.0/16"
}

resource "aws_subnet" "application" {
  vpc_id     = aws_vpc.main.id
  cidr_block = "10.20.1.0/24"
}
```

## Open the architecture

```sh
rootform run . --no-input
```

Rootform selects the required Dialects, downloads any missing packages, records
them in `rootform.lock`, and opens the local explorer. If your browser does not
open, use the loopback address printed by the command. Keep it running while you
explore.

`--no-input` accepts this unique selection without prompting. The new lock
records the exact `aws` and `core` Dialect packages used for the result.

Because the standalone example has no `.terraform.lock.hcl`, Rootform may warn
that AWS provider compatibility is unverified. Rendering continues; initialized
projects use provider-version evidence from their own lock file.

## Inspect the result

Find the virtual network `main` and subnet `application`. The subnet appears
inside the VPC because `vpc_id` refers to `aws_vpc.main` and the AWS Dialect
establishes network context from that reference.

Select `application`. Inspector identifies concept `core/subnet`, source
`aws_subnet.application`, and the `vpc_id` evidence used by the AWS rule to
establish network placement. Rootform preserves this
[provenance](../concepts/architecture-ir.md#follow-a-fact-back-to-its-evidence)
instead of inferring a relationship from resource names or CIDR values.

[Survey and Plan](../renderer/views.md) control the visible context,
[Focus](../renderer/views.md#focus) opens a local area, and Inspector explains
the selected facts.

## Save the architecture

Stop the server, then build JSON using the recorded selection:

```sh
rootform build . --locked --output architecture.json
```

Rootform writes an Architecture IR document to `architecture.json` and reports
the declaration accounting on standard error:

```text title="Declaration summary"
Declarations detected           3
Represented                     2
Supporting a composition        0
Filtered by rule                1
Unsupported                     0
Failed                          0
```

The VPC and subnet are represented; the Terraform settings block is filtered.
Nothing is unsupported or failed. [Architecture IR](../concepts/architecture-ir.md#from-declarations-to-architecture)
explains why accounting and visible shapes are different views of the same
result.

The required Dialects are now local, so the same input can produce
self-contained HTML without network access:

```sh
rootform build . --locked --offline --format html --output architecture.html
```

Open `architecture.html` directly in a browser. It needs no server or adjacent
assets.

<!-- rootform:endsteps -->

## Use your project

From the Terraform or OpenTofu root:

```sh
rootform run .
```

Review and commit `rootform.lock` once its selection is correct. Check
[project preparation](../cli.md) before changing an existing lock, and check
[supported inputs and modules](../inputs/index.md). Then use
[Diff](../guides/compare-architectures.md) to review a source change or
[check a policy](../guides/check-architecture.md) against the architecture.
