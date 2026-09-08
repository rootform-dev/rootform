# CLI reference inputs

`cli.json` arrives through the verified public export. It describes the real
Cobra command tree: public commands, usage, aliases, examples, local flags,
inherited flags and defaults. It contains no command handlers or application
source. Do not edit it by hand.

After importing an updated export, run:

```sh
bun run generate:cli
bun run check:docs
```

The generator owns command pages under `docs/reference/cli/` and the Commands
subtree in the existing navigation. The build page retains its authored
explanation outside a delimited generated usage/flags block. Tutorials and
concepts remain authored pages.

`check:cli` compares the generated result without changing files and runs in
the ordinary repository gate. Generator tests cover malformed metadata,
command-tree integrity and inherited flag handling.

## Executable verification

`verification.json` records the executable edition used for the checked
examples, its version and SHA-256, and the exact reference input digest. A
documentation verification build may include changes beyond the published
release with the same version string. It is evidence of the tested edition,
not an instruction to download an unpublished binary.

Supply a verified opaque executable to run examples:

```sh
ROOTFORM_BIN=/absolute/path/to/rootform bun run verify:docs-examples
```

The verifier runs commands in isolated temporary directories, compares every
public command's help flags with `cli.json`, and executes marked documentation
fences. It checks observed output, failure statuses, deterministic architecture
and Diff bytes, policy coverage, plan input boundaries, and offline/vendor
reproduction. The repository gate invokes this verifier as well.

The recorded binary digest identifies the baseline; verification also accepts
another platform's binary or a candidate update. Its version and actual
behavior must satisfy the checked reference and examples. Update the evidence
metadata deliberately when accepting a new baseline. Do not update expected
results merely to silence a failure.
