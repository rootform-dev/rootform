package command

import (
	"fmt"
	"strings"

	"github.com/spf13/cobra"
)

// completionShells returns the shells a script can be generated for, in the
// order the help lists them.
func completionShells() []string { return []string{"bash", "zsh", "fish", "powershell"} }

func newCompletionCommand(env *Env) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "completion <shell>",
		Short: "Generate shell completion",
		Long: "Generate a completion script for bash, zsh, fish, or PowerShell.\n\n" +
			"The script goes to standard output. Diagnostics go to standard error.\n\n" +
			"Exit status:\n" +
			"  0  the completion script was generated\n" +
			"  2  the command was used incorrectly\n" +
			"  4  the completion script could not be written",
		Example: "  rootform completion bash > /usr/local/etc/bash_completion.d/rootform\n" +
			"  rootform completion zsh > \"${fpath[1]}/_rootform\"\n" +
			"  rootform completion fish > ~/.config/fish/completions/rootform.fish",
		Args: func(cmd *cobra.Command, args []string) error {
			if len(args) == 1 && supportedShell(args[0]) {
				return nil
			}
			if len(args) == 0 {
				return usageError{msg: "completion needs a shell\n\nExpected:\n" +
					indented(completionShells()) + "\n\nTry:\n  rootform completion bash"}
			}
			if len(args) > 1 {
				return usageError{msg: fmt.Sprintf(
					"completion generates one script at a time, but %s given\n\nUsage:\n  rootform completion <shell>",
					counted(len(args), "shell was", "shells were"))}
			}
			return usageError{msg: fmt.Sprintf(
				"completion cannot generate a script for %s\n\nExpected:\n%s\n\nTry:\n  rootform completion bash",
				quoted(args[0]), indented(completionShells()))}
		},
		RunE: func(cmd *cobra.Command, args []string) error {
			root := cmd.Root()
			var err error
			switch strings.ToLower(args[0]) {
			case "bash":
				err = root.GenBashCompletionV2(env.Stdout, true)
			case "zsh":
				err = root.GenZshCompletion(env.Stdout)
			case "fish":
				err = root.GenFishCompletion(env.Stdout, true)
			default:
				err = root.GenPowerShellCompletionWithDesc(env.Stdout)
			}
			if err != nil {
				return UnavailableError{Message: "the completion script could not be written: " + err.Error()}
			}
			return nil
		},
		SilenceErrors: true,
		SilenceUsage:  true,
	}
	return cmd
}

func supportedShell(name string) bool {
	for _, candidate := range completionShells() {
		if strings.ToLower(name) == candidate {
			return true
		}
	}
	return false
}

// completeValues offers the fixed values of a flag instead of file names.
func completeValues(cmd *cobra.Command, flag string, values ...string) {
	if err := cmd.RegisterFlagCompletionFunc(flag, cobra.FixedCompletions(values, cobra.ShellCompDirectiveNoFileComp)); err != nil {
		panic("completion for --" + flag + ": " + err.Error())
	}
}

func stageValues() []string { return []string{"planned", "refreshed", "recorded"} }

// completeEvidenceValues offers the values of the evidence options that
// run, check and explain share.
func completeEvidenceValues(cmd *cobra.Command) {
	completeValues(cmd, "plan-complete", "attested")
	completeValues(cmd, "producer", "terraform", "opentofu")
}

// The saved plan options run, check and explain share. A saved plan file
// enriches its plan JSON only once they are paired, and pairing compares
// their run identity and configuration shape; it neither validates the plan
// nor proves more than that correspondence.
const (
	planFileUsage          = "pair the plan JSON with the saved plan `file` it was exported from, to enrich it; pairing compares version, timestamp, and configuration shape"
	requireEnrichmentUsage = "refuse the input when its saved plan file does not pair with the plan JSON"
)

func newVersionCommand(env *Env) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "version",
		Short: "Show the Rootform version",
		Long: "Print the Rootform version to standard output. Diagnostics go to\n" +
			"standard error.\n\n" +
			"Exit status:\n" +
			"  0  the version was printed\n" +
			"  2  the command was used incorrectly\n" +
			"  4  the version could not be written",
		Example: "  rootform version\n" +
			"  rootform --version\n" +
			"  rootform version > rootform-version.txt",
		Args: noArguments("version"),
		RunE: func(cmd *cobra.Command, args []string) error {
			version := env.Version
			if version == "" {
				version = "unknown"
			}
			if _, err := fmt.Fprintln(env.Stdout, "rootform "+version); err != nil {
				return UnavailableError{Message: "the version could not be written: " + err.Error()}
			}
			return nil
		},
		SilenceErrors: true,
		SilenceUsage:  true,
	}
	return cmd
}
