package command

import (
	"errors"
	"fmt"

	"github.com/spf13/cobra"
)

func newRunCommand(env *Env) *cobra.Command {
	opts := &Options{}
	cmd := &cobra.Command{
		Use:   "run <input> [--diff <input>]",
		Short: "Produce a Form from a plan or state JSON, or open a saved Form",
		Long: "The input is a Terraform or OpenTofu plan JSON or state JSON, detected\n" +
			"from its content, or a saved Form; '-' reads standard input. Export a plan\n" +
			"with terraform show -json plan.tfplan and a state with terraform show\n" +
			"-json. A configuration directory, a raw state, and a saved binary plan are\n" +
			"refused.\n\n" +
			"A plan Form holds its Planned, Refreshed, and reconstructed Recorded\n" +
			"stages, its planned changes, and the drift the plan reports; a state Form\n" +
			"holds its Recorded stage. --diff compares one stage of each input into a\n" +
			"comparison Form, which reopens alone and is never a --diff operand.\n\n" +
			"Its differences compare the two inputs; they are not drift and do not\n" +
			"establish what drifted between the two exports.\n\n" +
			"run serves the Form on a loopback address and opens a browser until\n" +
			"interrupted; --no-serve exits once the outputs are written. The summary\n" +
			"goes to standard output, or the --format output when no file is written.\n" +
			"Progress, written files, the explorer address, and errors go to standard\n" +
			"error. A machine format on standard output needs --no-serve. Every output\n" +
			"is rendered before the first is written, and none may replace an input.\n\n" +
			"run never evaluates Policies; rootform check does.\n\n" +
			"Exit status:\n" +
			"  0  the Form was produced or opened\n" +
			"  2  the command was used incorrectly\n" +
			"  3  an input was refused, rootform.lock is invalid, or a requested stage\n" +
			"     is unavailable\n" +
			"  4  an input, output, or rootform.lock file, or the explorer, failed",
		Example: "  rootform run plan.json\n" +
			"  terraform show -json plan.tfplan | rootform run -\n" +
			"  rootform run state.json --no-serve -o form.json\n" +
			"  rootform run form.json --no-serve --details\n" +
			"  rootform run plan.json --no-serve -o report.md -o report.html\n" +
			"  rootform run before.json --diff after.json --no-serve",
		Args: exactlyOne("run", "input"),
		RunE: func(cmd *cobra.Command, args []string) error {
			opts.Input = args[0]
			if err := refuseRetiredSides(cmd, opts); err != nil {
				return err
			}
			if err := validateRunOptions(opts); err != nil {
				return err
			}
			if env.Service == nil {
				return errors.New("application service is not configured")
			}
			return env.Service.Run(*opts)
		}, SilenceErrors: true, SilenceUsage: true,
	}
	f := cmd.Flags()
	f.StringVar(&opts.DiffInput, "diff", "", "compare with a second `input`: a plan, a state, or a saved single-input Form")
	f.StringVar(&opts.Stage, "stage", "", "stage the summary leads with, for one input: `planned|refreshed|recorded`; default: Planned for a plan, Recorded for a state")
	f.StringVar(&opts.BeforeStage, "before-stage", "", "stage of the first input to compare: `planned|refreshed|recorded`; default: Planned for a plan, Recorded for a state")
	f.StringVar(&opts.AfterStage, "after-stage", "", "stage of the second input to compare: `planned|refreshed|recorded`; default: Planned for a plan, Recorded for a state")
	f.StringArrayVarP(&opts.Output, "output", "o", nil, "write `file`; its extension selects the format: .json (the Form), .txt, .md, or .html; repeatable")
	f.StringVar(&opts.Format, "format", "", "format of standard output, or of a single -o file without a recognized extension: `text|json|markdown|html`; default: text")
	f.BoolVar(&opts.Details, "details", false, "add semantics, closure counts, and diagnostic codes; a Markdown summary and the summary beside the explorer then list every entry")
	f.BoolVar(&opts.NoServe, "no-serve", false, "exit once the outputs are written instead of serving the explorer")
	f.BoolVar(&opts.NoBrowser, "no-browser", false, "serve the explorer without opening a browser")
	f.IntVar(&opts.Port, "port", DefaultPort, "serve the explorer on loopback `port`; 0 picks a free port; default: 21717")
	projectFlag(cmd, &opts.Project)
	f.BoolVar(&opts.Locked, "locked", false, "refuse to run unless rootform.lock is valid")
	dialectOverrideFlag(cmd, &opts.Dialect)
	f.StringVar(&opts.PlanFile, "plan-file", "", planFileUsage)
	f.StringVar(&opts.DiffPlanFile, "diff-plan-file", "", "pair the --diff plan JSON with its saved plan `file`, as --plan-file does")
	f.BoolVar(&opts.RequireEnrichment, "require-enrichment", false, requireEnrichmentUsage)
	f.StringVar(&opts.PlanComplete, "plan-complete", "", "declare the plan complete; the only `value` is attested")
	f.StringVar(&opts.Producer, "producer", "", "declare the tool that produced the input: `terraform|opentofu`")
	f.StringArrayVar(&opts.ProviderMap, "provider-map", nil, "map an observed provider to a binding, as `observed=binding`; repeatable")
	f.StringArrayVar(&opts.Policy, "policy", nil, "refused: rootform check evaluates Policies")
	f.StringArrayVar(&opts.PolicyPack, "policy-pack", nil, "refused: rootform check evaluates Policies")
	f.String("before-side", "", "retired: a saved comparison is not a --diff operand")
	f.String("after-side", "", "retired: a saved comparison is not a --diff operand")
	_ = f.MarkHidden("policy")
	_ = f.MarkHidden("policy-pack")
	_ = f.MarkHidden("before-side")
	_ = f.MarkHidden("after-side")
	groupFlagsInOrder(cmd, "Inputs and stages", "diff", "stage", "before-stage", "after-stage")
	groupFlags(cmd, "Output", "output", "format", "details")
	groupFlags(cmd, "Explorer", "no-serve", "no-browser", "port")
	groupFlags(cmd, "Rootform project", "project", "locked", "dialect")
	groupFlags(cmd, "Advanced evidence settings", "plan-file", "diff-plan-file", "require-enrichment", "plan-complete", "producer", "provider-map")
	for _, flag := range []string{"stage", "before-stage", "after-stage"} {
		completeValues(cmd, flag, stageValues()...)
	}
	completeValues(cmd, "format", "text", "json", "markdown", "html")
	completeEvidenceValues(cmd)
	return cmd
}

// validateRunOptions refuses every combination run cannot honor before any
// input is read.
func validateRunOptions(opts *Options) error {
	if len(opts.Policy) > 0 || len(opts.PolicyPack) > 0 {
		flag, values := "--policy", opts.Policy
		if len(opts.Policy) == 0 {
			flag, values = "--policy-pack", opts.PolicyPack
		}
		return usageError{msg: flag + " belongs to check; run never evaluates Policies\n\nTry:\n  rootform check " + commandArgument(opts.Input) + " " + flag + " " + policyFlagExample(flag, values)}
	}
	if opts.Format == "sarif" {
		return usageError{msg: "SARIF reports Policy results; run never evaluates Policies\n\nTry:\n  rootform check " + commandArgument(opts.Input) + " --format sarif"}
	}
	if opts.Format != "" && opts.Format != "text" && opts.Format != "json" && opts.Format != "markdown" && opts.Format != "html" {
		return usageError{msg: "--format must be text, json, markdown, or html"}
	}
	if opts.Input == "-" && opts.DiffInput == "-" {
		return usageError{msg: "only one input may read standard input"}
	}
	if opts.Port < 0 || opts.Port > 65535 {
		return usageError{msg: fmt.Sprintf("--port must be between 0 and 65535, but %d was given", opts.Port)}
	}
	if opts.PlanComplete != "" && opts.PlanComplete != "attested" {
		return usageError{msg: "--plan-complete accepts only attested"}
	}
	for _, stage := range [][2]string{{"--stage", opts.Stage}, {"--before-stage", opts.BeforeStage}, {"--after-stage", opts.AfterStage}} {
		if value := stage[1]; value != "" && value != "planned" && value != "refreshed" && value != "recorded" {
			return usageError{msg: fmt.Sprintf("%s must be planned, refreshed, or recorded, but %q was given", stage[0], value)}
		}
	}
	for _, flag := range [][2]string{{"--before-stage", opts.BeforeStage}, {"--after-stage", opts.AfterStage}, {"--diff-plan-file", opts.DiffPlanFile}} {
		if opts.DiffInput == "" && flag[1] != "" {
			return usageError{msg: flag[0] + " applies to a comparison and needs --diff"}
		}
	}
	if opts.DiffInput != "" && opts.Stage != "" {
		compared := "rootform run " + commandArgument(opts.Input) + " --diff " + commandArgument(opts.DiffInput)
		return usageError{msg: "--stage selects the stage of one input; with --diff, --before-stage\n" +
			"selects the stage of " + inputName(opts.Input, "the first input") + " and --after-stage the stage of " + inputName(opts.DiffInput, "the --diff input") +
			"\n\nTry:\n  " + compared + " --before-stage " + opts.Stage + "\n  " + compared + " --after-stage " + opts.Stage}
	}
	machine := len(opts.Output) == 0 && opts.Format != "" && opts.Format != "text"
	if machine && !opts.NoServe {
		return usageError{msg: "--format " + opts.Format + " writes to standard output, which a serving run never ends\n\nTry:\n  rootform run " + commandArgument(opts.Input) + " --no-serve --format " + opts.Format}
	}
	if opts.Details && len(opts.Output) == 0 && (opts.Format == "json" || opts.Format == "html") {
		return usageError{msg: "--details expands the text or Markdown summary, and this command writes none\n\n" +
			"Try:\n  rootform run " + commandArgument(opts.Input) + " --no-serve --details"}
	}
	return refuseLockedOverrides("run", opts.Locked, opts.Dialect, nil)
}

// refuseRetiredSides answers the flags that once took one side of a saved
// comparison as an operand: a comparison is no longer a --diff operand, and
// each input contributes the stage its own stage flag selects.
func refuseRetiredSides(cmd *cobra.Command, opts *Options) error {
	for _, side := range [][3]string{{"before-side", "--before-stage", inputName(opts.Input, "the first input")}, {"after-side", "--after-stage", inputName(opts.DiffInput, "the --diff input")}} {
		if !cmd.Flags().Changed(side[0]) {
			continue
		}
		return usageError{msg: "--" + side[0] + " is retired; a saved comparison is not a --diff operand,\n" +
			"and " + side[1] + " selects the stage of " + side[2] +
			"\n\nTry:\n  rootform run " + commandArgument(opts.Input) + " --diff " + commandArgument(opts.DiffInput) + " " + side[1] + " STAGE"}
	}
	return nil
}

// inputName names an input as typed when it prints safely, and describes it
// otherwise.
func inputName(value, description string) string {
	if name := commandValue(value, ""); name != "" {
		return name
	}
	return description
}

func policyFlagExample(flag string, values []string) string {
	if len(values) != 0 {
		if value := commandValue(values[0], ""); value != "" {
			return value
		}
	}
	if flag == "--policy" {
		return "'PACK/*'"
	}
	return "DIR"
}
