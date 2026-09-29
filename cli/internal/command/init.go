package command

import (
	"errors"

	"github.com/spf13/cobra"
)

// InitOptions carries the parsed options for one explicit project
// preparation run.
type InitOptions struct {
	Path    string
	Locked  bool
	Offline bool
	NoInput bool
	Details bool
	Format  Format
}

type InitOutcome int

const (
	// InitNoAnswer is the zero value, so a service that returns nothing never
	// reads as prepared.
	InitNoAnswer InitOutcome = iota
	InitCompleted
	InitInvalid
	InitFailure
)

type InitService interface {
	Init(InitOptions) (InitOutcome, error)
}

func newInitCommand(env *Env) *cobra.Command {
	options := &InitOptions{}
	format := ""
	cmd := &cobra.Command{
		Use:   "init [path]",
		Short: "Prepare a Rootform project",
		Long: "Prepare an existing rootform.lock and materialize the project's exact\n" +
			"non-embedded selections (Dialects and Policy Pack sources) locally.\n\n" +
			"init is explicit: it never detects providers, selects another version,\n" +
			"or writes rootform.lock. With --locked the existing rootform.lock is\n" +
			"required and valid; without it, a missing lock is an empty selection\n" +
			"and an existing lock is always preserved. Embedded Dialects ship\n" +
			"inside the release set and are never acquired. When network access is\n" +
			"available and not disabled by --offline, init fetches only the exact\n" +
			"manifest digests already pinned by rootform.lock.\n\n" +
			"Path defaults to . and is the Rootform project. Machine JSON goes to\n" +
			"standard output. Diagnostics and --details go to standard error.\n\n" +
			"--details lists each prepared Dialect and Policy Pack with its status\n" +
			"and source.\n\n" +
			"Exit status:\n" +
			"  0  preparation completed\n" +
			"  1  selected content is invalid, missing, or differs from rootform.lock\n" +
			"  2  the command was used incorrectly\n" +
			"  3  rootform.lock is required or invalid, or --offline needs content\n" +
			"     that is not installed\n" +
			"  4  a file, the Rootform home, or the registry could not be read or written",
		Example: "  rootform init\n" +
			"  rootform init ./infra\n" +
			"  rootform init ./infra --locked --offline\n" +
			"  rootform init ./infra --no-input\n" +
			"  rootform init ./infra --details\n" +
			"  rootform init ./infra --format json",
		Args: atMostOneInput("init", "path"),
		RunE: func(cmd *cobra.Command, args []string) error {
			options.Path = "."
			if len(args) == 1 {
				options.Path = args[0]
			}
			selected, err := parseFormat(format, FormatText, FormatJSON)
			if err != nil {
				return err
			}
			options.Format = selected
			applyPreparationEnvironment(env, &options.Offline, &options.NoInput)
			if selected == FormatJSON {
				options.NoInput = true
			}
			if env.Init == nil {
				return errors.New("init service is not configured")
			}
			outcome, err := env.Init.Init(*options)
			if err != nil {
				return UnavailableError{Message: err.Error()}
			}
			switch outcome {
			case InitCompleted:
				return nil
			case InitInvalid:
				return exitStatus{code: ExitNegative}
			case InitNoAnswer:
				return exitStatus{code: ExitNoAnswer}
			default:
				return exitStatus{code: ExitFailure}
			}
		},
		SilenceErrors: true,
		SilenceUsage:  true,
	}
	flags := cmd.Flags()
	flags.BoolVar(&options.Locked, "locked", false,
		"require and preserve the existing rootform.lock")
	flags.BoolVar(&options.Offline, "offline", false,
		"use no network; accept local and installed sources")
	flags.BoolVar(&options.NoInput, "no-input", false,
		"never prompt; require deterministic action")
	flags.BoolVar(&options.Details, "details", false,
		"list every prepared unit's status and source on standard error")
	formatFlag(cmd, &format, "text", "json")
	groupFlags(cmd, "Preparation", "locked", "offline", "no-input")
	groupFlags(cmd, "Output", "format", "details")
	return cmd
}
