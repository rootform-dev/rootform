package command

import (
	"errors"

	"github.com/spf13/cobra"
)

// ShowObject names the kind of definition a lookup reports.
type ShowObject string

const (
	// ShowDefinition is the bare form: the name itself selects a dialect, the
	// rf vocabulary, or one declaration they make.
	ShowDefinition ShowObject = "definition"
	ShowPolicyPack ShowObject = "policy-pack"
	ShowPolicy     ShowObject = "policy"
)

// ShowOptions carries the parsed options for one lookup.
type ShowOptions struct {
	Object  ShowObject
	Name    string
	Format  Format
	Project string
	// PolicyPack overlays local authoring roots on the project selection by
	// Policy Pack name for this run only, without changing rootform.lock.
	PolicyPack []string
	// Dialect names dialect source directories used for this run only.
	Dialect []string
}

// ShowOutcome is the framework-neutral result of one lookup.
type ShowOutcome int

const (
	// ShowUndecided is a run that could not read the loaded semantics. It is
	// the zero value, so a service that returns nothing never reads as found.
	ShowUndecided ShowOutcome = iota
	ShowReported
	ShowNotFound
	// ShowInvalidReference is a name that cannot refer to a definition at
	// all. Nothing was looked up, so it is command misuse rather than a
	// lookup that found nothing.
	ShowInvalidReference
	ShowFailure
)

// ShowService is the injected declaration-lookup seam.
type ShowService interface {
	Show(ShowOptions) (ShowOutcome, error)
}

func newShowCommand(env *Env) *cobra.Command {
	options := &ShowOptions{Object: ShowDefinition}
	format := ""
	cmd := &cobra.Command{
		Use:         "show <name>",
		Annotations: map[string]string{ownUsageAnnotation: "true"},
		Short:       "Show a Rootform definition",
		Long: "Show one Dialect, the RF Vocabulary, or one declaration they make.\n\n" +
			"A bare owner name such as google or rf shows that owner and every\n" +
			"declaration it makes. A qualified <owner>.<kind>.<name> shows one\n" +
			"declaration, where kind is concept, context, relation, or rule. A\n" +
			"bare declaration name is accepted when it resolves unambiguously.\n\n" +
			"The definition goes to standard output; redirect it to save a file.\n" +
			"Diagnostics go to standard error.\n\n" +
			"Exit status:\n" +
			"  0  the definition was shown\n" +
			"  1  the named definition was not found\n" +
			"  2  the command was used incorrectly\n" +
			"  3  the selection is invalid or unavailable, or the name is ambiguous\n" +
			"  4  rootform.lock could not be read or the definition could not be written",
		Example: "  rootform show google\n" +
			"  rootform show google.rule.cloud-sql-instance\n" +
			"  rootform show google.relation.runs-as\n" +
			"  rootform show rf.concept.virtual-network\n" +
			"  rootform show google --format json\n" +
			"  rootform show google --project ./infra",
		Args: func(cmd *cobra.Command, args []string) error {
			if err := refuseOutputFlag(cmd, args, "<name>", "text", "json"); err != nil {
				return err
			}
			return exactlyOne("show", "name")(cmd, args)
		},
		RunE: func(cmd *cobra.Command, args []string) error {
			selected, err := parseFormat(format, FormatText, FormatJSON)
			if err != nil {
				return err
			}
			options.Format, options.Name = selected, args[0]
			return runShow(env, *options)
		},
		SilenceErrors: true,
		SilenceUsage:  true,
	}
	outputFlag(cmd)
	formatFlag(cmd, &format, "text", "json")
	projectFlag(cmd, &options.Project)
	dialectOverrideFlag(cmd, &options.Dialect)
	groupFlags(cmd, "Output", "format")
	groupFlags(cmd, "Rootform project", "project", "dialect")
	cmd.AddCommand(newShowPolicyCommand(env), newShowPolicyPackCommand(env))
	return cmd
}

func newShowPolicyCommand(env *Env) *cobra.Command {
	options := &ShowOptions{Object: ShowPolicy}
	format := ""
	cmd := &cobra.Command{
		Use:   "policy <identifier>",
		Short: "Show a Policy definition",
		Long: "Show a Policy's target, assertion, message, Policy Pack, and source\n" +
			"location.\n\n" +
			"The project must select the owning Policy Pack, or --policy-pack can\n" +
			"supply a local root. Use <policy-pack>.policy.<name>,\n" +
			"<policy-pack>/<name>, or a bare name when it resolves unambiguously.\n\n" +
			"rootform explain policy explains an outcome that rootform check\n" +
			"recorded.\n\n" +
			"The definition goes to standard output; redirect it to save a file.\n" +
			"Diagnostics go to standard error.\n\n" +
			"Exit status:\n" +
			"  0  the definition was shown\n" +
			"  1  the named definition was not found\n" +
			"  2  the command was used incorrectly\n" +
			"  3  the selection is invalid or unavailable, or the name is ambiguous\n" +
			"  4  rootform.lock could not be read or the definition could not be written",
		Example: "  rootform show policy baseline.policy.cluster-network-context\n" +
			"  rootform show policy cluster-network-context\n" +
			"  rootform show policy cluster-network-context --policy-pack ./policies\n" +
			"  rootform show policy baseline.policy.cluster-network-context --format json\n" +
			"  rootform show policy cluster-network-context --project ./infra",
		Args: func(cmd *cobra.Command, args []string) error {
			if err := refuseOutputFlag(cmd, args, "<identifier>", "text", "json"); err != nil {
				return err
			}
			return exactlyOne("show policy", "identifier")(cmd, args)
		},
		RunE: func(cmd *cobra.Command, args []string) error {
			selected, err := parseFormat(format, FormatText, FormatJSON)
			if err != nil {
				return err
			}
			options.Format, options.Name = selected, args[0]
			return runShow(env, *options)
		},
		SilenceErrors: true,
		SilenceUsage:  true,
	}
	addShowFormatFlag(cmd, &format)
	projectFlag(cmd, &options.Project)
	policyPackOverlayFlag(cmd, &options.PolicyPack)
	groupFlags(cmd, "Output", "format")
	groupFlags(cmd, "Rootform project", "project", "policy-pack")
	return cmd
}

func newShowPolicyPackCommand(env *Env) *cobra.Command {
	options := &ShowOptions{Object: ShowPolicyPack}
	format := ""
	cmd := &cobra.Command{
		Use:   "policy-pack <name>",
		Short: "Show a Policy Pack",
		Long: "Show a selected or local Policy Pack, including its version, the\n" +
			"Policies it declares, its content identity, and its source location.\n\n" +
			"The name selects one loaded Policy Pack. Each --policy-pack root\n" +
			"replaces the selected Policy Pack of the same name for this command\n" +
			"only and adds any other name; rootform.lock is unchanged.\n\n" +
			"The definition goes to standard output; redirect it to save a file.\n" +
			"Diagnostics go to standard error.\n\n" +
			"Exit status:\n" +
			"  0  the definition was shown\n" +
			"  1  the named definition was not found\n" +
			"  2  the command was used incorrectly\n" +
			"  3  the selection is invalid or unavailable, or the name is ambiguous\n" +
			"  4  rootform.lock could not be read or the definition could not be written",
		Example: "  rootform show policy-pack baseline\n" +
			"  rootform show policy-pack baseline --policy-pack ./policies\n" +
			"  rootform show policy-pack baseline --format json\n" +
			"  rootform show policy-pack baseline --project ./infra",
		Args: func(cmd *cobra.Command, args []string) error {
			if err := refuseOutputFlag(cmd, args, "<name>", "text", "json"); err != nil {
				return err
			}
			return exactlyOne("show policy-pack", "name")(cmd, args)
		},
		RunE: func(cmd *cobra.Command, args []string) error {
			selected, err := parseFormat(format, FormatText, FormatJSON)
			if err != nil {
				return err
			}
			options.Format, options.Name = selected, args[0]
			return runShow(env, *options)
		},
		SilenceErrors: true,
		SilenceUsage:  true,
	}
	addShowFormatFlag(cmd, &format)
	projectFlag(cmd, &options.Project)
	policyPackOverlayFlag(cmd, &options.PolicyPack)
	groupFlags(cmd, "Output", "format")
	groupFlags(cmd, "Rootform project", "project", "policy-pack")
	return cmd
}

func addShowFormatFlag(cmd *cobra.Command, format *string) {
	outputFlag(cmd)
	formatFlag(cmd, format, "text", "json")
}

// runShow maps one lookup onto the accepted exit contract: a definition that
// was shown, a name that no loaded definition carries, and a lookup that could
// not select a single definition stay distinguishable.
func runShow(env *Env, options ShowOptions) error {
	if err := requireProjectDirectory(options.Project); err != nil {
		return err
	}
	if env.Show == nil {
		return errors.New("show service is not configured")
	}
	outcome, err := env.Show.Show(options)
	if err != nil {
		return serviceFailure(err)
	}
	switch outcome {
	case ShowReported:
		return nil
	case ShowNotFound:
		return exitStatus{code: ExitNegative}
	case ShowInvalidReference:
		return exitStatus{code: ExitUsage}
	case ShowFailure:
		return exitStatus{code: ExitFailure}
	default:
		return exitStatus{code: ExitNoAnswer}
	}
}
