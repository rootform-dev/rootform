package command

import (
	"errors"
	"strings"

	"github.com/spf13/cobra"
)

// CheckOptions carries one Policy evaluation request.
type CheckOptions struct {
	Input             string
	Side              string
	Stage             string
	Policy            []string
	PolicyPack        []string
	Project           string
	Locked            bool
	Dialect           []string
	PlanFile          string
	RequireEnrichment bool
	PlanComplete      string
	Producer          string
	ProviderMap       []string
	Output            []string
	Format            string
	Details           bool
}

// CheckService evaluates Policies and returns the verdict as its exit.
type CheckService interface {
	Check(CheckOptions) error
}

func newCheckCommand(env *Env) *cobra.Command {
	opts := &CheckOptions{}
	cmd := &cobra.Command{
		Use:   "check <input>",
		Short: "Evaluate Policies against a Form or each side of a comparison",
		Long: "check evaluates the selected Policies against one architecture: the\n" +
			"Planned stage of a plan, or the Recorded stage of a state. Policies come\n" +
			"from the Policy Packs in rootform.lock, then the --policy-pack overlays;\n" +
			"--policy narrows the selection. A plan's reconstructed Recorded stage is\n" +
			"never evaluated.\n\n" +
			"A comparison Form has two sides. check evaluates the Before and the After\n" +
			"side, each at the stage selected in the saved comparison and linked\n" +
			"against its own semantics, with the same selection, and reports each side\n" +
			"apart; --side keeps one of them.\n\n" +
			"The input is a plan JSON or state JSON, compiled with the project's\n" +
			"Dialects, or a saved Form, loaded without compiling it again; '-' reads\n" +
			"standard input.\n\n" +
			"The summary goes to standard output, or the --format output when no file\n" +
			"is written. Progress, written files, and errors go to standard error; a\n" +
			"verdict is never repeated there. Every requested report is written\n" +
			"whatever the verdict. check never serves.\n\n" +
			"Exit status:\n" +
			"  0  every selected Policy passed on every requested side\n" +
			"  1  a selected Policy was violated on a requested side\n" +
			"  2  the command was used incorrectly\n" +
			"  3  no verdict: indeterminate, no target, nothing selected, a side that\n" +
			"     could not be evaluated, an input that was refused, or an invalid\n" +
			"     rootform.lock\n" +
			"  4  an input, report, or rootform.lock file could not be read or written",
		Example: "  rootform check plan.json\n" +
			"  rootform check state.json --policy 'security/*'\n" +
			"  rootform check comparison.json --side after\n" +
			"  rootform check form.json --stage refreshed\n" +
			"  rootform check plan.json -o results.json -o report.md -o results.sarif",
		Args: exactlyOne("check", "input"),
		RunE: func(cmd *cobra.Command, args []string) error {
			opts.Input = args[0]
			switch opts.Format {
			case "", "text", "json", "markdown", "sarif":
			case "html":
				return usageError{msg: "check reports are text, json, markdown, or sarif; the interactive HTML export belongs to run\n\nTry:\n  rootform run " + commandArgument(opts.Input) + " --no-serve -o report.html"}
			default:
				return usageError{msg: "--format must be text, json, markdown, or sarif"}
			}
			if env.Check == nil {
				return errors.New("check service is not configured")
			}
			return env.Check.Check(*opts)
		}, SilenceErrors: true, SilenceUsage: true,
	}
	f := cmd.Flags()
	f.StringVar(&opts.Side, "side", "", "sides of a comparison Form to evaluate: `before|after|both`; default: both")
	f.StringVar(&opts.Stage, "stage", "", "stage to evaluate: `planned|refreshed|recorded`; default: Planned for a plan, Recorded for a state; with a comparison Form, needs --side before or after")
	f.StringArrayVar(&opts.Policy, "policy", nil, "evaluate only the Policies `selector` names: PACK.policy.NAME, PACK/NAME, a bare name, or PACK/*; repeatable")
	policyPackOverlayFlag(cmd, &opts.PolicyPack)
	f.StringArrayVarP(&opts.Output, "output", "o", nil, "write `file`; its extension selects the format: .json (the Policy result), .txt, .md, .sarif, or .sarif.json; repeatable")
	f.StringVar(&opts.Format, "format", "", "format of standard output, or of a single -o file without a recognized extension: `text|json|markdown|sarif`; default: text")
	f.BoolVar(&opts.Details, "details", false, "also list passed evaluations, Policy Pack identities, and diagnostic codes")
	projectFlag(cmd, &opts.Project)
	f.BoolVar(&opts.Locked, "locked", false, "refuse to run unless rootform.lock is valid")
	dialectOverrideFlag(cmd, &opts.Dialect)
	f.StringVar(&opts.PlanFile, "plan-file", "", planFileUsage)
	f.BoolVar(&opts.RequireEnrichment, "require-enrichment", false, requireEnrichmentUsage)
	f.StringVar(&opts.PlanComplete, "plan-complete", "", "declare the plan complete; the only `value` is attested")
	f.StringVar(&opts.Producer, "producer", "", "declare the tool that produced the input: `terraform|opentofu`")
	f.StringArrayVar(&opts.ProviderMap, "provider-map", nil, "map an observed provider to a binding, as `observed=binding`; repeatable")
	groupFlags(cmd, "Target selection", "side", "stage")
	groupFlags(cmd, "Policy selection", "policy", "policy-pack")
	groupFlags(cmd, "Output", "output", "format", "details")
	groupFlags(cmd, "Rootform project", "project", "locked", "dialect")
	groupFlags(cmd, "Advanced evidence settings", "plan-file", "require-enrichment", "plan-complete", "producer", "provider-map")
	completeValues(cmd, "side", "before", "after", "both")
	completeValues(cmd, "stage", stageValues()...)
	completeValues(cmd, "format", "text", "json", "markdown", "sarif")
	completeEvidenceValues(cmd)
	return cmd
}

// ValidateCheckOptions refuses option values a check cannot use. The service
// calls it only once the outputs are known safe, so that such a usage error
// still replaces every requested report.
func ValidateCheckOptions(opts CheckOptions) error {
	if opts.PlanComplete != "" && opts.PlanComplete != "attested" {
		return usageError{msg: "--plan-complete accepts only attested"}
	}
	if opts.Stage != "" && opts.Stage != "planned" && opts.Stage != "refreshed" && opts.Stage != "recorded" {
		return usageError{msg: "--stage must be planned, refreshed, or recorded"}
	}
	if opts.Side != "" && opts.Side != "before" && opts.Side != "after" && opts.Side != "both" {
		return usageError{msg: "--side must be before, after, or both"}
	}
	if opts.Stage != "" && opts.Side == "both" {
		return usageError{msg: "--stage selects the stage of one side; use --side before or --side after"}
	}
	for _, selector := range opts.Policy {
		if strings.TrimSpace(selector) == "" {
			return usageError{msg: "--policy requires a nonempty selection"}
		}
	}
	return refuseLockedOverrides("check", opts.Locked, opts.Dialect, opts.PolicyPack)
}

// commandArgument returns an argument a reader can paste into a shell, or a
// placeholder when quoting it would be needed.
func commandArgument(value string) string {
	return commandValue(value, "INPUT")
}

// commandValue prints a value the user typed in a suggested command when it
// needs no shell quoting, and the placeholder otherwise.
func commandValue(value, placeholder string) string {
	if value == "" || value == "-" {
		return placeholder
	}
	for _, r := range value {
		if !(r >= 'a' && r <= 'z' || r >= 'A' && r <= 'Z' || r >= '0' && r <= '9' || strings.ContainsRune("-_./=:@+,", r)) {
			return placeholder
		}
	}
	return value
}
