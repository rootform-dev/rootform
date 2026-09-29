package backendtest

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"path/filepath"
	"strings"
	"testing"

	"github.com/rootform-dev/rootform/cli/backend"
	"github.com/rootform-dev/rootform/cli/form"
	"github.com/rootform-dev/rootform/cli/policyresult"
)

// Subject is one backend under test and the inputs it answers.
type Subject struct {
	Backend backend.Backend
	// Project is a project directory whose selection compiles Plan and
	// State; empty means the working directory.
	Project string
	// Plan and State are a plan JSON and a state JSON the selection
	// compiles.
	Plan  []byte
	State []byte
	// PolicyPacks are Policy Pack sources that declare at least one Policy
	// and apply to the Form Plan compiles to.
	PolicyPacks []string
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
