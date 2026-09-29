package command

import (
	"errors"
	"strings"
	"testing"
)

type exitSelectionService struct{ err error }

func (s exitSelectionService) Mutate(SelectionOptions) error { return s.err }

type exitConflict struct{}

func (exitConflict) Error() string  { return "selection conflicts" }
func (exitConflict) NoAnswer() bool { return true }

type exitStoreService struct{ err error }

func (s exitStoreService) Install(InstallOptions) error     { return s.err }
func (s exitStoreService) Uninstall(UninstallOptions) error { return s.err }

type exitVendorService struct {
	outcome VendorOutcome
	err     error
}

func (s exitVendorService) Vendor(VendorOptions) (VendorOutcome, error) { return s.outcome, s.err }

type exitValidateService struct {
	outcome ValidateOutcome
	err     error
}

func (s exitValidateService) Validate(ValidateOptions) (ValidateOutcome, error) {
	return s.outcome, s.err
}

type exitFmtService struct {
	outcome FmtOutcome
	err     error
}

func (s exitFmtService) Fmt(FmtOptions) (FmtOutcome, error) { return s.outcome, s.err }

type exitTestService struct {
	outcome TestOutcome
	err     error
}

func (s exitTestService) Test(TestOptions) (TestOutcome, error) { return s.outcome, s.err }

func TestCommandFamilyExitContract(t *testing.T) {
	negative := NegativeError{Message: "named object is absent"}
	failure := errors.New("the operation could not be completed")
	cases := []struct {
		name string
		args []string
		set  func(*Env, error)
	}{
		{"add", []string{"add", "dialects", "./source"}, func(e *Env, err error) { e.Selection = exitSelectionService{err} }},
		{"remove", []string{"remove", "dialects", "missing"}, func(e *Env, err error) { e.Selection = exitSelectionService{err} }},
		{"update", []string{"update", "dialect", "missing"}, func(e *Env, err error) { e.Selection = exitSelectionService{err} }},
		{"install", []string{"install", "dialects", "registry.example.com/acme/dialects:1"}, func(e *Env, err error) { e.Store = exitStoreService{err} }},
		{"uninstall", []string{"uninstall", "dialects", "missing@0.1.0"}, func(e *Env, err error) { e.Store = exitStoreService{err} }},
		{"compile", []string{"compile", "policy-pack", "./source", "--semantics", "form.json", "-o", "pack.json"}, func(e *Env, err error) { e.Compile = &stubCompile{err: err} }},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			for _, state := range []struct {
				name string
				err  error
				want int
			}{
				{"negative", negative, ExitNegative},
				{"failure", failure, ExitFailure},
			} {
				t.Run(state.name, func(t *testing.T) {
					var stdout, stderr strings.Builder
					env := &Env{Stdout: &stdout, Stderr: &stderr, Args: tc.args, Getenv: func(string) string { return "" }}
					tc.set(env, state.err)
					if got := Run(env); got != state.want {
						t.Fatalf("exit = %d, want %d; stderr = %q", got, state.want, stderr.String())
					}
					if state.want == ExitFailure && stderr.String() != "rootform: "+failure.Error()+"\n" {
						t.Fatalf("failure diagnostic = %q", stderr.String())
					}
				})
			}
		})
	}
}

func TestOutcomeFamilyExitContract(t *testing.T) {
	cases := []struct {
		name        string
		args        []string
		setNegative func(*Env)
		setFailure  func(*Env)
	}{
		{"validate", []string{"validate", "form", "form.json"}, func(e *Env) { e.Validate = exitValidateService{outcome: ValidateInvalid} }, func(e *Env) {
			e.Validate = exitValidateService{err: errors.New("validation report could not be written")}
		}},
		{"fmt", []string{"fmt", "./source", "--check"}, func(e *Env) { e.Fmt = exitFmtService{outcome: FmtInvalid} }, func(e *Env) { e.Fmt = exitFmtService{err: errors.New("source could not be read")} }},
		{"test", []string{"test", "./fixtures"}, func(e *Env) { e.Test = exitTestService{outcome: TestFailed} }, func(e *Env) { e.Test = exitTestService{err: errors.New("fixture could not be read")} }},
		{"package", []string{"package", "dialects", "./source", "--to", "./oci"}, func(e *Env) { e.Package = &stubPackage{outcome: PackageInvalid} }, func(e *Env) { e.Package = &stubPackage{err: errors.New("package could not be written")} }},
		{"publish", []string{"publish", "dialects", "./oci", "--to", "registry.example.com/acme/dialects"}, func(e *Env) { e.Publish = &stubPublish{outcome: PublishInvalid} }, func(e *Env) { e.Publish = &stubPublish{err: errors.New("registry could not be reached")} }},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			for _, state := range []struct {
				name string
				set  func(*Env)
				want int
			}{
				{"negative", tc.setNegative, ExitNegative},
				{"failure", tc.setFailure, ExitFailure},
			} {
				t.Run(state.name, func(t *testing.T) {
					var stdout, stderr strings.Builder
					env := &Env{Stdout: &stdout, Stderr: &stderr, Args: tc.args, Getenv: func(string) string { return "" }}
					state.set(env)
					if got := Run(env); got != state.want {
						t.Fatalf("exit = %d, want %d; stderr = %q", got, state.want, stderr.String())
					}
					if state.want == ExitFailure && (!strings.HasPrefix(stderr.String(), "rootform: ") || strings.Count(stderr.String(), "\n") != 1) {
						t.Fatalf("failure diagnostic = %q", stderr.String())
					}
				})
			}
		})
	}
}

func TestVendorExitContract(t *testing.T) {
	for _, tc := range []struct {
		name    string
		service exitVendorService
		want    int
		stderr  string
	}{
		{"empty selection", exitVendorService{outcome: VendorNoAnswer}, ExitNoAnswer, ""},
		{"invalid content", exitVendorService{outcome: VendorInvalid}, ExitNegative, ""},
		{"refused operation", exitVendorService{outcome: VendorFailure}, ExitFailure, ""},
		{"read failure", exitVendorService{err: errors.New("rootform.lock could not be read")}, ExitFailure,
			"rootform: rootform.lock could not be read\n"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			var stdout, stderr strings.Builder
			got := Run(&Env{Stdout: &stdout, Stderr: &stderr, Args: []string{"vendor"}, Vendor: tc.service})
			if got != tc.want {
				t.Fatalf("exit = %d, want %d; stderr = %q", got, tc.want, stderr.String())
			}
			if stderr.String() != tc.stderr {
				t.Fatalf("failure diagnostic = %q", stderr.String())
			}
		})
	}
}

func TestSelectionConflictHasNoAnswer(t *testing.T) {
	var stdout, stderr strings.Builder
	got := Run(&Env{
		Stdout: &stdout, Stderr: &stderr,
		Args:      []string{"add", "dialects", "./source"},
		Selection: exitSelectionService{err: exitConflict{}},
	})
	if got != ExitNoAnswer || stderr.String() != "rootform: selection conflicts\n" {
		t.Fatalf("exit = %d, stderr = %q", got, stderr.String())
	}
}

func TestChangedCommandExitHelp(t *testing.T) {
	for path, want := range map[string]string{
		"add": "02", "remove": "02", "update": "02",
		"install": "02", "uninstall": "02", "validate": "02",
		"compile": "02", "package": "02", "publish": "02",
		"init":         "01234",
		"add dialects": "01234", "add policy-packs": "01234", "remove dialects": "01234",
		"update dialect": "01234", "update policy-pack": "01234",
		"install dialects": "01234", "install policy-packs": "01234", "uninstall dialects": "0124",
		"vendor": "01234", "vendor dialects": "01234", "vendor policy-packs": "01234",
		"validate form": "01234", "validate dialects": "01234", "validate rule": "01234",
		"fmt": "0124", "test": "01234", "compile policy-pack": "0124",
		"package dialects": "0124", "package policy-packs": "0124",
		"publish dialects": "0124", "publish policy-packs": "0124",
	} {
		t.Run(path, func(t *testing.T) {
			command := findCommand(t, NewRootCommand(&Env{}), strings.Fields(path)...)
			_, block, found := strings.Cut(command.Long, "Exit status:\n")
			if !found {
				t.Fatal("missing Exit status block")
			}
			var got strings.Builder
			for _, line := range strings.Split(block, "\n") {
				if len(line) > 80 {
					t.Errorf("help line has %d columns: %q", len(line), line)
				}
				if len(line) >= 4 && strings.HasPrefix(line, "  ") && line[2] >= '0' && line[2] <= '9' && line[3] == ' ' {
					got.WriteByte(line[2])
				}
			}
			if got.String() != want {
				t.Fatalf("statuses = %q, want %q; block = %q", got.String(), want, block)
			}
		})
	}
}
