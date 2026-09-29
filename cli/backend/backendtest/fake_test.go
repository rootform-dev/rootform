package backendtest_test

import (
	"bytes"
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/rootform-dev/rootform/cli/backend"
	"github.com/rootform-dev/rootform/cli/backend/backendtest"
	"github.com/rootform-dev/rootform/cli/form"
	"github.com/rootform-dev/rootform/cli/policyresult"
)

func fixtureForm(t *testing.T, name string) form.Form {
	t.Helper()
	data, err := os.ReadFile(filepath.Join("..", "..", "form", "testdata", name))
	if err != nil {
		t.Fatal(err)
	}
	decoded, err := form.Decode(data)
	if err != nil {
		t.Fatal(err)
	}
	return decoded
}

// TestFakeConforms runs the conformance suite against the fake, scripted with
// the Form fixtures, so the suite and the fake agree on the port contract.
func TestFakeConforms(t *testing.T) {
	plan := []byte(`{"format_version":"1.2","terraform_version":"1.9.0","planned_values":{},"configuration":{}}`)
	state := []byte(`{"format_version":"1.0","terraform_version":"1.9.0","values":{}}`)
	backendtest.Run(t, func(t *testing.T) backendtest.Subject {
		planForm, stateForm := fixtureForm(t, "plan.json"), fixtureForm(t, "state.json")
		comparison := fixtureForm(t, "comparison.json")
		fake := &backendtest.Fake{
			CompileFunc: func(_ context.Context, _ backend.Selection, export backend.Export) (backend.Compiled, error) {
				var status struct {
					Errored any `json:"errored"`
				}
				_ = json.Unmarshal(export.Data, &status)
				switch status.Errored.(type) {
				case bool:
					return backend.Compiled{}, &backend.Error{Kind: backend.NoAnswer, Message: "PLAN_ERRORED: the plan JSON records that planning failed"}
				case string:
					return backend.Compiled{}, &backend.Error{Kind: backend.NoAnswer, Message: "INPUT_INVALID: malformed plan JSON"}
				}
				switch {
				case bytes.Equal(export.Data, plan):
					return backend.Compiled{Form: planForm.Input, Enrichment: form.SnapshotEnrichment{Status: form.SnapshotAbsent}}, nil
				case bytes.Equal(export.Data, state):
					return backend.Compiled{Form: stateForm.Input, Enrichment: form.SnapshotEnrichment{Status: form.SnapshotAbsent}}, nil
				}
				return backend.Compiled{}, &backend.Error{Kind: backend.NoAnswer, Message: "INPUT_INVALID: the input could not be analyzed"}
			},
			PresentationFunc: func(context.Context, backend.Selection, *form.InputForm) backend.Presentation {
				return backend.Presentation{Catalog: []byte("{}\n")}
			},
			PoliciesFunc: func(_ context.Context, selection backend.Selection, overlays []string) (backend.PolicySet, error) {
				if selection.Project != "" {
					if _, err := os.Stat(selection.Project); err != nil {
						return nil, &backend.Error{Kind: backend.Failure, Code: "SELECTION_PROJECT_UNREADABLE", Message: "project root could not be read"}
					}
				}
				return backendtest.PolicySet{
					PackList: []backend.Pack{{Record: policyresult.PolicyPack{ID: "fixture", Version: "0.1.0"}, Overlay: len(overlays) > 0, Policies: []string{"fixture.policy.one"}}},
					EvaluateFunc: func(_ context.Context, _ *form.InputForm, _ form.Stage, selected []string) policyresult.Architecture {
						return policyresult.NewArchitecture(len(selected)).Finalized()
					},
				}, nil
			},
			CompareFunc: func(context.Context, form.Side, form.Side) *form.ComparisonForm {
				return comparison.Comparison
			},
		}
		return backendtest.Subject{Backend: fake, Plan: plan, State: state, PolicyPacks: []string{"fixture"}}
	})
}

// TestFakeRecordsWhatItWasAsked keeps the recorded selections, exports and
// overlays a command test asserts, and states its notices once.
func TestFakeRecordsWhatItWasAsked(t *testing.T) {
	fake := &backendtest.Fake{Notices: "Using fixture 0.1.0 from ./fixture for this command only\n"}
	var notices bytes.Buffer
	session := fake.Open(context.Background(), backend.Selection{Project: "p", Locked: true, Dialects: []string{"d"}}, &notices)
	if notices.Len() != 0 {
		t.Fatalf("Open stated notices: %q", notices.String())
	}
	if _, err := session.Compile(context.Background(), backend.Export{Data: []byte("{}"), Producer: "terraform"}); err == nil {
		t.Fatal("an unscripted fake compiled")
	}
	if _, err := session.Policies(context.Background(), []string{"pack"}); err != nil {
		t.Fatal(err)
	}
	if got := notices.String(); got != fake.Notices {
		t.Fatalf("notices = %q, want them once", got)
	}
	if got := fake.Selections(); len(got) != 1 || got[0].Project != "p" || !got[0].Locked || got[0].Dialects[0] != "d" {
		t.Fatalf("selections = %+v", got)
	}
	if got := fake.Exports(); len(got) != 1 || got[0].Producer != "terraform" {
		t.Fatalf("exports = %+v", got)
	}
	if got := fake.Overlays(); len(got) != 1 || got[0][0] != "pack" {
		t.Fatalf("overlays = %+v", got)
	}
}
