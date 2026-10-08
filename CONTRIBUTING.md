# Contributing

This repository accepts changes to public contracts, schemas, documentation,
examples, distribution tooling, and the public CLI module under `cli/`.
Proprietary engine changes belong in the private engine repository. A change
to `cli/` reaches the Rootform binary when the engine pins the new commit.

Open an issue before changing a public wire format, command contract, release
asset convention, licensing boundary, or security behavior. Update normative
contract text and executable validation together.

Documentation follows [Writing for Rootform](docs/contributing/writing.md).
For prose, run `bun scripts/ci/run.ts docs` for metadata, navigation, and links.
`bun run check:docs` also checks generated CLI, Action and provider references.
Verify the
documented commands and outputs with `ROOTFORM_BIN` set to a
checksum-verified executable and `bun run verify:docs-examples`.

Check the CLI module with Go 1.26.7 and `bun run check:cli-module`.

Configure the publication hooks before contributing:

```sh
git config core.hooksPath .githooks
```

They validate staged files, commit messages and introduced history before
commit or push. Files remain subject to validation when tracked inside an
ignored directory. Keep private notes outside this checkout. Public pull
requests describe the change and useful validation; the default squash body
is empty.

## Pull request checks

Target `dev`. Forks use the same read-only validation jobs; GitHub may require
a maintainer to approve a first-time contributor's workflow run. No deployment
secret or private source is available to those jobs.

`Contribution impact` compares the exact base and head using the base revision
of the policy. Renames include both paths, deletions retain the old ownership,
and mixed changes select the union. Unknown or incomplete changes require full
validation. Every PR receives `Repository safety` and the required
`public repository boundary` conclusion. The conclusion fails when a needed
check fails, is cancelled or does not run. Skipped checks state why they are
not needed; a path filter never leaves the required conclusion pending.

| Change | Additional checks |
| --- | --- |
| Documentation prose, navigation or media | Documentation and rendered preview |
| Changed code blocks, commands, recipes or executable docs | Executable examples, plus Documentation for docs; changed registry recipes also run a disposable TLS registry |
| Public CLI | Public CLI module, generated references and executable examples |
| Generated CLI, Action or coverage page | Documentation, generated-reference check and rendered preview; failures include the expected output diff |
| Official Dialects or fixtures | Dialect validation/replay and generated coverage |
| Policy Packs | Policy validation and executable examples |
| Playground evidence | Executable examples and exact scenario evidence |
| Contracts, schemas or model changes | Broad compatibility, references and distribution checks |
| Installers, OCI or distribution metadata | Distribution contracts and tooling; no publication |
| Workflows, generators, common dependencies or unclassified tooling | Full validation |

Runtime checks use the published, checksum-pinned reference executable in
`dependencies/verification-runtime.json`. They prove compatibility with that
runtime, not a new binary release. Current Playground Forms retain their generator
version and digest; the reference examples are replayed separately from
`scripts/fixtures/reference-playground`. When changing their source inputs, regenerate
both sets with their recorded runtimes. Candidate qualification replays the current
Forms using the exact candidate executable. CLI module tests also exercise the proposed
Go source directly. Changed registry publication recipes receive a separate,
targeted TLS registry qualification without credentials or remote publication.

Documentation previews use an approved shell and the PR's exact public content
SHA. Only validated Markdown and assets enter the build. MDX, scripts, unsafe
HTML/frontmatter and symlinks fail preview validation. Public PR feedback is one
updated comment: current checks, preview, and downstream integration progress.
Failures link to public checks or identify the content error, never private logs.
Superseded commit results cannot replace the latest commit's feedback.

After merge, documentation advances staging independently from scenarios and
runtime consumers. CLI, Dialect and contract changes receive separate consumer
compatibility checks. Integration into `dev` does not publish a production site,
binary, image or package. A failed downstream check remains visible on the
public contribution.

A stage that stops progressing ends its check as timed out. A maintainer
resumes it by commenting `/rootform retry` on the PR, also after fixing a
downstream failure. Delivery then continues on a new `Contribution delivery`
check while the earlier one stays in the history. A retry never turns a failed
build into a success; the build itself must run again.

## Branches and promotion

`dev` integrates contributions and is the default branch. `main` holds the
promoted history that releases are cut from. It only fast-forwards to a `dev`
commit that already passed the checks above.

A maintainer promotes by opening a pull request from `dev` into `main`. It runs
the same checks on the exact `dev` commit, selected from the changes between
`main` and `dev`, and `Repository safety` rejects any other source branch or
a history that cannot fast-forward. Once `public repository boundary` passes,
the `promote` workflow, dispatched with the pull request number, verifies that
result on the exact head again and fast-forwards `main` to it. GitHub then
marks the pull request merged. Promotion publishes nothing, and no check runs
again after the push.

Fixes, including urgent ones, land on `dev` and are promoted the same way, so
`main` never needs to be merged back into `dev`. When unreleased work on `dev`
must not ship, revert it on `dev` before promoting.

## Releases

This repository names every release of the Rootform binary. A `main` commit
requests one when its `package.json` names an unpublished version,
`CHANGELOG.md` has entries under that version, and the documentation names it.
`public-export.json` names the Engine commit that builds the binary. When
Engine promotes, it opens the pull request that moves this pin and adds the
public changes it brings to `Unreleased`.

To request a release, run on a branch from `dev`:

```bash
bun scripts/prepare-release.ts 0.2.0
```

It sets the version, moves the `Unreleased` entries under it, and points the
documentation at the release tag. Open the result as a pull request into
`dev`, then promote it. `bun scripts/prepare-release.ts --check` prints the
request a commit makes, or names what it lacks. A tag of a deleted immutable
release cannot name another release, so `v0.1.0-dev.2`, `v0.1.0`, and
`v0.1.1` are refused.

A maintainer then starts the release handoff for that `main` commit. It
builds the requested version from the pinned Engine commit, attaches it to a
handoff draft, and starts the `candidate` workflow on `main`. The candidate
assembles the archives, image, and installers, qualifies them on every
supported platform, and leaves a draft release. A failed job resumes with
"Re-run failed jobs"; a new handoff for the same version replaces the draft.
The `publish` workflow, dispatched with the version, publishes that draft only
when a successful candidate run recorded its exact assets, then publishes the
official image with the platform digests that run qualified. Nothing is
published before that dispatch.

Official Dialects ship inside the release. Policy Packs carry their own
versions: `publish-policy-packs` publishes the packs on `main` with a
published stable release, and keeps a tag already present with the same
bytes. The GitHub Action is released from its own repository.

## Local qualification

For the complete gate, set `ROOTFORM_BIN` to the verified executable, then run:

```bash
bun install --frozen-lockfile
bun run verify
```

The project selection lifecycle has a separate qualification against a live
OCI Distribution registry. Start a registry that serves TLS with a CA you
control, accepts anonymous pushes, and writes its access log to a file. Then
run:

```bash
bun run test:selection-e2e --rootform-bin /path/to/rootform   --registry 127.0.0.1:5443 --ca-file ca.crt   --registry-log registry.log --evidence selection-evidence.json
```

It publishes test Dialects and Policy Packs under a fresh repository prefix,
runs every scenario in temporary projects and Rootform homes, and fails when a
command that must not use the network appears in the access log. It is not
part of `bun run verify`.

`bun run verify` executes every marked documentation command except the ones
that publish to or pull from a registry, and fails when a marked command runs
nowhere. Run the registry examples against the same kind of registry:

```bash
bun run test:docs-registry --rootform-bin /path/to/rootform --registry 127.0.0.1:5443 --ca-file ca.crt
```

It replaces the illustrative registry host in each example with a fresh
repository prefix on that registry, then publishes, installs, selects, and
updates the documented Dialect and Policy Pack.

The selected CI check starts and removes its own loopback-only registry. To run
the same qualification locally with Docker and OpenSSL installed:

```bash
bun scripts/ci/run.ts registry
```

Contributions to repository material covered by the root `LICENSE` follow
Apache-2.0, as do contributions under `cli/` with its own copy of that
license. Contributions under `dialects/` follow its own MPL-2.0
`dialects/LICENSE`. Do not submit private infrastructure, state, plans,
credentials, customer data, prompts, transcripts, or material you lack rights
to distribute.
