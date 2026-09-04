# CLI reference

Project initialization:

```text
rootform init [path]
```

Path defaults to literal `.` and is both project root and Terraform/OpenTofu
root. Initialization discovers providers from source, uses only compatible
version evidence from `.terraform.lock.hcl`, resolves non-ambiguous dialects
and dependencies from official index plus explicitly configured OCI sources,
installs missing exact artifacts, and writes `rootform.lock`.

Initialization flags:

```text
--locked     require an existing lock and never modify it
--offline    forbid every network access
--upgrade    allow newer compatible dialect versions
--source REF add a dialect artifact or dialect index OCI reference; repeatable
--policy-pack REF
             select an exact Policy Pack OCI artifact reference; repeatable
--no-input   forbid prompts and interactive choices
-v, --verbose
             show provider evidence, dialect compatibility, and origin
--format text|json
             select human or deterministic machine output
```

`--locked` is incompatible with `--upgrade`, `--source`, and `--policy-pack`.
`--locked` still permits exact download of artifacts already pinned by lock,
from each pin's own OCI repository and manifest digest, without reading
official index. JSON output implies no input.
`ROOTFORM_INPUT=0` and `CI=true` imply no input; CI does not imply offline.
`ROOTFORM_OFFLINE=1` implies offline. `ROOTFORM_HOME=<path>` replaces default
home entirely.

Remote OCI access reuses Docker credentials without Rootform login flags.
Non-empty `DOCKER_CONFIG` selects its `config.json`; otherwise Rootform reads
current user's `~/.docker/config.json`. For challenged registry, host-specific
`credHelpers` wins, then global `credsStore`, then matching `auths`. Configured
helper/store failure is final rather than another-identity fallback. ORAS handles
standard Basic and Bearer challenges. Rootform never writes Docker config or
persists credentials in lock, home, cache, diagnostics, or Architecture IR.
Set `SSL_CERT_FILE` to a non-empty bounded PEM bundle when registry uses a
private CA. Invalid, empty, non-regular, or oversized bundles fail closed with
sanitized diagnostics; offline mode never reads this file.

`--source` requires canonical registry/repository reference with tag or
SHA-256 digest. Artifact type identifies direct dialect versus additional
index. Direct dialect becomes explicit root. Indexes extend discovery without
priority; same name/version with differing metadata or artifact identity fails
closed. Tags are recorded with exact resolved manifest digest. Locked commands
use only entry artifact pins, never source tags or indexes.

Interactive init shows proposed dialects, versions, dependencies, sizes, and
changes before confirmation. An ambiguous configured match requires explicit
choice. No-input mode applies only unique deterministic recommendations and
fails rather than guess. Unknown provider version permits compatible dialect
use with warning; reliable incompatible evidence blocks that candidate.
Providers with no configured dialect remain explicitly uncovered without
fabricating a selection.

Primary commands:

```text
rootform build [directory]             canonical Architecture IR
rootform build [directory] --format html --output architecture.html
rootform check [directory-or-document] policy evaluation
rootform check [directory-or-document] --policy <policy>
rootform list policies
rootform list policy-packs
rootform show policy <policy>
rootform show policy-pack <pack>
rootform diff <base> <head>             architecture comparison
rootform run [directory]                local browser explorer
rootform explain <document>             provenance explanation
```

Directory forms of `build`, `check`, and `run` call same project-preparation
service before compilation. They accept `--locked`, `--offline`, `--no-input`,
and `-v`/`--verbose`; `--upgrade` remains init-only. Preparation resolves
missing exact dialects; `check` also resolves selected Policy Packs, while
`build` and `run` ignore governance. A coherent local lock is a silent
zero-network path. Missing exact locked artifacts may be installed without
changing lock. With no lock, unique no-input recommendations may create one and
command resumes in same process. A normal no-input command never changes
existing lock: run exact reported `rootform init [path] --no-input`, then commit
updated lock. Interactive normal commands show complete proposal and require
confirmation before lock or vendor change.

`--offline` forbids network for both explicit init and implicit preparation.
`--locked` requires existing lock and preserves bytes while still permitting
exact artifact recovery unless offline. Project `.rootform/dialects/` remains
exclusive: installed store is never fallback. Reliable incompatible provider
version evidence blocks compilation; unknown or stale version evidence warns and
recommends `terraform init` or `tofu init`. Provider without configured dialect is
reported explicitly and remains unsupported.

`check` evaluates policies from the project's selected policy packs.
Repeatable `--policy <policy>` restricts evaluation to named policies. A policy
always belongs to a pack; dialect selection never provides policy.

Dialect authoring and local package management:

```text
rootform fmt [directory] --check
rootform validate dialects <directory>
rootform test <fixtures>
rootform install dialects <directory>
rootform lock dialects <directory>
rootform verify dialects <directory>
rootform package dialects <directory> --to <layout> --repository <repository>
rootform publish dialects <layout> --to <repository>
rootform publish dialects <layout> --to <repository> --index
rootform vendor dialects
rootform list dialects --installed
rootform list dialects --outdated
rootform init . --upgrade
rootform remove dialect <name> <version>
```

Listings never contact network or mutate project. `--outdated` uses cached
official index snapshot and names missing cache instead of guessing. Upgrade
stays explicit through `init --upgrade`, revisits only official index and source
references recorded in lock plus newly supplied `--source` values, and never
scans registries. Removed selections remain installed until exact `remove
dialect` command is requested.

Policy pack authoring and local package management:

```text
rootform package policy-packs <directory> --to <layout>
rootform publish policy-packs <layout> --to <repository>
rootform vendor policy-packs
rootform list policies --policy-pack <directory>
rootform list policy-packs --policy-pack <directory>
rootform show policy <name> --policy-pack <directory>
rootform show policy-pack <name> --policy-pack <directory>
rootform check [directory-or-document] --policy-pack <directory>
```

`--policy-pack <directory>` selects an unpackaged local pack directory for
read-only list, show, and check during authoring. These local forms never
contact network, load installed or vendored packs, or write lock.
`package policy-packs` validates and compiles all supplied packs, then writes
one deterministic local OCI layout. Optional `--source-url`, `--revision`,
`--documentation-url`, and `--licenses` values become explicit OCI provenance;
Rootform never discovers them from Git. Packaging performs no network operation
and produces no pack index.

`publish policy-packs` validates an existing packaged layout and publishes to
the explicitly supplied tagless OCI repository through standard Docker
authentication.
Pack tags derive from compiled name and version as
`policy-pack-<name>-<version>`. Existing same digest is idempotent; another
digest at same version tag fails. Successful publication requires digest repull
and complete content verification. V0 has no Policy Pack index and never moves
a mutable pack discovery tag; selection requires an explicit direct artifact
reference. `--dry-run` validates and reports plan without registry or
credential access.

`vendor policy-packs` materializes existing exact lock pins from verified
store/cache or their recorded registry repository, without resolution, upgrade,
source substitution, or lock write. Use `--offline` to forbid registry fallback
during this explicit repair.

`show policy`, `show policy-pack`, and policy listings are read-only. Machine
output exposes version, execution source (`local`, `vendor`, or `store`), artifact
repository, manifest and layer digests, content digest, plus explicit OCI
source/revision/documentation/license provenance when packaged. Optional
provenance is never synthesized. Project `.rootform/policy-packs/` is exclusive
execution source for project `check` and listings when present; store, cache,
and registry never supply fallback.

The language server is pack-less: it does not load, evaluate, or require Policy
Packs. `validate policy` and `explain policy` can inspect packs already selected
by the project, but do not accept a local `--policy-pack` authoring directory.

`package dialects` validates and compiles all supplied dialects, then writes one
deterministic local OCI layout containing dialect artifacts and generated
index. Optional `--source-url`, `--revision`, `--documentation-url`, and
`--licenses` values become explicit OCI provenance; Rootform never discovers
them from Git. Packaging performs no network operation.

`publish dialects` validates an existing packaged layout and publishes to its
recorded tagless OCI repository through standard Docker authentication.
Dialect tags derive from compiled name and version. Existing same digest is
idempotent; another digest at same version tag fails. Successful publication
requires digest repull and complete content verification. `--index` adds
immutable digest-derived index after all dialects; it never moves official
mutable discovery tag. `--dry-run` validates and reports plan without registry
or credential access. Text and JSON use `--format text|json`.

`show dialect <name>` and dialect listings are read-only. Machine output exposes
version, current execution source (`vendor` or `store`), discovery origins,
artifact repository, manifest and layer digests, semantic and presentation
digests, plus explicit OCI source/revision/documentation/license provenance
when packaged. Optional provenance is never synthesized.

When `.rootform/dialects/` exists, `build`, `check`, and `run` accept only its
complete lock-matching contents. They do not repair it or fall back elsewhere.
`vendor dialects` is explicit repair command: it materializes existing exact
lock pins from verified store/cache or their recorded registry repository,
without resolution, upgrade, source substitution, or lock write. Use
`--offline` to forbid registry fallback during this explicit repair.

Machine output goes to standard output or explicit output file. Preparation
prompts, progress, downloads, warnings, and verbose detail go to standard error,
so JSON, SARIF, HTML, and other primary outputs stay parseable. In init JSON
mode, standard output contains one JSON result. Exit status `0` means requested
claim holds, `1` means known violation or difference, `2` means invalid use,
and `3` means result is indeterminate or unavailable.
Command-specific help is authoritative:

```bash
rootform <command> --help
```
