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
download of artifacts already pinned by lock. JSON output implies no input.
`ROOTFORM_INPUT=0` and `CI=true` imply no input; CI does not imply offline.
`ROOTFORM_OFFLINE=1` implies offline. `ROOTFORM_HOME=<path>` replaces default
home entirely.

Interactive init shows proposed dialects, versions, dependencies, sizes, and
changes before confirmation. An ambiguous official match requires explicit
choice. No-input mode applies only unique deterministic recommendations and
fails rather than guess. Unknown provider version permits compatible dialect
use with warning; reliable incompatible evidence blocks that candidate.
Providers with no official dialect remain explicitly uncovered without
fabricating a selection.

Primary commands:

```text
rootform build <directory>             canonical Architecture IR
rootform build <directory> --format html --output architecture.html
rootform check <directory-or-document> policy evaluation
rootform diff <base> <head>             architecture comparison
rootform run <directory>                local browser explorer
rootform explain <document>             provenance explanation
```

Dialect authoring and local package management:

```text
rootform fmt [directory] --check
rootform validate dialects <directory>
rootform test <fixtures>
rootform install dialects <directory>
rootform lock dialects <directory>
rootform verify dialects <directory>
rootform vendor dialects
```

Machine output goes to standard output or explicit output file. Diagnostics go
to standard error. In init JSON mode, standard output contains one JSON result;
warnings and verbose detail remain on standard error. Exit status `0` means
requested claim holds, `1` means known violation or difference, `2` means
invalid use, and `3` means result is indeterminate or unavailable.
Command-specific help is authoritative:

```bash
rootform <command> --help
```
