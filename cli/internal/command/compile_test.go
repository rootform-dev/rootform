package command

import (
	"errors"
	"reflect"
	"strings"
	"testing"
)

type stubCompile struct {
	got []CompileOptions
	err error
}

func (s *stubCompile) CompilePolicyPack(options CompileOptions) error {
	s.got = append(s.got, options)
	return s.err
}

func TestCompilePolicyPackOptions(t *testing.T) {
	for _, outputFlag := range []string{"-o", "--output"} {
		t.Run(outputFlag, func(t *testing.T) {
			service := &stubCompile{}
			env, _, stderr := newTestEnv([]string{
				"compile", "policy-pack", "./policy sources", "--semantics", "./arch.json",
				outputFlag, "./compiled.json",
			}, &recorderService{})
			env.Compile = service
			if code := Run(env); code != ExitOK {
				t.Fatalf("exit = %d: %s", code, stderr.String())
			}
			want := []CompileOptions{{Source: "./policy sources", Semantics: "./arch.json", Output: "./compiled.json"}}
			if !reflect.DeepEqual(service.got, want) {
				t.Fatalf("options = %#v, want %#v", service.got, want)
			}
		})
	}
}

func TestCompilePolicyPackUsage(t *testing.T) {
	for _, args := range [][]string{
		{"compile"},
		{"compile", "unknown"},
		{"compile", "policy-pack"},
		{"compile", "policy-pack", "--semantics", "arch.json", "-o", "pack.json"},
		{"compile", "policy-pack", "one", "two", "--semantics", "arch.json", "-o", "pack.json"},
		{"compile", "policy-pack", "", "--semantics", "arch.json", "-o", "pack.json"},
		{"compile", "policy-pack", "policies", "-o", "pack.json"},
		{"compile", "policy-pack", "policies", "--semantics", "arch.json"},
		{"compile", "policy-pack", "policies", "--semantics=", "-o", "pack.json"},
		{"compile", "policy-pack", "policies", "--semantics", "arch.json", "--output="},
		{"compile", "policy-pack", "policies", "--semantics", "-", "-o", "pack.json"},
		{"compile", "policy-pack", "policies", "--semantics", "arch.json", "-o", "-"},
		{"compile", "policy-pack", "policies", "--semantics"},
		{"compile", "policy-pack", "policies", "--unknown"},
	} {
		t.Run(strings.Join(args, " "), func(t *testing.T) {
			service := &stubCompile{}
			env, _, stderr := newTestEnv(args, &recorderService{})
			env.Compile = service
			if code := Run(env); code != ExitUsage {
				t.Fatalf("exit = %d: %s", code, stderr.String())
			}
			assertUsageDiagnostic(t, stderr.String())
			if len(service.got) != 0 {
				t.Fatal("invalid usage called the service")
			}
		})
	}
}

func TestCompilePolicyPackServiceFailure(t *testing.T) {
	for _, service := range []*stubCompile{nil, {err: errors.New("cannot write compiled Policy Pack")}} {
		env, _, stderr := newTestEnv([]string{
			"compile", "policy-pack", "policies", "--semantics", "arch.json", "-o", "pack.json",
		}, &recorderService{})
		if service != nil {
			env.Compile = service
		}
		if code := Run(env); code != ExitFailure {
			t.Fatalf("exit = %d: %s", code, stderr.String())
		}
		if service != nil && !strings.Contains(stderr.String(), service.err.Error()) {
			t.Fatalf("missing diagnostic: %s", stderr.String())
		}
	}
}

func TestCompileHelpAndGroup(t *testing.T) {
	env, stdout, stderr := newTestEnv([]string{"compile", "policy-pack", "--help"}, &recorderService{})
	service := &stubCompile{}
	env.Compile = service
	if code := Run(env); code != ExitOK {
		t.Fatalf("exit = %d: %s", code, stderr.String())
	}
	for _, want := range []string{"--semantics", "--output", "saved Form", "semantic pins", "offline", "Dialect sources", "form.json"} {
		if !strings.Contains(stdout.String(), want) {
			t.Fatalf("help missing %q: %s", want, stdout.String())
		}
	}
	if len(service.got) != 0 {
		t.Fatal("help called the service")
	}
	cmd, _, err := NewRootCommand(env).Find([]string{"compile"})
	if err != nil || cmd.GroupID != groupAuthor {
		t.Fatalf("compile group = %q: %v", cmd.GroupID, err)
	}
}
