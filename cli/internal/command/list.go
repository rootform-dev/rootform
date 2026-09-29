package command

import (
	"errors"
	"slices"
	"strings"

	"github.com/spf13/cobra"
)

// ListObject names the kind of definition a listing reports.
type ListObject string

const (
	ListDialects    ListObject = "dialects"
	ListPolicyPacks ListObject = "policy-packs"
	ListPolicies    ListObject = "policies"
)

// FormatWide keeps one row per definition and adds the columns a bare name
// cannot carry. It is a reading aid; the machine contract stays JSON.
const FormatWide Format = "wide"

// ListOptions carries the parsed options for one listing.
type ListOptions struct {
	Object ListObject
	// Names narrows a dialect listing to the named dialects. An empty
	// selection reports every loaded dialect.
	Names []string
	// Dialect names dialect source directories used for this run only.
	Dialect []string
	// Installed lists the Rootform home instead of the project catalog.
	Installed bool
	// PolicyPack overlays local authoring roots on the project selection by
	// Policy Pack name for this run only, without changing rootform.lock.
	PolicyPack []string
	Project    string
	Format     Format
}

// ListOutcome is the framework-neutral result of one listing.
type ListOutcome int

const (
	// ListUndecided is a run that could not read the loaded semantics. It is
	// the zero value, so a service that returns nothing never reads as a
	// complete listing.
	ListUndecided ListOutcome = iota
	ListReported
	ListNotFound
	ListFailure
)

// ListService is the injected declaration-reading seam.
type ListService interface {
	List(ListOptions) (ListOutcome, error)
}

func newListCommand(env *Env) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "list <object>",
		Short: "List Rootform definitions",
		Long: "List the Dialects a project loads, the Policy Packs it selects, or\n" +
			"the Policies those Policy Packs declare.\n\n" +
			"Use \"rootform show\" to read one listed definition in full.\n\n" +
			"Exit status:\n" +
			"  0  help was shown\n" +
			"  2  the command was used incorrectly",
		Example: "  rootform list dialects\n" +
			"  rootform list dialects --format wide\n" +
			"  rootform list policy-packs\n" +
			"  rootform list policies --project ./infra",
		Args:          objectRequired("list", "dialects", "policy-packs", "policies"),
		RunE:          func(cmd *cobra.Command, args []string) error { return cmd.Help() },
		SilenceErrors: true,
		SilenceUsage:  true,
	}
	cmd.AddCommand(
		newListObjectCommand(env, ListDialects,
			"List the Dialect catalog",
			"List the Dialect catalog available to this project: the Dialects\n"+
				"embedded in Rootform and the Dialects the project selects.\n\n"+
				"Without a name, every loaded Dialect is included. Text names one\n"+
				"Dialect per line. Wide adds version, origin, and declaration counts.\n"+
				"JSON carries the exact version, origin, and content digest of\n"+
				"every selection.\n\n"+
				"With --installed, the versions installed in the Rootform home are\n"+
				"listed with their repository and digests; no project is read and no\n"+
				"network is used. --project cannot be combined with --installed.",
			"  rootform list dialects\n"+
				"  rootform list dialects --format wide\n"+
				"  rootform list dialects google aws\n"+
				"  rootform list dialects --project ./infra\n"+
				"  rootform list dialects --dialect ./dialects/payments\n"+
				"  rootform list dialects --installed\n"+
				"  rootform list dialects --format json"),
		newListObjectCommand(env, ListPolicyPacks,
			"List Policy Packs",
			"List the Policy Packs the project selects or that are provided\n"+
				"locally.\n\n"+
				"The project selection is loaded. Each --policy-pack root replaces\n"+
				"the selected Policy Pack of the same name for this command only\n"+
				"and adds any other name; rootform.lock is unchanged. Text names\n"+
				"one Policy Pack per line. Wide adds version and Policy count.\n"+
				"JSON carries the exact version and content digest.\n\n"+
				"With --installed, the versions installed in the Rootform home are\n"+
				"listed with their repository and digests; no project is read and no\n"+
				"network is used. --project cannot be combined with --installed.",
			"  rootform list policy-packs\n"+
				"  rootform list policy-packs --format wide\n"+
				"  rootform list policy-packs --policy-pack ./policies\n"+
				"  rootform list policy-packs --project ./infra\n"+
				"  rootform list policy-packs --installed\n"+
				"  rootform list policy-packs --format json"),
		newListObjectCommand(env, ListPolicies,
			"List Policies",
			"List the Policies the selected Policy Packs declare.\n\n"+
				"The project selection is loaded. Each --policy-pack root replaces\n"+
				"the selected Policy Pack of the same name for this command only\n"+
				"and adds any other name; rootform.lock is unchanged. Text names\n"+
				"one qualified Policy per line. Wide adds each Policy target.\n"+
				"JSON carries the owning Policy Pack and target of every Policy.",
			"  rootform list policies\n"+
				"  rootform list policies --format wide\n"+
				"  rootform list policies --policy-pack ./policies\n"+
				"  rootform list policies --project ./infra\n"+
				"  rootform list policies --format json"),
	)
	return cmd
}

func newListObjectCommand(env *Env, object ListObject, short, long, example string) *cobra.Command {
	options := &ListOptions{Object: object}
	format := ""
	name := string(object)
	statuses := "  0  the definitions were listed\n"
	if object == ListDialects {
		statuses += "  1  a named Dialect is not loaded\n"
	}
	statuses += "  2  the command was used incorrectly\n" +
		"  3  the project selection or its catalog is invalid or unavailable\n"
	if object == ListPolicies {
		statuses += "  4  rootform.lock could not be read or the listing could not be written"
	} else {
		statuses += "  4  rootform.lock or the Rootform home could not be read, or the listing\n" +
			"     could not be written"
	}
	cmd := &cobra.Command{
		Use:   name,
		Short: short,
		Long: long + "\n\n" +
			"The listing goes to standard output; redirect it to save a file.\n" +
			"Diagnostics go to standard error.\n\n" +
			"Exit status:\n" + statuses,
		Example: example,
		Args: func(cmd *cobra.Command, args []string) error {
			if err := refuseOutputFlag(cmd, args, "", "text", "wide", "json"); err != nil {
				return err
			}
			if object == ListDialects {
				return nil
			}
			return noArguments("list "+name)(cmd, args)
		},
		RunE: func(cmd *cobra.Command, args []string) error {
			selected, err := parseFormat(format, FormatText, FormatWide, FormatJSON)
			if err != nil {
				return err
			}
			options.Format = selected
			if len(args) != 0 {
				options.Names = append([]string{}, args...)
			}
			if options.Installed && (cmd.Flags().Changed("project") || len(options.Names) != 0 ||
				len(options.Dialect) != 0 || len(options.PolicyPack) != 0) {
				return usageError{msg: "--installed lists the Rootform home; names, --project, --dialect, and\n" +
					"--policy-pack list what a project selects instead\n\n" +
					"Try:\n  " + cmd.CommandPath() + " --installed\n  " + projectListing(cmd, options)}
			}
			if err := requireProjectDirectory(options.Project); err != nil {
				return err
			}
			if env.List == nil {
				return errors.New("list service is not configured")
			}
			outcome, err := env.List.List(*options)
			if err != nil {
				return serviceFailure(err)
			}
			switch outcome {
			case ListReported:
				return nil
			case ListNotFound:
				return exitStatus{code: ExitNegative}
			case ListFailure:
				return exitStatus{code: ExitFailure}
			default:
				return exitStatus{code: ExitNoAnswer}
			}
		},
		SilenceErrors: true,
		SilenceUsage:  true,
	}
	outputFlag(cmd)
	formatFlag(cmd, &format, "text", "wide", "json")
	projectFlag(cmd, &options.Project)
	if object == ListDialects {
		cmd.Use = name + " [name]..."
		dialectOverrideFlag(cmd, &options.Dialect)
	}
	if object == ListPolicyPacks || object == ListPolicies {
		policyPackOverlayFlag(cmd, &options.PolicyPack)
	}
	if object == ListDialects || object == ListPolicyPacks {
		cmd.Flags().BoolVar(&options.Installed, "installed", false,
			"list versions installed in the Rootform home")
	}
	groupFlags(cmd, "Output", "format")
	projectFlags := []string{"project"}
	if object == ListDialects {
		projectFlags = append(projectFlags, "dialect")
	}
	if object == ListPolicyPacks || object == ListPolicies {
		projectFlags = append(projectFlags, "policy-pack")
	}
	groupFlags(cmd, "Rootform project", projectFlags...)
	if object == ListDialects || object == ListPolicyPacks {
		groupFlags(cmd, "Rootform home", "installed")
	}
	return cmd
}

// projectListing repeats a listing without --installed, keeping the names and
// project options that list what a project selects.
func projectListing(cmd *cobra.Command, options *ListOptions) string {
	command := cmd.CommandPath()
	for _, name := range options.Names {
		command += " " + shellQuotedArgument(name)
	}
	if cmd.Flags().Changed("project") {
		command += " --project " + shellQuotedArgument(options.Project)
	}
	for _, dialect := range options.Dialect {
		command += " --dialect " + shellQuotedArgument(dialect)
	}
	for _, pack := range options.PolicyPack {
		command += " --policy-pack " + shellQuotedArgument(pack)
	}
	return command
}

// outputFlag keeps the retired -o/--output hidden, so that using it points to
// --format and a redirection instead of reading as an unknown flag.
func outputFlag(cmd *cobra.Command) {
	cmd.Flags().StringP("output", "o", "", "not accepted; the result goes to standard output")
	_ = cmd.Flags().MarkHidden("output")
}

func refuseOutputFlag(cmd *cobra.Command, args []string, placeholder string, formats ...string) error {
	flag := cmd.Flags().Lookup("output")
	if flag == nil || !flag.Changed {
		return nil
	}
	command := cmd.CommandPath()
	for _, arg := range args {
		command += " " + shellQuotedArgument(arg)
	}
	if len(args) == 0 && placeholder != "" {
		command += " " + placeholder
	}
	value := flag.Value.String()
	try := command + " > " + shellQuotedArgument(value)
	switch {
	case value == "-":
		try = command
	case slices.Contains(formats, value):
		try = command + " --format " + value
	case strings.HasSuffix(value, ".json"):
		try = command + " --format json > " + shellQuotedArgument(value)
	}
	return usageError{msg: "-o/--output is not accepted; " + cmd.CommandPath() +
		" writes to standard output\n\nTry:\n  " + try}
}

func shellQuotedArgument(value string) string {
	if commandArgument(value) == value {
		return value
	}
	return "'" + strings.ReplaceAll(value, "'", "'\"'\"'") + "'"
}
