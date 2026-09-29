package app

import (
	"context"
	"errors"
	"io"
	"os"

	"github.com/rootform-dev/rootform/cli/backend"
	"github.com/rootform-dev/rootform/cli/detect"
	"github.com/rootform-dev/rootform/cli/form"
	cli "github.com/rootform-dev/rootform/cli/internal/command"
	docinput "github.com/rootform-dev/rootform/cli/internal/document"
)

// inputResult is exactly one validated Form read from one input: what the
// input was and, for a plan JSON, the outcome of its saved-plan enrichment.
type inputResult struct {
	Decoded    form.Form
	Kind       detect.Kind
	Enrichment form.SnapshotEnrichment
}

// operandRequest is one input and the options that shape its compilation.
type operandRequest struct {
	command  string
	input    string
	planFile string
	// savedRefusal names the first option that cannot affect a saved Form.
	savedRefusal string
	planComplete bool
	export       backend.Export
}

// loadOperand reads one input, compiles a producer export and loads a saved
// Form as it is, without reinterpreting it. run, check and explain read every
// input through it.
func loadOperand(ctx context.Context, stdin io.Reader, stderr io.Writer, request operandRequest, session backend.Session) (operand, error) {
	name := request.input
	var data []byte
	var err error
	if request.input == "-" {
		name = "standard input"
		data, err = docinput.ReadStream(stdin)
		if errors.Is(err, docinput.ErrTooLarge) {
			return operand{}, cli.RunError{Code: cli.ExitNoAnswer, Message: "INPUT_REFUSED: " + err.Error()}
		}
		if err != nil {
			return operand{}, cli.RunError{Code: cli.ExitFailure, Message: "INPUT_UNREADABLE: standard input could not be read"}
		}
	} else {
		data, err = readInputFile(request.input)
		if err != nil {
			return operand{}, classifyInputError(err, request.command, request.input)
		}
	}
	kind, _, err := detect.Detect(data)
	if err != nil {
		return operand{}, cli.RunError{Code: cli.ExitNoAnswer, Message: safeRunError(err) + unrecognizedHint(err, request.command)}
	}
	if kind == detect.KindDocument && request.savedRefusal != "" {
		return operand{}, cli.RunError{Code: cli.ExitUsage, Message: request.savedRefusal + " cannot affect a saved Form"}
	}
	if request.planFile != "" && kind != detect.KindPlan {
		return operand{}, cli.RunError{Code: cli.ExitUsage, Message: "--plan-file requires plan JSON"}
	}
	if request.planComplete && kind == detect.KindState {
		return operand{}, cli.RunError{Code: cli.ExitUsage, Message: "--plan-complete requires plan JSON"}
	}
	if kind == detect.KindDocument {
		progress(stderr, "Loading", name+" (saved Form; no recompilation)")
	} else {
		progress(stderr, "Compiling", name+" ("+kindWords(kind)+")")
	}
	analyzed, err := analyze(ctx, data, kind, request, session)
	if err != nil {
		return operand{}, err
	}
	switch analyzed.Enrichment.Status {
	case form.SnapshotVerified:
		progress(stderr, "Enriched", "saved plan paired with this plan JSON ("+countWithNoun(analyzed.Enrichment.Modules, "module", "modules")+")")
	case form.SnapshotRefused:
		progress(stderr, "Refused", "saved plan ("+analyzed.Enrichment.Diagnostic+"); analysis continues with the plan JSON alone")
	}
	return operand{name: name, kind: kind, compiled: kind != detect.KindDocument, result: analyzed}, nil
}

// analyze turns the bytes of one input into its Form. A saved Form reopens
// exactly as it was saved and never reaches the backend; a plan JSON or state
// JSON is compiled by the selection session.
func analyze(ctx context.Context, data []byte, kind detect.Kind, request operandRequest, session backend.Session) (inputResult, error) {
	if kind == detect.KindDocument {
		decoded, err := form.Decode(data)
		if err != nil {
			return inputResult{}, cli.RunError{Code: cli.ExitNoAnswer, Message: safeRunError(err)}
		}
		return inputResult{Decoded: decoded, Kind: kind}, nil
	}
	export := request.export
	export.Data = data
	export.PlanFile = request.planFile
	compiled, err := session.Compile(ctx, export)
	if err != nil {
		return inputResult{}, backendRunError(err)
	}
	return inputResult{Decoded: form.Form{Input: compiled.Form}, Kind: kind, Enrichment: compiled.Enrichment}, nil
}

// backendRunError states a backend failure with the exit its kind carries.
// The backend already sanitized its message, so it is printed as it is.
func backendRunError(err error) error {
	var failure *backend.Error
	if errors.As(err, &failure) {
		return cli.RunError{Code: exitOf(failure.Kind), Message: failure.Message}
	}
	return cli.RunError{Code: cli.ExitNoAnswer, Message: safeRunError(err)}
}

// exitOf maps the kind of a backend failure to the exit status it carries.
func exitOf(kind backend.Kind) int {
	switch kind {
	case backend.Failure:
		return cli.ExitFailure
	case backend.Negative:
		return cli.ExitNegative
	case backend.Usage:
		return cli.ExitUsage
	}
	return cli.ExitNoAnswer
}

// readInputFile reads one plan, state or Form file under the document
// ceiling. A directory, a device or a file that cannot be read is named as
// such, so the caller can tell a usage mistake from an unreadable file.
func readInputFile(path string) ([]byte, error) {
	info, err := os.Stat(path)
	if err != nil {
		return nil, errors.New("INPUT_UNREADABLE: input could not be read")
	}
	if info.IsDir() {
		return nil, errors.New("DIRECTORY_INPUT: use a Terraform or OpenTofu plan JSON or state JSON export")
	}
	if !info.Mode().IsRegular() {
		return nil, errors.New("INPUT_UNREADABLE: input must be a regular file")
	}
	data, err := docinput.ReadFile("input", path)
	if errors.Is(err, docinput.ErrTooLarge) {
		return nil, errors.New("INPUT_REFUSED: " + err.Error())
	}
	if err != nil {
		return nil, errors.New("INPUT_UNREADABLE: input could not be read")
	}
	return data, nil
}
