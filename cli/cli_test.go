package cli_test

import (
	"bytes"
	"context"
	"errors"
	"io"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/rootform-dev/rootform/cli"
	"github.com/rootform-dev/rootform/cli/backend"
	"github.com/rootform-dev/rootform/cli/backend/backendtest"
	"github.com/rootform-dev/rootform/cli/form"
	"github.com/rootform-dev/rootform/cli/internal/document"
	"github.com/rootform-dev/rootform/cli/internal/export"
	"github.com/rootform-dev/rootform/cli/policyresult"
)

// planExport is a plan JSON the fake compiles to the plan Form fixture.
var planExport = []byte(`{"format_version":"1.2","terraform_version":"1.9.0","planned_values":{},"configuration":{}}`)

// invoke runs one command line with plain streams and returns its exit
// status, standard output and standard error.
func invoke(t *testing.T, env cli.Env, args ...string) (int, string, string) {
	t.Helper()
	var out, errb bytes.Buffer
	env.Stdout, env.Stderr, env.Args = &out, &errb, args
	if env.Version == "" {
		env.Version = "0.1.0"
	}
	code := cli.Run(env)
	return code, out.String(), errb.String()
}

func fixture(t *testing.T, name string) []byte {
	t.Helper()
	data, err := os.ReadFile(filepath.Join("form", "testdata", name))
	if err != nil {
		t.Fatal(err)
	}
	return data
}

func fixtureForm(t *testing.T, name string) form.Form {
	t.Helper()
	decoded, err := form.Decode(fixture(t, name))
	if err != nil {
		t.Fatal(err)
	}
	return decoded
}

func write(t *testing.T, name string, data []byte) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), name)
	if err := os.WriteFile(path, data, 0o600); err != nil {
		t.Fatal(err)
	}
	return path
}

// oversized writes a sparse document one byte past the ceiling.
func oversized(t *testing.T, name string) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), name)
	file, err := os.Create(path)
	if err != nil {
		t.Fatal(err)
	}
	defer file.Close()
	if err := file.Truncate(document.MaxBytes + 1); err != nil {
		t.Fatal(err)
	}
	return path
}

// compilesThePlan compiles planExport to the plan Form fixture.
func compilesThePlan(t *testing.T) func(context.Context, backend.Selection, backend.Export) (backend.Compiled, error) {
	planForm := fixtureForm(t, "plan.json")
	return func(_ context.Context, _ backend.Selection, export backend.Export) (backend.Compiled, error) {
		if !bytes.Equal(export.Data, planExport) {
			return backend.Compiled{}, &backend.Error{Kind: backend.NoAnswer, Message: "INPUT_INVALID: the input could not be analyzed"}
		}
		return backend.Compiled{Form: planForm.Input, Enrichment: form.SnapshotEnrichment{Status: form.SnapshotAbsent}}, nil
	}
}

// onePack is a Policy set with one pack whose Policies all pass.
func onePack(context.Context, backend.Selection, []string) (backend.PolicySet, error) {
	return backendtest.PolicySet{
		PackList: []backend.Pack{{Record: policyresult.PolicyPack{ID: "checks", Version: "0.1.0"}, Policies: []string{"checks.policy.always"}}},
		EvaluateFunc: func(_ context.Context, _ *form.InputForm, _ form.Stage, selected []string) policyresult.Architecture {
			return policyresult.NewArchitecture(len(selected)).Finalized()
		},
	}, nil
}

// A saved Form reopens as it was saved: run and check never send it to the
// backend to compile.
func TestSavedFormNeverReachesTheCompiler(t *testing.T) {
	saved := write(t, "form.json", fixture(t, "plan.json"))
	fake := &backendtest.Fake{PoliciesFunc: onePack}
	if code, _, errb := invoke(t, cli.Env{Backend: fake}, "run", saved, "--no-serve"); code != 0 || !strings.Contains(errb, "(saved Form; no recompilation)") {
		t.Fatalf("run: exit %d %s", code, errb)
	}
	if code, out, errb := invoke(t, cli.Env{Backend: fake}, "check", saved); !strings.HasPrefix(out, "Policy check completed\n") || !strings.Contains(errb, "(saved Form; no recompilation)") {
		t.Fatalf("check: exit %d %s%s", code, out, errb)
	}
	if exports := fake.Exports(); len(exports) != 0 {
		t.Fatalf("a saved Form was compiled: %+v", exports)
	}
}

// A backend failure keeps the exit status of its kind and is printed as the
// backend sanitized it; an error outside the contract never leaks its text.
func TestBackendFailuresKeepTheirExitStatus(t *testing.T) {
	plan := write(t, "plan.json", planExport)
	for _, c := range []struct {
		err  error
		exit int
		line string
	}{
		{&backend.Error{Kind: backend.NoAnswer, Message: "PLAN_ERRORED: the plan JSON records that planning failed"}, 3, "rootform: PLAN_ERRORED: the plan JSON records that planning failed\n"},
		{&backend.Error{Kind: backend.Failure, Message: "SEMANTIC_SELECTION: the selected Dialects could not be loaded (selection failed)"}, 4, "rootform: SEMANTIC_SELECTION: the selected Dialects could not be loaded (selection failed)\n"},
		{&backend.Error{Kind: backend.Negative, Message: "INPUT_INVALID: the input could not be analyzed"}, 1, "rootform: INPUT_INVALID: the input could not be analyzed\n"},
		{&backend.Error{Kind: backend.Usage, Message: "--plan-file requires plan JSON"}, 2, "rootform: --plan-file requires plan JSON\n"},
		{errors.New("open /private/project/secret.tfvars: denied"), 3, "rootform: INPUT_INVALID: the input could not be analyzed\n"},
	} {
		fake := &backendtest.Fake{CompileFunc: func(context.Context, backend.Selection, backend.Export) (backend.Compiled, error) {
			return backend.Compiled{}, c.err
		}}
		code, out, errb := invoke(t, cli.Env{Backend: fake}, "run", plan, "--no-serve")
		if code != c.exit || out != "" || !strings.HasSuffix(errb, c.line) || strings.Contains(errb, "secret") {
			t.Fatalf("%v: exit %d, stdout %q, stderr %q", c.err, code, out, errb)
		}
	}
}

// The presentation warnings of the backend reach standard error, and the
// compiled Form reaches every output.
func TestRunStatesThePresentationWarnings(t *testing.T) {
	fake := &backendtest.Fake{
		CompileFunc: compilesThePlan(t),
		PresentationFunc: func(context.Context, backend.Selection, *form.InputForm) backend.Presentation {
			return backend.Presentation{Catalog: []byte("{}"), Warnings: []string{"the presentation of fixture 0.1.0 is incomplete"}}
		},
	}
	saved := filepath.Join(t.TempDir(), "form.json")
	code, _, errb := invoke(t, cli.Env{Backend: fake}, "run", write(t, "plan.json", planExport), "--no-serve", "-o", saved)
	if code != 0 || !strings.Contains(errb, "warning the presentation of fixture 0.1.0 is incomplete\n") {
		t.Fatalf("exit %d: %s", code, errb)
	}
	if exports := fake.Exports(); len(exports) != 1 || exports[0].Producer != "" {
		t.Fatalf("exports = %+v", exports)
	}
	data, err := os.ReadFile(saved)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := form.Decode(data); err != nil {
		t.Fatalf("the saved Form does not decode: %v", err)
	}
}

// An HTML export fills the renderer page with the display copy and the
// presentation catalog of the backend.
func TestRunFillsTheRendererPage(t *testing.T) {
	shell := []byte("<!doctype html><html><head>" + export.Placeholder + export.PresentationPlaceholder + "</head><body></body></html>")
	fake := &backendtest.Fake{PresentationFunc: func(context.Context, backend.Selection, *form.InputForm) backend.Presentation {
		return backend.Presentation{Catalog: []byte(`{"presented":true}`)}
	}}
	page := filepath.Join(t.TempDir(), "a.html")
	code, _, errb := invoke(t, cli.Env{Backend: fake, ExportShell: shell}, "run", write(t, "form.json", fixture(t, "plan.json")), "--no-serve", "-o", page)
	if code != 0 {
		t.Fatalf("html with a renderer: %d %s", code, errb)
	}
	html, err := os.ReadFile(page)
	if err != nil {
		t.Fatal(err)
	}
	if bytes.Contains(html, []byte(export.Placeholder)) || bytes.Contains(html, []byte(export.PresentationPlaceholder)) ||
		bytes.Count(html, []byte("</script>")) != 2 || !bytes.Contains(html, []byte(`{"presented":true}`)) {
		t.Fatalf("the page does not carry the document and its presentation:\n%.400s", html)
	}
}

// check loads the Policies before its input: a selection failure stops it
// with the failure's own exit status and code, and the input is never
// compiled.
func TestCheckStopsWhenThePoliciesCannotLoad(t *testing.T) {
	fake := &backendtest.Fake{
		CompileFunc: compilesThePlan(t),
		PoliciesFunc: func(context.Context, backend.Selection, []string) (backend.PolicySet, error) {
			return nil, &backend.Error{Kind: backend.Failure, Code: "SELECTION_PROJECT_UNREADABLE", Message: "rootform.lock could not be read: permission denied"}
		},
	}
	result := filepath.Join(t.TempDir(), "result.json")
	code, out, errb := invoke(t, cli.Env{Backend: fake}, "check", write(t, "plan.json", planExport), "-o", result)
	if code != 4 || out != "" || !strings.Contains(errb, "SELECTION_PROJECT_UNREADABLE") || !strings.Contains(errb, "rootform.lock could not be read: permission denied") {
		t.Fatalf("exit %d, stdout %q, stderr %q", code, out, errb)
	}
	if exports := fake.Exports(); len(exports) != 0 {
		t.Fatalf("the input was compiled after the selection failed: %+v", exports)
	}
	data, err := os.ReadFile(result)
	if err != nil {
		t.Fatal(err)
	}
	decoded, err := policyresult.Decode(data)
	if err != nil || decoded.Status != policyresult.StatusFailed || decoded.Diagnostics[0].Code != "SELECTION_PROJECT_UNREADABLE" {
		t.Fatalf("result: %+v %v", decoded, err)
	}
}

// A selection without a Policy Pack leaves check without an answer.
func TestCheckWithoutAPolicyPackHasNoAnswer(t *testing.T) {
	fake := &backendtest.Fake{}
	code, out, errb := invoke(t, cli.Env{Backend: fake}, "check", write(t, "form.json", fixture(t, "plan.json")))
	if code != 3 || out != "" || !strings.Contains(errb, "POLICY_UNAVAILABLE: no Policy Pack is selected") {
		t.Fatalf("exit %d, stdout %q, stderr %q", code, out, errb)
	}
}

// spaces is an endless stream of JSON whitespace.
type spaces struct{}

func (spaces) Read(p []byte) (int, error) {
	for i := range p {
		p[i] = ' '
	}
	return len(p), nil
}

// A plan, state or Form past the ceiling is refused, from a file or from
// standard input, before anything reaches the backend; validate form reports
// the refusal as a failed validation.
func TestInputsPastTheCeilingAreRefused(t *testing.T) {
	fake := &backendtest.Fake{CompileFunc: compilesThePlan(t), PoliciesFunc: onePack}
	for _, c := range []struct {
		name  string
		stdin io.Reader
		args  []string
		exit  int
	}{
		{"run file", nil, []string{"run", oversized(t, "plan.json"), "--no-serve"}, 3},
		{"run stream", io.LimitReader(spaces{}, document.MaxBytes+1), []string{"run", "-", "--no-serve"}, 3},
		{"check file", nil, []string{"check", oversized(t, "form.json")}, 3},
		{"explain file", nil, []string{"explain", "instance", "local_file.a", "--input", oversized(t, "plan.json")}, 3},
		{"validate form file", nil, []string{"validate", "form", oversized(t, "form.json")}, 4},
	} {
		t.Run(c.name, func(t *testing.T) {
			code, out, errb := invoke(t, cli.Env{Backend: fake, Stdin: c.stdin}, c.args...)
			if code != c.exit || out != "" || !strings.Contains(errb, "INPUT_REFUSED: ") || !strings.Contains(errb, document.Limit()) {
				t.Fatalf("exit %d, stdout %q, stderr %q", code, out, errb)
			}
		})
	}
	if exports := fake.Exports(); len(exports) != 0 {
		t.Fatalf("an oversized input reached the backend: %d exports", len(exports))
	}
}
