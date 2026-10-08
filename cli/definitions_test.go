package cli_test

import (
	"bytes"
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"

	"github.com/rootform-dev/rootform/cli"
	"github.com/rootform-dev/rootform/cli/backend"
	"github.com/rootform-dev/rootform/cli/backend/backendtest"
	"github.com/rootform-dev/rootform/cli/form"
)

// selectedDefinitions is the selection the fake describes: the RF Vocabulary
// and two Dialects that both declare a concept named cluster.
func selectedDefinitions(context.Context, backend.Selection) (backend.Definitions, error) {
	return backend.Definitions{
		Vocabulary: backend.Vocabulary{Owner: "rf", Version: "0.1.0", ContractDigest: "sha256:c", Definitions: []backend.VocabularyDefinition{
			{Kind: "concept", ID: "rf.concept.network", Name: "network", Contract: "A network."},
		}},
		Dialects: []backend.Dialect{
			{
				Owner: "beta", Version: "0.2.0", Origin: form.SemanticLocal, ContentDigest: "sha256:b",
				Concepts: []backend.Declaration{{ID: "beta.concept.cluster", Owner: "beta", Name: "cluster"}},
			},
			{
				Owner: "alpha", Version: "0.1.0", Origin: form.SemanticSupplied, ContentDigest: "sha256:a",
				Concepts: []backend.Declaration{{ID: "alpha.concept.cluster", Owner: "alpha", Name: "cluster"}},
				Rules: []backend.Rule{{
					ID: "alpha.rule.instance", Owner: "alpha", Name: "instance",
					Match: backend.Match{Kind: "resource", Type: "alpha_instance"}, Produces: "alpha.concept.cluster",
				}},
			},
		},
	}, nil
}

// checksPack describes one Policy Pack source with one Policy.
func checksPack(context.Context, backend.Selection, []string) ([]backend.PolicyPackDefinition, error) {
	return []backend.PolicyPackDefinition{{
		Name: "checks", Version: "0.1.0", ContentDigest: "sha256:p",
		Policies: []backend.PolicyDefinition{{
			ID: "checks.policy.always", Pack: "checks", Name: "always",
			Target: backend.PolicyTarget{Concept: "alpha.concept.cluster"},
			Assert: "true", Message: "Always.",
		}},
	}}, nil
}

// list dialects reports the Dialects the backend describes in canonical
// order, and hands the project and the overrides of the command to it.
func TestListReportsTheSelectedDialects(t *testing.T) {
	fake := &backendtest.Fake{DefinitionsFunc: selectedDefinitions}
	project := t.TempDir()
	code, out, errb := invoke(t, cli.Env{Backend: fake}, "list", "dialects", "--project", project, "--dialect", "./payments")
	if code != 0 || out != "alpha\nbeta\n" {
		t.Fatalf("exit %d\n%s%s", code, out, errb)
	}
	if got := fake.Selections(); len(got) != 1 || got[0].Project != project || !reflect.DeepEqual(got[0].Dialects, []string{"./payments"}) {
		t.Fatalf("selections = %+v", got)
	}
	code, out, errb = invoke(t, cli.Env{Backend: fake}, "list", "dialects", "--format", "json")
	var listed []struct {
		Name          string `json:"name"`
		Origin        string `json:"origin"`
		ContentDigest string `json:"content_digest"`
		Concepts      int    `json:"concepts"`
		Rules         int    `json:"rules"`
	}
	if code != 0 || json.Unmarshal([]byte(out), &listed) != nil || len(listed) != 2 ||
		listed[0].Name != "alpha" || listed[0].Origin != "embedded" || listed[0].ContentDigest != "sha256:a" ||
		listed[0].Rules != 1 || listed[1].Origin != "local" || listed[1].Concepts != 1 {
		t.Fatalf("exit %d\n%s%s", code, out, errb)
	}
	code, out, errb = invoke(t, cli.Env{Backend: fake}, "list", "dialects", "gamma")
	if code != 1 || out != "" || !strings.Contains(errb, `no dialect named "gamma" is loaded`) {
		t.Fatalf("an unknown Dialect: exit %d\n%s%s", code, out, errb)
	}
}

// A failure to load the definitions is stated as the backend sanitized it and
// keeps the exit status of its kind; an invalid rootform.lock leaves no
// answer for every command.
func TestDefinitionFailuresKeepTheirExitStatus(t *testing.T) {
	commands := [][]string{
		{"list", "dialects"},
		{"show", "rf"},
		{"validate", "rule", "alpha.rule.instance", "--project", t.TempDir()},
		{"test", t.TempDir()},
	}
	for _, tc := range []struct {
		kind  backend.Kind
		codes []int
	}{
		{backend.NoAnswer, []int{3, 3, 3, 3}},
		{backend.Unresolved, []int{3, 3, 4, 4}},
		{backend.Failure, []int{4, 4, 4, 4}},
	} {
		fake := &backendtest.Fake{DefinitionsFunc: func(context.Context, backend.Selection) (backend.Definitions, error) {
			return backend.Definitions{}, &backend.Error{Kind: tc.kind, Message: "rootform.lock is invalid"}
		}}
		for index, args := range commands {
			code, out, errb := invoke(t, cli.Env{Backend: fake}, args...)
			if code != tc.codes[index] || out != "" || errb != "rootform: rootform.lock is invalid\n" {
				t.Fatalf("%s with kind %d: exit %d %q %q", args[0], tc.kind, code, out, errb)
			}
		}
	}
}

// show resolves a name against the definitions the backend describes.
func TestShowResolvesNamesAgainstTheDefinitions(t *testing.T) {
	fake := &backendtest.Fake{DefinitionsFunc: selectedDefinitions}
	for _, tc := range []struct {
		name   string
		code   int
		first  string
		stderr string
	}{
		{"rf", 0, "rf@0.1.0", ""},
		{"alpha", 0, "alpha@0.1.0", ""},
		{"alpha.rule.instance", 0, "alpha.rule.instance", ""},
		{"instance", 0, "alpha.rule.instance", ""},
		{"rf.concept.network", 0, "rf.concept.network", ""},
		{"cluster", 3, "", "names more than one declaration"},
		{"alpha.rule", 2, "", "is not a declaration reference"},
		{"alpha.rule.absent", 1, "", `alpha declares no rule named "absent"`},
		{"gamma.rule.instance", 1, "", `nothing named "gamma" is loaded`},
	} {
		code, out, errb := invoke(t, cli.Env{Backend: fake}, "show", tc.name)
		first, _, _ := strings.Cut(out, "\n")
		if code != tc.code || first != tc.first || !strings.Contains(errb, tc.stderr) {
			t.Fatalf("show %s: exit %d\n%s%s", tc.name, code, out, errb)
		}
	}
	code, out, errb := invoke(t, cli.Env{Backend: fake}, "show", "alpha.rule.instance", "--format", "json")
	var rule struct {
		ID       string `json:"id"`
		Produces string `json:"produces"`
		Match    struct {
			Type string `json:"type"`
		} `json:"match"`
	}
	if code != 0 || json.Unmarshal([]byte(out), &rule) != nil || rule.ID != "alpha.rule.instance" ||
		rule.Produces != "alpha.concept.cluster" || rule.Match.Type != "alpha_instance" {
		t.Fatalf("exit %d\n%s%s", code, out, errb)
	}
}

// The Policy commands describe the Policy Pack sources the backend compiles,
// with the overlays of the command applied.
func TestPolicyDefinitionsAnswerListShowAndValidate(t *testing.T) {
	fake := &backendtest.Fake{DefinitionsFunc: selectedDefinitions, PolicyDefinitionsFunc: checksPack}
	env := cli.Env{Backend: fake, Getwd: func() (string, error) { return "work", nil }}
	if code, out, errb := invoke(t, env, "list", "policies", "--policy-pack", "./checks"); code != 0 || out != "checks.policy.always\n" {
		t.Fatalf("list policies: exit %d\n%s%s", code, out, errb)
	}
	if got := fake.Overlays(); len(got) != 1 || !reflect.DeepEqual(got[0], []string{"./checks"}) {
		t.Fatalf("overlays = %+v", got)
	}
	if code, out, errb := invoke(t, env, "list", "policy-packs", "--format", "json"); code != 0 || !strings.Contains(out, `"content_digest": "sha256:p"`) {
		t.Fatalf("list policy-packs: exit %d\n%s%s", code, out, errb)
	}
	if code, out, errb := invoke(t, env, "show", "policy", "checks/always"); code != 0 || !strings.HasPrefix(out, "checks.policy.always\n") {
		t.Fatalf("show policy: exit %d\n%s%s", code, out, errb)
	}
	if code, out, errb := invoke(t, env, "validate", "policy", "always"); code != 0 || !strings.Contains(out, "checks.policy.always valid") {
		t.Fatalf("validate policy: exit %d\n%s%s", code, out, errb)
	}
	if code, out, errb := invoke(t, env, "validate", "policy", "checks/absent"); code != 1 || !strings.Contains(errb, `"checks/absent"`) {
		t.Fatalf("validate an absent Policy: exit %d\n%s%s", code, out, errb)
	}
	undigested := &backendtest.Fake{PolicyDefinitionsFunc: func(context.Context, backend.Selection, []string) ([]backend.PolicyPackDefinition, error) {
		return []backend.PolicyPackDefinition{{Name: "checks", Version: "0.1.0"}}, nil
	}}
	if code, out, errb := invoke(t, cli.Env{Backend: undigested}, "list", "policy-packs"); code != 4 || out != "" {
		t.Fatalf("a Policy Pack without a digest: exit %d\n%s%s", code, out, errb)
	}
}

// list --installed reads the Rootform home and opens no project.
func TestListInstalledReadsTheHome(t *testing.T) {
	fake := &backendtest.Fake{InstalledFunc: func(_ context.Context, family backend.Family) ([]backend.Unit, error) {
		if family != backend.PolicyPacks {
			return nil, nil
		}
		return []backend.Unit{{Name: "checks", Version: "0.1.0", Repository: "registry.example.com/acme/checks", ManifestDigest: "sha256:m", ContentDigest: "sha256:c"}}, nil
	}}
	code, out, errb := invoke(t, cli.Env{Backend: fake}, "list", "policy-packs", "--installed", "--format", "json")
	var units []map[string]string
	if code != 0 || json.Unmarshal([]byte(out), &units) != nil || len(units) != 1 ||
		units[0]["kind"] != "policy-pack" || units[0]["name"] != "checks" || units[0]["manifest_digest"] != "sha256:m" {
		t.Fatalf("exit %d\n%s%s", code, out, errb)
	}
	if code, out, errb := invoke(t, cli.Env{Backend: fake}, "list", "policy-packs", "--installed"); code != 0 ||
		!strings.Contains(out, "checks@0.1.0") || !strings.Contains(out, "registry.example.com/acme/checks@sha256:m") {
		t.Fatalf("exit %d\n%s%s", code, out, errb)
	}
	if code, out, errb := invoke(t, cli.Env{Backend: fake}, "list", "dialects", "--installed"); code != 0 || !strings.Contains(out, "installed Dialects") {
		t.Fatalf("an empty home: exit %d\n%s%s", code, out, errb)
	}
	if got := fake.Selections(); len(got) != 0 {
		t.Fatalf("an installed listing opened %+v", got)
	}
	unavailable := &backendtest.Fake{InstalledFunc: func(context.Context, backend.Family) ([]backend.Unit, error) {
		return nil, &backend.Error{Kind: backend.Failure, Message: "the Rootform home is unavailable"}
	}}
	if code, out, errb := invoke(t, cli.Env{Backend: unavailable}, "list", "dialects", "--installed"); code != 4 || out != "" ||
		errb != "rootform: the Rootform home is unavailable\n" {
		t.Fatalf("an unavailable home: exit %d %q %q", code, out, errb)
	}
}

// validate dialects compiles one source directory through the authoring port
// and reports what the compilation found.
func TestValidateDialectsReportsTheCompilation(t *testing.T) {
	directory := t.TempDir()
	var asked []string
	answer := func(compilation backend.DialectCompilation, err error) *backendtest.Fake {
		return &backendtest.Fake{DialectsFunc: func(_ context.Context, directory string) (backend.DialectCompilation, error) {
			asked = append(asked, directory)
			return compilation, err
		}}
	}
	valid := answer(backend.DialectCompilation{Dialects: []backend.Identity{{Name: "alpha", Version: "0.1.0"}}}, nil)
	if code, out, errb := invoke(t, cli.Env{Backend: valid}, "validate", "dialects", directory); code != 0 ||
		!strings.HasPrefix(out, "Dialect set valid\n") || !strings.Contains(out, "\n  alpha@0.1.0\n") {
		t.Fatalf("exit %d\n%s%s", code, out, errb)
	}
	if code, out, errb := invoke(t, cli.Env{Backend: valid}, "validate", "dialects", directory, "--format", "json"); code != 0 || out != "alpha@0.1.0 compiles\n" {
		t.Fatalf("exit %d\n%s%s", code, out, errb)
	}
	if !reflect.DeepEqual(asked, []string{directory, directory}) {
		t.Fatalf("compiled %q, want %q twice", asked, directory)
	}
	invalid := answer(backend.DialectCompilation{Diagnostics: []backend.Diagnostic{
		{Code: "CONCEPT_UNKNOWN", Message: "concept.absent is not declared", Path: "rule.rf.hcl", Line: 7, Column: 3},
	}}, nil)
	if code, out, errb := invoke(t, cli.Env{Backend: invalid}, "validate", "dialects", directory); code != 1 ||
		!strings.HasPrefix(out, "Dialect set invalid (1 error)\n") || !strings.Contains(out, "\nrule.rf.hcl\n") ||
		!strings.Contains(out, "  7:3  CONCEPT_UNKNOWN  ") {
		t.Fatalf("exit %d\n%s%s", code, out, errb)
	}
	empty := answer(backend.DialectCompilation{Empty: true}, nil)
	if code, out, errb := invoke(t, cli.Env{Backend: empty}, "validate", "dialects", directory); code != 3 || out != "" ||
		!strings.Contains(errb, "No Dialects in that directory.") {
		t.Fatalf("exit %d\n%s%s", code, out, errb)
	}
	unreadable := answer(backend.DialectCompilation{}, &backend.Error{Kind: backend.Failure, Message: "that Dialect directory could not be read"})
	if code, out, errb := invoke(t, cli.Env{Backend: unreadable}, "validate", "dialects", directory); code != 4 || out != "" ||
		errb != "rootform: that Dialect directory could not be read\n" {
		t.Fatalf("exit %d %q %q", code, out, errb)
	}
}

// A named validation loads the selection of the named project, or of the
// working directory when none is named.
func TestValidateNamesADeclarationOfTheSelection(t *testing.T) {
	fake := &backendtest.Fake{DefinitionsFunc: selectedDefinitions}
	env := cli.Env{Backend: fake, Getwd: func() (string, error) { return "work", nil }}
	if code, out, errb := invoke(t, env, "validate", "rule", "alpha.rule.instance"); code != 0 || !strings.Contains(out, "alpha.rule.instance valid") {
		t.Fatalf("exit %d\n%s%s", code, out, errb)
	}
	project := t.TempDir()
	if code, out, errb := invoke(t, env, "validate", "concept", "network", "--project", project); code != 0 || !strings.Contains(out, "rf.concept.network valid") {
		t.Fatalf("exit %d\n%s%s", code, out, errb)
	}
	if code, out, errb := invoke(t, env, "validate", "rule", "alpha.rule.absent"); code != 1 || !strings.Contains(errb, `"alpha.rule.absent"`) {
		t.Fatalf("exit %d\n%s%s", code, out, errb)
	}
	var projects []string
	for _, selection := range fake.Selections() {
		projects = append(projects, selection.Project)
	}
	if !reflect.DeepEqual(projects, []string{"work", project, "work"}) {
		t.Fatalf("opened projects %q", projects)
	}
	lost := cli.Env{Backend: fake, Getwd: func() (string, error) { return "", os.ErrNotExist }}
	if code, out, errb := invoke(t, lost, "validate", "rule", "alpha.rule.instance"); code != 4 || out != "" ||
		errb != "rootform: the working directory could not be read\n" {
		t.Fatalf("exit %d %q %q", code, out, errb)
	}
}

// test loads the definitions of the project the fixture directory is, then
// compiles every fixture export and compares it with its recorded golden.
func TestTestComparesFixturesWithTheirGoldens(t *testing.T) {
	root := t.TempDir()
	directory := filepath.Join(root, "baseline")
	if err := os.Mkdir(directory, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(directory, "plan.json"), planExport, 0o600); err != nil {
		t.Fatal(err)
	}
	expected, err := form.FixtureJSON(fixtureForm(t, "plan.json").Input)
	if err != nil {
		t.Fatal(err)
	}
	golden := filepath.Join(directory, "analysis.golden")
	fake := &backendtest.Fake{DefinitionsFunc: selectedDefinitions, CompileFunc: compilesThePlan(t)}
	type counts struct {
		Passed  int `json:"passed"`
		Failed  int `json:"failed"`
		Updated int `json:"updated"`
	}
	run := func(args ...string) (int, counts) {
		t.Helper()
		code, out, errb := invoke(t, cli.Env{Backend: fake}, append([]string{"test", root, "--format", "json"}, args...)...)
		var reported counts
		if err := json.Unmarshal([]byte(out), &reported); err != nil && code != 3 {
			t.Fatalf("exit %d: the report is not JSON\n%s%s", code, out, errb)
		}
		return code, reported
	}
	if code, _ := run(); code != 3 {
		t.Fatalf("an export without a golden is no case: exit %d", code)
	}
	if code, counts := run("--update"); code != 0 || counts.Updated != 1 {
		t.Fatalf("recording: exit %d %+v", code, counts)
	}
	if recorded, err := os.ReadFile(golden); err != nil || !bytes.Equal(recorded, expected) {
		t.Fatalf("the recorded golden is not the fixture form of the Form: %v", err)
	}
	if code, counts := run(); code != 0 || counts.Passed != 1 {
		t.Fatalf("comparing: exit %d %+v", code, counts)
	}
	if err := os.WriteFile(golden, []byte("{}"), 0o600); err != nil {
		t.Fatal(err)
	}
	if code, counts := run(); code != 1 || counts.Failed != 1 {
		t.Fatalf("a golden that differs: exit %d %+v", code, counts)
	}
	for _, selection := range fake.Selections() {
		if selection.Project != root {
			t.Fatalf("opened %q, want the fixture directory %q", selection.Project, root)
		}
	}
	for _, export := range fake.Exports() {
		if !bytes.Equal(export.Data, planExport) || export.PlanFile != "" || export.RequireEnrichment {
			t.Fatalf("compiled %+v", export)
		}
	}
}
