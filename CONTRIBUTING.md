# Contributing

This repository accepts changes to public contracts, schemas, documentation,
examples, and distribution tooling. Proprietary engine changes belong in the
private engine repository.

Open an issue before changing a public wire format, command contract, release
asset convention, licensing boundary, or security behavior. Update normative
contract text and executable validation together.

Documentation follows [Writing for Rootform](docs/contributing/writing.md).
Run `bun run check:docs` for metadata, navigation, and links. Verify the
first-architecture example with `ROOTFORM_BIN` set to a checksum-verified
executable and `bun run verify:docs-examples`.

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

Contributions to repository material covered by the root `LICENSE` follow
Apache-2.0. Contributions under `dialects/` follow its own MPL-2.0
`dialects/LICENSE`. Do not submit private infrastructure, state, plans,
credentials, customer data, prompts, transcripts, or material you lack rights
to distribute.
