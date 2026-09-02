# CLI reference

Project initialization:

```text
rootform init [path]
```

Path defaults to literal `.` and is both project root and Terraform/OpenTofu
root. Initialization discovers providers from source, uses only compatible
version evidence from `.terraform.lock.hcl`, resolves official non-ambiguous
dialects and dependencies, installs missing exact artifacts, and writes
`rootform.lock`.

Initialization flags:

```text
--locked     require an existing lock and never modify it
--offline    forbid every network access
--upgrade    allow newer compatible dialect versions
--no-input   forbid prompts and interactive choices
-v, --verbose
             show provider evidence, dialect compatibility, and origin
--format text|json
             select human or deterministic machine output
```

`--locked` and `--upgrade` are incompatible. `--locked` still permits exact
download of artifacts already pinned by lock, from each pin's own OCI
repository and manifest digest, without reading official index. JSON output
implies no input.
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

Interactive init shows proposed dialects, versions, dependencies, sizes, and
changes before confirmation. An ambiguous official match requires explicit
choice. No-input mode applies only unique deterministic recommendations and
fails rather than guess. Unknown provider version permits compatible dialect
use with warning; reliable incompatible evidence blocks that candidate.
Providers with no official dialect remain explicitly uncovered without
fabricating a selection.

Primary commands:

```text
rootform build [directory]             canonical Architecture IR
rootform build [directory] --format html --output architecture.html
rootform check [directory-or-document] policy evaluation
rootform diff <base> <head>             architecture comparison
rootform run [directory]                local browser explorer
rootform explain <document>             provenance explanation
```

Directory forms of `build`, `check`, and `run` call same project-preparation
service before compilation. They accept `--locked`, `--offline`, `--no-input`,
and `-v`/`--verbose`; `--upgrade` remains init-only. A coherent local lock is a
silent zero-network path. Missing exact locked artifacts may be installed
without changing lock. With no lock, unique no-input recommendations may create
one and command resumes in same process. A normal no-input command never changes
existing lock: run exact reported `rootform init [path] --no-input`, then commit
updated lock. Interactive normal commands show complete proposal and require
confirmation before lock or vendor change.

`--offline` forbids network for both explicit init and implicit preparation.
`--locked` requires existing lock and preserves bytes while still permitting
exact artifact recovery unless offline. Project `.rootform/dialects/` remains
exclusive: installed store is never fallback. Reliable incompatible provider
version evidence blocks compilation; unknown or stale version evidence warns and
recommends `terraform init` or `tofu init`. Provider without official dialect is
reported explicitly and remains unsupported.

Dialect authoring and local package management:

```text
rootform fmt [directory] --check
rootform validate dialects <directory>
rootform test <fixtures>
rootform install dialects <directory>
rootform lock dialects <directory>
rootform verify dialects <directory>
rootform vendor dialects
rootform list dialects --installed
rootform list dialects --outdated
rootform init . --upgrade
rootform remove dialect <name> <version>
```

Listings never contact network or mutate project. `--outdated` uses cached
official index snapshot and names missing cache instead of guessing. Upgrade
stays explicit through `init --upgrade`; removed selections remain installed
until exact `remove dialect` command is requested.

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
