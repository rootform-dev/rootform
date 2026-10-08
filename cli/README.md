# Rootform CLI module

`github.com/rootform-dev/rootform/cli` provides Rootform's Go command surface:
commands, flags, help, reports, exit statuses, the loopback Explorer server and
HTML export. It also owns the Form and Policy result models and their schema
generators.

Call `cli.Run` with a `cli.Env` containing arguments, streams and a backend.
Implement `cli/backend` for compilation, comparison, presentation and Policy
evaluation. `cli/backend/backendtest` provides a fake backend and conformance
tests. The distributed Rootform executable supplies that backend.

Consumers pin an exact repository commit. The module makes no compatibility
promise yet.

## Validate

With Go 1.26.7, from this directory:

```bash
GOWORK=off go test ./...
```

From the repository root, `bun run check:cli-module` also runs gofmt, vet and
schema and CLI reference freshness checks with the pinned toolchain.

After changing a model or command, regenerate from this directory:

```bash
go run ./internal/architecture/document/schema/cmd -write
go run ./internal/policy/schema/cmd -write
go run ./internal/clireference/cmd -write
```

See [contributor setup](../docs/contributing/index.md) and
[public contracts](../contracts/README.md). License: [Apache-2.0](LICENSE).
