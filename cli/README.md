# Rootform CLI module

`github.com/rootform-dev/rootform/cli` is the public Go module of the Rootform
command line. It holds the Form and Policy result models, input detection, and
the generators of the Form and Policy result schemas. The Rootform binary is
built from a private engine that pins one commit of this repository for both
this module and the official Dialects.

The module makes no compatibility promise yet: its version is the commit the
engine pins.

## Check

With Go 1.26.7, from this directory:

```bash
GOWORK=off go test ./...
```

From the repository root, `bun run check:cli-module` runs the same checks with
the pinned toolchain, gofmt, vet and the schema freshness checks.

After changing a model, regenerate the committed schemas from this directory:

```bash
go run ./internal/architecture/document/schema/cmd -write
go run ./internal/policy/schema/cmd -write
```

## License

Apache-2.0. See [LICENSE](LICENSE).
