package command

import (
	"errors"

	"github.com/spf13/cobra"
)

// CompileOptions carries the paths for compiling and pinning a Policy Pack.
type CompileOptions struct {
	Source    string
	Semantics string
	Output    string
}

// CompileService owns Policy Pack compilation and writing the compiled file.
type CompileService interface {
	CompilePolicyPack(CompileOptions) error
}

func newCompileCommand(env *Env) *cobra.Command {
	cmd := &cobra.Command{
		Use:           "compile <object>",
		Short:         "Compile a Policy Pack for offline checks",
		Long:          "Compile Policy Pack sources with explicit semantic pins for later checks.\n\nExit status:\n  0  help was shown\n  2  the command was used incorrectly",
		Args:          objectRequired("compile", "policy-pack"),
		RunE:          func(cmd *cobra.Command, args []string) error { return cmd.Help() },
		SilenceErrors: true,
		SilenceUsage:  true,
	}
	options := &CompileOptions{}
	pack := &cobra.Command{
		Use:   "policy-pack <directory>",
		Short: "Compile and pin a Policy Pack",
		Long: "Compile one Policy Pack source directory using the semantics of the saved\n" +
			"Form in --semantics, and write the compiled JSON file to --output. The\n" +
			"compiled Policy Pack keeps its semantic pins for later offline evaluation\n" +
			"without the Dialect sources that produced the Form.\n\n" +
			"The summary goes to standard output. Diagnostics go to standard error.\n\n" +
			"Exit status:\n" +
			"  0  the compiled Policy Pack was written\n" +
			"  1  the Policy Pack or Form is invalid\n" +
			"  2  the command was used incorrectly\n" +
			"  4  a source could not be read or the output could not be written",
		Example: "  rootform compile policy-pack ./policies --semantics form.json -o pack.json\n" +
			"  rootform compile policy-pack . --semantics form.json -o pack.json\n" +
			"  rootform compile policy-pack ./rules --semantics form.json -o rules.json",
		Args: exactlyOne("compile policy-pack", "directory"),
		RunE: func(cmd *cobra.Command, args []string) error {
			options.Source = args[0]
			if options.Source == "" || options.Semantics == "" || options.Output == "" ||
				options.Semantics == "-" || options.Output == "-" {
				return usageError{msg: "compile policy-pack needs a source directory, --semantics, and --output\n\n" +
					"Usage:\n  rootform compile policy-pack <directory> --semantics <form-file> -o <compiled-file>"}
			}
			if env.Compile == nil {
				return errors.New("compile service is not configured")
			}
			if err := env.Compile.CompilePolicyPack(*options); err != nil {
				return serviceFailure(err)
			}
			return nil
		},
		SilenceErrors: true,
		SilenceUsage:  true,
	}
	pack.Flags().StringVar(&options.Semantics, "semantics", "",
		"read semantics from a saved Form `file` (required)")
	pack.Flags().StringVarP(&options.Output, "output", "o", "",
		"write compiled Policy Pack to `file` (required)")
	cmd.AddCommand(pack)
	return cmd
}
