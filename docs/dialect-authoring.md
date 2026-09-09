---
title: "Write a Dialect"
description: "Define a provider Dialect in .rf, prove its architectural meaning with fixtures, and package the reviewed result."
---

A Dialect turns source declarations into explicit Architecture IR facts. Write
one when Rootform needs new provider coverage or when an existing provider rule
does not express proven domain meaning.

Start from provider documentation and synthetic configuration. Do not infer
semantics from resource names alone. Every rule should answer three questions:

1. Which source declaration does it recognize?
2. Which architectural concept does that declaration represent?
3. Which source evidence proves each context, contribution, relation, or
   composition member?

For product meaning and selection behavior, read [Dialects](concepts/dialects.md).

## Set up an authoring checkout

Clone the public Dialects repository and work from its root. It contains shared
`core` vocabulary, provider Dialects, tests, and lock evidence needed to validate
a contribution.

```sh
git clone https://github.com/rootform-dev/dialects.git
cd dialects
```

Keep one Dialect in one source root. Files can be organized recursively by
domain; Rootform discovers `.rf` and `.rf.json` beneath that root. One and only
one `dialect` declaration identifies the package.

An existing provider Dialect commonly looks like this:

```text title="Dialect package"
example/
├── dialect.rf
├── network/
│   ├── concepts.rf
│   └── virtual-network.rf
├── compute/
│   └── instance.rf
└── presentation.json
```

Folder names organize source for people. They do not create namespaces,
modules, or imports. Dialect and definition labels establish identity.

<!-- rootform:steps -->

## Declare identity and compatibility

The official AWS declaration shows every package-level field:

```hcl title="aws/dialect.rf"
dialect "aws" {
  version = "0.1.0"

  requires {
    core = "0.1.0"
  }

  provider "hashicorp/aws" {
    version = "= 6.62.0"
  }
}
```

`version` is an exact semantic version. A `requires` entry names another
Dialect and its exact version. A provider block names a canonical provider
source and the versions this Dialect supports.

Requirements make another Dialect's vocabulary available through qualified
references such as `concept.core.subnet`. They are direct: depending on a
Dialect that itself requires `core` does not place `core` in your authoring
scope.

Use a provider constraint supported by evidence and fixtures. A broad
constraint claims broad compatibility; it is not a convenience default.

## Define only needed vocabulary

Reuse `core` vocabulary when it expresses the same architecture meaning.
Define a provider-specific concept when the meaning is distinct.

```hcl title="core/network/virtual-network.rf"
concept "virtual-network" {
  kind        = scope
  description = "A virtual network that provides connectivity and isolation."
}

concept "subnet" {
  kind        = scope
  description = "A subnet that segments a virtual network."
}
```

Choose the concept kind by its role in Architecture IR:

| Kind | Use it when |
| --- | --- |
| `entity` | The declaration becomes an independently inspectable component. |
| `scope` | The representation can provide context or containment. |
| `detail` | The declaration supports another representation through a contribution. |

Define a context only when a placement dimension has stable meaning:

```hcl title="core/architecture/contexts.rf"
context "network" {
  description = "Network placement or containment."
}
```

Names are lower kebab case. Descriptions should explain architectural meaning,
not restate provider marketing or the label.

## Add the smallest complete rule

Begin with source selection and representation. The official AWS VPC rule has
no extra fact because the declaration already represents the whole component:

```hcl title="aws/network/vpc.rf"
rule "vpc" {
  match {
    kind = "resource"
    type = "aws_vpc"
  }

  as = concept.core.virtual-network
}
```

`match.kind` selects a closed Terraform/OpenTofu declaration category.
`match.type` is the exact adapter-owned type. `as` refers to a local concept as
`concept.name`, or to a directly required Dialect as
`concept.dialect.name`.

Add a predicate inside a rule's `match` block only when declarations of the same
type have different proven meaning:

```hcl title="Match block inside a rule"
match {
  kind  = "resource"
  type  = "google_compute_global_forwarding_rule"
  where = source.load_balancing_scheme == "EXTERNAL"
}
```

A `where` predicate can compare source traversals with string, Boolean, or
integer literals. It cannot call functions or read another declaration. If a
value is missing, unknown, or incompatible, Rootform does not treat the rule as
a safe match.

## Add facts from explicit evidence

The AWS subnet rule follows `vpc_id` to establish network context:

```hcl title="aws/network/vpc.rf"
rule "subnet" {
  match {
    kind = "resource"
    type = "aws_subnet"
  }

  as = concept.core.subnet

  context {
    as  = context.core.network
    to  = concept.core.virtual-network
    via = source.vpc_id
  }
}
```

Use each fact for one semantic claim:

- `context` places a representation relative to another in a named dimension;
- `contribution` attaches a `detail` representation to an entity or scope;
- `relation "type"` records a directional domain relationship between
  entities or scopes.

`via = source.path` follows evidence from the initially matched declaration.
`via = provider.path` reads the concrete provider configuration used by that
source; use it only for a fact whose evidence genuinely belongs there.

Facts normally resolve a source reference. When a provider exposes an
identifier rather than a reference, add a bounded fact match inside the rule's
context block:

```hcl title="Context block inside a rule"
context {
  as  = context.core.network
  to  = concept.core.subnet
  via = source.network

  match {
    by       = target.name
    strategy = "exact"
  }
}
```

The only strategies are `exact` and `dot-ancestor`. Use them when provider
behavior proves the equality or namespace relationship. They do not perform a
general search.

## Compose only one architectural component

Use a composition when several linked declarations implement one component,
not to make a large graph visually smaller. This is the complete composition
from the official Google application load balancer rule:

```hcl title="google/load-balancing/application-load-balancer.rf"
rule "application-load-balancer" {
  match {
    kind = "resource"
    type = "google_compute_global_forwarding_rule"
  }

  as = concept.core.load-balancer

  composition {
    member "target-https-proxy" {
      via = source.target

      match {
        kind = "resource"
        type = "google_compute_target_https_proxy"
      }
    }

    member "url-map" {
      via = member.target-https-proxy.url_map

      match {
        kind = "resource"
        type = "google_compute_url_map"
      }
    }

    member "backend-service" {
      via = member.url-map.default_service

      match {
        kind = "resource"
        type = "google_compute_backend_service"
      }
    }
  }
}
```

Member order is semantic. A member can traverse the initial `source` or a
member declared earlier. Forward and self references are invalid. Rootform
accounts member declarations as supporting a composition rather than as
separate visible representations.

## Compile and inspect definitions

Check canonical formatting, then compile the repository's Dialects:

```sh
rootform fmt --check .
rootform validate dialects .
```

Validation reads source directly. Install the compiled checkout into an
isolated authoring home before commands that inspect selected definitions or
build fixtures:

```sh
export ROOTFORM_HOME="$(mktemp -d)"
rootform install dialects .
rootform verify dialects .
```

Then inspect the exact object you changed:

```sh
rootform validate rule aws/subnet
rootform show rule aws/subnet
rootform show concept core/subnet
```

Named commands use Dialects selected for the current project or installed
locally. A bare name is accepted only when it resolves
unambiguously. JSON output is useful for tooling; text output is easier during
interactive authoring.

Editor integration runs the same compiler boundary:

```sh
rootform lsp
```

Configure your editor to launch that command for `.rf` and `.rf.json`. Keep
CLI validation in CI even when editor diagnostics are enabled.

## Prove consequences with fixtures

A valid rule can still express the wrong meaning. Test it against small source
configurations and reviewed Architecture IR. A fixture case is a directory
containing Terraform/OpenTofu source and `architecture.golden`:

```text title="Dialect fixture"
fixtures/example/minimal/
├── main.tf
└── architecture.golden
```

Run all cases or narrow by case-name substring:

```sh
rootform test ./fixtures
rootform test ./fixtures --run example/minimal
```

`rootform test` builds each discovered case with the checkout's prepared
Dialects and compares exact architecture bytes with the golden. Review changes
to concepts, contexts, relations, declaration outcomes, provenance, and
diagnostics. Do not update a golden only to silence a difference.

Strong coverage includes:

- a minimal positive example;
- realistic scenarios that exercise facts and compositions;
- boundary cases that must remain unsupported or unresolved;
- provider-version evidence for the declared compatibility range;
- deterministic repeat output.

## Keep presentation separate

Dialect rules produce semantics. One optional `presentation.json` belongs at
the Dialect source root beside `dialect.rf`. It maps local rule or concept names
to declarative technology identities and optional plain-text labels:

```json title="aws/presentation.json"
{
  "format_version": "1",
  "rules": {
    "vpc": "generic/network",
    "subnet": "generic/subnet"
  },
  "concepts": {},
  "rule_labels": {
    "vpc": "Amazon VPC",
    "subnet": "Amazon VPC subnet"
  },
  "concept_labels": {}
}
```

Use unqualified names owned by the Dialect (`vpc`, not `aws/vpc`). `rules` and
`concepts` map them to `family/name` technology identities; the label maps are
optional. This example leaves `concepts` empty because those concepts belong to
`core`.

Keep the manifest declarative: no SVG, HTML, URLs, styles, layout, architecture
facts, or renderer behavior. Normal runs warn and ignore invalid presentation;
`rootform package dialects` rejects it. See
[Presentation manifest contract](../contracts/presentation-manifest.md) and
[machine schema](../schemas/presentation-manifest.schema.json) for complete
limits.

Test semantics independently, then inspect a rendered fixture.

## Package and publish a Dialect

Packaging is offline and produces an OCI layout. Supply immutable source
metadata and the package license. Replace example URLs with repository-owned
values; use the exact revision from the checkout:

```sh
rootform package dialects . --to artifacts/oci \
  --repository registry.example/team/dialects \
  --source-url https://example.com/team/dialects \
  --revision "$(git rev-parse HEAD)" \
  --documentation-url https://example.com/team/dialects/docs \
  --licenses MPL-2.0
```

Verify the artifact before publishing:

```sh
rootform verify dialects artifacts/oci
```

Publishing uses Docker-compatible registry credentials, refuses a changed
existing version tag, and reports success only after exact digest repull and
verification:

```sh
rootform publish dialects artifacts/oci \
  --to registry.example/team/dialects --index
```

Direct publication does not require an index; omit `--index` when discovery is
managed elsewhere.

## Use a published Dialect

Add a private Dialect artifact or index while preparing the project. Rootform
reads registry credentials from standard Docker configuration:

```sh
DOCKER_CONFIG=/path/to/docker-config \
  rootform init ./infra \
  --source registry.example/team/dialects:dialect-company-1.2.0 \
  --no-input
```

Review and commit the resulting `rootform.lock`. Later local or CI runs recover
that exact artifact by digest with `rootform init ./infra --locked --no-input`;
they do not need the original `--source` argument.

<!-- rootform:endsteps -->

See [Test and validate](language/test-validate.md) for the authoring loop and
[Dialect reference](language/reference/dialects.md) for every accepted field.
