package command

import (
	"errors"
	"fmt"

	"github.com/spf13/cobra"
)

// ExplainObject names the kind of conclusion an explanation justifies.
type ExplainObject string

const (
	ExplainInstance ExplainObject = "instance"
	ExplainRule     ExplainObject = "rule"
	ExplainPolicy   ExplainObject = "policy"
)

// ExplainOptions carries one explanation request.
type ExplainOptions struct {
	Object ExplainObject
	Name   string
	// Input is a plan JSON, a state JSON, a saved Form, or '-'.
	Input string
	// Result is the Policy result explain policy reads, or '-'.
	Result            string
	Side              string
	Stage             string
	Format            Format
	Details           bool
	Project           string
	Locked            bool
	Dialect           []string
	PlanFile          string
	RequireEnrichment bool
	PlanComplete      string
	Producer          string
	ProviderMap       []string
}

// ExplainService justifies one conclusion; its error carries the exit status.
type ExplainService interface {
	Explain(ExplainOptions) error
}

const explainInputNote = "The input is read as run reads it: a plan JSON or state JSON is compiled\n" +
	"with the project's Dialects, a saved Form is loaded as it is, and '-' reads\n" +
	"standard input. --stage selects the stage; the default is Planned for a\n" +
	"plan and Recorded for a state. A comparison Form needs --side, which\n" +
	"explains the stage selected for that side in the saved comparison unless\n" +
	"--stage names another.\n\n" +
	"The explanation goes to standard output. Progress and errors go to\n" +
	"standard error."

func newExplainCommand(env *Env) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "explain <object> <name>",
		Short: "Justify one conclusion of a Form or a Policy result",
		Long: "explain instance and explain rule read an input as run does and justify\n" +
			"how one instance or one Rule was interpreted at one stage. explain policy\n" +
			"reads a Policy result written by check and justifies one Policy outcome\n" +
			"without evaluating it again.\n\n" +
			"Exit status:\n" +
			"  0  help was shown\n" +
			"  2  the command was used incorrectly",
		Example: "  rootform explain instance aws_vpc.main --input plan.json\n" +
			"  rootform explain rule aws.rule.vpc --input state.json\n" +
			"  rootform explain policy baseline/vpc-flow-logs --result results.json",
		Args:          objectRequired("explain", "instance", "rule", "policy"),
		RunE:          func(cmd *cobra.Command, args []string) error { return cmd.Help() },
		SilenceErrors: true,
		SilenceUsage:  true,
	}
	cmd.AddCommand(
		newExplainInstanceCommand(env),
		newExplainRuleCommand(env),
		newExplainPolicyCommand(env),
		retiredExplainCommand("architecture", "the old name of explain instance",
			"explain architecture is now explain instance\n\nTry:\n  rootform explain instance ADDRESS --input INPUT"),
		retiredExplainCommand("semantics", "the old name of explain rule",
			"explain semantics is now explain rule, which explains a Rule applied in an\n"+
				"input; rootform show prints a Rule definition\n\n"+
				"Try:\n  rootform explain rule RULE --input INPUT\n  rootform show RULE"),
	)
	return cmd
}

// retiredExplainCommand refuses a renamed explanation whatever its operands,
// naming the command that replaced it.
func retiredExplainCommand(name, short, message string) *cobra.Command {
	return &cobra.Command{
		Use:                name,
		Short:              short,
		Hidden:             true,
		DisableFlagParsing: true,
		RunE:               func(*cobra.Command, []string) error { return usageError{msg: message} },
		SilenceErrors:      true,
		SilenceUsage:       true,
	}
}

func newExplainInstanceCommand(env *Env) *cobra.Command {
	opts := &ExplainOptions{Object: ExplainInstance}
	format := ""
	cmd := &cobra.Command{
		Use:   "instance <address> --input <input>",
		Short: "Explain how one instance was interpreted",
		Long: "Show how one instance was interpreted at one stage: its Rule and Concept,\n" +
			"the facts it takes part in with their evidence, each closure outcome, its\n" +
			"dependencies, and its diagnostics. A declaration address explains every\n" +
			"instance of that declaration. An explanation states what the evidence\n" +
			"records; it never infers a cause.\n\n" +
			explainInputNote + "\n\n" +
			"Exit status:\n" +
			"  0  the instance was explained\n" +
			"  1  no instance has this address at the selected stage\n" +
			"  2  the command was used incorrectly\n" +
			"  3  the input was refused, rootform.lock is invalid, or the stage or side\n" +
			"     is unavailable\n" +
			"  4  the input or rootform.lock could not be read",
		Example: "  rootform explain instance google_compute_network.vpc --input plan.json\n" +
			"  rootform explain instance 'aws_instance.web[\"a\"]' --input state.json\n" +
			"  rootform explain instance aws_vpc.main --input plan.json --stage refreshed\n" +
			"  rootform explain instance aws_vpc.main --input comparison.json --side before\n" +
			"  rootform explain instance aws_vpc.main --input form.json --format json",
		Args: exactlyOne("explain instance", "address"),
		RunE: func(cmd *cobra.Command, args []string) error {
			return runExplain(env, opts, format, args[0])
		},
		SilenceErrors: true,
		SilenceUsage:  true,
	}
	explainFlags(cmd, opts, &format)
	return cmd
}

func newExplainRuleCommand(env *Env) *cobra.Command {
	opts := &ExplainOptions{Object: ExplainRule}
	format := ""
	cmd := &cobra.Command{
		Use:   "rule <rule> --input <input>",
		Short: "Explain how one Rule applied in an input",
		Long: "Show how one Rule applied at one stage: what it matches and emits, the\n" +
			"instances it interpreted, the candidates it did not match or left\n" +
			"undecided, and for each emission its closure outcomes and the facts it\n" +
			"produced with their evidence. Name the Rule as <owner>.rule.<name>, or by\n" +
			"its bare name when that is unambiguous. rootform show prints a Rule\n" +
			"definition without an input.\n\n" +
			explainInputNote + "\n\n" +
			"Exit status:\n" +
			"  0  the Rule was explained\n" +
			"  1  the semantics of the input hold no Rule with this name\n" +
			"  2  the command was used incorrectly\n" +
			"  3  the input was refused, rootform.lock is invalid, the stage or side is\n" +
			"     unavailable, or the name is ambiguous\n" +
			"  4  the input or rootform.lock could not be read",
		Example: "  rootform explain rule google.rule.cloud-sql-instance --input plan.json\n" +
			"  rootform explain rule cloud-sql-instance --input state.json\n" +
			"  rootform explain rule aws.rule.vpc --input comparison.json --side after\n" +
			"  rootform explain rule aws.rule.vpc --input plan.json --format json",
		Args: exactlyOne("explain rule", "rule"),
		RunE: func(cmd *cobra.Command, args []string) error {
			return runExplain(env, opts, format, args[0])
		},
		SilenceErrors: true,
		SilenceUsage:  true,
	}
	explainFlags(cmd, opts, &format)
	// The explanation of a Rule lists every instance and carries no diagnostic
	// code, so --details adds nothing; it stays accepted for existing scripts.
	_ = cmd.Flags().MarkHidden("details")
	return cmd
}

func newExplainPolicyCommand(env *Env) *cobra.Command {
	opts := &ExplainOptions{Object: ExplainPolicy}
	format := ""
	var packs []string
	cmd := &cobra.Command{
		Use:   "policy <policy> --result <file>",
		Short: "Explain one Policy outcome recorded by check",
		Long: "Show why one Policy passed, was violated, stayed indeterminate, or had\n" +
			"no target, from the Policy result that rootform check wrote as JSON.\n" +
			"Nothing is evaluated again: each side the result records is explained\n" +
			"as recorded, and --side keeps one side of a comparison. Name the Policy\n" +
			"as <policy-pack>.policy.<name>, as <policy-pack>/<name>, or by its bare\n" +
			"name when that is unambiguous.\n\n" +
			"--input names the Form the result was computed from, read as run reads\n" +
			"it; its facts and closures then describe the evidence each evaluation\n" +
			"inspected. The input is used only when its Form digest equals the one\n" +
			"the result records.\n\n" +
			"The explanation goes to standard output. Progress and errors go to\n" +
			"standard error.\n\n" +
			"Exit status:\n" +
			"  0  the Policy outcome was explained\n" +
			"  1  the result records no Policy with this name\n" +
			"  2  the command was used incorrectly\n" +
			"  3  the result or input was refused, the name is ambiguous, the side is\n" +
			"     not recorded, the check recorded no outcome for this Policy, or the\n" +
			"     input is not the Form the result was computed from\n" +
			"  4  the result, the input, or rootform.lock could not be read",
		Example: "  rootform explain policy baseline/vpc-flow-logs --result results.json\n" +
			"  rootform explain policy vpc-flow-logs --result results.json --side before\n" +
			"  rootform explain policy vpc-flow-logs --result results.json --input form.json\n" +
			"  rootform check plan.json --format json |\n" +
			"    rootform explain policy vpc-flow-logs --result -",
		Args: exactlyOne("explain policy", "policy"),
		RunE: func(cmd *cobra.Command, args []string) error {
			if len(packs) != 0 {
				result := commandValue(opts.Result, "results.json")
				return usageError{msg: "--policy-pack belongs to check; explain policy explains the outcomes\n" +
					"a result recorded and never evaluates Policies\n\n" +
					"Try:\n  rootform check " + commandValue(opts.Input, "plan.json") + " --policy-pack " + commandValue(packs[0], "DIR") + " -o " + result +
					"\n  rootform explain policy " + commandArgument(args[0]) + " --result " + result}
			}
			return runExplain(env, opts, format, args[0])
		},
		SilenceErrors: true,
		SilenceUsage:  true,
	}
	f := cmd.Flags()
	f.StringVar(&opts.Result, "result", "", "read the Policy result `file` that check wrote as JSON, or '-' for standard input")
	f.StringVar(&opts.Input, "input", "", "describe inspected evidence from the Form `input` the result was computed from: a plan JSON, a state JSON, a saved Form, or '-'")
	f.StringVar(&opts.Side, "side", "", "side of a comparison result to explain: `before|after`; default: every recorded side")
	formatFlag(cmd, &format, "text", "json")
	f.BoolVar(&opts.Details, "details", false, "also list passed evaluations and diagnostic codes")
	f.StringArrayVar(&packs, "policy-pack", nil, "refused: rootform check evaluates Policies")
	_ = f.MarkHidden("policy-pack")
	explainProjectFlags(cmd, opts)
	groupFlags(cmd, "Inputs", "result", "input", "side")
	groupFlags(cmd, "Output", "format", "details")
	groupFlags(cmd, "Rootform project", "project", "locked", "dialect")
	groupFlags(cmd, "Advanced evidence settings", "plan-file", "require-enrichment", "plan-complete", "producer", "provider-map")
	completeValues(cmd, "side", "before", "after")
	return cmd
}

// explainFlags declares the options of an explanation that reads one stage
// of an input.
func explainFlags(cmd *cobra.Command, opts *ExplainOptions, format *string) {
	f := cmd.Flags()
	f.StringVar(&opts.Input, "input", "", "read `input`: a plan JSON, a state JSON, a saved Form, or '-' for standard input")
	f.StringVar(&opts.Side, "side", "", "side of a comparison Form to explain: `before|after`; required for a comparison Form")
	f.StringVar(&opts.Stage, "stage", "", "stage to explain: `planned|refreshed|recorded`; default: Planned for a plan, Recorded for a state, or the stage selected in the saved comparison for a side")
	formatFlag(cmd, format, "text", "json")
	f.BoolVar(&opts.Details, "details", false, "also show diagnostic codes")
	explainProjectFlags(cmd, opts)
	groupFlags(cmd, "Input", "input", "side", "stage")
	groupFlags(cmd, "Output", "format", "details")
	groupFlags(cmd, "Rootform project", "project", "locked", "dialect")
	groupFlags(cmd, "Advanced evidence settings", "plan-file", "require-enrichment", "plan-complete", "producer", "provider-map")
	completeValues(cmd, "side", "before", "after")
	completeValues(cmd, "stage", stageValues()...)
}

// explainProjectFlags declares the options that shape how an input compiles,
// the same as run and check.
func explainProjectFlags(cmd *cobra.Command, opts *ExplainOptions) {
	f := cmd.Flags()
	projectFlag(cmd, &opts.Project)
	f.BoolVar(&opts.Locked, "locked", false, "refuse to run unless rootform.lock is valid")
	dialectOverrideFlag(cmd, &opts.Dialect)
	f.StringVar(&opts.PlanFile, "plan-file", "", planFileUsage)
	f.BoolVar(&opts.RequireEnrichment, "require-enrichment", false, requireEnrichmentUsage)
	f.StringVar(&opts.PlanComplete, "plan-complete", "", "declare the plan complete; the only `value` is attested")
	f.StringVar(&opts.Producer, "producer", "", "declare the tool that produced the input: `terraform|opentofu`")
	f.StringArrayVar(&opts.ProviderMap, "provider-map", nil, "map an observed provider to a binding, as `observed=binding`; repeatable")
	completeEvidenceValues(cmd)
}

func runExplain(env *Env, opts *ExplainOptions, format, name string) error {
	selected, err := parseFormat(format, FormatText, FormatJSON)
	if err != nil {
		return err
	}
	options := *opts
	options.Format, options.Name = selected, name
	if err := validateExplainOptions(options); err != nil {
		return err
	}
	if env.Explain == nil {
		return errors.New("explain service is not configured")
	}
	return env.Explain.Explain(options)
}

// validateExplainOptions refuses every combination an explanation cannot
// honor before any input is read.
func validateExplainOptions(o ExplainOptions) error {
	path := "explain " + string(o.Object)
	if o.Object == ExplainPolicy {
		if o.Result == "" {
			return usageError{msg: "explain policy needs --result, the Policy result that check wrote\n\n" +
				"Try:\n  rootform check plan.json -o results.json\n  rootform explain policy " + commandArgument(o.Name) + " --result results.json"}
		}
		if o.Result == "-" && o.Input == "-" {
			return usageError{msg: "only one input may read standard input"}
		}
		if o.Input == "" {
			if flag := compilationFlag(o); flag != "" {
				return usageError{msg: flag + " shapes how --input compiles and needs --input"}
			}
		}
	} else if o.Input == "" {
		if o.Object == ExplainRule {
			return usageError{msg: "explain rule explains how a Rule applied in an input and needs --input;\n" +
				"rootform show prints a Rule definition\n\n" +
				"Try:\n  rootform explain rule " + commandArgument(o.Name) + " --input plan.json\n  rootform show " + commandArgument(o.Name)}
		}
		return usageError{msg: "explain instance needs --input, the plan, state, or Form to read\n\n" +
			"Try:\n  rootform explain instance " + commandArgument(o.Name) + " --input plan.json"}
	}
	if o.Side != "" && o.Side != "before" && o.Side != "after" {
		return usageError{msg: "--side must be before or after"}
	}
	if o.Stage != "" && o.Stage != "planned" && o.Stage != "refreshed" && o.Stage != "recorded" {
		return usageError{msg: "--stage must be planned, refreshed, or recorded"}
	}
	if o.PlanComplete != "" && o.PlanComplete != "attested" {
		return usageError{msg: "--plan-complete accepts only attested"}
	}
	return refuseLockedOverrides(fmt.Sprintf("%s %s", path, commandArgument(o.Name)), o.Locked, o.Dialect, nil)
}

// compilationFlag names the first option that only shapes how an input
// compiles.
func compilationFlag(o ExplainOptions) string {
	switch {
	case o.Project != "":
		return "--project"
	case o.Locked:
		return "--locked"
	case len(o.Dialect) > 0:
		return "--dialect"
	case o.PlanFile != "":
		return "--plan-file"
	case o.RequireEnrichment:
		return "--require-enrichment"
	case o.PlanComplete != "":
		return "--plan-complete"
	case o.Producer != "":
		return "--producer"
	case len(o.ProviderMap) > 0:
		return "--provider-map"
	}
	return ""
}
