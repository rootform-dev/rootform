package app

import (
	"context"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"unicode/utf8"

	"github.com/rootform-dev/rootform/cli/backend"
	cli "github.com/rootform-dev/rootform/cli/command"
	"github.com/rootform-dev/rootform/cli/detect"
	"github.com/rootform-dev/rootform/cli/form"
	"github.com/rootform-dev/rootform/cli/human"
	docinput "github.com/rootform-dev/rootform/cli/internal/document"
	"github.com/rootform-dev/rootform/cli/internal/server"
)

// runService analyzes or loads its inputs once and derives every requested
// output, the terminal summary and the loopback explorer from that one result.
// It never evaluates a Policy.
type runService struct {
	stdin   io.Reader
	stdout  io.Writer
	stderr  io.Writer
	browser cli.BrowserLauncher
	backend backend.Backend
	// version names the generator a compared Form records.
	version string
	// shell and assets are the renderer page and the explorer files the
	// build embeds; either may be absent.
	shell  []byte
	assets fs.FS
	// serveReady is called with the served URL; tests use it to stop the server.
	serveReady func(string)
}

func (s runService) Run(options cli.Options) error {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	return s.run(ctx, options)
}

// operand is one input as read: its display name and what it was.
type operand struct {
	name     string
	kind     detect.Kind
	compiled bool
	result   inputResult
}

// runResult is the single result every output renders.
type runResult struct {
	operands     []operand
	decoded      form.Form
	payload      []byte
	display      []byte
	presentation []byte
	// focus is the analysis the summary leads with: the single analysis, or
	// the after side of a comparison.
	focus      *form.InputForm
	focusStage form.Stage
	generator  string
}

func (s runService) run(ctx context.Context, options cli.Options) error {
	if s.stdin == nil {
		s.stdin = os.Stdin
	}
	if s.stdout == nil {
		s.stdout = io.Discard
	}
	if s.stderr == nil {
		s.stderr = io.Discard
	}
	providerMap, attestations, err := validateAttestations(options.Producer, options.ProviderMap)
	if err != nil {
		return cli.RunError{Code: cli.ExitUsage, Message: err.Error()}
	}
	if options.PlanComplete != "" {
		attestations = append(attestations, form.Attestation{Name: "plan-complete", Value: options.PlanComplete})
	}
	inputs := []string{options.Input}
	if options.DiffInput != "" {
		inputs = append(inputs, options.DiffInput)
	}
	if options.Project != "" {
		info, statErr := os.Stat(options.Project)
		if statErr != nil || !info.IsDir() {
			return cli.RunError{Code: cli.ExitUsage, Message: "--project requires a directory"}
		}
	}
	if err := validateOutputs(options.Output, options.Format, append(append([]string{}, inputs...), options.PlanFile, options.DiffPlanFile), runOutputRules); err != nil {
		return cli.RunError{Code: cli.ExitUsage, Message: err.Error()}
	}

	sess := s.backend.Open(ctx, backend.Selection{Project: options.Project, Locked: options.Locked, Dialects: options.Dialect}, s.stderr)
	result := runResult{generator: s.version}
	for i, input := range inputs {
		archive := options.PlanFile
		if i == 1 {
			archive = options.DiffPlanFile
		}
		loaded, err := loadOperand(ctx, s.stdin, s.stderr, operandRequest{
			command: "run", input: input, planFile: archive,
			savedRefusal: documentOption(options, i),
			planComplete: options.PlanComplete != "",
			export:       backend.Export{RequireEnrichment: options.RequireEnrichment, Producer: options.Producer, PlanComplete: options.PlanComplete != "", ProviderMap: providerMap, Attestations: attestations},
		}, sess)
		if err != nil {
			return err
		}
		if len(inputs) == 2 && loaded.result.Decoded.Comparison != nil {
			return cli.RunError{Code: cli.ExitUsage, Message: fmt.Sprintf("%s is a comparison Form; it reopens alone and is never a --diff operand\n\nTry:\n  rootform run %s", loaded.name, shellQuote(input))}
		}
		result.operands = append(result.operands, loaded)
	}

	result.decoded = result.operands[0].result.Decoded
	if len(result.operands) == 2 {
		before, selectErr := selectRunStage(result.operands[0].result.Decoded, options.BeforeStage)
		if selectErr != nil {
			return cli.RunError{Code: cli.ExitNoAnswer, Message: selectErr.Error()}
		}
		after, selectErr := selectRunStage(result.operands[1].result.Decoded, options.AfterStage)
		if selectErr != nil {
			return cli.RunError{Code: cli.ExitNoAnswer, Message: selectErr.Error()}
		}
		progressDirection(s.stderr, "Comparing",
			fmt.Sprintf("Before %s (%s)", stageWords(before.Stage), result.operands[0].name),
			fmt.Sprintf("-> After %s (%s)", stageWords(after.Stage), result.operands[1].name))
		result.decoded = form.Form{Comparison: s.backend.Compare(ctx, before, after)}
		if err := result.decoded.Comparison.Validate(); err != nil {
			return cli.RunError{Code: cli.ExitFailure, Message: "COMPARISON_INVALID: the comparison Form failed validation"}
		}
	}
	if err := result.selectFocus(options); err != nil {
		return err
	}

	payload, err := form.Encode(result.decoded)
	if err != nil {
		return cli.RunError{Code: cli.ExitFailure, Message: "DOCUMENT_INVALID: the result failed validation"}
	}
	result.payload = payload
	decodedPayload, err := form.Decode(payload)
	if err != nil {
		return cli.RunError{Code: cli.ExitFailure, Message: "DOCUMENT_INVALID: the result failed validation"}
	}
	result.display, err = form.DisplayJSON(decodedPayload)
	if err != nil {
		return cli.RunError{Code: cli.ExitFailure, Message: "DOCUMENT_INVALID: the display copy could not be produced"}
	}
	presented := sess.Presentation(ctx, result.focus)
	for _, warning := range presented.Warnings {
		writeWarning(s.stderr, warning)
	}
	result.presentation = presented.Catalog

	if err := s.writeOutputs(options, result); err != nil {
		return cli.RunError{Code: cli.ExitFailure, Message: err.Error()}
	}
	if options.NoServe {
		return nil
	}
	return s.serve(ctx, options, result)
}

// selectFocus settles the stage the summary leads with.
func (r *runResult) selectFocus(options cli.Options) error {
	if c := r.decoded.Comparison; c != nil {
		if options.Stage != "" {
			return cli.RunError{Code: cli.ExitUsage, Message: "--stage does not apply to a comparison Form; it records the stage of each side"}
		}
		after := c.After.Form
		r.focus, r.focusStage = &after, c.After.Stage
		return nil
	}
	a := r.decoded.Input
	stage := form.Stage(options.Stage)
	if stage == "" {
		stage = a.DefaultStage
	}
	if a.Stages[stage] == nil {
		return cli.RunError{Code: cli.ExitNoAnswer, Message: fmt.Sprintf("STAGE_UNAVAILABLE: this input has no %s stage; available: %s", stageWords(stage), strings.Join(availableStages(a), ", "))}
	}
	r.focus, r.focusStage = a, stage
	return nil
}

func availableStages(a *form.InputForm) []string {
	names := []string{}
	for _, stage := range form.Stages() {
		if a.Stages[stage] != nil {
			names = append(names, stageWords(stage))
		}
	}
	return names
}

// serve starts the loopback explorer for the display copy and blocks until
// interrupted.
func (s runService) serve(ctx context.Context, options cli.Options, r runResult) error {
	assets := s.assets
	served, err := server.NewDocument(r.display, r.presentation, assets, options.Port)
	if err != nil {
		return cli.RunError{Code: cli.ExitFailure, Message: "SERVER_FAILED: the explorer could not prepare the result"}
	}
	addr, err := served.Listen()
	if err != nil {
		var conflict server.PortConflictError
		if errors.As(err, &conflict) && options.Port != 0 {
			return cli.RunError{Code: cli.ExitFailure, Message: fmt.Sprintf("SERVER_FAILED: port %d is unavailable; pass --port 0 to pick a free port, or --no-serve", options.Port)}
		}
		return cli.RunError{Code: cli.ExitFailure, Message: "SERVER_FAILED: the loopback server could not start"}
	}
	url := "http://" + addr.String() + "/"
	if assets == nil {
		writeWarning(s.stderr, "this build carries no explorer assets; the server answers only /api/v1/document and /api/v1/presentation")
	}
	if !options.NoBrowser && s.browser != nil {
		if err := s.browser.Open(url); err != nil {
			writeWarning(s.stderr, "the browser could not be opened; visit "+url)
		}
	}
	human.Section(s.stderr, "Explorer")
	fmt.Fprintf(s.stderr, "  %s\n\n  %s\n", url, human.Dim(s.stderr, "Press Ctrl+C to stop."))
	if s.serveReady != nil {
		s.serveReady(url)
	}
	done := make(chan error, 1)
	go func() { done <- served.Serve() }()
	select {
	case <-ctx.Done():
		if err := served.Shutdown(); err != nil {
			return cli.RunError{Code: cli.ExitFailure, Message: "SERVER_FAILED: the server could not shut down"}
		}
		if err := <-done; err != nil && !errors.Is(err, http.ErrServerClosed) {
			return cli.RunError{Code: cli.ExitFailure, Message: "SERVER_FAILED: the server stopped unexpectedly"}
		}
		return nil
	case err := <-done:
		if err != nil {
			return cli.RunError{Code: cli.ExitFailure, Message: "SERVER_FAILED: the server stopped unexpectedly"}
		}
		return nil
	}
}

// progress writes one step that ran. Steps go to standard error only.
func progress(w io.Writer, step, detail string) {
	fmt.Fprintf(w, "%s %s\n", human.Dim(w, fmt.Sprintf("%-10s", step)), safeText(detail))
}

// progressDirection writes a step that goes from one operand to another. When
// the whole line would pass the report width, the destination continues on an
// aligned line, so no name is cut.
func progressDirection(w io.Writer, step, from, to string) {
	indent := len(fmt.Sprintf("%-10s ", step))
	if indent+utf8.RuneCountInString(safeText(from+" "+to)) <= reportLineWidth {
		progress(w, step, from+" "+to)
		return
	}
	progress(w, step, from)
	fmt.Fprintf(w, "%s%s\n", strings.Repeat(" ", indent), safeText(to))
}

func kindWords(kind detect.Kind) string {
	switch kind {
	case detect.KindPlan:
		return "plan JSON"
	case detect.KindState:
		return "state JSON"
	}
	return string(kind)
}

// classifyInputError tells a usage mistake, such as a directory given as an
// input, from a file that could not be read.
func classifyInputError(err error, command, input string) error {
	message := err.Error()
	switch {
	case strings.HasPrefix(message, "DIRECTORY_INPUT:"):
		return cli.RunError{Code: cli.ExitUsage, Message: message + "\n\nTry:\n  terraform show -json plan.tfplan > plan.json\n  rootform " + command + " plan.json"}
	case strings.Contains(message, "must be a regular file"):
		return cli.RunError{Code: cli.ExitUsage, Message: fmt.Sprintf("INPUT_UNREADABLE: input %q must be a regular file", input)}
	case strings.HasPrefix(message, "INPUT_UNREADABLE:"):
		return cli.RunError{Code: cli.ExitFailure, Message: fmt.Sprintf("INPUT_UNREADABLE: input %q could not be read", input)}
	case strings.HasPrefix(message, "INPUT_REFUSED:"):
		return cli.RunError{Code: cli.ExitNoAnswer, Message: fmt.Sprintf("INPUT_REFUSED: input %q exceeds the %s a document may occupy", input, docinput.Limit())}
	}
	return cli.RunError{Code: cli.ExitNoAnswer, Message: safeRunError(err)}
}

// unrecognizedHint names the export that a refused input most likely needed.
// A saved plan, a raw state file, a plan event stream and configuration text
// are Terraform or OpenTofu files that Rootform reads only through show -json.
func unrecognizedHint(err error, command string) string {
	var refused *detect.Error
	if !errors.As(err, &refused) {
		return ""
	}
	use := "rootform " + command
	switch refused.Shape {
	case detect.ShapeEmptyState:
		return "\n\nTry:\n  terraform plan -out=plan.tfplan\n  terraform show -json plan.tfplan > plan.json\n  " + use + " plan.json --plan-file plan.tfplan"
	case detect.ShapeZipArchive:
		return "\n\nA saved plan is read with --plan-file, next to the plan JSON exported from it.\n\nTry:\n  terraform show -json plan.tfplan > plan.json\n  " + use + " plan.json --plan-file plan.tfplan"
	case detect.ShapeRawState:
		return "\n\nTry:\n  terraform show -json > state.json\n  " + use + " state.json"
	case detect.ShapeEventStream:
		return "\n\nTry:\n  terraform plan -out=plan.tfplan\n  terraform show -json plan.tfplan > plan.json\n  " + use + " plan.json"
	case detect.ShapeNotJSON:
		return "\n\nTry:\n  terraform show -json plan.tfplan > plan.json\n  " + use + " plan.json"
	}
	return ""
}

func safeRunError(err error) string {
	message := err.Error()
	if strings.HasPrefix(message, form.CodeFormatUnsupported+":") {
		return message
	}
	if strings.HasPrefix(message, "DOCUMENT_") {
		return "DOCUMENT_INVALID: the Form failed validation"
	}
	if strings.Contains(message, "SEMANTIC_SELECTION:") {
		return "SEMANTIC_SELECTION: the selected Dialects could not be loaded (" + selectionCause(message) + ")"
	}
	if strings.Contains(message, "internal analysis validation") || strings.HasPrefix(message, "ANALYSIS_INVALID") {
		return "ANALYSIS_INVALID: the compiled Form failed validation"
	}
	for _, code := range []string{"INPUT_UNRECOGNIZED", "INPUT_UNREADABLE", "INPUT_INVALID", "INPUT_REFUSED", "PLAN_ERRORED", "PLAN_FILE_UNREADABLE", "PLAN_PAIR_MISMATCH", "PLAN_FILE_REQUIRED", "STATE_", "SENSITIVE_", "MASK_"} {
		if strings.HasPrefix(message, code) {
			return message
		}
	}
	return "INPUT_INVALID: the input could not be analyzed"
}

// selectionCause keeps the first line of a selection error: it names the unit
// and never carries paths or registry responses.
func selectionCause(message string) string {
	_, cause, _ := strings.Cut(message, "SEMANTIC_SELECTION: ")
	cause, _, _ = strings.Cut(cause, "\n")
	if cause == "" {
		return "selection failed"
	}
	return cause
}

func documentOption(options cli.Options, index int) string {
	if index == 0 && options.PlanFile != "" {
		return "--plan-file"
	}
	if index == 1 && options.DiffPlanFile != "" {
		return "--diff-plan-file"
	}
	if len(options.Dialect) > 0 {
		return "--dialect"
	}
	if options.Locked {
		return "--locked"
	}
	if options.Producer != "" {
		return "--producer"
	}
	if len(options.ProviderMap) > 0 {
		return "--provider-map"
	}
	if options.PlanComplete != "" {
		return "--plan-complete"
	}
	if options.RequireEnrichment {
		return "--require-enrichment"
	}
	return ""
}

func selectRunStage(decoded form.Form, stageName string) (form.Side, error) {
	stage := form.Stage(stageName)
	if stage == "" && decoded.Input != nil {
		stage = decoded.Input.DefaultStage
	}
	return form.Select(decoded, stage, "")
}
