package command

import (
	"errors"

	"github.com/spf13/cobra"
)

func newLSPCommand(env *Env) *cobra.Command {
	return &cobra.Command{
		Use:   "lsp",
		Short: "Serve Rootform language features over stdio",
		Long: "Run the Rootform language server over standard input and standard output.\n" +
			"Protocol frames are the only standard output. Process diagnostics go to\n" +
			"standard error; source diagnostics travel through LSP.\n\n" +
			"Exit status:\n" +
			"  0  the client completed shutdown and exit\n" +
			"  2  the command was used incorrectly\n" +
			"  4  the transport or the protocol lifecycle failed",
		Example: "  rootform lsp\n" +
			"  rootform lsp 2>rootform-lsp.log\n" +
			"  rootform lsp <client.frames >server.frames",
		Args: noArguments("lsp"),
		RunE: func(*cobra.Command, []string) error {
			if env.LSP == nil {
				return errors.New("language server service is not configured")
			}
			// A transport error can quote protocol frames, so it never reaches
			// standard error.
			if err := env.LSP.Run(); err != nil {
				return UnavailableError{Message: "the language server stopped before the client completed shutdown"}
			}
			return nil
		},
		SilenceErrors: true,
		SilenceUsage:  true,
	}
}
