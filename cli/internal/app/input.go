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

type inputFileError struct {
	kind   string
	reason string
}

func (e inputFileError) Error() string {
	switch e.kind {
	case "directory":
		return "DIRECTORY_INPUT: use a Terraform or OpenTofu plan JSON or state JSON export"
	case "not-regular":
		return "INPUT_UNREADABLE: input must be a regular file"
	case "too-large":
		return "INPUT_REFUSED: " + docinput.ErrTooLarge.Error()
	default:
		return "INPUT_UNREADABLE: input could not be read"
	}
}

func inputReadReason(err error) string {
	switch {
	case errors.Is(err, os.ErrNotExist):
		return "file does not exist"
	case errors.Is(err, os.ErrPermission):
		return "permission denied"
	default:
		return ""
	}
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
			return operand{}, technicalError(cli.ExitNoAnswer, "INPUT_REFUSED",
				"INPUT_REFUSED: "+err.Error(), "standard input exceeds the "+docinput.Limit()+" limit", "")
		}
		if err != nil {
			return operand{}, technicalError(cli.ExitFailure, "INPUT_UNREADABLE",
				"INPUT_UNREADABLE: standard input could not be read",
				"cannot read standard input", "")
		}
	} else {
		data, err = readInputFile(request.input)
		if err != nil {
			return operand{}, classifyInputError(err, request.command, request.input)
		}
	}
	kind, _, err := detect.Detect(data)
	if err != nil {
		hint := unrecognizedHint(err, request.command)
		message := safeRunError(err) + hint
		var refused *detect.Error
		if errors.As(err, &refused) {
			body := hint
			if refused.Shape == detect.ShapeEmptyState {
				body = "The working directory that exported it has no state." + body
			}
			return operand{}, technicalError(cli.ExitNoAnswer, refused.Code, message,
				unrecognizedHeadline(refused.Shape), body)
		}
		return operand{}, cli.RunError{Code: cli.ExitNoAnswer, Message: message}
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
			message := safeRunError(err)
			var invalid *form.DecodeError
			if errors.As(err, &invalid) {
				code := "DOCUMENT_INVALID"
				if invalid.Code == form.CodeFormatUnsupported {
					code = invalid.Code
				}
				return inputResult{}, technicalError(cli.ExitNoAnswer, code, message,
					formFailureHeadline(invalid), "")
			}
			return inputResult{}, technicalError(cli.ExitNoAnswer, "DOCUMENT_INVALID", message,
				"the Form failed validation", "")
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

// backendRunError preserves the backend kind and machine message while using
// its separate human fields when the backend supplies them.
func backendRunError(err error) error {
	var failure *backend.Error
	if errors.As(err, &failure) {
		if failure.Code != "" && failure.Human != "" {
			return technicalError(exitOf(failure.Kind), failure.Code, failure.Message,
				failure.Human, failure.Detail)
		}
		return cli.RunError{Code: exitOf(failure.Kind), Message: failure.Message}
	}
	return technicalError(cli.ExitNoAnswer, "INPUT_INVALID", safeRunError(err),
		"the input could not be analyzed", "")
}

func unrecognizedHeadline(shape string) string {
	switch shape {
	case detect.ShapeZipArchive:
		return "this input looks like a saved plan"
	case detect.ShapeRawState:
		return "this input is raw Terraform state"
	case detect.ShapeEventStream:
		return "this input is a Terraform plan event stream"
	case detect.ShapeNotJSON:
		return "this input is not JSON"
	case detect.ShapeEmptyState:
		return "this state export has no recorded state"
	case "malformed JSON or trailing garbage":
		return "this input is not valid JSON"
	case detect.ShapeUnknownJSON:
		return "this JSON is not a plan, state or saved Form"
	case "empty input":
		return "this input is empty"
	default:
		return "Rootform does not recognize this input"
	}
}

func formFailureHeadline(err *form.DecodeError) string {
	switch err.Code {
	case form.CodeFormatUnsupported:
		return err.Message
	case form.CodeJSONInvalid:
		return "the Form is not valid JSON"
	case form.CodeFieldUnknown:
		return "the Form contains an unknown field"
	case form.CodeTrailingContent:
		return "the Form has content after its JSON document"
	default:
		return "the Form failed validation"
	}
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
		return nil, inputFileError{kind: "unreadable", reason: inputReadReason(err)}
	}
	if info.IsDir() {
		return nil, inputFileError{kind: "directory"}
	}
	if !info.Mode().IsRegular() {
		return nil, inputFileError{kind: "not-regular"}
	}
	data, err := docinput.ReadFile("input", path)
	if errors.Is(err, docinput.ErrTooLarge) {
		return nil, inputFileError{kind: "too-large"}
	}
	if err != nil {
		return nil, inputFileError{kind: "unreadable", reason: inputReadReason(err)}
	}
	return data, nil
}
