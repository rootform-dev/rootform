package cli_test

import (
	"context"
	"net"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"

	"github.com/rootform-dev/rootform/cli"
	"github.com/rootform-dev/rootform/cli/backend"
	"github.com/rootform-dev/rootform/cli/backend/backendtest"
	"github.com/rootform-dev/rootform/cli/form"
)

func expectTechnicalError(t *testing.T, exit int, stdout, stderr string, wantExit int, headline, code string) {
	t.Helper()
	if exit != wantExit || stdout != "" || !strings.Contains(stderr, "Error: "+headline+"\n") ||
		!strings.HasSuffix(stderr, "\nCode: "+code+"\n") || strings.Contains(stderr, "rootform: "+code+":") {
		t.Fatalf("exit %d, stdout %q, stderr %q", exit, stdout, stderr)
	}
}

func TestTechnicalBackendErrorsStateCauseFirst(t *testing.T) {
	plan := write(t, "plan.json", planExport)
	for _, tc := range []struct {
		name, code, message, human, detail string
	}{
		{"missing lock", "SEMANTIC_SELECTION", "SEMANTIC_SELECTION: the selected Dialects could not be loaded (rootform.lock is required by --locked)",
			"rootform.lock is required by --locked", "Create rootform.lock first, or run without --locked."},
		{"pair mismatch", "PLAN_PAIR_MISMATCH", "PLAN_PAIR_MISMATCH: saved plan refused; --require-enrichment requires a saved plan that pairs with the plan JSON",
			"saved plan does not match the plan JSON", "--require-enrichment needs a verified pairing.\n\nRe-export the JSON from the same saved plan:\n  terraform show -json plan.tfplan > plan.json"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			fake := &backendtest.Fake{CompileFunc: func(context.Context, backend.Selection, backend.Export) (backend.Compiled, error) {
				return backend.Compiled{}, &backend.Error{Kind: backend.NoAnswer, Code: tc.code, Message: tc.message, Human: tc.human, Detail: tc.detail}
			}}
			args := []string{"run", plan, "--no-serve", "--require-enrichment"}
			if tc.name == "missing lock" {
				args = []string{"run", plan, "--no-serve", "--locked"}
			}
			exit, stdout, stderr := invoke(t, cli.Env{Backend: fake}, args...)
			expectTechnicalError(t, exit, stdout, stderr, 3, tc.human, tc.code)
			if !strings.Contains(stderr, tc.detail) || strings.Contains(stderr, tc.message) {
				t.Fatalf("guidance or hierarchy lost: %q", stderr)
			}
		})
	}
}

func TestDefinitionErrorsKeepSelectionCauseAndCode(t *testing.T) {
	for _, kind := range []backend.Kind{backend.NoAnswer, backend.Failure} {
		fake := &backendtest.Fake{DefinitionsFunc: func(context.Context, backend.Selection) (backend.Definitions, error) {
			return backend.Definitions{}, &backend.Error{
				Kind: kind, Code: "SELECTION_LOCK_INVALID", Message: "rootform.lock is invalid",
				Human: "rootform.lock is invalid", Detail: "Expected strict JSON with known fields and no duplicates",
			}
		}}
		for _, args := range [][]string{{"list", "dialects"}, {"show", "aws"}} {
			for _, format := range []string{"text", "json"} {
				exit, stdout, stderr := invoke(t, cli.Env{Backend: fake}, append(args, "--format", format)...)
				wantExit := 3
				if kind == backend.Failure {
					wantExit = 4
				}
				expectTechnicalError(t, exit, stdout, stderr, wantExit, "rootform.lock is invalid", "SELECTION_LOCK_INVALID")
				if !strings.Contains(stderr, "Expected strict JSON with known fields and no duplicates") {
					t.Fatalf("lock guidance lost: %q", stderr)
				}
			}
		}
	}
}

func TestTechnicalInputErrorsKeepExistingGuidance(t *testing.T) {
	archive := write(t, "plan.tfplan", []byte("PK\x03\x04safe test fixture"))
	exit, stdout, stderr := invoke(t, cli.Env{Backend: &backendtest.Fake{}}, "run", archive, "--no-serve")
	expectTechnicalError(t, exit, stdout, stderr, 3, "this input looks like a saved plan", "INPUT_UNRECOGNIZED")
	want := "A saved plan is read with --plan-file, next to the plan JSON exported from it.\n\nTry:\n  terraform show -json plan.tfplan > plan.json\n  rootform run plan.json --plan-file plan.tfplan"
	if !strings.Contains(stderr, want) {
		t.Fatalf("saved-plan guidance changed: %q", stderr)
	}

	invalid := write(t, "broken.json", []byte(`{"format_version":`))
	exit, stdout, stderr = invoke(t, cli.Env{Backend: &backendtest.Fake{}}, "run", invalid, "--no-serve")
	expectTechnicalError(t, exit, stdout, stderr, 3, "this input is not valid JSON", "INPUT_UNRECOGNIZED")

	formBytes := strings.Replace(string(fixture(t, "plan.json")), `"format_version": "1"`, `"format_version": "9"`, 1)
	if formBytes == string(fixture(t, "plan.json")) {
		t.Fatal("Form fixture has no format_version")
	}
	unsupported := write(t, "form.json", []byte(formBytes))
	exit, stdout, stderr = invoke(t, cli.Env{Backend: &backendtest.Fake{}}, "run", unsupported, "--no-serve")
	expectTechnicalError(t, exit, stdout, stderr, 3,
		`document format "9" is not supported; this build reads format 1`, "DOCUMENT_FORMAT_UNSUPPORTED")
}

func TestTechnicalStageAndFilesystemErrors(t *testing.T) {
	fake := &backendtest.Fake{}
	state := write(t, "form.json", fixture(t, "state.json"))
	exit, stdout, stderr := invoke(t, cli.Env{Backend: fake}, "run", state, "--stage", "planned", "--no-serve")
	expectTechnicalError(t, exit, stdout, stderr, 3, "this input has no Planned stage", "STAGE_UNAVAILABLE")
	if !strings.Contains(stderr, "Available: Recorded") {
		t.Fatalf("available stages lost: %q", stderr)
	}

	missing := filepath.Join(t.TempDir(), "missing.json")
	exit, stdout, stderr = invoke(t, cli.Env{Backend: fake}, "run", missing, "--no-serve")
	expectTechnicalError(t, exit, stdout, stderr, 4, "cannot read \""+missing+"\"", "INPUT_UNREADABLE")
	if !strings.Contains(stderr, "file does not exist") {
		t.Fatalf("filesystem cause lost: %q", stderr)
	}

	output := filepath.Join(t.TempDir(), "missing-directory", "form.json")
	exit, stdout, stderr = invoke(t, cli.Env{Backend: fake}, "run", state, "--no-serve", "-o", output)
	if !strings.HasPrefix(stdout, "Form loaded\n") {
		t.Fatalf("stdout changed after failed file output: %q", stdout)
	}
	expectTechnicalError(t, exit, "", stderr, 4, "cannot write \""+output+"\"", "OUTPUT_FAILED")
}

func TestUnexpectedBackendErrorKeepsSafeFallback(t *testing.T) {
	plan := write(t, "plan.json", planExport)
	fake := &backendtest.Fake{CompileFunc: func(context.Context, backend.Selection, backend.Export) (backend.Compiled, error) {
		return backend.Compiled{}, os.ErrPermission
	}}
	exit, stdout, stderr := invoke(t, cli.Env{Backend: fake}, "run", plan, "--no-serve")
	expectTechnicalError(t, exit, stdout, stderr, 3, "the input could not be analyzed", "INPUT_INVALID")
	if strings.Contains(stderr, "permission") {
		t.Fatalf("unstructured backend detail leaked: %q", stderr)
	}
}

func TestOccupiedExplorerPortKeepsUsefulAdvice(t *testing.T) {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = listener.Close() })
	port := listener.Addr().(*net.TCPAddr).Port
	state := write(t, "form.json", fixture(t, "state.json"))
	fake := &backendtest.Fake{PresentationFunc: func(context.Context, backend.Selection, *form.InputForm) backend.Presentation {
		return backend.Presentation{Catalog: []byte("{}")}
	}}
	exit, stdout, stderr := invoke(t, cli.Env{Backend: fake},
		"run", state, "--port", strconv.Itoa(port), "--no-browser")
	if !strings.HasPrefix(stdout, "Form loaded\n") {
		t.Fatalf("stdout changed: %q", stdout)
	}
	expectTechnicalError(t, exit, "", stderr, 4, "port "+strconv.Itoa(port)+" is unavailable", "SERVER_FAILED")
	if !strings.Contains(stderr, "Pass --port 0 to pick a free port, or --no-serve.") {
		t.Fatalf("port guidance lost: %q", stderr)
	}
}
