package command

import (
	"errors"

	"github.com/spf13/cobra"
)

// ValidateObject names the kind of object a validation checks.
type ValidateObject string

const (
	ValidateForm     ValidateObject = "form"
	ValidateDialects ValidateObject = "dialects"
	ValidatePolicy   ValidateObject = "policy"
	ValidateRule     ValidateObject = "rule"
	ValidateConcept  ValidateObject = "concept"
	ValidateContext  ValidateObject = "context"
	ValidateRelation ValidateObject = "relation"
)

// ValidateOptions carries the parsed options for one validation.
type ValidateOptions struct {
	Object ValidateObject
	// Name identifies the single object to validate. It is empty for the
	// object kinds that validate a whole input.
	Name   string
	Input  string
	Format Format
	// Dialect names dialect source directories used for this run only.
	Dialect []string
	// PolicyPack names local Policy Pack directories overlaid on the
	// selection for this run only.
	PolicyPack []string
	// Project is the directory whose rootform.lock selects the definitions
	// a named validation reads; empty means the working directory.
	Project string
}

// ValidateOutcome is the framework-neutral result of one validation.
type ValidateOutcome int

const (
	// ValidateUndecided is a run that could not decide whether the object is
	// correctly defined. It is the zero value, so a service that returns
	// nothing never reads as valid.
	ValidateUndecided ValidateOutcome = iota
	ValidateValid
	ValidateInvalid
	ValidateNotFound
	ValidateFailure
)

// ValidateService is the injected definition-checking seam.
type ValidateService interface {
	Validate(ValidateOptions) (ValidateOutcome, error)
}

func newValidateCommand(env *Env) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "validate <object>",
		Short: "Validate a Rootform object",
		Long: "Validate a saved Form or a Rootform definition and report any problems.\n\n" +
			"Validation checks definitions; it does not evaluate Policies. Use\n" +
			"rootform check plan.json --policy PACK/NAME for that.\n\n" +
			"Exit status:\n  0  help was shown\n  2  the command was used incorrectly",
		Example: "  rootform validate form form.json\n" +
			"  rootform validate dialects ./dialects\n" +
			"  rootform validate rule google.rule.cloud-sql-instance",
		Args: objectRequired("validate",
			"form", "dialects", "policy", "rule", "concept", "context", "relation"),
		RunE:          func(cmd *cobra.Command, args []string) error { return cmd.Help() },
		SilenceErrors: true,
		SilenceUsage:  true,
	}
	cmd.AddCommand(
		newValidateFormCommand(env),
		newValidateDialectsCommand(env),
		newValidateNamedCommand(env, ValidatePolicy,
			"Validate a Policy definition",
			"Validate a Policy definition in its selected Policy Pack.",
			"  rootform validate policy baseline.policy.cluster-network-context\n"+
				"  rootform validate policy cluster-network-context\n"+
				"  rootform validate policy cluster-network-context --policy-pack ./policies\n"+
				"  rootform validate policy baseline.policy.cluster-network-context --format json"),
		newValidateNamedCommand(env, ValidateRule,
			"Validate a Rule definition",
			"Validate a Rule and its references within its Dialect.",
			"  rootform validate rule google.rule.cloud-sql-instance\n"+
				"  rootform validate rule cloud-sql-instance\n"+
				"  rootform validate rule payments.rule.gateway --dialect ./dialects/payments\n"+
				"  rootform validate rule google.rule.cloud-sql-instance --format json"),
		newValidateNamedCommand(env, ValidateConcept,
			"Validate a Concept definition",
			"Validate a Concept in its Dialect or the RF Vocabulary.",
			"  rootform validate concept rf.concept.virtual-network\n"+
				"  rootform validate concept virtual-network\n"+
				"  rootform validate concept rf.concept.virtual-network --format json"),
		newValidateNamedCommand(env, ValidateContext,
			"Validate a context dimension",
			"Validate a context dimension in its Dialect or the RF Vocabulary.",
			"  rootform validate context rf.context.network\n"+
				"  rootform validate context network\n"+
				"  rootform validate context rf.context.network --format json"),
		newValidateNamedCommand(env, ValidateRelation,
			"Validate a relation predicate",
			"Validate a relation and every compiled producer reference.",
			"  rootform validate relation google.relation.runs-as\n"+
				"  rootform validate relation runs-as\n"+
				"  rootform validate relation google.relation.runs-as --format json"),
	)
	return cmd
}

func newValidateFormCommand(env *Env) *cobra.Command {
	options := &ValidateOptions{Object: ValidateForm}
	format := ""
	cmd := &cobra.Command{
		Use:   "form <file>",
		Short: "Validate a saved Form",
		Long: "Check that a saved Form is a valid format-1 state, plan, or comparison\n" +
			"Form. Validation reads the Form alone: it loads no Dialect and never\n" +
			"recompiles. Use '-' for standard input.\n\n" +
			"A plan or state export is analyzed by rootform run, not validated here.\n\n" +
			"The text or JSON result goes to standard output. Diagnostics go to\n" +
			"standard error.\n\n" +
			"Exit status:\n" +
			"  0  the Form is valid\n" +
			"  1  the Form is not valid\n" +
			"  2  the command was used incorrectly\n" +
			"  3  the input was refused\n" +
			"  4  the input could not be read or the report could not be written",
		Example: "  rootform validate form form.json\n" +
			"  cat form.json | rootform validate form -\n" +
			"  rootform validate form comparison.json --format json",
		Args: exactlyOne("validate form", "form"),
		RunE: func(cmd *cobra.Command, args []string) error {
			selected, err := parseFormat(format, FormatText, FormatJSON)
			if err != nil {
				return err
			}
			options.Format = selected
			options.Input = args[0]
			return runValidate(env, *options)
		},
		SilenceErrors: true,
		SilenceUsage:  true,
	}
	formatFlag(cmd, &format, "text", "json")
	return cmd
}

func newValidateDialectsCommand(env *Env) *cobra.Command {
	options := &ValidateOptions{Object: ValidateDialects}
	format := ""
	cmd := &cobra.Command{
		Use:   "dialects [directory]",
		Short: "Validate Dialect definitions",
		Long: "Compile and validate each Dialect of a directory, including its\n" +
			"Concepts, Rules, and references.\n\n" +
			"Without a directory, validation reads the current directory. The text or\n" +
			"JSON result goes to standard output. Diagnostics go to standard error.\n\n" +
			"Exit status:\n" +
			"  0  every Dialect is valid\n" +
			"  1  at least one Dialect is not valid\n" +
			"  2  the command was used incorrectly\n" +
			"  3  no Dialects were found\n" +
			"  4  a source could not be read or the report could not be written",
		Example: "  rootform validate dialects\n" +
			"  rootform validate dialects ./dialects\n" +
			"  rootform validate dialects ./dialects --format json",
		Args: atMostOneInput("validate dialects", "directory"),
		RunE: func(cmd *cobra.Command, args []string) error {
			selected, err := parseFormat(format, FormatText, FormatJSON)
			if err != nil {
				return err
			}
			options.Format = selected
			input, err := resolveDir(env, args)
			if err != nil {
				return err
			}
			options.Input = input
			return runValidate(env, *options)
		},
		SilenceErrors: true,
		SilenceUsage:  true,
	}
	formatFlag(cmd, &format, "text", "json")
	return cmd
}

func newValidateNamedCommand(env *Env, object ValidateObject, short, long, example string) *cobra.Command {
	options := &ValidateOptions{Object: object}
	format := ""
	name := string(object)
	selection := "Use <owner>.<kind>.<name>, or a bare name when it resolves unambiguously.\n" +
		"--dialect adds or replaces one Dialect for this command only."
	if object == ValidatePolicy {
		selection = "The project must select the Policy Pack that owns the Policy, or\n" +
			"--policy-pack must name its source directory for this command only.\n" +
			"Use <policy-pack>.policy.<name>, <policy-pack>/<name>, or a bare name\n" +
			"when it resolves unambiguously."
	}
	cmd := &cobra.Command{
		Use:   name + " <identifier>",
		Short: short,
		Long: long + "\n\n" +
			selection + "\n\n" +
			"The text or JSON result goes to standard output. Diagnostics go to\n" +
			"standard error.\n\n" +
			"Exit status:\n" +
			"  0  the definition is valid\n" +
			"  1  the definition is not valid, or no definition has that name\n" +
			"  2  the command was used incorrectly\n" +
			"  3  rootform.lock is invalid or the name is ambiguous\n" +
			"  4  rootform.lock or definitions could not be read, or the report could\n" +
			"     not be written",
		Example: example,
		Args:    exactlyOne("validate "+name, "identifier"),
		RunE: func(cmd *cobra.Command, args []string) error {
			selected, err := parseFormat(format, FormatText, FormatJSON)
			if err != nil {
				return err
			}
			options.Format, options.Name = selected, args[0]
			if err := requireProjectDirectory(options.Project); err != nil {
				return err
			}
			return runValidate(env, *options)
		},
		SilenceErrors: true,
		SilenceUsage:  true,
	}
	formatFlag(cmd, &format, "text", "json")
	projectFlag(cmd, &options.Project)
	dialectOverrideFlag(cmd, &options.Dialect)
	if object == ValidatePolicy {
		policyPackOverlayFlag(cmd, &options.PolicyPack)
	}
	return cmd
}

func runValidate(env *Env, options ValidateOptions) error {
	if env.Validate == nil {
		return errors.New("validate service is not configured")
	}
	outcome, err := env.Validate.Validate(options)
	if err != nil {
		return serviceFailure(err)
	}
	switch outcome {
	case ValidateValid:
		return nil
	case ValidateInvalid:
		return exitStatus{code: ExitNegative}
	case ValidateNotFound:
		return exitStatus{code: ExitNegative}
	case ValidateFailure:
		return exitStatus{code: ExitFailure}
	default:
		return exitStatus{code: ExitNoAnswer}
	}
}
