package app

import (
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"regexp"
	"strings"

	"github.com/rootform-dev/rootform/cli/backend"
	"github.com/rootform-dev/rootform/cli/form"
	cli "github.com/rootform-dev/rootform/cli/internal/command"
	"github.com/rootform-dev/rootform/cli/policyresult"
)

// checkService evaluates the selected Policies against each requested
// architecture of a Form. It reads its input through the loader run uses,
// never serves, and states the verdict as its exit only.
type checkService struct {
	stdin   io.Reader
	stdout  io.Writer
	stderr  io.Writer
	backend backend.Backend
	// version names the generator a result records.
	version string
}

// checkRun records what one invocation established, so a failure after the
// outputs were validated still replaces every requested report with a result
// that identifies as much as was known.
type checkRun struct {
	options  cli.CheckOptions
	selected []string
	form     *policyresult.FormIdentity
	scope    policyresult.Scope
	// targets are the architectures the check evaluated, so its summary can
	// describe the evidence each evaluation inspected.
	targets []checkTarget
}

// checkTarget is one architecture to evaluate: the architecture of a plan,
// state or saved single-input Form, or one side of a comparison Form. A
// refusal fails this architecture alone.
type checkTarget struct {
	side    string
	form    form.InputForm
	stage   form.Stage
	digest  string
	refusal *policyresult.Diagnostic
}

// checkFailure stops an invocation. code is the diagnostic the failed result
// carries; detail is what standard error shows, with any guidance.
type checkFailure struct {
	exit     int
	code     string
	detail   string
	headline string
	body     string
	// message is the failed result's diagnostic when it differs from the
	// first line of detail.
	message string
}

func (f checkFailure) Error() string { return f.detail }

var diagnosticCode = regexp.MustCompile(`^[A-Z][A-Z0-9_]+$`)

// failureOf keeps the exit of a loader error and derives the diagnostic code
// from its message.
func failureOf(err error, fallbackExit int) checkFailure {
	var stopped checkFailure
	if errors.As(err, &stopped) {
		return stopped
	}
	exit, message := fallbackExit, err.Error()
	var runError cli.RunError
	if errors.As(err, &runError) {
		exit, message = runError.Code, runError.Message
		if runError.DiagnosticCode != "" {
			return checkFailure{exit: exit, code: runError.DiagnosticCode, detail: message,
				headline: runError.Headline, body: runError.Body}
		}
	}
	code := "USAGE_INVALID"
	if exit != cli.ExitUsage {
		code = "INPUT_INVALID"
	}
	if prefix, _, found := strings.Cut(message, ": "); found && diagnosticCode.MatchString(prefix) {
		code = prefix
	}
	return checkFailure{exit: exit, code: code, detail: message}
}

func usageFailure(message string) checkFailure {
	return checkFailure{exit: cli.ExitUsage, code: "USAGE_INVALID", detail: message}
}

func (s checkService) Check(options cli.CheckOptions) error {
	if s.stdin == nil {
		s.stdin = os.Stdin
	}
	if s.stdout == nil {
		s.stdout = io.Discard
	}
	if s.stderr == nil {
		s.stderr = io.Discard
	}
	run := &checkRun{options: options}
	if err := validateOutputs(options.Output, options.Format, []string{options.Input, options.PlanFile}, checkOutputRules); err != nil {
		return cli.RunError{Code: cli.ExitUsage, Message: err.Error()}
	}
	if err := cli.ValidateCheckOptions(options); err != nil {
		return s.fail(run, usageFailure(err.Error()))
	}
	providerMap, attestations, err := validateAttestations(options.Producer, options.ProviderMap)
	if err != nil {
		return s.fail(run, usageFailure(err.Error()))
	}
	if options.PlanComplete != "" {
		attestations = append(attestations, form.Attestation{Name: "plan-complete", Value: options.PlanComplete})
	}
	for _, pack := range options.PolicyPack {
		info, statErr := os.Stat(pack)
		if statErr != nil || !(info.IsDir() || info.Mode().IsRegular()) {
			return s.fail(run, usageFailure("--policy-pack requires a Policy Pack source directory or compiled Policy Pack file"))
		}
	}
	if options.Project != "" {
		info, statErr := os.Stat(options.Project)
		if statErr != nil || !info.IsDir() {
			return s.fail(run, usageFailure("--project requires a directory"))
		}
	}
	result, err := s.evaluate(run, providerMap, attestations)
	if err != nil {
		return s.fail(run, failureOf(err, cli.ExitNoAnswer))
	}
	return s.conclude(run, result)
}

func (s checkService) evaluate(run *checkRun, providerMap map[string]string, attestations []form.Attestation) (policyresult.Result, error) {
	ctx := context.Background()
	o := run.options
	sess := s.backend.Open(ctx, backend.Selection{Project: o.Project, Locked: o.Locked, Dialects: o.Dialect}, s.stderr)
	set, err := sess.Policies(ctx, o.PolicyPack)
	if err != nil {
		return policyresult.Result{}, selectionStop(selectionFailureOf(err))
	}
	packs := policyPacks(set.Packs())
	if packs.empty() {
		try := "Try:\n  rootform add policy-packs PACK\n  rootform check " + shellQuote(o.Input) + " --policy-pack DIR"
		return policyresult.Result{}, checkFailure{exit: cli.ExitNoAnswer, code: "POLICY_UNAVAILABLE",
			detail:   "POLICY_UNAVAILABLE: no Policy Pack is selected; add one to rootform.lock or pass --policy-pack\n\n" + try,
			headline: "no Policy Pack is selected",
			body:     "Add one to rootform.lock or pass --policy-pack.\n\n" + try}
	}
	selected, err := packs.resolve(o.Policy)
	if err != nil {
		return policyresult.Result{}, usageFailure(err.Error())
	}
	run.selected = selected
	progress(s.stderr, "Selected", countWithNoun(len(selected), "Policy", "Policies")+" from "+countWithNoun(packs.packCount(), "Policy Pack", "Policy Packs"))

	loaded, err := loadOperand(ctx, s.stdin, s.stderr, operandRequest{
		command: "check", input: o.Input, planFile: o.PlanFile,
		savedRefusal: savedFormOption(o),
		planComplete: o.PlanComplete != "",
		export:       backend.Export{RequireEnrichment: o.RequireEnrichment, Producer: o.Producer, PlanComplete: o.PlanComplete != "", ProviderMap: providerMap, Attestations: attestations},
	}, sess)
	if err != nil {
		return policyresult.Result{}, err
	}
	decoded := loaded.result.Decoded
	digest, err := form.Digest(decoded)
	if err != nil {
		return policyresult.Result{}, checkFailure{exit: cli.ExitNoAnswer, code: "DOCUMENT_INVALID", detail: "DOCUMENT_INVALID: the Form failed validation"}
	}
	run.form = &policyresult.FormIdentity{Kind: formKind(decoded), Origin: "saved", Digest: digest, Generator: formGenerator(decoded)}
	if loaded.compiled {
		run.form.Origin = "compiled"
	}
	targets, err := s.targets(run, decoded)
	if err != nil {
		return policyresult.Result{}, err
	}
	run.targets = targets
	if words := progressWords(targets); words != "" && len(selected) > 0 {
		progress(s.stderr, "Evaluating", countWithNoun(len(selected), "Policy", "Policies")+" against "+words)
	}
	result := policyresult.NewResult()
	for _, t := range targets {
		var a policyresult.Architecture
		if t.refusal != nil {
			a = policyresult.ArchitectureUnavailable(len(selected), t.refusal.Code, t.refusal.Message)
			a.ReleaseSet = t.form.Semantics.ReleaseSet
			for _, owner := range t.form.Semantics.Owners {
				a.SemanticOwners = append(a.SemanticOwners, policyresult.SemanticOwner{ID: owner.ID, Kind: owner.Kind, Version: owner.Version, SemanticDigest: owner.SemanticDigest})
			}
			a.PolicyPacks = packs.loaded()
		} else {
			inputForm := t.form
			a = set.Evaluate(ctx, &inputForm, t.stage, selected)
		}
		a.Side, a.Kind, a.Stage, a.Digest = t.side, string(t.form.Kind), t.stage, t.digest
		result.Architectures = append(result.Architectures, a)
	}
	return s.identify(run, result), nil
}

// targets settles the architectures to evaluate. A plan or state input has
// one, at its default stage unless --stage chooses another. A comparison Form
// has one per requested side, each at the stage selected in the comparison. A
// plan's reconstructed Recorded stage is never evaluated: an explicit request
// is a usage error, and a comparison side that records it fails alone.
func (s checkService) targets(run *checkRun, decoded form.Form) ([]checkTarget, error) {
	o := run.options
	if decoded.Comparison == nil {
		if o.Side != "" {
			return nil, usageFailure(fmt.Sprintf("--side selects sides of a comparison Form; %s is a %s Form", inputWords(o.Input), formKind(decoded)))
		}
		run.scope = policyresult.ScopeInput
		side, err := form.Select(decoded, form.Stage(o.Stage), "")
		if err != nil {
			return nil, stageUnavailable(err)
		}
		if reconstructed(side) {
			return nil, usageFailure("Policies never evaluate the reconstructed Recorded stage of a plan; select --stage planned or --stage refreshed")
		}
		target, err := checkTargetOf("", side)
		if err != nil {
			return nil, err
		}
		return []checkTarget{target}, nil
	}
	sides := []string{form.SideBefore, form.SideAfter}
	run.scope = policyresult.ScopeBoth
	if o.Side == form.SideBefore || o.Side == form.SideAfter {
		sides = []string{o.Side}
		run.scope = policyresult.Scope(o.Side)
	}
	if o.Stage != "" && len(sides) != 1 {
		return nil, usageFailure("--stage selects the stage of one side of a comparison Form; add --side before or --side after")
	}
	targets := []checkTarget{}
	for _, name := range sides {
		side, err := form.Select(decoded, form.Stage(o.Stage), name)
		if err != nil {
			return nil, stageUnavailable(err)
		}
		target, err := checkTargetOf(name, side)
		if err != nil {
			return nil, err
		}
		if reconstructed(side) {
			if o.Stage != "" {
				return nil, usageFailure("Policies never evaluate the reconstructed Recorded stage of a plan; select --stage planned or --stage refreshed")
			}
			target.refusal = &policyresult.Diagnostic{Severity: policyresult.SeverityError, Code: "STAGE_REFUSED", Message: "this side records the reconstructed Recorded stage of a plan, which Policies never evaluate"}
		}
		targets = append(targets, target)
	}
	return targets, nil
}

func checkTargetOf(name string, side form.Side) (checkTarget, error) {
	digest, err := form.Digest(form.Form{Input: &side.Form})
	if err != nil {
		return checkTarget{}, checkFailure{exit: cli.ExitNoAnswer, code: "DOCUMENT_INVALID", detail: "DOCUMENT_INVALID: the Form failed validation"}
	}
	return checkTarget{side: name, form: side.Form, stage: side.Stage, digest: digest}, nil
}

func reconstructed(side form.Side) bool {
	return side.Form.Kind == form.KindPlan && side.Stage == form.StageRecorded
}

func stageUnavailable(err error) checkFailure {
	message := err.Error()
	if !strings.HasPrefix(message, "STAGE_UNAVAILABLE") {
		message = "STAGE_UNAVAILABLE: " + message
	}
	headline, body, _ := stageFailureWords(err)
	return checkFailure{exit: cli.ExitNoAnswer, code: "STAGE_UNAVAILABLE", detail: message,
		headline: headline, body: body}
}

// progressWords names the evaluated architectures for the progress line. Two
// sides are named by side and stage alone so the line fits a terminal.
func progressWords(targets []checkTarget) string {
	var parts []string
	var sides []checkTarget
	for _, t := range targets {
		switch {
		case t.refusal != nil:
		case t.side == "":
			parts = append(parts, "the "+stageWords(t.stage)+" architecture")
		default:
			sides = append(sides, t)
		}
	}
	if len(sides) == 1 {
		parts = append(parts, "the "+titleWord(sides[0].side)+" side ("+stageWords(sides[0].stage)+")")
	} else {
		for _, t := range sides {
			parts = append(parts, titleWord(t.side)+" ("+stageWords(t.stage)+")")
		}
	}
	return strings.Join(parts, " and ")
}

// inputWords names an input as the user typed it.
func inputWords(input string) string {
	if input == "-" {
		return "standard input"
	}
	return input
}

// selectionStop states a project selection failure once, with its guidance
// indented under it, while the failed result keeps the machine message.
func selectionStop(failure selectionFailure) checkFailure {
	statement := failure.Message
	if failure.human != "" {
		statement = failure.human
	}
	detail := failure.Code + ": " + statement
	if failure.detail != "" {
		for _, line := range strings.Split(failure.detail, "\n") {
			detail += "\n  " + line
		}
	}
	exit := cli.ExitNoAnswer
	if failure.operational {
		exit = cli.ExitFailure
	}
	return checkFailure{exit: exit, code: failure.Code, detail: detail, message: failure.Message,
		headline: statement, body: failure.detail}
}

// identify stamps what the invocation established on a result.
func (s checkService) identify(run *checkRun, result policyresult.Result) policyresult.Result {
	result.Generator = form.Generator{Name: form.GeneratorName, Version: s.version}
	result.Form = run.form
	result.Scope = run.scope
	result.Selection.Selectors = append([]string{}, run.options.Policy...)
	result.Selection.Policies = append([]string{}, run.selected...)
	return result.Finalized()
}

// fail ends an invocation that reached no verdict once its outputs are known
// safe. It replaces every requested report with a failed result, so no
// earlier file can pass for this invocation, and keeps the failure's exit.
func (s checkService) fail(run *checkRun, failure checkFailure) error {
	message := failure.message
	if message == "" {
		message, _, _ = strings.Cut(failure.detail, "\n")
		if prefix, rest, found := strings.Cut(message, ": "); found && prefix == failure.code {
			message = rest
		}
	}
	result := s.identify(run, policyresult.Unavailable(failure.code, message))
	files, stdoutBody, err := s.render(run, result, len(run.options.Output) == 0 && run.options.Format != "")
	if err == nil {
		err = writeRendered(s.stdout, s.stderr, files, stdoutBody, checkStdoutFormat(run.options) == "text")
	}
	if err != nil {
		failuref(s.stderr, "%s", failure.detail)
		return outputRunError(err)
	}
	if failure.headline != "" {
		return technicalError(failure.exit, failure.code, failure.detail,
			failure.headline, failure.body)
	}
	return cli.RunError{Code: failure.exit, Message: failure.detail}
}

// conclude writes every report and turns the verdict into the exit status,
// which it never restates on standard error. A report that cannot be written
// exits 4 once standard output carries the result.
func (s checkService) conclude(run *checkRun, result policyresult.Result) error {
	files, stdoutBody, err := s.render(run, result, true)
	if err != nil {
		return cli.RunError{Code: cli.ExitFailure, Message: err.Error()}
	}
	if err := writeRendered(s.stdout, s.stderr, files, stdoutBody, checkStdoutFormat(run.options) == "text"); err != nil {
		return outputRunError(err)
	}
	if code := policyresult.ExitCode(result.Status); code != cli.ExitOK {
		return cli.RunError{Code: code}
	}
	return nil
}

// savedFormOption names the first option that cannot affect a saved Form.
// --project and --locked still govern the Policy Packs that evaluate it.
func savedFormOption(o cli.CheckOptions) string {
	switch {
	case o.PlanFile != "":
		return "--plan-file"
	case len(o.Dialect) > 0:
		return "--dialect"
	case o.Producer != "":
		return "--producer"
	case len(o.ProviderMap) > 0:
		return "--provider-map"
	case o.PlanComplete != "":
		return "--plan-complete"
	case o.RequireEnrichment:
		return "--require-enrichment"
	}
	return ""
}

func formKind(decoded form.Form) string {
	if decoded.Comparison != nil {
		return "comparison"
	}
	if decoded.Input != nil {
		return string(decoded.Input.Kind)
	}
	return ""
}

func formGenerator(decoded form.Form) form.Generator {
	if decoded.Comparison != nil {
		return decoded.Comparison.Generator
	}
	if decoded.Input != nil {
		return decoded.Input.Generator
	}
	return form.Generator{}
}
