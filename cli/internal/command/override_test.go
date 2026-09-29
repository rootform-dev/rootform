package command

import (
	"strings"
	"testing"

	"github.com/spf13/cobra"
)

// TestOverrideSurface pins the override model: every command that reads the
// effective catalog accepts the same invocation-only overrides, and the
// commands that compile one explicit source set, read a saved document as it
// is, or mutate selections accept none.
func TestOverrideSurface(t *testing.T) {
	env, _, _ := newTestEnv(nil, &recorderService{})
	root := NewRootCommand(env)
	present := map[string][]string{
		"run":               {"dialect", "policy-pack"},
		"explain instance":  {"dialect", "input"},
		"explain rule":      {"dialect", "input"},
		"explain policy":    {"dialect", "input"},
		"show":              {"dialect"},
		"list dialects":     {"dialect"},
		"list policies":     {"policy-pack"},
		"list policy-packs": {"policy-pack"},
		"validate rule":     {"dialect"},
		"validate concept":  {"dialect"},
		"validate context":  {"dialect"},
		"validate relation": {"dialect"},
		"validate policy":   {"dialect", "policy-pack"},
		"test":              {"dialect"},
	}
	for path, flags := range present {
		command := findCommand(t, root, strings.Fields(path)...)
		for _, flag := range flags {
			if command.Flags().Lookup(flag) == nil {
				t.Errorf("rootform %s has no --%s", path, flag)
			}
		}
	}
	absent := map[string][]string{
		"explain instance":    {"policy-pack"},
		"explain rule":        {"policy-pack"},
		"explain policy":      {"policy-pack"},
		"show":                {"policy-pack"},
		"list dialects":       {"policy-pack"},
		"list policies":       {"dialect"},
		"validate rule":       {"policy-pack"},
		"validate form":       {"dialect", "policy-pack"},
		"test":                {"policy-pack"},
		"validate dialects":   {"dialect", "policy-pack"},
		"compile policy-pack": {"dialect", "policy-pack"},
		"fmt":                 {"dialect", "policy-pack"},
		"package":             {"dialect", "policy-pack"},
		"publish dialects":    {"dialect", "policy-pack"},
		"add dialects":        {"dialect"},
		"add policy-packs":    {"policy-pack"},
		"remove dialects":     {"dialect"},
		"update dialect":      {"dialect"},
		"update policy-pack":  {"policy-pack"},
		"init":                {"dialect", "policy-pack"},
		"vendor dialects":     {"dialect"},
		"install dialects":    {"dialect"},
		"uninstall dialects":  {"dialect"},
	}
	for path, flags := range absent {
		command := findCommand(t, root, strings.Fields(path)...)
		for _, flag := range flags {
			declared := command.Flags().Lookup(flag)
			if declared == nil {
				continue
			}
			// A hidden flag may only refuse, pointing to the command that
			// owns it.
			if !declared.Hidden || !strings.HasPrefix(declared.Usage, "refused: ") {
				t.Errorf("rootform %s accepts --%s", path, flag)
			}
		}
	}
	for _, path := range []string{"validate rule", "validate policy", "validate form", "test"} {
		if findCommand(t, root, strings.Fields(path)...).Flags().Lookup("locked") != nil {
			t.Errorf("rootform %s accepts --locked, so its overrides need the locked refusal", path)
		}
	}
	// The shared wording: the same flag reads the same everywhere. check is
	// the one command that also replays compiled Policy Pack artifacts, so
	// its --policy-pack names that wider input.
	usages := map[string]map[string]struct{}{"dialect": {}, "policy-pack": {}}
	for path := range present {
		command := findCommand(t, root, strings.Fields(path)...)
		for flag := range usages {
			if declared := command.Flags().Lookup(flag); declared != nil && !declared.Hidden {
				usages[flag][declared.Usage] = struct{}{}
			}
		}
	}
	for flag, wordings := range usages {
		if len(wordings) != 1 {
			t.Errorf("--%s is described %d ways: %v", flag, len(wordings), wordings)
		}
	}
}

// TestLockedOverride proves that every command that accepts
// --locked refuses an override beside it with the usage exit.
func TestLockedOverride(t *testing.T) {
	env, _, _ := newTestEnv(nil, &recorderService{})
	root := NewRootCommand(env)
	var lockedCommands []string
	var walk func(command *cobra.Command, path []string)
	walk = func(command *cobra.Command, path []string) {
		for _, child := range command.Commands() {
			childPath := append(append([]string{}, path...), child.Name())
			if child.Flags().Lookup("locked") != nil &&
				(visibleFlag(child, "dialect") || visibleFlag(child, "policy-pack")) {
				lockedCommands = append(lockedCommands, strings.Join(childPath, " "))
			}
			walk(child, childPath)
		}
	}
	walk(root, nil)
	if len(lockedCommands) == 0 {
		t.Fatal("no command accepts both --locked and an override")
	}
	for _, path := range lockedCommands {
		command := findCommand(t, root, strings.Fields(path)...)
		for _, flag := range []string{"dialect", "policy-pack"} {
			if !visibleFlag(command, flag) {
				continue
			}
			args := append(strings.Fields(path), "--locked", "--"+flag, "./x")
			switch path {
			case "run", "check":
				args = append(args, "input.json")
			case "explain instance", "explain rule":
				args = append(args, "name", "--input", "input.json")
			case "explain policy":
				args = append(args, "name", "--result", "results.json", "--input", "input.json")
			}
			env, _, stderr := newTestEnv(args, &recorderService{})
			if path == "check" {
				env.Check = validatingCheck{}
			}
			if got := Run(env); got != ExitUsage {
				t.Errorf("Run(%v) = %d, want %d; stderr=%q", args, got, ExitUsage, stderr.String())
			}
			if !strings.Contains(stderr.String(), "--locked and --"+flag+" cannot be used together") {
				t.Errorf("Run(%v) stderr = %q", args, stderr.String())
			}
		}
	}
}

func visibleFlag(command *cobra.Command, name string) bool {
	flag := command.Flags().Lookup(name)
	return flag != nil && !flag.Hidden
}

type validatingCheck struct{}

func (validatingCheck) Check(opts CheckOptions) error { return ValidateCheckOptions(opts) }
