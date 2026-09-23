---
title: Your first architecture
description: Explore a VPC and subnet, save the architecture, and explain its placement.
---

Build and inspect a VPC with one subnet from Terraform configuration. Rootform
uses its supplied AWS [Dialect](../concepts/dialects.md), so this tutorial needs
no cloud account, credentials, Terraform binary, or provider download.

<!-- rootform:steps -->

## Create input

```sh
mkdir rootform-first-architecture
cd rootform-first-architecture
```

Save this complete configuration as `main.tf`:

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
rootform run .
```

Rootform opens the local explorer and reports what it built. Output includes:

```ansi title="Run output excerpt"
[1m[32mServing architecture[0m
http://127.0.0.1:21717

[2mSource[0m     .
[2mResources[0m  2
[2mFacts[0m      1 resolved, 0 omitted
[2mWatch[0m      enabled
```

The command stays in the foreground and rebuilds after source changes. Leave
this terminal running while you use the browser. Use a second terminal for the
remaining commands, or press `Ctrl+C` after exploring and reuse the same one.

## Inspect the subnet

The first view contains `main`, an Amazon VPC with one nested object. Open
`main`, then select `application`. The Details tab identifies it as
`aws_subnet.application` and shows `main` under **Where**.

This is a placement: the subnet appears inside the VPC. Rootform does not draw
that context as a connection arrow.

## Follow the placement evidence

Open the subnet's Source tab. Under **Network context**, expand **Resolution**.
The explorer names `aws.rule.subnet`, the resolved subnet and VPC, and source
line 17. That line is the `vpc_id = aws_vpc.main.id` reference used as evidence
for the placement.

The reference alone is not architectural meaning. The AWS Dialect Rule states
that this specific evidence establishes network context. Other Terraform
references do not become placements or connections automatically.

## Build the architecture

In the second terminal, from `rootform-first-architecture`, run:

```sh
rootform build . --output architecture.json
```

The command writes a Rootform architecture file and reports:

```ansi title="Declaration summary"
[1m[32mArchitecture built -> architecture.json[0m

[2mResources[0m  2
[2mFacts[0m      1 resolved, 0 omitted
```

The saved [Architecture IR](../concepts/architecture-ir.md) keeps source
accounting, interpretations, facts, diagnostics, and evidence for later
inspection or automation.

## Explain the architecture

```sh
rootform explain architecture aws_subnet.application --input architecture.json
```

```ansi title="Subnet explanation excerpt"
[1maws_subnet.application[0m

[2mConcept[0m  rf.concept.subnet "application"
[2mRule[0m     aws.rule.subnet
[2mDefined[0m  main.tf:16

[1m[38;5;208mContexts[0m
[2m  rf.context.network[0m  rf.concept.virtual-network "main"
                      via aws_subnet.application.vpc_id
```

The explanation confirms which Rule interpreted the subnet and which argument
resolved to its VPC.

## Optional: self-contained HTML

```sh
rootform build . --format html --output architecture.html
```

Open `architecture.html` in a browser. It contains its assets and the same
architecture, so it needs no local server or adjacent files.

<!-- rootform:endsteps -->

To use your own project, run `rootform run .` from its root module. Child modules
referenced by configuration must already be available locally. Configuration
shows declared structure; use a [Terraform or OpenTofu plan](../inputs/plans.md)
when your question depends on planned instances or before-and-after evidence.

Next, [choose another input](../inputs/index.md),
[compare architectures](../guides/compare-architectures.md), or
[run checks](../guides/check-architecture.md).
