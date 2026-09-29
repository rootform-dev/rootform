package command

import (
	"errors"

	"github.com/spf13/cobra"
)

// FmtOptions carries the parsed options for one formatting run.
type FmtOptions struct {
	Path  string
	Check bool
	Diff  bool
}

// FmtOutcome is the framework-neutral result of one formatting run.
type FmtOutcome int

const (
	// FmtUndecided is a run that could not decide whether any source would
	// change. It is the zero value, so a service that returns nothing never
	// reads as tidy.
	FmtUndecided FmtOutcome = iota
	// FmtClean is a run in which every source was already tidy.
	FmtClean
	// FmtRewritten is a run that tidied at least one source. The sources are
	// tidy once it returns, so it is a success.
	FmtRewritten
	// FmtDrift is an inspection that found at least one source which is not
	// tidy. Nothing was rewritten, so it is not a success.
	FmtDrift
	FmtInvalid
	FmtFailure
)

// FmtService is the injected source-formatting seam.
type FmtService interface {
	Fmt(FmtOptions) (FmtOutcome, error)
}

func newFmtCommand(env *Env) *cobra.Command {
	options := &FmtOptions{}
	cmd := &cobra.Command{
		Use:   "fmt [path]",
		Short: "Format Rootform files",
		Long: "Rewrite Rootform source files using the canonical format.\n\n" +
			"Without a path, fmt reads the current directory. By default it rewrites\n" +
			"changed files. --check reports their names and --diff writes changes to\n" +
			"standard output without rewriting. Diagnostics go to standard error.\n\n" +
			"Exit status:\n" +
			"  0  the sources are formatted\n" +
			"  1  a source cannot be parsed, or --check or --diff found a source\n" +
			"     that is not formatted\n" +
			"  2  the command was used incorrectly\n" +
			"  4  a source could not be read or rewritten",
		Example: "  rootform fmt\n" +
			"  rootform fmt ./dialects\n" +
			"  rootform fmt --check\n" +
			"  rootform fmt ./dialects --diff",
		Args: atMostOneInput("fmt", "path"),
		RunE: func(cmd *cobra.Command, args []string) error {
			path, err := resolveDir(env, args)
			if err != nil {
				return err
			}
			options.Path = path
			if env.Fmt == nil {
				return errors.New("fmt service is not configured")
			}
			outcome, err := env.Fmt.Fmt(*options)
			if err != nil {
				return serviceFailure(err)
			}
			switch outcome {
			case FmtClean, FmtRewritten:
				return nil
			case FmtDrift:
				return exitStatus{code: ExitNegative}
			case FmtInvalid:
				return exitStatus{code: ExitNegative}
			case FmtFailure:
				return exitStatus{code: ExitFailure}
			default:
				return UnavailableError{Message: "fmt did not report a result"}
			}
		},
		SilenceErrors: true,
		SilenceUsage:  true,
	}
	cmd.Flags().BoolVar(&options.Check, "check", false,
		"check formatting without rewriting files")
	cmd.Flags().BoolVar(&options.Diff, "diff", false,
		"show formatting changes without rewriting files")
	return cmd
}
