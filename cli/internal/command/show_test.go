package command

import (
	"os"
	"reflect"
	"strings"
	"testing"
)

type stubShow struct {
	got     []ShowOptions
	outcome ShowOutcome
}

func (s *stubShow) Show(options ShowOptions) (ShowOutcome, error) {
	s.got = append(s.got, options)
	return s.outcome, nil
}

// The name is resolved against the loaded catalog, so the command surface
// passes it through exactly as typed, whatever shape it has.
func TestShowPassesOneNameThrough(t *testing.T) {
	for _, name := range []string{
		"google", "rf", "google.rule.cloud-sql-instance",
		"rf.concept.virtual-network", "cloud-sql-instance",
	} {
		t.Run(name, func(t *testing.T) {
			service := &stubShow{outcome: ShowReported}
			stdout, stderr := &strings.Builder{}, &strings.Builder{}
			if got := Run(&Env{
				Stdout: stdout, Stderr: stderr,
				Args: []string{"show", name}, Show: service,
			}); got != ExitOK {
				t.Fatalf("Run = %d, want %d: %s", got, ExitOK, stderr.String())
			}
			want := []ShowOptions{{Object: ShowDefinition, Name: name, Format: FormatText}}
			if !reflect.DeepEqual(service.got, want) {
				t.Fatalf("options = %#v, want %#v", service.got, want)
			}
		})
	}
}

func TestShowSelectsTheReportedShape(t *testing.T) {
	for _, args := range [][]string{
		{"show", "google", "--format", "json"},
	} {
		t.Run(strings.Join(args, " "), func(t *testing.T) {
			service := &stubShow{outcome: ShowReported}
			stdout, stderr := &strings.Builder{}, &strings.Builder{}
			if got := Run(&Env{
				Stdout: stdout, Stderr: stderr, Args: args, Show: service,
			}); got != ExitOK {
				t.Fatalf("Run = %d, want %d: %s", got, ExitOK, stderr.String())
			}
			want := []ShowOptions{{Object: ShowDefinition, Name: "google", Format: FormatJSON}}
			if !reflect.DeepEqual(service.got, want) {
				t.Fatalf("options = %#v, want %#v", service.got, want)
			}
		})
	}
}

func TestShowPassesProject(t *testing.T) {
	t.Chdir(t.TempDir())
	if err := os.Mkdir("infra", 0o755); err != nil {
		t.Fatal(err)
	}
	service := &stubShow{outcome: ShowReported}
	stdout, stderr := &strings.Builder{}, &strings.Builder{}
	if got := Run(&Env{
		Stdout: stdout, Stderr: stderr,
		Args: []string{"show", "google", "--project", "./infra"}, Show: service,
	}); got != ExitOK {
		t.Fatalf("Run = %d, want %d: %s", got, ExitOK, stderr.String())
	}
	want := []ShowOptions{{Object: ShowDefinition, Name: "google", Project: "./infra", Format: FormatText}}
	if !reflect.DeepEqual(service.got, want) {
		t.Fatalf("options = %#v, want %#v", service.got, want)
	}
}

func TestShowRefusesOutputFlag(t *testing.T) {
	for _, testCase := range []struct {
		args []string
		want string
	}{
		{args: []string{"show", "google", "-o", "json"}, want: "rootform: -o/--output is not accepted; rootform show writes to standard output\n\nTry:\n  rootform show google --format json\n"},
		{args: []string{"show", "google", "-o", "google.json"}, want: "rootform: -o/--output is not accepted; rootform show writes to standard output\n\nTry:\n  rootform show google --format json > google.json\n"},
		{args: []string{"show", "name with spaces", "-o", "out file.txt"}, want: "rootform: -o/--output is not accepted; rootform show writes to standard output\n\nTry:\n  rootform show 'name with spaces' > 'out file.txt'\n"},
		{args: []string{"show", "-o", "json"}, want: "rootform: -o/--output is not accepted; rootform show writes to standard output\n\nTry:\n  rootform show <name> --format json\n"},
		{args: []string{"show", "policy", "-o", "wide"}, want: "rootform: -o/--output is not accepted; rootform show policy writes to standard output\n\nTry:\n  rootform show policy <identifier> > wide\n"},
		{args: []string{"show", "policy", "example.policy.check", "--output", "json"}, want: "rootform: -o/--output is not accepted; rootform show policy writes to standard output\n\nTry:\n  rootform show policy example.policy.check --format json\n"},
		{args: []string{"show", "policy-pack", "baseline", "-o", "-"}, want: "rootform: -o/--output is not accepted; rootform show policy-pack writes to standard output\n\nTry:\n  rootform show policy-pack baseline\n"},
	} {
		t.Run(strings.Join(testCase.args, " "), func(t *testing.T) {
			service := &stubShow{outcome: ShowReported}
			stdout, stderr := &strings.Builder{}, &strings.Builder{}
			if got := Run(&Env{
				Stdout: stdout, Stderr: stderr, Args: testCase.args, Show: service,
			}); got != ExitUsage {
				t.Fatalf("Run = %d, want %d: %s", got, ExitUsage, stderr.String())
			}
			if stderr.String() != testCase.want {
				t.Fatalf("stderr = %q, want %q", stderr.String(), testCase.want)
			}
			if len(service.got) != 0 || stdout.Len() != 0 {
				t.Fatalf("removed output flag reached service or stdout: %#v, %q",
					service.got, stdout.String())
			}
		})
	}
}

// One definition is one name. The typed forms were removed, so a verb plus a
// name must report how to use the command instead of guessing which was meant.
func TestShowRefusesRemovedTypedForms(t *testing.T) {
	for _, args := range [][]string{
		{"show", "dialect", "google"},
		{"show", "rule", "google.rule.cloud-sql-instance"},
		{"show", "concept", "rf.concept.virtual-network"},
		{"show", "context", "rf.context.network"},
		{"show", "relation", "google.relation.runs-as"},
	} {
		t.Run(strings.Join(args, " "), func(t *testing.T) {
			service := &stubShow{outcome: ShowReported}
			stdout, stderr := &strings.Builder{}, &strings.Builder{}
			if got := Run(&Env{
				Stdout: stdout, Stderr: stderr, Args: args, Show: service,
			}); got != ExitUsage {
				t.Fatalf("Run(%v) = %d, want %d", args, got, ExitUsage)
			}
			if !strings.Contains(stderr.String(), "rootform show <name>") {
				t.Fatalf("the report does not name the accepted form:\n%s", stderr.String())
			}
			if len(service.got) != 0 || stdout.Len() != 0 {
				t.Fatalf("a removed form reached the service: %#v, %q",
					service.got, stdout.String())
			}
		})
	}
}

func TestShowPolicyPackSurface(t *testing.T) {
	t.Run("policy-pack passes name, local roots, and format", func(t *testing.T) {
		service := &stubShow{outcome: ShowReported}
		stdout, stderr := &strings.Builder{}, &strings.Builder{}
		if got := Run(&Env{
			Stdout: stdout, Stderr: stderr,
			Args: []string{"show", "policy-pack", "baseline",
				"--policy-pack", "./policies", "--format", "json"},
			Show: service,
		}); got != ExitOK {
			t.Fatalf("Run = %d, want %d: %s", got, ExitOK, stderr.String())
		}
		want := []ShowOptions{{
			Object: ShowPolicyPack, Name: "baseline", Format: FormatJSON,
			PolicyPack: []string{"./policies"},
		}}
		if !reflect.DeepEqual(service.got, want) {
			t.Fatalf("options = %#v, want %#v", service.got, want)
		}
	})

	t.Run("policy passes a pack-qualified identifier and local roots", func(t *testing.T) {
		service := &stubShow{outcome: ShowReported}
		stdout, stderr := &strings.Builder{}, &strings.Builder{}
		if got := Run(&Env{
			Stdout: stdout, Stderr: stderr,
			Args: []string{"show", "policy", "baseline.policy.cluster-network-context",
				"--policy-pack", "./policies"},
			Show: service,
		}); got != ExitOK {
			t.Fatalf("Run = %d, want %d: %s", got, ExitOK, stderr.String())
		}
		want := []ShowOptions{{
			Object: ShowPolicy, Name: "baseline.policy.cluster-network-context",
			Format: FormatText, PolicyPack: []string{"./policies"},
		}}
		if !reflect.DeepEqual(service.got, want) {
			t.Fatalf("options = %#v, want %#v", service.got, want)
		}
	})

	t.Run("a name is required", func(t *testing.T) {
		service := &stubShow{outcome: ShowReported}
		stdout, stderr := &strings.Builder{}, &strings.Builder{}
		if got := Run(&Env{
			Stdout: stdout, Stderr: stderr,
			Args: []string{"show", "policy-pack"}, Show: service,
		}); got != ExitUsage {
			t.Fatalf("Run = %d, want %d: %s", got, ExitUsage, stderr.String())
		}
		if len(service.got) != 0 || stdout.Len() != 0 {
			t.Fatalf("usage reached the service or wrote stdout: %#v, %q",
				service.got, stdout.String())
		}
	})

	t.Run("the bare form refuses the local Policy Pack flag", func(t *testing.T) {
		service := &stubShow{outcome: ShowReported}
		stdout, stderr := &strings.Builder{}, &strings.Builder{}
		if got := Run(&Env{
			Stdout: stdout, Stderr: stderr,
			Args: []string{"show", "google", "--policy-pack", "./policies"},
			Show: service,
		}); got != ExitUsage {
			t.Fatalf("Run = %d, want %d: %s", got, ExitUsage, stderr.String())
		}
		if len(service.got) != 0 {
			t.Fatalf("usage reached the service with %#v", service.got)
		}
	})
}

func TestShowExitContract(t *testing.T) {
	for _, testCase := range []struct {
		name    string
		args    []string
		outcome ShowOutcome
		want    int
	}{
		{name: "reported", args: []string{"show", "google"}, outcome: ShowReported, want: ExitOK},
		{name: "not found", args: []string{"show", "gooogle"}, outcome: ShowNotFound, want: ExitNegative},
		{name: "undecided", args: []string{"show", "shared"}, outcome: ShowUndecided, want: ExitNoAnswer},
		{name: "write failure", args: []string{"show", "google"}, outcome: ShowFailure, want: ExitFailure},
		{name: "invalid reference", args: []string{"show", "google.frob.x"},
			outcome: ShowInvalidReference, want: ExitUsage},
		{name: "pack reported", args: []string{"show", "policy-pack", "baseline"},
			outcome: ShowReported, want: ExitOK},
		{name: "pack not found", args: []string{"show", "policy-pack", "baseline"},
			outcome: ShowNotFound, want: ExitNegative},
		{name: "policy undecided", args: []string{"show", "policy", "cluster-network-context"},
			outcome: ShowUndecided, want: ExitNoAnswer},
	} {
		t.Run(testCase.name, func(t *testing.T) {
			stdout, stderr := &strings.Builder{}, &strings.Builder{}
			if got := Run(&Env{
				Stdout: stdout, Stderr: stderr, Args: testCase.args,
				Show: &stubShow{outcome: testCase.outcome},
			}); got != testCase.want {
				t.Fatalf("Run = %d, want %d", got, testCase.want)
			}
		})
	}
}
