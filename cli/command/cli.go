// Package command constructs the Cobra root command and maps its outcome to
// the process exit code.
package command

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"strings"

	"github.com/spf13/cobra"
)

const (
	// ExitOK is the clean-shutdown exit code, including help via -h/--help.
	ExitOK = 0
	// ExitNegative is a decided negative answer: a violation, an invalid
	// object, an unformatted source, a failing fixture, or a name not found.
	ExitNegative = 1
	// ExitUsage is the exit code for invalid usage.
	ExitUsage = 2
	// ExitNoAnswer means the input, selection or evidence allows no answer.
	ExitNoAnswer = 3
	// ExitFailure is an operational failure: a file, store, network, registry
	// or server failure, or an unexpected internal error.
	ExitFailure = 4
)

// DefaultPort is the default loopback port; an explicit --port 0 selects an
// ephemeral port.
const DefaultPort = 21717

// Options carries the parsed, framework-neutral root-command options.
type Options struct {
	Input             string
	DiffInput         string
	Stage             string
	BeforeStage       string
	AfterStage        string
	PlanFile          string
	DiffPlanFile      string
	RequireEnrichment bool
	PlanComplete      string
	Producer          string
	ProviderMap       []string
	Project           string
	Policy            []string
	PolicyPack        []string
	Output            []string
	Format            string
	Details           bool
	NoServe           bool
	Locked            bool
	// Dialect names dialect source directories used for this run only.
	Dialect   []string
	NoBrowser bool
	Port      int
}

// RunError carries the exit status of a completed command. An empty message
// exits silently: the result already states the outcome.
type RunError struct {
	Code    int
	Message string
}

func (e RunError) Error() string { return e.Message }

// AppService is the injected application service.
type AppService interface {
	Run(Options) error
}

// BrowserLauncher is the injected browser-opening seam.
type BrowserLauncher interface {
	Open(url string) error
}

// LanguageServerService owns the blocking stdio language-server lifecycle.
type LanguageServerService interface {
	Run() error
}

// Env carries every process seam the command needs.
type Env struct {
	Stdout io.Writer
	Stderr io.Writer
	Args   []string
	Getwd  func() (string, error)
	Getenv func(string) string
	// InputTerminal reports whether stdin is an interactive terminal. A nil
	// seam preserves interactive behavior for embedded callers.
	InputTerminal func() bool
	// Color resolves human-output styling for the requested mode and reports
	// whether standard output carries color. A nil seam keeps output plain.
	Color func(mode string) (bool, error)
	// Paging resolves whether a long human report may open in a pager; it is
	// false for --no-pager. A nil seam writes every report directly.
	Paging func(requested bool)
	// Page writes a finished human report to out, through the pager when out
	// is an interactive terminal. A nil seam writes it directly.
	Page      func(out, errOut io.Writer, report []byte) error
	Service   AppService
	Check     CheckService
	Browser   BrowserLauncher
	Compile   CompileService
	List      ListService
	Show      ShowService
	Validate  ValidateService
	Fmt       FmtService
	Test      TestService
	Explain   ExplainService
	Vendor    VendorService
	Selection SelectionService
	Store     StoreService
	Init      InitService
	Package   PackageService
	Publish   PublishService
	LSP       LanguageServerService
	Version   string
}

// usageError carries a diagnostic that names what was wrong and, where one
// exists, the correction. A bare "invalid usage" leaves a user guessing.
type usageError struct{ msg string }

func (e usageError) Error() string { return e.msg }

// counted renders a count with the verb that agrees with it, so a diagnostic
// never reads "1 were given".
func counted(count int, singular, plural string) string {
	if count == 1 {
		return "1 " + singular
	}
	return fmt.Sprintf("%d %s", count, plural)
}

// sanitizeFlagError keeps the part of a flag error a user can act on and drops
// the parser internals it wraps, which name Go functions rather than a fix.
func sanitizeFlagError(err error) string {
	message := err.Error()
	if invalid, _, found := strings.Cut(message, ": "); found &&
		strings.HasPrefix(message, "invalid argument ") {
		return strings.TrimPrefix(invalid, "invalid ") + " is not a valid value"
	}
	return message
}

// UnavailableError reports an operational failure. Run prints its message so
// a user learns what failed instead of a generic failure.
type UnavailableError struct{ Message string }

func (e UnavailableError) Error() string { return e.Message }

// NegativeError reports a decided negative answer, such as a source that is
// invalid or a version that is not installed.
type NegativeError struct{ Message string }

func (e NegativeError) Error() string { return e.Message }

// Negative marks the error as a decided answer for serviceFailure.
func (e NegativeError) Negative() bool { return true }

func normalizeEnv(env *Env) *Env {
	if env == nil {
		env = &Env{}
	}
	normalized := *env
	if normalized.Stdout == nil {
		normalized.Stdout = io.Discard
	}
	if normalized.Stderr == nil {
		normalized.Stderr = io.Discard
	}
	return &normalized
}

// NewRootCommand builds a fresh root command per invocation.
func NewRootCommand(env *Env) *cobra.Command {
	env = normalizeEnv(env)
	args := env.Args
	if args == nil {
		args = []string{}
	}
	cmd := &cobra.Command{
		Use:   "rootform",
		Short: "Understand Terraform and OpenTofu as architecture",
		Long: "Rootform turns Terraform and OpenTofu plan or state exports into\n" +
			"semantic, deterministic, explainable architecture: a Form you can\n" +
			"explore, save, reopen, compare, and check against Policies.\n\n" +
			"Run 'rootform help <command>' for the options of one command.\n\n" +
			"A long report on an interactive terminal opens in less: Enter advances one\n" +
			"line, Space one page, b goes back a page, and q quits. With --no-pager, a\n" +
			"pipe or file, a CI run, or no less installed, the report prints in full.\n" +
			"ROOTFORM_PAGER names another pager, or turns paging off when empty.\n\n" +
			"Exit status:\n" +
			"  0  the request completed, or the answer is positive\n" +
			"  1  the answer is negative: a violation, an invalid object, an\n" +
			"     unformatted source, a failing fixture, or a name not found\n" +
			"  2  the command was used incorrectly\n" +
			"  3  the input, selection, or evidence allows no answer\n" +
			"  4  a file, Rootform home, network, registry, or server operation failed",
		Example: "  rootform run plan.json\n" +
			"  rootform run state.json --no-serve -o form.json\n" +
			"  rootform run before.json --diff after.json --no-serve\n" +
			"  rootform check plan.json -o results.sarif",
		Args: func(cmd *cobra.Command, args []string) error {
			if len(args) == 0 {
				return nil
			}
			if args[0] == "help" {
				return nil
			}
			switch args[0] {
			case "build", "diff", "view", "watch":
				return usageError{msg: fmt.Sprintf("%s is retired; use rootform run <plan-or-state.json>\n\nTry:\n  rootform run --help", args[0])}
			}
			return usageError{msg: fmt.Sprintf(
				"%q is not a rootform command\n\nTry:\n%s",
				args[0], tryCommands("rootform", closeCommands(cmd, args[0], commandNames(cmd)), "rootform help"))}
		},
		RunE: func(cmd *cobra.Command, args []string) error {
			if len(args) > 0 && args[0] == "help" {
				return showHelp(cmd, args[1:])
			}
			return cmd.Help()
		},
		SilenceErrors: true,
		SilenceUsage:  true,
	}
	cmd.SetOut(env.Stdout)
	cmd.SetErr(env.Stderr)
	cmd.SetArgs(args)
	if env.Version != "" {
		cmd.Version = env.Version
		cmd.SetVersionTemplate("rootform {{.Version}}\n")
	}
	cmd.SetFlagErrorFunc(func(c *cobra.Command, err error) error {
		// A misspelled command leaves the options of the intended one unknown,
		// so the command is named first when its arguments already fail.
		if parsed := c.Flags().Args(); len(parsed) != 0 && c.HasAvailableSubCommands() && c.Args != nil {
			if argsErr := c.Args(c, parsed); argsErr != nil {
				return argsErr
			}
		}
		return usageError{msg: sanitizeFlagError(err) +
			"\n\nTry:\n  " + c.CommandPath() + " --help"}
	})
	addCommandGroups(cmd)
	// Cobra's generated help command is replaced rather than removed, and the
	// replacement carries a group so the help template never prints an empty
	// ungrouped section for it.
	cmd.SetHelpCommand(&cobra.Command{Use: "no-generated-help", Hidden: true, GroupID: groupOther})
	cmd.AddCommand(newInitCommand(env))
	cmd.AddCommand(newCompileCommand(env))
	cmd.AddCommand(newRunCommand(env))
	cmd.AddCommand(newCheckCommand(env))
	cmd.AddCommand(newValidateCommand(env))
	cmd.AddCommand(newFmtCommand(env))
	cmd.AddCommand(newTestCommand(env))
	cmd.AddCommand(newListCommand(env))
	cmd.AddCommand(newShowCommand(env))
	cmd.AddCommand(newExplainCommand(env))
	cmd.AddCommand(newAddCommand(env))
	cmd.AddCommand(newRemoveCommand(env))
	cmd.AddCommand(newUpdateCommand(env))
	cmd.AddCommand(newInstallCommand(env))
	cmd.AddCommand(newUninstallCommand(env))
	cmd.AddCommand(newVendorCommand(env))
	cmd.AddCommand(newPackageCommand(env))
	cmd.AddCommand(newPublishCommand(env))
	cmd.AddCommand(newLSPCommand(env))
	cmd.AddCommand(newCompletionCommand(env))
	cmd.AddCommand(newVersionCommand(env))
	for _, child := range cmd.Commands() {
		child.GroupID = commandGroup(child.Name())
	}
	cmd.CompletionOptions.DisableDefaultCmd = true
	cmd.PersistentFlags().Var(&colorOption{value: colorAuto}, "color",
		"color human output: `auto|always|never`; default: auto")
	setFlagGroup(cmd.PersistentFlags().Lookup("color"), GlobalGroup)
	completeValues(cmd, "color", "auto", "always", "never")
	cmd.PersistentFlags().Bool("no-pager", false, "print a long report in full instead of opening it in less")
	setFlagGroup(cmd.PersistentFlags().Lookup("no-pager"), GlobalGroup)
	nameHelpFlags(cmd)
	colored := resolveColor(env, args)
	resolvePaging(env, args)
	useSingleRootUsage(cmd, colored)
	cmd.SetHelpFunc(func(c *cobra.Command, _ []string) {
		var help bytes.Buffer
		writeHelp(&help, c, colored)
		writePaged(env, c.OutOrStdout(), help.Bytes())
	})
	return cmd
}

// writePaged writes a finished human report through the Page seam, or
// directly when none is wired.
func writePaged(env *Env, out io.Writer, report []byte) {
	if env.Page != nil {
		_ = env.Page(out, env.Stderr, report)
		return
	}
	_, _ = out.Write(report)
}

// useSingleRootUsage omits the runnable root's redundant flags form while
// preserving Cobra's normal usage lines for every child command.
func useSingleRootUsage(cmd *cobra.Command, colored bool) {
	template := strings.Replace(cmd.UsageTemplate(),
		"{{if .Runnable}}", "{{if and .Runnable .HasParent}}", 1)
	cmd.SetUsageTemplate(colorizeUsage(template, colored))
}

// nameHelpFlags replaces Cobra's generated flag descriptions, which read
// "help for <last word>" and so name a subcommand out of context.
func nameHelpFlags(cmd *cobra.Command) {
	cmd.InitDefaultHelpFlag()
	cmd.InitDefaultVersionFlag()
	if flag := cmd.Flags().Lookup("help"); flag != nil {
		flag.Usage = "show how to use " + cmd.CommandPath()
		setFlagGroup(flag, GlobalGroup)
	}
	if flag := cmd.Flags().Lookup("version"); flag != nil {
		flag.Usage = "print the rootform version and exit"
		setFlagGroup(flag, GlobalGroup)
	}
	for _, child := range cmd.Commands() {
		nameHelpFlags(child)
	}
}

// Command groups order the root help by intention. Every command names one.
const (
	groupAnalyze = "analyze"
	groupInspect = "inspect"
	groupProject = "project"
	groupHome    = "home"
	groupAuthor  = "author"
	groupOther   = "other"
)

func commandGroup(name string) string {
	switch name {
	case "run", "check":
		return groupAnalyze
	case "explain", "list", "show", "validate":
		return groupInspect
	case "init", "add", "remove", "update", "vendor":
		return groupProject
	case "install", "uninstall":
		return groupHome
	case "fmt", "test", "compile", "package", "publish", "lsp":
		return groupAuthor
	default:
		return groupOther
	}
}

func addCommandGroups(cmd *cobra.Command) {
	cmd.AddGroup(
		&cobra.Group{ID: groupAnalyze, Title: "Analyze"},
		&cobra.Group{ID: groupInspect, Title: "Inspect"},
		&cobra.Group{ID: groupProject, Title: "Project"},
		&cobra.Group{ID: groupHome, Title: "Rootform home"},
		&cobra.Group{ID: groupAuthor, Title: "Author and publish"},
		&cobra.Group{ID: groupOther, Title: "Other"},
	)
}

// Cobra v1.10.2 registers hidden __complete commands with no public disable
// toggle. Completion scripts call them as the first argument only; anywhere
// else before "--" the CLI rejects them, and after "--" they are arguments.
func reservedCompletionName(args []string) (string, bool) {
	for index, arg := range args {
		if arg == "--" {
			return "", false
		}
		if index > 0 && (arg == "__complete" || arg == "__completeNoDesc") {
			return arg, true
		}
	}
	return "", false
}

// helpPointer names the help of the command a usage error came from.
func helpPointer(executed *cobra.Command) string {
	if executed == nil || !executed.HasParent() || executed.Hidden {
		return "rootform help"
	}
	return executed.CommandPath() + " --help"
}

// showHelp walks public topic names and writes the most specific command's
// help. A misspelled topic suggests the topics it resembles, or its parent.
func showHelp(cmd *cobra.Command, topic []string) error {
	target := cmd.Root()
	for index, name := range topic {
		if index == 0 && name == cmd.Root().Name() {
			continue
		}
		found := false
		for _, candidate := range target.Commands() {
			if candidate.Name() == name && !candidate.Hidden {
				target = candidate
				found = true
				break
			}
		}
		if !found {
			parent := "rootform help" + strings.TrimPrefix(target.CommandPath(), "rootform")
			return usageError{msg: fmt.Sprintf(
				"unknown help topic %q\n\nTry:\n%s",
				strings.Join(topic[:index+1], " "), tryCommands(parent, closeCommands(target, name, commandNames(target)), parent))}
		}
	}
	target.InitDefaultHelpFlag()
	return target.Help()
}

// Run executes the root command and returns the process exit code.
func Run(env *Env) int {
	env = normalizeEnv(env)
	if name, ok := reservedCompletionName(env.Args); ok {
		fmt.Fprintln(env.Stderr, "rootform: reserved command name: "+name)
		fmt.Fprintln(env.Stderr, "Run 'rootform --help' for usage.")
		return ExitUsage
	}
	executed, err := NewRootCommand(env).ExecuteC()
	if err == nil {
		return ExitOK
	}
	var runError RunError
	if errors.As(err, &runError) {
		if runError.Message != "" {
			fmt.Fprintln(env.Stderr, "rootform: "+runError.Message)
		}
		return runError.Code
	}
	// A command that reported its own outcome exits with it silently.
	var decided exitStatus
	if errors.As(err, &decided) {
		return decided.code
	}
	var usage usageError
	if errors.As(err, &usage) {
		fmt.Fprintln(env.Stderr, "rootform: "+usage.msg)
		// A message that already shows the correct syntax or a command to run
		// needs no pointer; adding one would leave the user two places to look.
		if !strings.Contains(usage.msg, "\nUsage:\n") && !strings.Contains(usage.msg, "\nTry:\n") {
			fmt.Fprintln(env.Stderr, "\nTry:\n  "+helpPointer(executed))
		}
		return ExitUsage
	}
	var unavailable UnavailableError
	if errors.As(err, &unavailable) {
		fmt.Fprintln(env.Stderr, "rootform: "+unavailable.Message)
		return ExitFailure
	}
	var negative NegativeError
	if errors.As(err, &negative) {
		fmt.Fprintln(env.Stderr, "rootform: "+negative.Message)
		return ExitNegative
	}
	// A failure that reaches here carries no message a user can act on, so it
	// names the one thing that is certain: which command stopped.
	fmt.Fprintln(env.Stderr, "rootform: the command stopped before it could finish")
	fmt.Fprintln(env.Stderr, "\nTry:\n  rootform help")
	return ExitFailure
}
