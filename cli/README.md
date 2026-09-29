# Rootform CLI module

`github.com/rootform-dev/rootform/cli` is the public Go module of the Rootform
command line: its commands, flags, help, completions, argument checks, exit
statuses, human and machine reports, the loopback explorer server and the HTML
export. It also holds the Form and Policy result models, input detection, and
the generators of the Form and Policy result schemas and of the CLI reference.

A program runs the command line by building one `cli.Env` with its streams,
arguments and a backend, and calling `cli.Run` once. The backend implements
the ports of `cli/backend`: compiling a plan or state export into a Form,
comparing two Forms, presenting a Form and loading and evaluating Policy
Packs. `cli/backend/backendtest` provides a scriptable fake backend and the
conformance suite every backend passes.

The Rootform binary is built from a private engine that implements the
backend and pins one commit of this repository for both this module and the
official Dialects.

The module makes no compatibility promise yet: its version is the commit the
engine pins.

## Check

With Go 1.26.7, from this directory:

```bash
GOWORK=off go test ./...
```

From the repository root, `bun run check:cli-module` runs the same checks with
the pinned toolchain, gofmt, vet and the schema and CLI reference freshness
checks.

After changing a model or a command, regenerate the committed schemas and the
CLI reference from this directory:

```bash
go run ./internal/architecture/document/schema/cmd -write
go run ./internal/policy/schema/cmd -write
go run ./internal/clireference/cmd -write
```

## License

Apache-2.0. See [LICENSE](LICENSE).
