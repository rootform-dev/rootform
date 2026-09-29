package command

import (
	"errors"

	"github.com/spf13/cobra"
)

// TestOptions carries the parsed options for one fixture run.
type TestOptions struct {
	Path string
	// Run narrows the run to the cases whose name contains this text. An
	// empty value runs every case.
	Run    string
	Format Format
	// Dialect names dialect source directories used for this run only.
	Dialect []string
	// Update records the produced golden for every case that differs or has
	// none yet, instead of reporting it as failed.
	Update bool
}

// TestOutcome is the framework-neutral result of one fixture run.
type TestOutcome int

const (
	// TestUndecided is a run that could not compare any case. It is the zero
	// value, so a service that returns nothing never reads as passing.
	TestUndecided TestOutcome = iota
	TestPassed
	TestFailed
	TestNoMatch
	TestFailure
)

// TestService is the injected fixture-comparison seam.
type TestService interface {
	Test(TestOptions) (TestOutcome, error)
}

func newTestCommand(env *Env) *cobra.Command {
	options := &TestOptions{}
	format := ""
	cmd := &cobra.Command{
		Use:   "test [directory]",
		Short: "Test Dialect fixtures",
		Long: "Analyze Dialect fixtures and compare the Forms they produce with the\n" +
			"recorded ones. A fixture is a directory holding one plan.json or\n" +
			"state.json export and an analysis.golden Form; the project at the test\n" +
			"directory selects the Dialects. A plan.tfplan saved plan beside plan.json\n" +
			"must pair with it, and its configuration snapshot then contributes the\n" +
			"facts that follow references.\n\n" +
			"A golden records the Form with only the Dialect definitions it reaches.\n" +
			"The comparison ignores which Rootform version and which Dialect versions\n" +
			"recorded it. With --update, test writes the produced golden for every\n" +
			"case that differs, and for a directory holding an export but no golden\n" +
			"yet.\n\n" +
			"Without a directory, test reads the current directory. Text or JSON\n" +
			"results go to standard output. Diagnostics go to standard error.\n\n" +
			"Exit status:\n" +
			"  0  every selected fixture passed or, with --update, was recorded\n" +
			"  1  at least one fixture differed or could not be analyzed\n" +
			"  2  the command was used incorrectly\n" +
			"  3  rootform.lock is invalid or no fixtures matched\n" +
			"  4  fixture files, rootform.lock, Dialects, or the report could not be\n" +
			"     read or written",
		Example: "  rootform test\n" +
			"  rootform test ./fixtures\n" +
			"  rootform test ./fixtures --run cloud-sql\n" +
			"  rootform test ./fixtures --format json\n" +
			"  rootform test ./fixtures --update",
		Args: atMostOneInput("test", "directory"),
		RunE: func(cmd *cobra.Command, args []string) error {
			selected, err := parseFormat(format, FormatText, FormatJSON)
			if err != nil {
				return err
			}
			options.Format = selected
			path, err := resolveDir(env, args)
			if err != nil {
				return err
			}
			options.Path = path
			if env.Test == nil {
				return errors.New("test service is not configured")
			}
			outcome, err := env.Test.Test(*options)
			if err != nil {
				return serviceFailure(err)
			}
			switch outcome {
			case TestPassed:
				return nil
			case TestFailed:
				return exitStatus{code: ExitNegative}
			case TestNoMatch:
				return exitStatus{code: ExitNoAnswer}
			case TestFailure:
				return exitStatus{code: ExitFailure}
			default:
				return UnavailableError{Message: "test did not report a result"}
			}
		},
		SilenceErrors: true,
		SilenceUsage:  true,
	}
	formatFlag(cmd, &format, "text", "json")
	cmd.Flags().StringVar(&options.Run, "run", "",
		"run only the cases whose `name` contains this text")
	cmd.Flags().BoolVar(&options.Update, "update", false,
		"write the golden of every differing or new case")
	dialectOverrideFlag(cmd, &options.Dialect)
	return cmd
}
