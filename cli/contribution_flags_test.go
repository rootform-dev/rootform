package cli_test

import (
	"context"
	"strings"
	"testing"

	"github.com/rootform-dev/rootform/cli"
	"github.com/rootform-dev/rootform/cli/backend"
	"github.com/rootform-dev/rootform/cli/backend/backendtest"
)

func TestRetiredOfflineFlagStopsBeforeBackend(t *testing.T) {
	plan := write(t, "plan.json", planExport)
	fake := &backendtest.Fake{CompileFunc: func(context.Context, backend.Selection, backend.Export) (backend.Compiled, error) {
		t.Fatal("invalid flags must not invoke the backend")
		return backend.Compiled{}, nil
	}}
	exit, stdout, stderr := invoke(t, cli.Env{Backend: fake}, "run", plan, "--no-serve", "--offline")
	if exit != 2 || stdout != "" || !strings.Contains(stderr, "unknown flag: --offline") {
		t.Fatalf("exit=%d stdout=%q stderr=%q", exit, stdout, stderr)
	}
}
