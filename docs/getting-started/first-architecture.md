---
title: Your first architecture
description: Build a VPC and subnet from configuration and read the resulting facts and evidence.
---

Build a VPC and subnet from Terraform configuration and read the architecture
Rootform derives from it. No cloud account, credentials, Terraform binary, or
provider download is involved: the RF Vocabulary and the Dialects that
interpret AWS resources are embedded in the Rootform release.

<!-- rootform:steps -->

## Create input

```sh
mkdir rootform-first-architecture
cd rootform-first-architecture
```

Save this configuration as `main.tf`:

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

## Build the architecture

```sh
rootform build . --output architecture.json
```

`build` compiles the directory with the supplied release set. It does not
discover, acquire, or prompt for packages, and it does not create
`rootform.lock`: a project that uses only supplied Dialects needs no lock and
no `rootform init`. The command writes Architecture IR to
`architecture.json` and reports a compact declaration summary on standard error:

```text title="Declaration summary"
Architecture built -> architecture.json

Resources  2
Facts      1 resolved, 0 omitted
```

The result line names the destination. The summary counts the two resources.
The third declaration in the file is the Terraform settings block, which is
not a resource and stays source data. The VPC and subnet each retain a base
representation and an applied Rule.

## Explain the architecture

`aws_vpc.main` and `aws_subnet.application` both start as base
representations. The AWS Dialect then applies `aws.rule.vpc` to the first and
`aws.rule.subnet` to the second, which classifies each representation with a
Concept. Classification records architectural meaning; it never changes the
representation identity established from the source declaration.

The subnet's `vpc_id` argument refers to `aws_vpc.main`. That reference is
source evidence on its own. `aws.rule.subnet` states how the evidence produces
meaning, so the result records a `rf.context.network` fact from the subnet
representation to the VPC representation rather than turning every reference
into a relation.

Read one element with:

```sh
rootform explain architecture aws_subnet.application --input architecture.json
```

The explanation names the source declaration, the applied Rule, and the
resolution behind each fact. Base metadata, applied interpretation, and fact
provenance stay separate, so what the source declared remains distinguishable
from what a Dialect established.

## Optional: self-contained HTML

```sh
rootform build . --format html --output architecture.html
```

Open `architecture.html` in a browser. The file carries its own assets and
needs no server or adjacent files. It presents the same architecture as
`architecture.json`.

<!-- rootform:endsteps -->

Continue with [Architecture IR](../concepts/architecture-ir.md) to see how the
document records bases, facts, and provenance,
[compare architectures](../guides/compare-architectures.md) to read a Diff, or
[check a policy](../guides/check-architecture.md) to evaluate the facts. When a
project adds third-party Dialects, excludes or replaces a supplied owner, or
selects Policy Packs, record that selection in `rootform.lock`; see
[external content](../guides/external-content.md).
