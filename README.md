# Rootform

[![Source license](https://img.shields.io/badge/source-Apache--2.0-blue.svg)](LICENSE)

Rootform reads a Terraform or OpenTofu plan and shows the architecture it
proposes: which resources sit where, what connects to what, and what changes.
The result is a **Form**, a saved file you can explore in a browser, question
from the terminal, compare with another revision, and check against Policies.
Every placement and connection is a fact a Dialect Rule established from plan
evidence; when a value is unknown until apply, Rootform says so instead of
guessing.

Rootform never runs Terraform or OpenTofu, executes providers, or contacts a
cloud account. It reads the exported plan or state JSON locally.

Try it without installing anything in the
[Playground](https://docs.rootform.dev/playground/), then follow the
[quickstart](https://docs.rootform.dev/getting-started/quickstart/).

## Install

```bash
curl -fsSL https://rootform.dev/install | sh
rootform version
```

[Install Rootform](docs/installation.md) covers macOS, Linux, Windows, the
container image, and checksum verification.

## Analyze a plan

Export a completed plan, then open its architecture:

```bash
terraform plan -out=plan.tfplan
terraform show -json plan.tfplan > plan.json
rootform run plan.json --plan-file plan.tfplan
```

The summary counts the planned instances and the facts Rules established;
the Explorer opens in your browser. Add `--no-serve -o analysis.json` to save
the Form instead, and `-o review.md` for a report to paste in a pull request.
Keep `plan.tfplan` and `plan.json` out of Git: they can contain secrets.

## Explore, explain, compare, check

These commands use the commerce sample from the
[quickstart](docs/getting-started/quickstart.md): `analysis.json` is the Form
it saves, `base/` and `head/` hold the two sample plans from
`examples/playground/commerce-platform/`, and `policies/` is the Pack it
writes.

```bash
rootform run analysis.json                                       # reopen the Form
rootform explain instance azurerm_subnet.prod_data --input analysis.json
rootform run base/plan.json --plan-file base/plan.tfplan \
  --diff head/plan.json --diff-plan-file head/plan.tfplan --no-serve -o comparison.md
rootform check analysis.json --policy-pack ./policies -o results.sarif
```

`explain` names the Rule and the evidence behind one placement, connection,
or Policy decision. `--diff` compares two Forms and reports differences,
which are never called drift. `check` evaluates Policies against one Form and
exits `0` on pass, `1` on a violation, and `3` when the evidence cannot
settle an evaluation or a Policy finds no target. `run` never evaluates
Policies. [Outputs and exit status](docs/reference/outputs.md) lists every
format.

## What Rootform does not do

It does not deploy or read live infrastructure, verify network reachability,
or evaluate configuration source. A Form describes the plan or state you gave
it. [Limitations](docs/limitations.md) states the evidence boundaries and
[Security and data handling](docs/security/index.md) what leaves your machine
(nothing, unless you share a report).

## What lives here

- [`docs/`](docs/): the documentation published at
  [docs.rootform.dev](https://docs.rootform.dev/);
- [`cli/`](cli/): the open-source Go module of the command line: commands,
  flags, help, reports, exit statuses, the loopback Explorer server, and the
  Form and Policy result models. Its version is the commit the Rootform
  binary pins; it makes no compatibility promise yet;
- [`dialects/`](dialects/): official Dialect sources, evidence, and fixtures
  embedded in Rootform releases;
- [`policy-packs/`](policy-packs/): Policy Pack examples;
- [`examples/`](examples/): synthetic Terraform projects with saved plans,
  including the Playground scenarios;
- [`contracts/`](contracts/) and [`schemas/`](schemas/): the Form, Policy
  result, lock, and release contracts with their JSON Schemas.

The Rootform binary is built from a private engine that implements the
module's backend: compilation, Rule and Policy evaluation, and comparison.
[Contribute to Rootform](docs/contributing/index.md) says where each kind of
change belongs.

## Licensing

- Repository source, contracts, documentation, examples, tooling, and the
  `cli/` module: Apache-2.0 ([LICENSE](LICENSE), [cli/LICENSE](cli/LICENSE)).
- Official Dialects under `dialects/`: MPL-2.0 ([dialects/LICENSE](dialects/LICENSE)).
- Distributed Rootform executables and official runtime images:
  [Elastic License 2.0](dependencies/ROOTFORM-BINARY-LICENSE.txt) (`Elastic-2.0`).
  Release archives and OCI images embed that notice; the repository
  `LICENSE` does not license distributed executables.
- Rootform name and logos: trademark rights reserved ([TRADEMARKS.md](TRADEMARKS.md)).
- Third-party components: their identified terms ([THIRD_PARTY_NOTICES.txt](THIRD_PARTY_NOTICES.txt)).

Report a suspected vulnerability through
[private vulnerability reporting](https://github.com/rootform-dev/rootform/security/advisories/new),
never in a public issue ([SECURITY.md](SECURITY.md)).
