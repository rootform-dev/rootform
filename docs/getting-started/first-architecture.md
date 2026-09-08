---
title: "Your first architecture"
description: "Render a VPC and subnet, inspect their evidence, and save a self-contained architecture file."
---

Render a VPC and subnet from a small Terraform configuration. Then save the
architecture and check why the subnet appears inside the network. No cloud
account or running infrastructure is needed.

## Before you start

[Install Rootform](../installation.md). This tutorial is verified with the current
documentation build. The [installation note](../installation.md#available-release)
identifies the published archive and its older interface.

The first run needs network access to download support for the AWS configuration.
Those semantic packages are called Dialects. Terraform, OpenTofu, an AWS provider,
and cloud credentials are not needed for this example.

<!-- rootform:steps -->

## Create the input

Create an empty working directory and enter it:

```sh
mkdir rootform-first-architecture
cd rootform-first-architecture
```

Save the following as `main.tf`:

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

`vpc_id` refers to the declared VPC. The AWS Dialect will use that reference
to establish the subnet's network context.

## Open the architecture

```sh
rootform run . --no-input
```

The command starts a loopback server and opens your browser. If it does not
open, use the `http://127.0.0.1:...` address printed by the command. Keep this
terminal running while you explore. Press `Ctrl+C` to stop the server.

On this first run, Rootform downloads the required packages and records the
selection in `rootform.lock`. `--no-input` permits a unique selection without
a prompt. The [preparation guide](../cli.md) explains the choices for real projects.

> [!NOTE]
> You may see a warning that AWS provider compatibility is unverified because
> this new directory has no `.terraform.lock.hcl`. That warning does not prevent
> this synthetic example from rendering. In an initialized real project, refresh
> provider version evidence with Terraform or OpenTofu as appropriate.

## Read the result

Find the virtual network named `main` and the subnet named `application`.
The subnet has network context inside the VPC.

Select `application` and inspect its evidence. The source is
`aws_subnet.application`; the rule comes from the AWS Dialect. Its `vpc_id`
reference explains the network placement.

In the current renderer, [Survey and Plan](../renderer/views.md) change the
amount of visible context, [Focus](../renderer/views.md#focus) explores a local
part, and Inspector explains a selection.

## Save the result

Stop the server with `Ctrl+C`, then build a document using the lock already
created:

```sh
rootform build . --locked --output architecture.json
```

The command writes JSON to `architecture.json`. Its declaration summary appears
on standard error; a provider-version warning may precede it:

```text title="Declaration summary"
Declarations detected           3
Represented                     2
Supporting a composition        0
Filtered by rule                1
Unsupported                     0
Failed                          0
```

The VPC and subnet are represented. The third declaration is the `terraform`
settings block, filtered as language settings. Nothing is unsupported or failed.
This accounting is part of the result, not a count of visible shapes.

The required Dialects are now available locally. Export a self-contained HTML
file without network access:

```sh
rootform build . --locked --offline --format html --output architecture.html
```

Open `architecture.html` directly in your browser. No server or adjacent asset
is needed. Your directory now contains:

```text title="Generated files"
main.tf
rootform.lock
architecture.json
architecture.html
```

Rootform has not applied or modified your Terraform configuration. Review and
commit `rootform.lock` when you use this workflow in a real project. The JSON
and HTML are generated outputs; keep or share them according to your team's
artifact policy.

<!-- rootform:endsteps -->

## Continue with a real question

Read [Dialects](../concepts/dialects.md) to understand the semantics behind this
example. Use the [input guide](../inputs/index.md) when moving to an existing
project with modules. If preparation or rendering fails, use
[troubleshooting](../troubleshooting/index.md) with the exact diagnostic.
