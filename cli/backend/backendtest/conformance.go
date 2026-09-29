package backendtest

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/rootform-dev/rootform/cli/backend"
	"github.com/rootform-dev/rootform/cli/form"
	"github.com/rootform-dev/rootform/cli/policyresult"
)

// Subject is one backend under test and the inputs it answers.
type Subject struct {
	// Backend reaches an empty Rootform home.
	Backend backend.Backend
	// Project is a project directory whose selection compiles Plan and
	// State and selects at least one Dialect; empty means the working
	// directory.
	Project string
	// Plan and State are a plan JSON and a state JSON the selection
	// compiles.
	Plan  []byte
	State []byte
	// PolicyPacks are Policy Pack source directories, each declaring one
	// Policy Pack with at least one Policy that applies to the Form Plan
	// compiles to.
	PolicyPacks []string
	// Dialects is a directory of Dialect sources that compiles without a
	// diagnostic and holds at least one native source.
	Dialects string
}

// Run is the conformance suite of a backend. subject builds a fresh backend
// for each check.
func Run(t *testing.T, subject func(t *testing.T) Subject) {
	t.Run("OpenIsLazy", func(t *testing.T) { openIsLazy(t, subject(t)) })
	t.Run("CompilesPlanAndState", func(t *testing.T) { compilesPlanAndState(t, subject(t)) })
	t.Run("RefusesFailedPlans", func(t *testing.T) { refusesFailedPlans(t, subject(t)) })
	t.Run("PresentsACatalog", func(t *testing.T) { presentsACatalog(t, subject(t)) })
	t.Run("ComparesTwoForms", func(t *testing.T) { comparesTwoForms(t, subject(t)) })
	t.Run("LoadsAndEvaluatesPolicies", func(t *testing.T) { loadsAndEvaluatesPolicies(t, subject(t)) })
	t.Run("DefinesTheSelection", func(t *testing.T) { definesTheSelection(t, subject(t)) })
	t.Run("RefusesTheDefinitionsOfAMissingProject", func(t *testing.T) { refusesMissingDefinitions(t, subject(t)) })
	t.Run("DefinesPolicyPacks", func(t *testing.T) { definesPolicyPacks(t, subject(t)) })
	t.Run("ListsAnEmptyHome", func(t *testing.T) { listsAnEmptyHome(t, subject(t)) })
	t.Run("RefusesWhatTheHomeCannotInstallOrDelete", func(t *testing.T) { refusesHomeChanges(t, subject(t)) })
	t.Run("PreparesAProjectWithoutALock", func(t *testing.T) { preparesAProjectWithoutALock(t, subject(t)) })
	t.Run("VendorsNothingWithoutASelection", func(t *testing.T) { vendorsNothingWithoutASelection(t, subject(t)) })
	t.Run("RefusesToChangeAnAbsentSelection", func(t *testing.T) { refusesToChangeAnAbsentSelection(t, subject(t)) })
	t.Run("CompilesDialectSources", func(t *testing.T) { compilesDialectSources(t, subject(t)) })
	t.Run("FormatsSources", func(t *testing.T) { formatsSources(t, subject(t)) })
	t.Run("CompilesAPolicyPack", func(t *testing.T) { compilesAPolicyPack(t, subject(t)) })
	t.Run("PackagesAndPlansAPublication", func(t *testing.T) { packagesAndPlansAPublication(t, subject(t)) })
	t.Run("StopsTheLanguageServerWhenCanceled", func(t *testing.T) { stopsTheLanguageServer(t, subject(t)) })
}

// sanitized requires a failure the command line can print as it is.
func sanitized(t *testing.T, err error) *backend.Error {
	t.Helper()
	var failure *backend.Error
	if !errors.As(err, &failure) {
		t.Fatalf("error %T is not a *backend.Error", err)
	}
	if strings.TrimSpace(failure.Message) == "" {
		t.Fatal("a backend error carries no message")
	}
	if failure.Error() != failure.Message {
		t.Fatalf("Error() = %q, want the message %q", failure.Error(), failure.Message)
	}
	return failure
}

func openIsLazy(t *testing.T, s Subject) {
	var notices bytes.Buffer
	missing := filepath.Join(t.TempDir(), "missing")
	session := s.Backend.Open(context.Background(), backend.Selection{Project: missing}, &notices)
	if session == nil {
		t.Fatal("Open returned no session")
	}
	if notices.Len() != 0 {
		t.Fatalf("Open wrote notices before the session was used: %q", notices.String())
	}
	_, err := session.Policies(context.Background(), nil)
	if err == nil {
		t.Fatal("the Policies of a missing project loaded")
	}
	failure := sanitized(t, err)
	if failure.Code == "" {
		t.Fatalf("a selection failure carries no code: %+v", failure)
	}
}

func compile(t *testing.T, s Subject, data []byte, kind form.Kind) *form.InputForm {
	t.Helper()
	session := s.Backend.Open(context.Background(), backend.Selection{Project: s.Project}, &bytes.Buffer{})
	compiled, err := session.Compile(context.Background(), backend.Export{Data: data})
	if err != nil {
		t.Fatalf("compiling the %s: %v", kind, err)
	}
	if compiled.Form == nil {
		t.Fatalf("compiling the %s returned no Form", kind)
	}
	if compiled.Form.Kind != kind {
		t.Fatalf("the Form of the %s is a %s Form", kind, compiled.Form.Kind)
	}
	if _, err := form.Encode(form.Form{Input: compiled.Form}); err != nil {
		t.Fatalf("the Form of the %s does not validate: %v", kind, err)
	}
	if compiled.Enrichment.Status != form.SnapshotAbsent {
		t.Fatalf("a %s without a saved plan records enrichment %q", kind, compiled.Enrichment.Status)
	}
	return compiled.Form
}

func compilesPlanAndState(t *testing.T, s Subject) {
	compile(t, s, s.Plan, form.KindPlan)
	compile(t, s, s.State, form.KindState)
}

// refusesFailedPlans requires a plan JSON that records a failed plan, or
// whose failure marker is malformed, to be refused before it is compiled.
func refusesFailedPlans(t *testing.T, s Subject) {
	for _, tc := range []struct {
		errored any
		code    string
	}{
		{true, "PLAN_ERRORED: "},
		{"yes", "INPUT_INVALID: "},
	} {
		var plan map[string]any
		if err := json.Unmarshal(s.Plan, &plan); err != nil {
			t.Fatal(err)
		}
		plan["errored"] = tc.errored
		data, err := json.Marshal(plan)
		if err != nil {
			t.Fatal(err)
		}
		session := s.Backend.Open(context.Background(), backend.Selection{Project: s.Project}, &bytes.Buffer{})
		_, err = session.Compile(context.Background(), backend.Export{Data: data})
		if err == nil {
			t.Fatalf("a plan recording errored=%v compiled", tc.errored)
		}
		failure := sanitized(t, err)
		if failure.Kind != backend.NoAnswer || !strings.HasPrefix(failure.Message, tc.code) {
			t.Fatalf("errored=%v: got kind %d %q, want no answer %s...", tc.errored, failure.Kind, failure.Message, tc.code)
		}
	}
}

func presentsACatalog(t *testing.T, s Subject) {
	focus := compile(t, s, s.Plan, form.KindPlan)
	session := s.Backend.Open(context.Background(), backend.Selection{Project: s.Project}, &bytes.Buffer{})
	presented := session.Presentation(context.Background(), focus)
	if len(presented.Catalog) == 0 || !json.Valid(presented.Catalog) {
		t.Fatalf("the presentation catalog is not JSON: %q", presented.Catalog)
	}
}

func comparesTwoForms(t *testing.T, s Subject) {
	state := compile(t, s, s.State, form.KindState)
	plan := compile(t, s, s.Plan, form.KindPlan)
	before, err := form.Select(form.Form{Input: state}, "", "")
	if err != nil {
		t.Fatal(err)
	}
	after, err := form.Select(form.Form{Input: plan}, "", "")
	if err != nil {
		t.Fatal(err)
	}
	compared := s.Backend.Compare(context.Background(), before, after)
	if compared == nil {
		t.Fatal("Compare returned no comparison")
	}
	if err := compared.Validate(); err != nil {
		t.Fatalf("the comparison does not validate: %v", err)
	}
}

func loadsAndEvaluatesPolicies(t *testing.T, s Subject) {
	plan := compile(t, s, s.Plan, form.KindPlan)
	session := s.Backend.Open(context.Background(), backend.Selection{Project: s.Project}, &bytes.Buffer{})
	set, err := session.Policies(context.Background(), s.PolicyPacks)
	if err != nil {
		t.Fatalf("loading the Policy Packs: %v", err)
	}
	var selected []string
	for _, pack := range set.Packs() {
		if pack.Record.ID == "" {
			t.Fatalf("a Policy Pack has no identity: %+v", pack)
		}
		if len(s.PolicyPacks) > 0 && !pack.Overlay {
			continue
		}
		selected = append(selected, pack.Policies...)
	}
	if len(selected) == 0 {
		t.Fatal("the Policy Packs declare no Policy")
	}
	side, err := form.Select(form.Form{Input: plan}, "", "")
	if err != nil {
		t.Fatal(err)
	}
	architecture := set.Evaluate(context.Background(), &side.Form, side.Stage, selected)
	if architecture.Summary.Policies.Selected != len(selected) {
		t.Fatalf("the result counts %d selected Policies, want %d", architecture.Summary.Policies.Selected, len(selected))
	}
	architecture.Kind, architecture.Stage = string(side.Form.Kind), side.Stage
	result := policyresult.NewResult()
	result.Architectures = append(result.Architectures, architecture)
	encoded, err := policyresult.Serialize(result)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := policyresult.Decode(encoded); err != nil {
		t.Fatalf("the evaluated result does not decode: %v", err)
	}
}

// definesTheSelection requires the RF Vocabulary and the selected Dialects,
// each declaration named by the identity a command line reference resolves.
func definesTheSelection(t *testing.T, s Subject) {
	session := s.Backend.Open(context.Background(), backend.Selection{Project: s.Project}, &bytes.Buffer{})
	definitions, err := session.Definitions(context.Background())
	if err != nil {
		t.Fatalf("loading the definitions: %v", err)
	}
	vocabulary := definitions.Vocabulary
	if vocabulary.Owner == "" || vocabulary.Version == "" || len(vocabulary.Definitions) == 0 {
		t.Fatalf("the RF Vocabulary is not described: %+v", vocabulary)
	}
	for _, definition := range vocabulary.Definitions {
		switch definition.Kind {
		case "concept", "context", "relation":
		default:
			t.Fatalf("the vocabulary definition %q has the kind %q", definition.ID, definition.Kind)
		}
		if definition.ID != vocabulary.Owner+"."+definition.Kind+"."+definition.Name {
			t.Fatalf("the vocabulary definition %q is not named %s.%s.%s", definition.ID, vocabulary.Owner, definition.Kind, definition.Name)
		}
	}
	if len(definitions.Dialects) == 0 {
		t.Fatal("the selection defines no Dialect")
	}
	for _, dialect := range definitions.Dialects {
		if dialect.Owner == "" || dialect.Version == "" {
			t.Fatalf("a Dialect has no identity: %+v", dialect)
		}
		for _, rule := range dialect.Rules {
			if rule.Owner != dialect.Owner || rule.ID != dialect.Owner+".rule."+rule.Name {
				t.Fatalf("the rule %q of %s is not named %s.rule.%s", rule.ID, dialect.Owner, dialect.Owner, rule.Name)
			}
		}
	}
}

// refusesMissingDefinitions requires a project that cannot be read to stop
// the command as an operational failure.
func refusesMissingDefinitions(t *testing.T, s Subject) {
	missing := filepath.Join(t.TempDir(), "missing")
	session := s.Backend.Open(context.Background(), backend.Selection{Project: missing}, &bytes.Buffer{})
	_, err := session.Definitions(context.Background())
	if err == nil {
		t.Fatal("the definitions of a missing project loaded")
	}
	if failure := sanitized(t, err); failure.Kind != backend.Failure {
		t.Fatalf("a missing project reads as kind %d, want a failure", failure.Kind)
	}
}

// definesPolicyPacks requires the Policy Pack sources to be described with
// their identity and the Policies they declare.
func definesPolicyPacks(t *testing.T, s Subject) {
	session := s.Backend.Open(context.Background(), backend.Selection{Project: s.Project}, &bytes.Buffer{})
	packs, err := session.PolicyDefinitions(context.Background(), s.PolicyPacks)
	if err != nil {
		t.Fatalf("describing the Policy Packs: %v", err)
	}
	policies := 0
	for _, pack := range packs {
		if pack.Name == "" || pack.Version == "" || pack.ContentDigest == "" {
			t.Fatalf("a Policy Pack has no identity: %+v", pack)
		}
		for _, policy := range pack.Policies {
			if policy.Pack != pack.Name || policy.ID != pack.Name+".policy."+policy.Name {
				t.Fatalf("the Policy %q of %s is not named %s.policy.%s", policy.ID, pack.Name, pack.Name, policy.Name)
			}
		}
		policies += len(pack.Policies)
	}
	if policies == 0 {
		t.Fatal("the Policy Packs declare no Policy")
	}
}

func listsAnEmptyHome(t *testing.T, s Subject) {
	for _, family := range []backend.Family{backend.Dialects, backend.PolicyPacks} {
		units, err := s.Backend.Home().Installed(context.Background(), family)
		if err != nil {
			t.Fatalf("listing the installed %s: %v", family, err)
		}
		if len(units) != 0 {
			t.Fatalf("an empty home lists the %s %+v", family, units)
		}
	}
}

// refusesHomeChanges requires a reference to a local directory to be refused
// as a usage error, and a version that is not installed to be a negative
// answer that deletes nothing.
func refusesHomeChanges(t *testing.T, s Subject) {
	home := s.Backend.Home()
	_, err := home.Install(context.Background(), backend.Installation{Family: backend.Dialects, References: []string{"./dialects"}})
	if err == nil {
		t.Fatal("a local directory was installed")
	}
	if failure := sanitized(t, err); failure.Kind != backend.Usage {
		t.Fatalf("installing a local directory reads as kind %d, want a usage error", failure.Kind)
	}
	_, err = home.Uninstall(context.Background(), backend.PolicyPacks, []string{"absent@1.0.0"})
	if err == nil {
		t.Fatal("a version that is not installed was deleted")
	}
	if failure := sanitized(t, err); failure.Kind != backend.Negative {
		t.Fatalf("deleting a version that is not installed reads as kind %d, want a negative answer", failure.Kind)
	}
}

// preparesAProjectWithoutALock requires a project without rootform.lock to
// have nothing to prepare unless the lock is required, and a preparation to
// write nothing into it.
func preparesAProjectWithoutALock(t *testing.T, s Subject) {
	project := t.TempDir()
	projects := s.Backend.Projects()
	prepared, err := projects.Prepare(context.Background(), backend.Preparation{Project: project})
	if err != nil {
		t.Fatalf("preparing a project without rootform.lock: %v", err)
	}
	if len(prepared.Dialects) != 0 || len(prepared.PolicyPacks) != 0 || prepared.Downloaded != 0 {
		t.Fatalf("a project without rootform.lock prepared %+v", prepared)
	}
	_, err = projects.Prepare(context.Background(), backend.Preparation{Project: project, Locked: true})
	if err == nil {
		t.Fatal("a preparation that requires rootform.lock accepted a project without one")
	}
	if failure := sanitized(t, err); failure.Kind != backend.NoAnswer {
		t.Fatalf("a missing rootform.lock reads as kind %d, want no answer", failure.Kind)
	}
	untouched(t, project)
}

// vendorsNothingWithoutASelection requires a project without rootform.lock to
// select no family, and vendoring a family it does not select to leave no
// answer.
func vendorsNothingWithoutASelection(t *testing.T, s Subject) {
	project := t.TempDir()
	projects := s.Backend.Projects()
	families, err := projects.Selected(context.Background(), project)
	if err != nil || len(families) != 0 {
		t.Fatalf("a project without rootform.lock selects %v, %v", families, err)
	}
	_, err = projects.Vendor(context.Background(), backend.Vendoring{Project: project, Family: backend.Dialects})
	if err == nil {
		t.Fatal("a project that selects no Dialect vendored Dialects")
	}
	if failure := sanitized(t, err); failure.Kind != backend.NoAnswer {
		t.Fatalf("vendoring nothing reads as kind %d, want no answer", failure.Kind)
	}
	untouched(t, project)
}

// refusesToChangeAnAbsentSelection requires removing a name the project does
// not select to be a negative answer and a malformed name to be a usage
// error, and neither to write rootform.lock.
func refusesToChangeAnAbsentSelection(t *testing.T, s Subject) {
	project := t.TempDir()
	projects := s.Backend.Projects()
	var notices bytes.Buffer
	_, err := projects.Change(context.Background(), backend.Change{
		Verb: "remove", Family: backend.PolicyPacks, Operands: []string{"absent"}, Project: project,
	}, &notices)
	if err == nil {
		t.Fatal("a Policy Pack the project does not select was removed")
	}
	if failure := sanitized(t, err); failure.Kind != backend.Negative {
		t.Fatalf("removing an absent selection reads as kind %d, want a negative answer", failure.Kind)
	}
	_, err = projects.Change(context.Background(), backend.Change{
		Verb: "remove", Family: backend.Dialects, Operands: []string{"Not A Name"}, Project: project,
	}, &notices)
	if err == nil {
		t.Fatal("a malformed name was removed")
	}
	if failure := sanitized(t, err); failure.Kind != backend.Usage {
		t.Fatalf("a malformed name reads as kind %d, want a usage error", failure.Kind)
	}
	untouched(t, project)
}

// untouched requires a project directory to hold nothing.
func untouched(t *testing.T, project string) {
	t.Helper()
	entries, err := os.ReadDir(project)
	if err != nil {
		t.Fatal(err)
	}
	if len(entries) != 0 {
		t.Fatalf("the project holds %d entries after a request that writes nothing", len(entries))
	}
}

// compilesDialectSources requires Dialect sources to compile as they stand,
// a directory without a source to be empty, and a directory that cannot be
// read to stop the command as an operational failure.
func compilesDialectSources(t *testing.T, s Subject) {
	authoring := s.Backend.Authoring()
	compiled, err := authoring.Dialects(context.Background(), s.Dialects)
	if err != nil {
		t.Fatalf("compiling the Dialect sources: %v", err)
	}
	if compiled.Empty || len(compiled.Dialects) == 0 || len(compiled.Diagnostics) != 0 {
		t.Fatalf("the Dialect sources did not compile: %+v", compiled)
	}
	for _, dialect := range compiled.Dialects {
		if dialect.Name == "" || dialect.Version == "" {
			t.Fatalf("a compiled Dialect has no identity: %+v", dialect)
		}
	}
	empty, err := authoring.Dialects(context.Background(), t.TempDir())
	if err != nil || !empty.Empty {
		t.Fatalf("an empty directory compiled to %+v, %v", empty, err)
	}
	_, err = authoring.Dialects(context.Background(), filepath.Join(t.TempDir(), "missing"))
	if err == nil {
		t.Fatal("a missing directory compiled")
	}
	if failure := sanitized(t, err); failure.Kind != backend.Failure {
		t.Fatalf("a missing directory reads as kind %d, want a failure", failure.Kind)
	}
}

// formatsSources requires the canonical text of a native source and of a
// JSON source to be canonical in turn, and JSON source that is not
// well-formed to be a negative answer.
func formatsSources(t *testing.T, s Subject) {
	authoring := s.Backend.Authoring()
	ctx := context.Background()
	native := ""
	err := filepath.WalkDir(s.Dialects, func(path string, entry fs.DirEntry, err error) error {
		if err != nil || native != "" {
			return err
		}
		if !entry.IsDir() && strings.HasSuffix(path, ".rf.hcl") {
			native = path
		}
		return nil
	})
	if err != nil || native == "" {
		t.Fatalf("the Dialect sources hold no native source: %v", err)
	}
	source, err := os.ReadFile(native)
	if err != nil {
		t.Fatal(err)
	}
	for _, c := range []struct {
		name   string
		source []byte
	}{
		{filepath.Base(native), source},
		{"fixture.rf.json", []byte(`{"dialect":{"name":"fixture","rules":[1,2]}}`)},
	} {
		formatted, err := authoring.Format(ctx, c.name, c.source)
		if err != nil {
			t.Fatalf("formatting %s: %v", c.name, err)
		}
		again, err := authoring.Format(ctx, c.name, formatted)
		if err != nil || !bytes.Equal(again, formatted) {
			t.Fatalf("the canonical text of %s is not canonical: %q became %q, %v", c.name, formatted, again, err)
		}
	}
	_, err = authoring.Format(ctx, "broken.rf.json", []byte("{"))
	if err == nil {
		t.Fatal("JSON source that is not well-formed was formatted")
	}
	if failure := sanitized(t, err); failure.Kind != backend.Negative {
		t.Fatalf("an invalid source reads as kind %d, want a negative answer", failure.Kind)
	}
}

// compilesAPolicyPack requires a Policy Pack source to compile and pin to the
// semantics of a Form, and a directory that declares no Policy Pack to be a
// negative answer.
func compilesAPolicyPack(t *testing.T, s Subject) {
	plan := compile(t, s, s.Plan, form.KindPlan)
	authoring := s.Backend.Authoring()
	var notices bytes.Buffer
	compiled, err := authoring.PolicyPack(context.Background(), s.PolicyPacks[0], plan.Semantics, &notices)
	if err != nil {
		t.Fatalf("compiling the Policy Pack: %v; notices %q", err, notices.String())
	}
	if compiled.Name == "" || compiled.Version == "" || compiled.Digest == "" {
		t.Fatalf("the compiled Policy Pack has no identity: %s@%s %s", compiled.Name, compiled.Version, compiled.Digest)
	}
	if !json.Valid(compiled.Content) || bytes.HasSuffix(compiled.Content, []byte("\n")) {
		t.Fatalf("the compiled Policy Pack is not one JSON document without its final newline: %q", compiled.Content)
	}
	_, err = authoring.PolicyPack(context.Background(), t.TempDir(), plan.Semantics, &notices)
	if err == nil {
		t.Fatal("a directory without a Policy Pack compiled")
	}
	if failure := sanitized(t, err); failure.Kind != backend.Negative {
		t.Fatalf("a directory without a Policy Pack reads as kind %d, want a negative answer", failure.Kind)
	}
}

// packagesAndPlansAPublication requires a Policy Pack source to be packaged
// into a new registry layout, an existing destination and a source set
// without a Policy Pack to be refused, a dry run to plan the publication of
// every packaged version, and an invalid repository to be a usage error.
func packagesAndPlansAPublication(t *testing.T, s Subject) {
	authoring := s.Backend.Authoring()
	ctx := context.Background()
	layout := filepath.Join(t.TempDir(), "layout")
	request := backend.Packaging{Family: backend.PolicyPacks, Source: s.PolicyPacks[0], Destination: layout}
	packaged, err := authoring.Package(ctx, request)
	if err != nil {
		t.Fatalf("packaging the Policy Pack: %v", err)
	}
	if len(packaged) == 0 {
		t.Fatal("packaging wrote no version")
	}
	for _, version := range packaged {
		if version.Name == "" || version.Version == "" || version.Digest == "" || version.Size <= 0 {
			t.Fatalf("a packaged version is not described: %+v", version)
		}
	}
	_, err = authoring.Package(ctx, request)
	if err == nil {
		t.Fatal("packaging replaced an existing layout")
	}
	if failure := sanitized(t, err); failure.Kind != backend.Failure {
		t.Fatalf("an existing destination reads as kind %d, want a failure", failure.Kind)
	}
	_, err = authoring.Package(ctx, backend.Packaging{Family: backend.PolicyPacks, Source: t.TempDir(), Destination: filepath.Join(t.TempDir(), "empty")})
	if err == nil {
		t.Fatal("a directory without a Policy Pack was packaged")
	}
	if failure := sanitized(t, err); failure.Kind != backend.Negative {
		t.Fatalf("a directory without a Policy Pack reads as kind %d, want a negative answer", failure.Kind)
	}
	const repository = "registry.example.com/acme/policy-packs"
	published, err := authoring.Publish(ctx, backend.Publication{Family: backend.PolicyPacks, Layout: layout, Repository: repository, DryRun: true})
	if err != nil {
		t.Fatalf("planning the publication: %v", err)
	}
	if !published.DryRun || published.Repository != repository || published.FormatVersion == "" || len(published.Versions) != len(packaged) {
		t.Fatalf("the planned publication is %+v, want a dry run of %d versions to %s", published, len(packaged), repository)
	}
	for i, version := range published.Versions {
		if version.Status != "planned" || version.Name != packaged[i].Name || version.Version != packaged[i].Version || version.ManifestDigest != packaged[i].Digest {
			t.Fatalf("the planned version %+v does not match the packaged %+v", version, packaged[i])
		}
	}
	_, err = authoring.Publish(ctx, backend.Publication{Family: backend.PolicyPacks, Layout: layout, Repository: "Not A Repository", DryRun: true})
	if err == nil {
		t.Fatal("a publication to an invalid repository was planned")
	}
	if failure := sanitized(t, err); failure.Kind != backend.Usage {
		t.Fatalf("an invalid repository reads as kind %d, want a usage error", failure.Kind)
	}
}

// stopsTheLanguageServer requires the language server to stop without an
// error once its context is canceled, as it does on an interrupt.
func stopsTheLanguageServer(t *testing.T, s Subject) {
	input, client := io.Pipe()
	defer client.Close()
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)
	go func() { done <- s.Backend.Authoring().ServeLanguage(ctx, input, io.Discard) }()
	cancel()
	select {
	case err := <-done:
		if err != nil {
			t.Fatalf("a canceled language server returned %v", err)
		}
	case <-time.After(10 * time.Second):
		t.Fatal("a canceled language server did not stop")
	}
}
