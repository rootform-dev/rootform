package command

import (
	"reflect"
	"strings"
	"testing"
)

func completionCandidates(t *testing.T, args ...string) ([]string, string) {
	t.Helper()
	env, stdout, stderr := newTestEnv(append([]string{"__complete"}, args...), &recorderService{})
	if code := Run(env); code != ExitOK {
		t.Fatalf("__complete %v = %d: %s", args, code, stderr)
	}
	words, directive := []string{}, ""
	for _, line := range strings.Split(strings.TrimSpace(stdout.String()), "\n") {
		if strings.HasPrefix(line, ":") {
			directive = line
			continue
		}
		word, _, _ := strings.Cut(line, "\t")
		words = append(words, word)
	}
	return words, directive
}

func TestCompletionOffersCommandsAndValues(t *testing.T) {
	stages := []string{"planned", "refreshed", "recorded"}
	cases := []struct {
		args []string
		want []string
	}{
		{[]string{"run", "--stage", ""}, stages},
		{[]string{"run", "--before-stage", ""}, stages},
		{[]string{"run", "--after-stage", ""}, stages},
		{[]string{"run", "--format", ""}, []string{"text", "json", "markdown", "html"}},
		{[]string{"check", "--side", ""}, []string{"before", "after", "both"}},
		{[]string{"check", "--stage", ""}, stages},
		{[]string{"check", "--format", ""}, []string{"text", "json", "markdown", "sarif"}},
		{[]string{"check", "--producer", ""}, []string{"terraform", "opentofu"}},
		{[]string{"check", "--plan-complete", ""}, []string{"attested"}},
		{[]string{"explain", "instance", "x", "--side", ""}, []string{"before", "after"}},
		{[]string{"explain", "instance", "x", "--stage", ""}, stages},
		{[]string{"explain", "rule", "x", "--format", ""}, []string{"text", "json"}},
		{[]string{"explain", "policy", "x", "--side", ""}, []string{"before", "after"}},
		{[]string{"explain", "policy", "x", "--producer", ""}, []string{"terraform", "opentofu"}},
		{[]string{"explain", "policy", "x", "--format", ""}, []string{"text", "json"}},
		{[]string{"list", "dialects", "--format", ""}, []string{"text", "wide", "json"}},
		{[]string{"list", "policies", "--format", ""}, []string{"text", "wide", "json"}},
		{[]string{"show", "x", "--format", ""}, []string{"text", "json"}},
		{[]string{"show", "policy", "x", "--format", ""}, []string{"text", "json"}},
		{[]string{"validate", "form", "x", "--format", ""}, []string{"text", "json"}},
		{[]string{"init", "--format", ""}, []string{"text", "json"}},
		{[]string{"test", "--format", ""}, []string{"text", "json"}},
		{[]string{"publish", "dialects", "x", "--format", ""}, []string{"text", "json"}},
		{[]string{"add", "dialects", "x", "--format", ""}, []string{"text", "json"}},
		{[]string{"run", "--color", ""}, []string{"auto", "always", "never"}},
	}
	for _, tc := range cases {
		words, directive := completionCandidates(t, tc.args...)
		if !reflect.DeepEqual(words, tc.want) || directive != ":4" {
			t.Errorf("__complete %q offered %q with %s, want %q with :4", tc.args, words, directive, tc.want)
		}
	}

	words, _ := completionCandidates(t, "explain", "")
	if !reflect.DeepEqual(words, []string{"instance", "policy", "rule"}) {
		t.Errorf("explain completes %q, want its three subcommands", words)
	}

	env, _, stderr := newTestEnv([]string{"run", "__complete"}, &recorderService{})
	if code := Run(env); code != ExitUsage || !strings.Contains(stderr.String(), "reserved command name: __complete") {
		t.Errorf("run __complete = %d, want a usage refusal naming the reserved word: %s", code, stderr)
	}
}

func TestCompletion(t *testing.T) {
	t.Run("every supported shell gets a script", func(t *testing.T) {
		for _, shell := range completionShells() {
			env, stdout, stderr := newTestEnv([]string{"completion", shell}, &recorderService{})
			if got := Run(env); got != ExitOK {
				t.Fatalf("Run(completion %s) = %d, want %d: %s", shell, got, ExitOK, stderr.String())
			}
			if stdout.Len() == 0 {
				t.Fatalf("completion %s produced no script", shell)
			}
			if stderr.Len() != 0 {
				t.Fatalf("completion %s wrote to standard error: %q", shell, stderr.String())
			}
		}
	})

	// Completion is generated locally. A script that reached for a network
	// address would break the product's offline guarantee.
	t.Run("a generated script contacts nothing", func(t *testing.T) {
		for _, shell := range completionShells() {
			env, stdout, _ := newTestEnv([]string{"completion", shell}, &recorderService{})
			if got := Run(env); got != ExitOK {
				t.Fatalf("Run(completion %s) = %d, want %d", shell, got, ExitOK)
			}
			for _, line := range strings.Split(stdout.String(), "\n") {
				// A commented address documents an upstream issue; only an
				// executable line could actually reach for it.
				if strings.HasPrefix(strings.TrimSpace(line), "#") {
					continue
				}
				for _, reach := range []string{"http://", "https://", "curl ", "wget "} {
					if strings.Contains(line, reach) {
						t.Fatalf("the %s script carries %q: %s", shell, reach, line)
					}
				}
			}
		}
	})

	t.Run("a shell name is required", func(t *testing.T) {
		env, _, stderr := newTestEnv([]string{"completion"}, &recorderService{})
		if got := Run(env); got != ExitUsage {
			t.Fatalf("Run = %d, want %d", got, ExitUsage)
		}
		assertUsageDiagnostic(t, stderr.String())
		for _, shell := range completionShells() {
			if !strings.Contains(stderr.String(), shell) {
				t.Fatalf("the report does not list %q as an accepted shell:\n%s", shell, stderr.String())
			}
		}
	})

	t.Run("an unsupported shell names what was expected", func(t *testing.T) {
		env, _, stderr := newTestEnv([]string{"completion", "csh"}, &recorderService{})
		if got := Run(env); got != ExitUsage {
			t.Fatalf("Run = %d, want %d", got, ExitUsage)
		}
		assertUsageDiagnostic(t, stderr.String())
		if !strings.Contains(stderr.String(), `"csh"`) {
			t.Fatalf("the report does not quote the requested shell:\n%s", stderr.String())
		}
	})

	t.Run("one script at a time", func(t *testing.T) {
		env, _, stderr := newTestEnv([]string{"completion", "bash", "zsh"}, &recorderService{})
		if got := Run(env); got != ExitUsage {
			t.Fatalf("Run = %d, want %d", got, ExitUsage)
		}
		assertUsageDiagnostic(t, stderr.String())
	})
}

func TestVersionReportsTheBinaryVersion(t *testing.T) {
	env, stdout, stderr := newTestEnv([]string{"version"}, &recorderService{})
	env.Version = "1.2.3"
	if got := Run(env); got != ExitOK {
		t.Fatalf("Run = %d, want %d: %s", got, ExitOK, stderr.String())
	}
	if stdout.String() != "rootform 1.2.3\n" {
		t.Fatalf("printed %q, want the version alone", stdout.String())
	}
}
