---
title: "Container image"
description: "Run Rootform against a plan or state export in a container."
---

Mount the exported input and selected project content. Rootform only reads the plan or state JSON; produce it with Terraform or OpenTofu before starting the container.

```sh
docker run --rm \
  --volume "$PWD:/workspace:ro" \
  --workdir /workspace \
  ghcr.io/rootform-dev/rootform:0.1.0 \
  rootform run plan.json --no-serve
```

To write a result, mount a writable output directory and use `-o` with its extension. The container user needs write access to that directory.

```sh
docker run --rm \
  --volume "$PWD:/workspace:ro" \
  --volume "$PWD/reports:/reports" \
  --workdir /workspace \
  ghcr.io/rootform-dev/rootform:0.1.0 \
  rootform run plan.json --no-serve -o /reports/analysis.json
```

A selected OCI Dialect or Policy Pack may need preparation before offline analysis. Vendor exact content in the project and verify it with `rootform init . --locked --offline --no-input`. The normal `run` command does not acquire packages. Producer exports may contain cleartext sensitive values; restrict mounted files and container output retention. See [Offline and security](../offline-security.md).
