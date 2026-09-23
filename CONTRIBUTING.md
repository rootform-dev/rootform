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

Contributions to repository material covered by the root `LICENSE` follow
Apache-2.0. Contributions under `dialects/` follow its own MPL-2.0
`dialects/LICENSE`. Do not submit private infrastructure, state, plans,
credentials, customer data, prompts, transcripts, or material you lack rights
to distribute.
