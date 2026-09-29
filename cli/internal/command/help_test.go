package command

import (
	"bytes"
	"regexp"
	"strings"
	"testing"

	"github.com/spf13/cobra"
	"github.com/spf13/pflag"
)

func visibleCommands(cmd *cobra.Command) []*cobra.Command {
	commands := make([]*cobra.Command, 0)
	for _, child := range cmd.Commands() {
		if child.Hidden {
			continue
		}
		commands = append(commands, child)
		commands = append(commands, visibleCommands(child)...)
	}
	return commands
}

func TestRootHelp(t *testing.T) {
	t.Run("help exits zero and lists every command under a group", func(t *testing.T) {
		env, stdout, stderr := newTestEnv([]string{"--help"}, &recorderService{})
		if got := Run(env); got != ExitOK {
			t.Fatalf("Run = %d, want %d: %s", got, ExitOK, stderr.String())
		}
		printed := stdout.String()
		groups := []string{"Analyze", "Inspect", "Project", "Rootform home", "Author and publish", "Other"}
		last := -1
		for _, group := range groups {
			at := strings.Index(printed, "\n"+group+"\n")
			if at < 0 {
				t.Fatalf("the help lists no %q section:\n%s", group, printed)
			}
			if at < last {
				t.Fatalf("the %q section is out of order:\n%s", group, printed)
			}
			last = at
		}
		for _, promise := range []string{"semantic", "deterministic", "explainable"} {
			if !strings.Contains(printed, promise) {
				t.Fatalf("the help does not describe Rootform as %q:\n%s", promise, printed)
			}
		}
		usageStart := strings.Index(printed, "Usage\n")
		examplesStart := strings.Index(printed, "\nExamples\n")
		if usageStart == -1 || examplesStart == -1 || examplesStart <= usageStart {
			t.Fatalf("the help carries no readable usage block:\n%s", printed)
		}
		if usage := printed[usageStart:examplesStart]; strings.Count(usage, "rootform") != 1 {
			t.Fatalf("the help repeats root usage forms:\n%s", usage)
		}
		run := strings.Index(printed, "rootform run plan.json")
		if run == -1 {
			t.Fatalf("the first example does not lead with local exploration:\n%s", printed)
		}
		if strings.Contains(printed, "\x1b[") {
			t.Fatalf("root help carries an ANSI escape sequence:\n%s", printed)
		}
		for _, line := range strings.Split(printed, "\n") {
			if len(line) > 80 {
				t.Fatalf("a root help line is %d columns wide:\n%s", len(line), line)
			}
		}
		for _, command := range NewRootCommand(env).Commands() {
			if command.Hidden {
				continue
			}
			if !strings.Contains(printed, command.Name()) {
				t.Fatalf("the help omits %q:\n%s", command.Name(), printed)
			}
			known := false
			for _, group := range NewRootCommand(env).Groups() {
				known = known || group.ID == command.GroupID
			}
			if !known {
				t.Fatalf("%q names no root group, so it would print outside every section", command.Name())
			}
		}
	})

	// A noun that repeats its verb reads as "rootform semantics validate"
	// rather than one grammar, which is what this surface moved away from.
	t.Run("no command repeats its parent verb", func(t *testing.T) {
		env, _, _ := newTestEnv(nil, &recorderService{})
		for _, command := range visibleCommands(NewRootCommand(env)) {
			parent := command.Parent()
			if parent == nil || parent.Name() == command.Name() {
				t.Fatalf("%q repeats its parent", command.CommandPath())
			}
		}
	})

	t.Run("an unknown command is a usage error naming the way forward", func(t *testing.T) {
		env, _, stderr := newTestEnv([]string{"nonesuch"}, &recorderService{})
		if got := Run(env); got != ExitUsage {
			t.Fatalf("Run = %d, want %d", got, ExitUsage)
		}
		assertUsageDiagnostic(t, stderr.String())
	})
}

func TestMisspelledCommandsSuggestWhatTheyResemble(t *testing.T) {
	explainObjects := "Expected:\n  instance\n  rule\n  policy\n\n"
	tests := []struct {
		name string
		args []string
		want string
	}{
		{"an object within two edits", []string{"explain", "polcy", "network-context"},
			"rootform: explain cannot act on \"polcy\"\n\n" + explainObjects + "Try:\n  rootform explain policy\n"},
		{"an object followed by options of the intended command", []string{"explain", "polcy", "network-context", "--result", "r.json"},
			"rootform: explain cannot act on \"polcy\"\n\n" + explainObjects + "Try:\n  rootform explain policy\n"},
		{"every object a prefix matches, in expected order", []string{"validate", "r", "x"},
			"rootform: validate cannot act on \"r\"\n\nExpected:\n  form\n  dialects\n  policy\n  rule\n  concept\n  context\n  relation\n\n" +
				"Try:\n  rootform validate rule\n  rootform validate relation\n"},
		{"help when no object is close", []string{"explain", "xyz"},
			"rootform: explain cannot act on \"xyz\"\n\n" + explainObjects + "Try:\n  rootform explain --help\n"},
		{"a command followed by options of the intended command", []string{"chek", "plan.json", "--policy-pack", "./p"},
			"rootform: \"chek\" is not a rootform command\n\nTry:\n  rootform check\n"},
		{"help when no command is close", []string{"nonesuch"},
			"rootform: \"nonesuch\" is not a rootform command\n\nTry:\n  rootform help\n"},
		{"a help topic", []string{"help", "explain", "polcy"},
			"rootform: unknown help topic \"explain polcy\"\n\nTry:\n  rootform help explain policy\n"},
		{"an unknown option of a command that runs alone", []string{"vendor", "--bogus"},
			"rootform: unknown flag: --bogus\n\nTry:\n  rootform vendor --help\n"},
		{"an unknown option after a name the command accepts", []string{"show", "aws", "--bogus"},
			"rootform: unknown flag: --bogus\n\nTry:\n  rootform show --help\n"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			env, stdout, stderr := newTestEnv(tt.args, &recorderService{})
			if got := Run(env); got != ExitUsage {
				t.Fatalf("Run = %d, want %d: %s", got, ExitUsage, stderr.String())
			}
			if stdout.Len() != 0 || stderr.String() != tt.want {
				t.Fatalf("stdout = %q\nstderr = %q\nwant   %q", stdout.String(), stderr.String(), tt.want)
			}
		})
	}
}

func TestHelpUsageSections(t *testing.T) {
	tests := []struct {
		name string
		args []string
		want string
	}{
		{
			name: "show",
			args: []string{"show", "--help"},
			want: "Usage\n" +
				"  rootform show <name> [options]\n" +
				"  rootform show <command> [options]\n",
		},
		{
			name: "vendor",
			args: []string{"vendor", "--help"},
			want: "Usage\n" +
				"  rootform vendor [options]\n" +
				"  rootform vendor <command> [options]\n",
		},
		{
			name: "root",
			args: []string{"--help"},
			want: "Usage\n  rootform <command> [options]\n",
		},
		{
			name: "vendor dialects",
			args: []string{"vendor", "dialects", "--help"},
			want: "Usage\n  rootform vendor dialects [options]\n",
		},
		{
			name: "list",
			args: []string{"list", "--help"},
			want: "Usage\n  rootform list <command> [options]\n",
		},
		{
			name: "add",
			args: []string{"add", "--help"},
			want: "Usage\n  rootform add <command> [options]\n",
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			env, stdout, stderr := newTestEnv(test.args, &recorderService{})
			if got := Run(env); got != ExitOK {
				t.Fatalf("Run = %d, want %d: %s", got, ExitOK, stderr.String())
			}
			printed := stdout.String()
			start := strings.Index(printed, "Usage\n")
			if start < 0 {
				t.Fatalf("help has no Usage section:\n%s", printed)
			}
			end := strings.Index(printed[start:], "\nExamples\n")
			if end < 0 {
				t.Fatalf("help has no Examples section after Usage:\n%s", printed)
			}
			got := printed[start : start+end]
			if got != test.want {
				t.Fatalf("Usage section = %q, want %q", got, test.want)
			}
		})
	}
}

func TestHelpContract(t *testing.T) {
	env, _, _ := newTestEnv(nil, &recorderService{})
	for _, command := range visibleCommands(NewRootCommand(env)) {
		t.Run(command.CommandPath(), func(t *testing.T) {
			if command.Short == "" {
				t.Fatal("the command says nothing about what it does")
			}
			if strings.HasSuffix(command.Short, ".") {
				t.Fatalf("Short = %q, want no trailing period", command.Short)
			}
			if command.Long == "" {
				t.Fatal("the command carries no description")
			}
			// A command that groups others documents itself through its
			// children; only a command that runs carries its own example.
			if !command.HasSubCommands() && command.Example == "" {
				t.Fatal("the command carries no example")
			}
			if command.Example != "" && !strings.Contains(command.Example, command.CommandPath()) {
				t.Fatalf("the example does not show the command itself:\n%s", command.Example)
			}
			prose := command.Short + "\n" + command.Long
			for _, leak := range []string{
				"IR", "AST", "artifact", "pipeline", "representation", "DTO", "CI",
				"upload", "cloud", "Semantic Package", "semantic definitions",
				"Rootform dependencies",
			} {
				// A term starts a word: the placeholder DIR does not carry IR.
				if regexp.MustCompile(`\b` + regexp.QuoteMeta(leak)).MatchString(prose) {
					t.Fatalf("the description carries %q, which is not the product's vocabulary:\n%s",
						leak, prose)
				}
			}
			visible := prose + "\n" + command.Example
			for _, obsolete := range []string{"rootform view", "--semantics"} {
				if obsolete == "--semantics" && command.CommandPath() == "rootform compile policy-pack" {
					continue
				}
				if strings.Contains(visible, obsolete) {
					t.Fatalf("the help carries obsolete or unsupported syntax %q:\n%s",
						obsolete, visible)
				}
			}
			if strings.Contains(visible, "\x1b[") {
				t.Fatalf("the help carries an ANSI escape sequence:\n%s", visible)
			}
			if !command.HasSubCommands() {
				if examples := len(strings.Split(strings.TrimSpace(command.Example), "\n")); examples < 3 {
					t.Fatalf("the command carries %d examples, want at least 3:\n%s",
						examples, command.Example)
				}
				normalizedLong := strings.Join(strings.Fields(command.Long), " ")
				for _, contract := range []string{"standard output", "standard error", "Exit status:"} {
					if !strings.Contains(normalizedLong, contract) {
						t.Fatalf("the description does not document %q:\n%s", contract, command.Long)
					}
				}
			}
			for _, line := range strings.Split(command.Long+"\n"+command.Example, "\n") {
				if len(line) > 80 {
					t.Fatalf("a help line is %d columns wide:\n%s", len(line), line)
				}
			}
			var rendered bytes.Buffer
			command.SetOut(&rendered)
			if err := command.Help(); err != nil {
				t.Fatal(err)
			}
			for _, line := range strings.Split(rendered.String(), "\n") {
				if len(line) > 80 {
					t.Fatalf("a rendered help line is %d columns wide:\n%s", len(line), line)
				}
			}
		})
	}
}

func TestCoreHelpExamplesUsePlanAndState(t *testing.T) {
	env, _, _ := newTestEnv(nil, &recorderService{})
	root := NewRootCommand(env)
	command, _, err := root.Find([]string{"run"})
	if err != nil {
		t.Fatal(err)
	}
	for _, want := range []string{"rootform run plan.json", "rootform run state.json", "rootform run before.json --diff after.json"} {
		if !strings.Contains(command.Example, want) {
			t.Fatalf("run examples omit %q: %s", want, command.Example)
		}
	}
}

func TestValidateFormHasNoOldCommand(t *testing.T) {
	env, _, _ := newTestEnv(nil, &recorderService{})
	root := NewRootCommand(env)
	validate, _, err := root.Find([]string{"validate"})
	if err != nil {
		t.Fatal(err)
	}
	var found bool
	for _, child := range validate.Commands() {
		if child.Name() == "architecture" || child.Name() == "document" {
			t.Fatal("the retired validation command remains")
		}
		if child.Name() == "form" {
			found = true
			if len(child.Aliases) != 0 {
				t.Fatalf("Form validation has aliases: %v", child.Aliases)
			}
		}
	}
	if !found {
		t.Fatal("Form validation command missing")
	}
}

func TestFlagDescriptionsNameWhatTheyCause(t *testing.T) {
	env, _, _ := newTestEnv(nil, &recorderService{})
	for _, command := range visibleCommands(NewRootCommand(env)) {
		command.Flags().VisitAll(func(flag *pflag.Flag) {
			if flag.Usage == "" {
				t.Fatalf("%s --%s says nothing about what it causes", command.CommandPath(), flag.Name)
			}
			if strings.HasSuffix(flag.Usage, ".") {
				t.Fatalf("%s --%s = %q, want no trailing period", command.CommandPath(), flag.Name, flag.Usage)
			}
			if first := strings.TrimSpace(flag.Usage); first != "" && strings.ToUpper(first[:1]) == first[:1] &&
				strings.ToLower(first[:1]) != first[:1] {
				t.Fatalf("%s --%s = %q, want a lower-case fragment", command.CommandPath(), flag.Name, flag.Usage)
			}
		})
	}
}
