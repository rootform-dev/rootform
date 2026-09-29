package command

import (
	"errors"
	"reflect"
	"strings"
	"testing"
)

type stubInit struct {
	got     []InitOptions
	outcome InitOutcome
	err     error
}

func (s *stubInit) Init(options InitOptions) (InitOutcome, error) {
	s.got = append(s.got, options)
	return s.outcome, s.err
}

func newInitEnv(args []string, service *stubInit) (*Env, *strings.Builder, *strings.Builder) {
	out := &strings.Builder{}
	errOut := &strings.Builder{}
	return &Env{
		Stdout: out,
		Stderr: errOut,
		Args:   args,
		Getenv: func(string) string { return "" },
		Init:   service,
	}, out, errOut
}

func TestInitCommandContract(t *testing.T) {
	t.Run("help describes explicit preparation only", func(t *testing.T) {
		service := &stubInit{outcome: InitCompleted}
		env, stdout, stderr := newInitEnv([]string{"init", "--help"}, service)
		if got := Run(env); got != ExitOK {
			t.Fatalf("Run = %d, want %d: %s", got, ExitOK, stderr.String())
		}
		for _, phrase := range []string{
			"never detects providers",
			"never acquired",
			"required and valid",
			"already pinned by rootform.lock",
			"--details",
		} {
			if !strings.Contains(stdout.String(), phrase) {
				t.Fatalf("init help misses %q: %s", phrase, stdout.String())
			}
		}
		for _, phrase := range []string{"--verbose", "Terraform or OpenTofu root"} {
			if strings.Contains(stdout.String(), phrase) {
				t.Fatalf("init help still contains %q: %s", phrase, stdout.String())
			}
		}
		if len(service.got) != 0 {
			t.Fatalf("help called service %d times", len(service.got))
		}
	})

	t.Run("defaults to dot", func(t *testing.T) {
		service := &stubInit{outcome: InitCompleted}
		env, _, stderr := newInitEnv([]string{"init"}, service)
		if got := Run(env); got != ExitOK {
			t.Fatalf("Run = %d, want %d: %s", got, ExitOK, stderr.String())
		}
		want := InitOptions{Path: ".", Format: FormatText}
		if !reflect.DeepEqual(service.got, []InitOptions{want}) {
			t.Fatalf("options = %#v, want %#v", service.got, want)
		}
	})

	t.Run("passes path and accepted flags", func(t *testing.T) {
		service := &stubInit{outcome: InitCompleted}
		args := []string{
			"init", "./infra", "--locked", "--offline", "--no-input", "--details",
			"--format", "json",
		}
		env, _, stderr := newInitEnv(args, service)
		if got := Run(env); got != ExitOK {
			t.Fatalf("Run = %d, want %d: %s", got, ExitOK, stderr.String())
		}
		want := InitOptions{
			Path: "./infra", Locked: true, Offline: true, NoInput: true,
			Details: true, Format: FormatJSON,
		}
		if !reflect.DeepEqual(service.got, []InitOptions{want}) {
			t.Fatalf("options = %#v, want %#v", service.got, want)
		}
	})

	t.Run("verbose aliases are rejected", func(t *testing.T) {
		for _, flag := range []string{"-v", "--verbose"} {
			service := &stubInit{outcome: InitCompleted}
			env, _, stderr := newInitEnv([]string{"init", flag}, service)
			if got := Run(env); got != ExitUsage {
				t.Fatalf("Run(%s) = %d, want %d", flag, got, ExitUsage)
			}
			if len(service.got) != 0 || !strings.Contains(stderr.String(), "unknown") {
				t.Fatalf("calls = %d, stderr = %q", len(service.got), stderr.String())
			}
		}
	})

	t.Run("acquisition and discovery flags are rejected", func(t *testing.T) {
		for _, flag := range []string{"--source", "--upgrade", "--official-layout", "--policy-pack"} {
			service := &stubInit{outcome: InitCompleted}
			env, _, stderr := newInitEnv([]string{"init", flag, "value"}, service)
			if got := Run(env); got != ExitUsage {
				t.Fatalf("Run(%s) = %d, want %d", flag, got, ExitUsage)
			}
			if len(service.got) != 0 || !strings.Contains(stderr.String(), "unknown flag") {
				t.Fatalf("calls = %d, stderr = %q", len(service.got), stderr.String())
			}
		}
	})

	t.Run("environment forces offline and no input", func(t *testing.T) {
		service := &stubInit{outcome: InitCompleted}
		env, _, stderr := newInitEnv([]string{"init"}, service)
		env.Getenv = func(name string) string {
			return map[string]string{"ROOTFORM_OFFLINE": "1", "ROOTFORM_INPUT": "0"}[name]
		}
		if got := Run(env); got != ExitOK {
			t.Fatalf("Run = %d, want %d: %s", got, ExitOK, stderr.String())
		}
		if !service.got[0].Offline || !service.got[0].NoInput {
			t.Fatalf("options = %#v", service.got[0])
		}
	})

	t.Run("CI and JSON disable prompts", func(t *testing.T) {
		for _, testCase := range []struct {
			name string
			args []string
			env  map[string]string
		}{
			{name: "CI", args: []string{"init"}, env: map[string]string{"CI": "true"}},
			{name: "JSON", args: []string{"init", "--format", "json"}},
		} {
			t.Run(testCase.name, func(t *testing.T) {
				service := &stubInit{outcome: InitCompleted}
				env, _, stderr := newInitEnv(testCase.args, service)
				env.Getenv = func(name string) string { return testCase.env[name] }
				if got := Run(env); got != ExitOK {
					t.Fatalf("Run = %d, want %d: %s", got, ExitOK, stderr.String())
				}
				if !service.got[0].NoInput {
					t.Fatalf("NoInput = false")
				}
			})
		}
	})

	t.Run("no frozen alias", func(t *testing.T) {
		service := &stubInit{outcome: InitCompleted}
		env, _, stderr := newInitEnv([]string{"init", "--frozen"}, service)
		if got := Run(env); got != ExitUsage {
			t.Fatalf("Run = %d, want %d", got, ExitUsage)
		}
		if len(service.got) != 0 || !strings.Contains(stderr.String(), "unknown flag") {
			t.Fatalf("calls = %d, stderr = %q", len(service.got), stderr.String())
		}
	})

	t.Run("undecided and failure map to stable exits", func(t *testing.T) {
		undecided := &stubInit{outcome: InitNoAnswer}
		env, _, _ := newInitEnv([]string{"init"}, undecided)
		if got := Run(env); got != ExitNoAnswer {
			t.Fatalf("undecided Run = %d, want %d", got, ExitNoAnswer)
		}
		invalid := &stubInit{outcome: InitInvalid}
		env, _, _ = newInitEnv([]string{"init"}, invalid)
		if got := Run(env); got != ExitNegative {
			t.Fatalf("invalid Run = %d, want %d", got, ExitNegative)
		}
		failure := &stubInit{outcome: InitFailure}
		env, _, _ = newInitEnv([]string{"init"}, failure)
		if got := Run(env); got != ExitFailure {
			t.Fatalf("failure Run = %d, want %d", got, ExitFailure)
		}
		failed := &stubInit{err: errors.New("sentinel")}
		env, _, _ = newInitEnv([]string{"init"}, failed)
		if got := Run(env); got != ExitFailure {
			t.Fatalf("failed Run = %d, want %d", got, ExitFailure)
		}
	})
}

func TestInitHelpExitStatus(t *testing.T) {
	command := findCommand(t, NewRootCommand(&Env{}), "init")
	want := "Exit status:\n" +
		"  0  preparation completed\n" +
		"  1  selected content is invalid, missing, or differs from rootform.lock\n" +
		"  2  the command was used incorrectly\n" +
		"  3  rootform.lock is required or invalid, or --offline needs content\n" +
		"     that is not installed\n" +
		"  4  a file, the Rootform home, or the registry could not be read or written"
	if !strings.Contains(command.Long, want) {
		t.Fatalf("init exit help = %q, want %q", command.Long, want)
	}
}
