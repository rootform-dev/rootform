// Package backendtest tests the backend ports: Fake is a scriptable backend
// for the command line's own tests, and Run is the conformance suite every
// backend passes.
package backendtest

import (
	"context"
	"io"
	"sync"

	"github.com/rootform-dev/rootform/cli/backend"
	"github.com/rootform-dev/rootform/cli/form"
	"github.com/rootform-dev/rootform/cli/policyresult"
)

// Fake is a scriptable backend. It compiles, compares, presents and evaluates
// nothing itself: each method answers with the function a test sets, and the
// fake records what it was asked. An unset function refuses the request.
type Fake struct {
	// CompileFunc answers Session.Compile.
	CompileFunc func(ctx context.Context, selection backend.Selection, export backend.Export) (backend.Compiled, error)
	// PresentationFunc answers Session.Presentation.
	PresentationFunc func(ctx context.Context, selection backend.Selection, focus *form.InputForm) backend.Presentation
	// PoliciesFunc answers Session.Policies.
	PoliciesFunc func(ctx context.Context, selection backend.Selection, overlays []string) (backend.PolicySet, error)
	// DefinitionsFunc answers Session.Definitions.
	DefinitionsFunc func(ctx context.Context, selection backend.Selection) (backend.Definitions, error)
	// PolicyDefinitionsFunc answers Session.PolicyDefinitions.
	PolicyDefinitionsFunc func(ctx context.Context, selection backend.Selection, overlays []string) ([]backend.PolicyPackDefinition, error)
	// CompareFunc answers Backend.Compare.
	CompareFunc func(ctx context.Context, before, after form.Side) *form.ComparisonForm
	// InstalledFunc answers Home.Installed.
	InstalledFunc func(ctx context.Context, family backend.Family) ([]backend.Unit, error)
	// InstallFunc answers Home.Install.
	InstallFunc func(ctx context.Context, request backend.Installation) ([]backend.Unit, error)
	// UninstallFunc answers Home.Uninstall.
	UninstallFunc func(ctx context.Context, family backend.Family, versions []string) ([]backend.Unit, error)
	// PrepareFunc answers Projects.Prepare.
	PrepareFunc func(ctx context.Context, request backend.Preparation) (backend.Prepared, error)
	// SelectedFunc answers Projects.Selected.
	SelectedFunc func(ctx context.Context, project string) ([]backend.Family, error)
	// VendorFunc answers Projects.Vendor.
	VendorFunc func(ctx context.Context, request backend.Vendoring) (backend.Vendored, error)
	// ChangeFunc answers Projects.Change.
	ChangeFunc func(ctx context.Context, request backend.Change, notices io.Writer) (backend.Changed, error)
	// DialectsFunc answers Authoring.Dialects.
	DialectsFunc func(ctx context.Context, directory string) (backend.DialectCompilation, error)
	// FormatFunc answers Authoring.Format.
	FormatFunc func(ctx context.Context, name string, source []byte) ([]byte, error)
	// PolicyPackFunc answers Authoring.PolicyPack.
	PolicyPackFunc func(ctx context.Context, directory string, semantics form.Semantics, notices io.Writer) (backend.CompiledPolicyPack, error)
	// PackageFunc answers Authoring.Package.
	PackageFunc func(ctx context.Context, request backend.Packaging) ([]backend.Packaged, error)
	// PublishFunc answers Authoring.Publish.
	PublishFunc func(ctx context.Context, request backend.Publication) (backend.Published, error)
	// ServeLanguageFunc answers Authoring.ServeLanguage.
	ServeLanguageFunc func(ctx context.Context, input io.ReadCloser, output io.Writer) error
	// Notices is written once to the notices of a session when it is first
	// used, as a selection states the sources it loads.
	Notices string

	mu         sync.Mutex
	selections []backend.Selection
	exports    []backend.Export
	overlays   [][]string
}

// Open records the selection and returns a session that does nothing until
// it is used.
func (f *Fake) Open(_ context.Context, selection backend.Selection, notices io.Writer) backend.Session {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.selections = append(f.selections, selection)
	return &fakeSession{fake: f, selection: selection, notices: notices}
}

// Compare answers with CompareFunc; without one it compares nothing.
func (f *Fake) Compare(ctx context.Context, before, after form.Side) *form.ComparisonForm {
	if f.CompareFunc == nil {
		return nil
	}
	return f.CompareFunc(ctx, before, after)
}

// Home answers with InstalledFunc, InstallFunc and UninstallFunc.
func (f *Fake) Home() backend.Home { return fakeHome{fake: f} }

// Projects answers with PrepareFunc, SelectedFunc, VendorFunc and
// ChangeFunc.
func (f *Fake) Projects() backend.Projects { return fakeProjects{fake: f} }

// Authoring answers with DialectsFunc, FormatFunc, PolicyPackFunc,
// PackageFunc, PublishFunc and ServeLanguageFunc.
func (f *Fake) Authoring() backend.Authoring { return fakeAuthoring{fake: f} }

// Selections are the selections opened, in order.
func (f *Fake) Selections() []backend.Selection {
	f.mu.Lock()
	defer f.mu.Unlock()
	return append([]backend.Selection{}, f.selections...)
}

// Exports are the exports compiled, in order.
func (f *Fake) Exports() []backend.Export {
	f.mu.Lock()
	defer f.mu.Unlock()
	return append([]backend.Export{}, f.exports...)
}

// Overlays are the Policy Pack overlays of every Policies and
// PolicyDefinitions call, in order.
func (f *Fake) Overlays() [][]string {
	f.mu.Lock()
	defer f.mu.Unlock()
	return append([][]string{}, f.overlays...)
}

type fakeSession struct {
	fake      *Fake
	selection backend.Selection
	notices   io.Writer
	noticed   bool
}

func (s *fakeSession) use() {
	if s.noticed {
		return
	}
	s.noticed = true
	if s.fake.Notices != "" && s.notices != nil {
		_, _ = io.WriteString(s.notices, s.fake.Notices)
	}
}

func (s *fakeSession) Compile(ctx context.Context, export backend.Export) (backend.Compiled, error) {
	s.use()
	s.fake.mu.Lock()
	s.fake.exports = append(s.fake.exports, export)
	s.fake.mu.Unlock()
	if s.fake.CompileFunc == nil {
		return backend.Compiled{}, &backend.Error{Kind: backend.NoAnswer, Message: "INPUT_INVALID: the input could not be analyzed"}
	}
	return s.fake.CompileFunc(ctx, s.selection, export)
}

func (s *fakeSession) Presentation(ctx context.Context, focus *form.InputForm) backend.Presentation {
	s.use()
	if s.fake.PresentationFunc == nil {
		return backend.Presentation{}
	}
	return s.fake.PresentationFunc(ctx, s.selection, focus)
}

func (s *fakeSession) Policies(ctx context.Context, overlays []string) (backend.PolicySet, error) {
	s.use()
	s.fake.mu.Lock()
	s.fake.overlays = append(s.fake.overlays, append([]string{}, overlays...))
	s.fake.mu.Unlock()
	if s.fake.PoliciesFunc == nil {
		return PolicySet{}, nil
	}
	return s.fake.PoliciesFunc(ctx, s.selection, overlays)
}

func (s *fakeSession) Definitions(ctx context.Context) (backend.Definitions, error) {
	s.use()
	if s.fake.DefinitionsFunc == nil {
		return backend.Definitions{}, refused("Definitions")
	}
	return s.fake.DefinitionsFunc(ctx, s.selection)
}

func (s *fakeSession) PolicyDefinitions(ctx context.Context, overlays []string) ([]backend.PolicyPackDefinition, error) {
	s.use()
	s.fake.mu.Lock()
	s.fake.overlays = append(s.fake.overlays, append([]string{}, overlays...))
	s.fake.mu.Unlock()
	if s.fake.PolicyDefinitionsFunc == nil {
		return nil, nil
	}
	return s.fake.PolicyDefinitionsFunc(ctx, s.selection, overlays)
}

// refused is the failure of a request no function answers.
func refused(request string) error {
	return &backend.Error{Kind: backend.Failure, Message: "the fake backend answers no " + request}
}

type fakeHome struct{ fake *Fake }

func (h fakeHome) Installed(ctx context.Context, family backend.Family) ([]backend.Unit, error) {
	if h.fake.InstalledFunc == nil {
		return nil, nil
	}
	return h.fake.InstalledFunc(ctx, family)
}

func (h fakeHome) Install(ctx context.Context, request backend.Installation) ([]backend.Unit, error) {
	if h.fake.InstallFunc == nil {
		return nil, refused("Install")
	}
	return h.fake.InstallFunc(ctx, request)
}

func (h fakeHome) Uninstall(ctx context.Context, family backend.Family, versions []string) ([]backend.Unit, error) {
	if h.fake.UninstallFunc == nil {
		return nil, refused("Uninstall")
	}
	return h.fake.UninstallFunc(ctx, family, versions)
}

type fakeProjects struct{ fake *Fake }

func (p fakeProjects) Prepare(ctx context.Context, request backend.Preparation) (backend.Prepared, error) {
	if p.fake.PrepareFunc == nil {
		return backend.Prepared{}, refused("Prepare")
	}
	return p.fake.PrepareFunc(ctx, request)
}

// Selected without SelectedFunc selects nothing.
func (p fakeProjects) Selected(ctx context.Context, project string) ([]backend.Family, error) {
	if p.fake.SelectedFunc == nil {
		return nil, nil
	}
	return p.fake.SelectedFunc(ctx, project)
}

func (p fakeProjects) Vendor(ctx context.Context, request backend.Vendoring) (backend.Vendored, error) {
	if p.fake.VendorFunc == nil {
		return backend.Vendored{}, refused("Vendor")
	}
	return p.fake.VendorFunc(ctx, request)
}

func (p fakeProjects) Change(ctx context.Context, request backend.Change, notices io.Writer) (backend.Changed, error) {
	if p.fake.ChangeFunc == nil {
		return backend.Changed{}, refused("Change")
	}
	return p.fake.ChangeFunc(ctx, request, notices)
}

type fakeAuthoring struct{ fake *Fake }

func (a fakeAuthoring) Dialects(ctx context.Context, directory string) (backend.DialectCompilation, error) {
	if a.fake.DialectsFunc == nil {
		return backend.DialectCompilation{}, refused("Dialects")
	}
	return a.fake.DialectsFunc(ctx, directory)
}

func (a fakeAuthoring) Format(ctx context.Context, name string, source []byte) ([]byte, error) {
	if a.fake.FormatFunc == nil {
		return nil, refused("Format")
	}
	return a.fake.FormatFunc(ctx, name, source)
}

func (a fakeAuthoring) PolicyPack(ctx context.Context, directory string, semantics form.Semantics, notices io.Writer) (backend.CompiledPolicyPack, error) {
	if a.fake.PolicyPackFunc == nil {
		return backend.CompiledPolicyPack{}, refused("PolicyPack")
	}
	return a.fake.PolicyPackFunc(ctx, directory, semantics, notices)
}

func (a fakeAuthoring) Package(ctx context.Context, request backend.Packaging) ([]backend.Packaged, error) {
	if a.fake.PackageFunc == nil {
		return nil, refused("Package")
	}
	return a.fake.PackageFunc(ctx, request)
}

func (a fakeAuthoring) Publish(ctx context.Context, request backend.Publication) (backend.Published, error) {
	if a.fake.PublishFunc == nil {
		return backend.Published{}, refused("Publish")
	}
	return a.fake.PublishFunc(ctx, request)
}

func (a fakeAuthoring) ServeLanguage(ctx context.Context, input io.ReadCloser, output io.Writer) error {
	if a.fake.ServeLanguageFunc == nil {
		return refused("ServeLanguage")
	}
	return a.fake.ServeLanguageFunc(ctx, input, output)
}

// PolicySet is a scriptable Policy set: it lists PackList and evaluates with
// EvaluateFunc. Without EvaluateFunc every architecture is left without an
// answer.
type PolicySet struct {
	PackList     []backend.Pack
	EvaluateFunc func(ctx context.Context, architecture *form.InputForm, stage form.Stage, selected []string) policyresult.Architecture
}

// Packs returns PackList.
func (p PolicySet) Packs() []backend.Pack { return append([]backend.Pack{}, p.PackList...) }

// Evaluate answers with EvaluateFunc.
func (p PolicySet) Evaluate(ctx context.Context, architecture *form.InputForm, stage form.Stage, selected []string) policyresult.Architecture {
	if p.EvaluateFunc == nil {
		return policyresult.ArchitectureUnavailable(len(selected), "POLICY_UNAVAILABLE", "the fake backend evaluates nothing")
	}
	return p.EvaluateFunc(ctx, architecture, stage, selected)
}
