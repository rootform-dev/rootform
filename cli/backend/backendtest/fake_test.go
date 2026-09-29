package backendtest_test

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
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
		dialects := t.TempDir()
		if err := os.WriteFile(filepath.Join(dialects, "dialect.rf.hcl"), []byte("dialect \"fixture\" {}\n"), 0o644); err != nil {
			t.Fatal(err)
		}
		packs := t.TempDir()
		if err := os.WriteFile(filepath.Join(packs, "pack.rf.hcl"), []byte("policy_pack \"fixture\" {}\n"), 0o644); err != nil {
			t.Fatal(err)
		}
		projectUnreadable := &backend.Error{Kind: backend.Failure, Code: "SELECTION_PROJECT_UNREADABLE", Message: "project root could not be read"}
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
						return nil, projectUnreadable
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
			DefinitionsFunc: func(_ context.Context, selection backend.Selection) (backend.Definitions, error) {
				if selection.Project != "" {
					if _, err := os.Stat(selection.Project); err != nil {
						return backend.Definitions{}, projectUnreadable
					}
				}
				return backend.Definitions{
					Vocabulary: backend.Vocabulary{Owner: "rf", Version: "0.1.0", Definitions: []backend.VocabularyDefinition{
						{Kind: "concept", ID: "rf.concept.network", Name: "network"},
					}},
					Dialects: []backend.Dialect{{Owner: "fixture", Version: "0.1.0", Rules: []backend.Rule{
						{ID: "fixture.rule.one", Owner: "fixture", Name: "one"},
					}}},
				}, nil
			},
			PolicyDefinitionsFunc: func(context.Context, backend.Selection, []string) ([]backend.PolicyPackDefinition, error) {
				return []backend.PolicyPackDefinition{{Name: "fixture", Version: "0.1.0", ContentDigest: "sha256:0", Policies: []backend.PolicyDefinition{
					{ID: "fixture.policy.one", Pack: "fixture", Name: "one"},
				}}}, nil
			},
			DialectsFunc: func(_ context.Context, directory string) (backend.DialectCompilation, error) {
				entries, err := os.ReadDir(directory)
				if err != nil {
					return backend.DialectCompilation{}, &backend.Error{Kind: backend.Failure, Message: "that Dialect directory could not be read"}
				}
				if len(entries) == 0 {
					return backend.DialectCompilation{Empty: true}, nil
				}
				return backend.DialectCompilation{Dialects: []backend.Identity{{Name: "fixture", Version: "0.1.0"}}}, nil
			},
			InstallFunc: func(_ context.Context, request backend.Installation) ([]backend.Unit, error) {
				for _, reference := range request.References {
					if strings.HasPrefix(reference, ".") || filepath.IsAbs(reference) {
						return nil, &backend.Error{Kind: backend.Usage, Message: fmt.Sprintf("%q is not an OCI reference; install takes registry references only", reference)}
					}
				}
				return nil, nil
			},
			UninstallFunc: func(_ context.Context, _ backend.Family, versions []string) ([]backend.Unit, error) {
				return nil, &backend.Error{Kind: backend.Negative, Message: versions[0] + " is not installed"}
			},
			PrepareFunc: func(_ context.Context, request backend.Preparation) (backend.Prepared, error) {
				if request.Locked {
					return backend.Prepared{}, &backend.Error{Kind: backend.NoAnswer, Message: "rootform.lock is required"}
				}
				return backend.Prepared{}, nil
			},
			VendorFunc: func(context.Context, backend.Vendoring) (backend.Vendored, error) {
				return backend.Vendored{}, &backend.Error{Kind: backend.NoAnswer, Message: "rootform.lock selects no content for this vendor operation"}
			},
			ChangeFunc: func(_ context.Context, request backend.Change, _ io.Writer) (backend.Changed, error) {
				for _, name := range request.Operands {
					if strings.ToLower(name) != name || strings.Contains(name, " ") {
						return backend.Changed{}, &backend.Error{Kind: backend.Usage, Message: fmt.Sprintf("%q is not a valid name", name)}
					}
				}
				return backend.Changed{}, &backend.Error{Kind: backend.Negative, Message: "Policy Pack absent is not selected"}
			},
			FormatFunc: func(_ context.Context, name string, source []byte) ([]byte, error) {
				if !strings.HasSuffix(name, ".rf.json") {
					return source, nil
				}
				var indented bytes.Buffer
				if err := json.Indent(&indented, source, "", "  "); err != nil {
					return nil, &backend.Error{Kind: backend.Negative, Message: name + " is not valid JSON"}
				}
				return indented.Bytes(), nil
			},
			PolicyPackFunc: func(_ context.Context, directory string, _ form.Semantics, _ io.Writer) (backend.CompiledPolicyPack, error) {
				if directory != packs {
					return backend.CompiledPolicyPack{}, &backend.Error{Kind: backend.Negative, Message: "the source directory must declare exactly one Policy Pack"}
				}
				return backend.CompiledPolicyPack{Name: "fixture", Version: "0.1.0", Pins: 1, Digest: "sha256:0", Content: []byte("{}")}, nil
			},
			PackageFunc: func(_ context.Context, request backend.Packaging) ([]backend.Packaged, error) {
				if request.Source != packs {
					return nil, &backend.Error{Kind: backend.Negative, Message: "no Policy Packs were found in that directory"}
				}
				if err := os.Mkdir(request.Destination, 0o755); err != nil {
					return nil, &backend.Error{Kind: backend.Failure, Message: "package destination already exists"}
				}
				return []backend.Packaged{{Name: "fixture", Version: "0.1.0", Digest: "sha256:1", Size: 512}}, nil
			},
			PublishFunc: func(_ context.Context, request backend.Publication) (backend.Published, error) {
				if strings.ToLower(request.Repository) != request.Repository || strings.Contains(request.Repository, " ") {
					return backend.Published{}, &backend.Error{Kind: backend.Usage, Message: "destination OCI repository is invalid"}
				}
				return backend.Published{FormatVersion: "1", DryRun: request.DryRun, Repository: request.Repository, Versions: []backend.PublishedVersion{{
					Name: "fixture", Version: "0.1.0", Repository: request.Repository, Tag: "policy-pack-fixture-0.1.0",
					ManifestDigest: "sha256:1", ManifestSize: 512, Size: 2048, Status: "planned",
				}}}, nil
			},
			ServeLanguageFunc: func(ctx context.Context, _ io.ReadCloser, _ io.Writer) error {
				<-ctx.Done()
				return nil
			},
		}
		return backendtest.Subject{Backend: fake, Plan: plan, State: state, PolicyPacks: []string{packs}, Dialects: dialects}
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
