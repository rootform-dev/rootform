package command

import (
	"os"
	"reflect"
	"strings"
	"testing"
)

type stubList struct {
	got     []ListOptions
	outcome ListOutcome
	err     error
}

func (s *stubList) List(options ListOptions) (ListOutcome, error) {
	s.got = append(s.got, options)
	return s.outcome, s.err
}

func TestListPolicyPackSurface(t *testing.T) {
	t.Run("policy-packs passes local roots and format", func(t *testing.T) {
		t.Chdir(t.TempDir())
		if err := os.Mkdir("infra", 0o755); err != nil {
			t.Fatal(err)
		}
		service := &stubList{outcome: ListReported}
		stdout, stderr := &strings.Builder{}, &strings.Builder{}
		if got := Run(&Env{
			Stdout: stdout, Stderr: stderr,
			Args: []string{"list", "policy-packs", "--policy-pack", "./policies",
				"--policy-pack", "./baseline", "--project", "./infra", "--format", "json"},
			List: service,
		}); got != ExitOK {
			t.Fatalf("Run = %d, want %d: %s", got, ExitOK, stderr.String())
		}
		want := []ListOptions{{
			Object: ListPolicyPacks, Format: FormatJSON,
			Project: "./infra", PolicyPack: []string{"./policies", "./baseline"},
		}}
		if !reflect.DeepEqual(service.got, want) {
			t.Fatalf("options = %#v, want %#v", service.got, want)
		}
	})

	t.Run("policies passes local roots", func(t *testing.T) {
		service := &stubList{outcome: ListReported}
		stdout, stderr := &strings.Builder{}, &strings.Builder{}
		if got := Run(&Env{
			Stdout: stdout, Stderr: stderr,
			Args: []string{"list", "policies", "--policy-pack", "./policies"},
			List: service,
		}); got != ExitOK {
			t.Fatalf("Run = %d, want %d: %s", got, ExitOK, stderr.String())
		}
		want := []ListOptions{{
			Object: ListPolicies, Format: FormatText,
			PolicyPack: []string{"./policies"},
		}}
		if !reflect.DeepEqual(service.got, want) {
			t.Fatalf("options = %#v, want %#v", service.got, want)
		}
	})

	t.Run("policy commands refuse dialect-only flags", func(t *testing.T) {
		for _, args := range [][]string{
			{"list", "policies", "--dialect", "google"},
			{"list", "policies", "--installed"},
			{"list", "policies", "google"},
			{"list", "dialects", "--installed", "google"},
			{"list", "dialects", "--installed", "--dialect", "./d"},
			{"list", "dialects", "--installed", "--project", "./infra"},
			{"list", "dialects", "--policy-pack", "./policies"},
		} {
			service := &stubList{outcome: ListReported}
			stdout, stderr := &strings.Builder{}, &strings.Builder{}
			if got := Run(&Env{
				Stdout: stdout, Stderr: stderr,
				Args: args, List: service,
			}); got != ExitUsage {
				t.Fatalf("Run(%v) = %d, want %d", args, got, ExitUsage)
			}
			if len(service.got) != 0 || stdout.Len() != 0 {
				t.Fatalf("Run(%v) reached the service or wrote stdout: %#v, %q",
					args, service.got, stdout.String())
			}
		}
	})

	t.Run("--installed with project options suggests both listings", func(t *testing.T) {
		stdout, stderr := &strings.Builder{}, &strings.Builder{}
		if got := Run(&Env{
			Stdout: stdout, Stderr: stderr,
			Args: []string{"list", "dialects", "aws", "--installed", "--project", "./infra", "--dialect", "./d"}, List: &stubList{},
		}); got != ExitUsage {
			t.Fatalf("Run = %d, want %d", got, ExitUsage)
		}
		want := "rootform: --installed lists the Rootform home; names, --project, --dialect, and\n" +
			"--policy-pack list what a project selects instead\n\n" +
			"Try:\n  rootform list dialects --installed\n  rootform list dialects aws --project ./infra --dialect ./d\n"
		if stderr.String() != want {
			t.Fatalf("stderr = %q, want %q", stderr, want)
		}
	})

	t.Run("an unknown listing outcome is indeterminate", func(t *testing.T) {
		stdout, stderr := &strings.Builder{}, &strings.Builder{}
		if got := Run(&Env{
			Stdout: stdout, Stderr: stderr,
			Args: []string{"list", "policy-packs"}, List: &stubList{},
		}); got != ExitNoAnswer {
			t.Fatalf("Run = %d, want %d", got, ExitNoAnswer)
		}
	})
}

func TestListExitOutcomes(t *testing.T) {
	for _, testCase := range []struct {
		outcome ListOutcome
		want    int
	}{
		{ListNotFound, ExitNegative},
		{ListUndecided, ExitNoAnswer},
		{ListFailure, ExitFailure},
	} {
		stdout, stderr := &strings.Builder{}, &strings.Builder{}
		if got := Run(&Env{Stdout: stdout, Stderr: stderr,
			Args: []string{"list", "dialects"}, List: &stubList{outcome: testCase.outcome},
		}); got != testCase.want {
			t.Errorf("outcome %d exited %d, want %d", testCase.outcome, got, testCase.want)
		}
	}
}

// The wide listing is a reading aid over the same selection, so it must reach
// the service as its own format and never as JSON.
func TestListSelectsTheReportedShape(t *testing.T) {
	for _, testCase := range []struct {
		args []string
		want Format
	}{
		{args: []string{"list", "dialects"}, want: FormatText},
		{args: []string{"list", "dialects", "--format", "wide"}, want: FormatWide},
		{args: []string{"list", "dialects", "--format", "json"}, want: FormatJSON},
	} {
		t.Run(strings.Join(testCase.args, " "), func(t *testing.T) {
			service := &stubList{outcome: ListReported}
			stdout, stderr := &strings.Builder{}, &strings.Builder{}
			if got := Run(&Env{
				Stdout: stdout, Stderr: stderr, Args: testCase.args, List: service,
			}); got != ExitOK {
				t.Fatalf("Run = %d, want %d: %s", got, ExitOK, stderr.String())
			}
			want := []ListOptions{{Object: ListDialects, Format: testCase.want}}
			if !reflect.DeepEqual(service.got, want) {
				t.Fatalf("options = %#v, want %#v", service.got, want)
			}
		})
	}
}

func TestListRefusesAnUnsupportedShape(t *testing.T) {
	service := &stubList{outcome: ListReported}
	stdout, stderr := &strings.Builder{}, &strings.Builder{}
	if got := Run(&Env{
		Stdout: stdout, Stderr: stderr,
		Args: []string{"list", "dialects", "--format", "yaml"}, List: service,
	}); got != ExitUsage {
		t.Fatalf("Run = %d, want %d", got, ExitUsage)
	}
	for _, want := range []string{"yaml", "text, wide, or json", "Try:\n  rootform list dialects --help"} {
		if !strings.Contains(stderr.String(), want) {
			t.Fatalf("the report does not carry %q:\n%s", want, stderr.String())
		}
	}
	if len(service.got) != 0 {
		t.Fatalf("an unsupported shape reached the service: %#v", service.got)
	}
}

func TestListRefusesOutputFlag(t *testing.T) {
	for _, testCase := range []struct {
		args []string
		want string
	}{
		{[]string{"list", "dialects", "-o", "wide"}, "rootform: -o/--output is not accepted; rootform list dialects writes to standard output\n\nTry:\n  rootform list dialects --format wide\n"},
		{[]string{"--color", "never", "list", "dialects", "-o", "json"}, "rootform: -o/--output is not accepted; rootform list dialects writes to standard output\n\nTry:\n  rootform list dialects --format json\n"},
		{[]string{"list", "dialects", "google", "-o", "out.json"}, "rootform: -o/--output is not accepted; rootform list dialects writes to standard output\n\nTry:\n  rootform list dialects google --format json > out.json\n"},
		{[]string{"list", "policies", "--output=policies.txt"}, "rootform: -o/--output is not accepted; rootform list policies writes to standard output\n\nTry:\n  rootform list policies > policies.txt\n"},
		{[]string{"list", "dialects", "-o"}, "rootform: flag needs an argument: 'o' in -o\n\nTry:\n  rootform list dialects --help\n"},
	} {
		t.Run(strings.Join(testCase.args, " "), func(t *testing.T) {
			service := &stubList{outcome: ListReported}
			stdout, stderr := &strings.Builder{}, &strings.Builder{}
			if got := Run(&Env{
				Stdout: stdout, Stderr: stderr, Args: testCase.args, List: service,
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

// Symbol listings were removed in favor of "rootform show <owner>", so the
// old objects must report the objects that remain instead of listing nothing.
func TestListRefusesRemovedObjects(t *testing.T) {
	for _, object := range []string{"rules", "concepts", "contexts", "relations"} {
		t.Run(object, func(t *testing.T) {
			service := &stubList{outcome: ListReported}
			stdout, stderr := &strings.Builder{}, &strings.Builder{}
			if got := Run(&Env{
				Stdout: stdout, Stderr: stderr,
				Args: []string{"list", object}, List: service,
			}); got != ExitUsage {
				t.Fatalf("Run = %d, want %d", got, ExitUsage)
			}
			for _, want := range []string{object, "dialects", "policy-packs", "policies"} {
				if !strings.Contains(stderr.String(), want) {
					t.Fatalf("the report does not carry %q:\n%s", want, stderr.String())
				}
			}
			if len(service.got) != 0 || stdout.Len() != 0 {
				t.Fatalf("a removed object reached the service: %#v, %q",
					service.got, stdout.String())
			}
		})
	}
}
