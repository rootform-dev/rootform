package command

import (
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"

	"github.com/spf13/cobra"
)

func findCommand(t *testing.T, root *cobra.Command, path ...string) *cobra.Command {
	t.Helper()
	found, _, err := root.Find(path)
	if err != nil || found == root {
		t.Fatalf("rootform %s is not a command: %v", strings.Join(path, " "), err)
	}
	return found
}

func TestOfflineLookupHelpExitStatus(t *testing.T) {
	root := NewRootCommand(&Env{})
	for _, path := range [][]string{
		{"add", "dialects"}, {"add", "policy-packs"},
		{"update", "dialect"}, {"update", "policy-pack"},
	} {
		command := findCommand(t, root, path...)
		want := "  3  rootform.lock is invalid, selections conflict, or --offline needs\n" +
			"     content that is not installed\n"
		if !strings.Contains(command.Long, want) {
			t.Errorf("%s exit help = %q, want %q", strings.Join(path, " "), command.Long, want)
		}
	}
	for _, path := range [][]string{{"install", "dialects"}, {"install", "policy-packs"}} {
		command := findCommand(t, root, path...)
		want := "  3  --offline needs content that is not installed"
		if !strings.Contains(command.Long, want) {
			t.Errorf("%s exit help = %q, want %q", strings.Join(path, " "), command.Long, want)
		}
	}
}

// TestRemoveHelpExitStatus keeps remove help to what remove can do: it
// resolves no source, so it names neither --offline nor the network.
func TestRemoveHelpExitStatus(t *testing.T) {
	root := NewRootCommand(&Env{})
	for path, want := range map[string]string{
		"remove dialects": "  1  a named selection is absent or the remaining selection is invalid\n" +
			"  2  the command was used incorrectly\n" +
			"  3  rootform.lock is invalid, or --embedded names a Dialect that is not\n" +
			"     embedded or that a selection replaces\n" +
			"  4  a file or Rootform home operation failed",
		"remove policy-packs": "  1  a named selection is absent or the remaining selection is invalid\n" +
			"  2  the command was used incorrectly\n" +
			"  3  rootform.lock is invalid\n" +
			"  4  a file or Rootform home operation failed",
	} {
		command := findCommand(t, root, strings.Fields(path)...)
		if !strings.HasSuffix(command.Long, want) || strings.Contains(command.Long, "--offline") {
			t.Errorf("%s exit help = %q, want suffix %q", path, command.Long, want)
		}
	}
}

// TestProjectMustBeADirectory refuses a --project that names no directory
// before any service reads it, as run, check, and explain do.
func TestProjectMustBeADirectory(t *testing.T) {
	file := filepath.Join(t.TempDir(), "rootform.lock")
	if err := os.WriteFile(file, []byte("{}"), 0o644); err != nil {
		t.Fatal(err)
	}
	for _, args := range [][]string{
		{"list", "dialects", "--project", file},
		{"list", "policy-packs", "--project", filepath.Join(filepath.Dir(file), "absent")},
		{"show", "google", "--project", file},
		{"show", "policy-pack", "baseline", "--project", file},
	} {
		t.Run(strings.Join(args[:2], " "), func(t *testing.T) {
			list, show := &stubList{outcome: ListReported}, &stubShow{outcome: ShowReported}
			stdout, stderr := &strings.Builder{}, &strings.Builder{}
			if got := Run(&Env{Stdout: stdout, Stderr: stderr, Args: args, List: list, Show: show}); got != ExitUsage {
				t.Fatalf("Run = %d, want %d: %s", got, ExitUsage, stderr.String())
			}
			if want := "rootform: --project requires a directory\n"; stderr.String() != want {
				t.Fatalf("stderr = %q, want %q", stderr.String(), want)
			}
			if len(list.got) != 0 || len(show.got) != 0 || stdout.Len() != 0 {
				t.Fatal("a --project that is not a directory reached the service")
			}
		})
	}
}

// TestSelectionCommandSurface pins the command family and the flags each
// selection command accepts.
func TestSelectionCommandSurface(t *testing.T) {
	env, _, _ := newTestEnv(nil, &recorderService{})
	root := NewRootCommand(env)
	want := map[string][]string{
		"add dialects":           {"replace", "offline", "dry-run", "format"},
		"add policy-packs":       {"offline", "dry-run", "format"},
		"remove dialects":        {"embedded", "dry-run", "format"},
		"remove policy-packs":    {"dry-run", "format"},
		"update dialect":         {"offline", "dry-run", "format"},
		"update policy-pack":     {"offline", "dry-run", "format"},
		"install dialects":       {"offline", "format"},
		"install policy-packs":   {"offline", "format"},
		"uninstall dialects":     {"format"},
		"uninstall policy-packs": {"format"},
		"list dialects":          {"installed", "dialect", "format"},
		"list policy-packs":      {"installed", "policy-pack", "format"},
		"run":                    {"dialect", "policy-pack", "locked"},
		"show":                   {"dialect"},
		"explain instance":       {"dialect"},
		"explain rule":           {"dialect"},
		"explain policy":         {"dialect"},
		"vendor":                 {"offline"},
	}
	for path, flags := range want {
		command := findCommand(t, root, strings.Fields(path)...)
		for _, flag := range flags {
			if command.Flags().Lookup(flag) == nil {
				t.Errorf("rootform %s has no --%s", path, flag)
			}
		}
	}
	for path, absent := range map[string]string{
		"remove dialects":     "offline",
		"remove policy-packs": "embedded",
		"add policy-packs":    "replace",
		"uninstall dialects":  "offline",
	} {
		if findCommand(t, root, strings.Fields(path)...).Flags().Lookup(absent) != nil {
			t.Errorf("rootform %s accepts --%s", path, absent)
		}
	}
}

func TestSelectionCommandsRefuseMisuse(t *testing.T) {
	for _, args := range [][]string{
		{"add", "dialects"},
		{"remove", "policy-packs"},
		{"update", "dialect"},
		{"update", "dialect", "a", "./b", "./c"},
		{"install", "dialects"},
		{"uninstall", "dialects", "payments"},
		{"uninstall", "dialects", "@0.1.0"},
		{"run", "--locked", "--dialect", "./d"},
		{"add", "dialects", "./d", "--format", "yaml"},
	} {
		env, _, stderr := newTestEnv(args, &recorderService{})
		if got := Run(env); got != ExitUsage {
			t.Errorf("Run(%v) = %d, want %d; stderr=%q", args, got, ExitUsage, stderr.String())
		}
	}
}

// TestSelectionVocabulary keeps the unit-state words of the selection model:
// embedded, installed, selected, vendored, and override.
func TestSelectionVocabulary(t *testing.T) {
	env, _, _ := newTestEnv(nil, &recorderService{})
	root := NewRootCommand(env)
	store := regexp.MustCompile(`\bstore\b`)
	if store.MatchString(root.Long) {
		t.Errorf("rootform help says \"store\":\n%s", root.Long)
	}
	for _, path := range []string{
		"add", "add dialects", "add policy-packs", "remove", "remove dialects",
		"remove policy-packs", "update", "update dialect", "update policy-pack",
		"install", "install dialects", "install policy-packs", "uninstall",
		"uninstall dialects", "uninstall policy-packs", "list dialects", "list policy-packs",
	} {
		command := findCommand(t, root, strings.Fields(path)...)
		prose := strings.ToLower(command.Short + "\n" + command.Long)
		for _, word := range []string{"supplied", "acquire", "cached", "fetched", "pinned", "builtin", "built-in"} {
			if strings.Contains(prose, word) {
				t.Errorf("rootform %s help says %q:\n%s", path, word, prose)
			}
		}
	}
	for _, path := range []string{
		"add dialects", "add policy-packs", "remove dialects", "remove policy-packs",
		"update dialect", "update policy-pack", "install dialects", "install policy-packs",
		"uninstall dialects", "uninstall policy-packs", "list dialects", "list policy-packs",
		"init", "vendor", "vendor dialects", "vendor policy-packs",
	} {
		if command := findCommand(t, root, strings.Fields(path)...); store.MatchString(command.Long) {
			t.Errorf("rootform %s help says \"store\":\n%s", path, command.Long)
		}
	}
}
