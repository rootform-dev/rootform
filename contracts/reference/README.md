# Generated reference data

| File | Source |
| --- | --- |
| `cli.json` | Public Go command tree, flags and help |
| `github-actions.json` | GitHub Action inputs and outputs |
| `verification.json` | Executable version, digest and checked reference input |

Do not hand-edit generated metadata. After changing the command tree, run from
the repository root:

```sh
(cd cli && go run ./internal/clireference/cmd -write)
bun run generate:cli
bun run check:docs
```

The CLI generator owns command pages in `docs/reference/cli/` and their navigation.
`bun run check:cli-module` checks Go output freshness; `bun run check:cli` checks
rendered references. Authored tutorials and concepts remain separate.

## Verify examples

```sh
ROOTFORM_BIN=/absolute/path/to/rootform bun run verify:docs-examples
```

The verifier runs marked commands in isolated directories and checks output,
exit status, deterministic Forms, Policy coverage and offline reproduction.
`verification.json` identifies the tested edition, not a download instruction.
Another platform or candidate binary must satisfy the same reference and examples.
