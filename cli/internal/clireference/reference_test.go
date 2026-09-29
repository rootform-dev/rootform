package clireference

import (
	"bytes"
	"encoding/json"
	"os"
	"reflect"
	"slices"
	"strings"
	"testing"

	"github.com/rootform-dev/rootform/cli/internal/command"
	"github.com/spf13/cobra"
)

func decode(t *testing.T, root *cobra.Command) Document {
	t.Helper()
	data, err := Export(root)
	if err != nil {
		t.Fatal(err)
	}
	var doc Document
	if err := json.Unmarshal(data, &doc); err != nil {
		t.Fatal(err)
	}
	return doc
}

func TestPublicBoundaryAndFlagSemantics(t *testing.T) {
	root := &cobra.Command{Use: "sample", Annotations: map[string]string{"private": "do-not-export"}}
	root.PersistentFlags().String("shared", "parent", "Shared setting")
	root.PersistentFlags().String("shadowed", "parent", "Parent setting")
	root.PersistentFlags().Bool("private", false, "do-not-export")
	if err := root.PersistentFlags().MarkHidden("private"); err != nil {
		t.Fatal(err)
	}
	hidden := &cobra.Command{Use: "secret", Hidden: true}
	hidden.AddCommand(&cobra.Command{Use: "visible-child"})
	child := &cobra.Command{
		Use: "read [path]", Short: "Read input", Long: "Read one input.",
		Aliases: []string{"view", "r"}, Example: "sample read input.json",
		Deprecated:       "Use inspect instead.",
		Run:              func(*cobra.Command, []string) { t.Fatal("handler executed") },
		PersistentPreRun: func(*cobra.Command, []string) { t.Fatal("hook executed") },
	}
	child.Flags().StringP("shadowed", "s", "child", "Child setting")
	child.Flags().Bool("enabled", false, "Enable reading")
	if err := child.MarkFlagRequired("shadowed"); err != nil {
		t.Fatal(err)
	}
	child.Flags().Lookup("shadowed").Annotations["private"] = []string{"do-not-export"}
	child.Flags().Lookup("shadowed").ShorthandDeprecated = "Use the long flag."
	child.Flags().Lookup("shadowed").Deprecated = "Use --source."
	if err := child.Flags().Set("shadowed", "runtime-value-must-not-export"); err != nil {
		t.Fatal(err)
	}
	root.AddCommand(hidden, child, &cobra.Command{Use: "alpha"})
	doc := decode(t, root)
	if len(doc.Commands) != 3 || doc.Commands[1].Path != "sample alpha" || doc.Commands[2].Path != "sample read" {
		t.Fatalf("wrong visible order: %+v", doc.Commands)
	}
	entry := doc.Commands[2]
	if entry.Usage != "sample read [path] [options]" || !reflect.DeepEqual(entry.Aliases, []string{"r", "view"}) {
		t.Fatalf("missing command metadata: %+v", entry)
	}
	if entry.Description != child.Long || entry.Examples != child.Example || entry.Deprecated != child.Deprecated {
		t.Fatalf("lost public help: %+v", entry)
	}
	if len(entry.InheritedFlags) != 1 || entry.InheritedFlags[0].Name != "shared" || entry.InheritedFlags[0].Group != command.GlobalGroup {
		t.Fatalf("bad inheritance/shadowing: %+v", entry.InheritedFlags)
	}
	if len(entry.Flags) != 2 || entry.Flags[0].NoOptionDefault != "true" {
		t.Fatalf("bad flags: %+v", entry.Flags)
	}
	want := Flag{Name: "shadowed", Shorthand: "s", Type: "string", Group: command.OptionsGroup, Default: "child", Usage: "Child setting",
		Required: true, Deprecated: "Use --source.", ShorthandDeprecated: "Use the long flag."}
	if entry.Flags[1] != want {
		t.Fatalf("got %+v, want %+v", entry.Flags[1], want)
	}
	data, err := Export(root)
	if err != nil {
		t.Fatal(err)
	}
	for _, forbidden := range [][]byte{[]byte("do-not-export"), []byte("runtime-value-must-not-export"), []byte("visible-child")} {
		if bytes.Contains(data, forbidden) {
			t.Fatalf("export leaked %q", forbidden)
		}
	}
}

func TestCurrentIsDeterministicAndDoesNotReadEnvironment(t *testing.T) {
	env := &command.Env{
		Version:       "an-arbitrary-version",
		Getenv:        func(string) string { t.Fatal("environment read"); return "" },
		Getwd:         func() (string, error) { t.Fatal("directory read"); return "", nil },
		InputTerminal: func() bool { t.Fatal("terminal queried"); return false },
	}
	first, err := Current()
	if err != nil {
		t.Fatal(err)
	}
	second, err := Export(command.NewRootCommand(env))
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(first, second) {
		t.Fatal("reference depends on version or environment")
	}
}

// Every exported command reads as its help does: the same usage line, its
// flags under the headings help prints in the same order, and each command
// under the heading its parent lists it in.
func TestExportMatchesCLIHelp(t *testing.T) {
	doc := decode(t, command.NewRootCommand(&command.Env{Version: "reference"}))
	help := func(path string) string {
		t.Helper()
		var stdout, stderr bytes.Buffer
		args := append(strings.Fields(path)[1:], "--help")
		if code := command.Run(&command.Env{Args: args, Stdout: &stdout, Stderr: &stderr, Version: "reference"}); code != command.ExitOK {
			t.Fatalf("%s --help exited %d: %s", path, code, stderr.String())
		}
		return stdout.String()
	}
	for _, command := range doc.Commands {
		text := help(command.Path)
		usage := "  " + strings.ReplaceAll(command.Usage, "\n", "\n  ")
		if !strings.Contains(text, "\nUsage\n"+usage+"\n") {
			t.Fatalf("%s: exported usage %q is not the usage its help prints:\n%s", command.Path, command.Usage, text)
		}
		if !headingsInOrder(text, command.FlagGroups) || !headingsInOrder(text, command.CommandGroups) {
			t.Fatalf("%s: exported headings %q and %q are not the headings its help prints, in order:\n%s",
				command.Path, command.CommandGroups, command.FlagGroups, text)
		}
		for _, flag := range append(append([]Flag{}, command.Flags...), command.InheritedFlags...) {
			if !slices.Contains(command.FlagGroups, flag.Group) {
				t.Fatalf("%s: --%s is exported under %q, a heading its help does not print", command.Path, flag.Name, flag.Group)
			}
		}
		for _, child := range command.Subcommands {
			for _, entry := range doc.Commands {
				if entry.Path == child && entry.Group != "" && !slices.Contains(command.CommandGroups, entry.Group) {
					t.Fatalf("%s: %s is exported under %q, a heading its help does not print", command.Path, child, entry.Group)
				}
			}
		}
	}
	groups := map[string]string{}
	for _, command := range doc.Commands {
		groups[command.Path] = command.Group
		for _, flag := range command.Flags {
			groups[command.Path+" --"+flag.Name] = flag.Group
		}
	}
	for key, want := range map[string]string{
		"rootform run":              "Analyze",
		"rootform check":            "Analyze",
		"rootform explain":          "Inspect",
		"rootform run --stage":      "Inputs and stages",
		"rootform run --format":     "Output",
		"rootform check --side":     "Target selection",
		"rootform explain instance": "",
	} {
		if got, ok := groups[key]; !ok || got != want {
			t.Errorf("%s is exported under %q, want %q", key, got, want)
		}
	}
	for path, want := range map[string][]string{
		"rootform": {"Analyze", "Inspect", "Project", "Rootform home", "Author and publish", "Other"},
		"rootform check": {"Target selection", "Policy selection", "Output", "Rootform project",
			"Advanced evidence settings", "Global options"},
		"rootform explain": {"Global options"},
	} {
		for _, command := range doc.Commands {
			if command.Path != path {
				continue
			}
			got := command.FlagGroups
			if path == "rootform" {
				got = command.CommandGroups
			}
			if !slices.Equal(got, want) {
				t.Errorf("%s exports headings %q, want %q", path, got, want)
			}
		}
	}
}

func headingsInOrder(help string, headings []string) bool {
	for _, heading := range headings {
		var found bool
		if _, help, found = strings.Cut(help, "\n"+heading+"\n"); !found {
			return false
		}
	}
	return true
}

func TestCurrentSnapshot(t *testing.T) {
	actual, err := Current()
	if err != nil {
		t.Fatal(err)
	}
	expected, err := os.ReadFile("../../" + Output)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(actual, expected) {
		t.Fatal("CLI reference drift: run go run ./internal/clireference/cmd -write from the module root")
	}
}
