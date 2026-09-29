package app

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"sort"
	"strconv"
	"strings"

	cli "github.com/rootform-dev/rootform/cli/command"
	"github.com/rootform-dev/rootform/cli/detect"
	"github.com/rootform-dev/rootform/cli/form"
	"github.com/rootform-dev/rootform/cli/human"
	docinput "github.com/rootform-dev/rootform/cli/internal/document"
)

// validateService checks that definitions are well formed. It evaluates no
// policy: a valid architecture may still violate one, and the two questions
// keep separate answers and separate commands.
type validateService struct {
	stdin  io.Reader
	stdout io.Writer
	stderr io.Writer
	// definitions validates the objects a Dialect or Policy Pack declares.
	definitions cli.ValidateService
}

type validationProblem struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Path    string `json:"path,omitempty"`
	Line    int    `json:"line,omitempty"`

	// The human fields locate a diagnostic for a reader. They stay out of the
	// machine record: architecture diagnostics carried no line before this
	// pass, and adding one would change what consumers parse.
	humanPath   string
	humanLine   int
	humanColumn int
}

type validationReport struct {
	Object   string              `json:"object"`
	Subject  string              `json:"subject"`
	Valid    bool                `json:"valid"`
	Problems []validationProblem `json:"problems"`
}

// validationEvidence is what a human report shows beside the verdict.
// Uncertainty is counted apart from errors: an architecture can be structurally
// valid and still leave facts unresolved, and the two answers must not merge.
type validationEvidence struct {
	dialects    []string
	uncertainty int
	// structural records that a canonical Form was delivered and
	// validates on its own. It shapes the human verdict only: the machine
	// report, its problem list, and the exit code keep counting every error
	// exactly as before.
	structural bool
}

func (s validateService) Validate(options cli.ValidateOptions) (cli.ValidateOutcome, error) {
	switch options.Object {
	case cli.ValidateForm:
		return s.validateForm(options)
	case cli.ValidateDialects, cli.ValidatePolicy, cli.ValidateRule, cli.ValidateConcept,
		cli.ValidateContext, cli.ValidateRelation:
		if s.definitions == nil {
			return cli.ValidateFailure, errors.New("validate service is not configured")
		}
		return s.definitions.Validate(options)
	default:
		failuref(s.stderr, "%q is not something rootform can validate\n", string(options.Object))
		return cli.ValidateFailure, nil
	}
}

// validateForm checks one saved Form on its own: strict format-1 decoding and
// every Form invariant. It loads no Dialect and never recompiles; a plan or
// state export is analyzed by rootform run.
func (s validateService) validateForm(options cli.ValidateOptions) (cli.ValidateOutcome, error) {
	var data []byte
	if options.Input == "-" {
		read, err := docinput.ReadStream(s.stdin)
		if errors.Is(err, docinput.ErrTooLarge) {
			return s.undecided("INPUT_REFUSED: " + err.Error())
		}
		if err != nil {
			return s.undecided("standard input could not be read")
		}
		data = read
	} else {
		read, err := readInputFile(options.Input)
		if err != nil {
			return s.undecided(safeRunError(err))
		}
		data = read
	}
	kind, _, detectErr := detect.Detect(data)
	if detectErr == nil && kind != detect.KindDocument {
		return s.refused("this input is " + kindWords(kind) + ", not a saved Form\n\nTry:\n  rootform run " +
			shellQuote(options.Input) + " --no-serve -o form.json\n  rootform validate form form.json")
	}
	if _, err := form.Decode(data); err != nil {
		return s.report(options, formProblems(err), validationEvidence{})
	}
	return s.report(options, nil, validationEvidence{structural: true})
}

// formProblems lists every decoding or validation problem of a Form. The
// problem path locates the problem inside the JSON; it is never a file.
func formProblems(err error) []validationProblem {
	var invalid *form.ValidationError
	if errors.As(err, &invalid) {
		problems := make([]validationProblem, 0, len(invalid.Problems))
		for _, problem := range invalid.Problems {
			problems = append(problems, validationProblem{Code: problem.Code, Message: problem.Path + ": " + problem.Message})
		}
		return problems
	}
	var decode *form.DecodeError
	if errors.As(err, &decode) {
		return []validationProblem{{Code: decode.Code, Message: decode.Message}}
	}
	var refused *detect.Error
	if errors.As(err, &refused) {
		return []validationProblem{{Code: refused.Code, Message: "the input is a " + refused.Shape}}
	}
	return []validationProblem{{Code: "DOCUMENT_INVALID", Message: "the Form could not be read"}}
}

// subjectOf names what was validated without carrying a filesystem path into
// a report. Declared identifiers are public semantic identities and stay exact.
func subjectOf(options cli.ValidateOptions) string {
	if options.Name != "" {
		return options.Name
	}
	if options.Object == cli.ValidateDialects {
		return "dialect set"
	}
	return "form"
}

func (s validateService) report(
	options cli.ValidateOptions,
	problems []validationProblem,
	evidence validationEvidence,
) (cli.ValidateOutcome, error) {
	if problems == nil {
		problems = make([]validationProblem, 0)
	}
	report := validationReport{
		Object:   string(options.Object),
		Subject:  subjectOf(options),
		Valid:    len(problems) == 0,
		Problems: problems,
	}
	if options.Format == cli.FormatJSON {
		encoded, err := json.MarshalIndent(report, "", "  ")
		if err != nil {
			return s.undecided("the validation result could not be written")
		}
		if _, err := s.stdout.Write(append(encoded, 10)); err != nil {
			return s.undecided("the validation result could not be written")
		}
	} else {
		s.writeHumanReport(report, evidence)
	}
	if report.Valid {
		return cli.ValidateValid, nil
	}
	return cli.ValidateInvalid, nil
}

// writeHumanReport leads with the verdict and the number of errors behind it,
// then the evidence, then the diagnostics grouped under their file. The
// diagnostics are the answer the command was asked for, so they stay on
// standard output with the verdict they explain.
func (s validateService) writeHumanReport(report validationReport, evidence validationEvidence) {
	human.Verdict(s.stdout, validationVerdict(report, evidence), validationStatus(report, evidence))
	if len(evidence.dialects) > 0 {
		human.Section(s.stdout, "Dialects")
		for _, dialect := range evidence.dialects {
			fmt.Fprintf(s.stdout, "  %s\n", dialect)
		}
	}
	// An incomplete analysis and unresolved facts are reported beside the
	// verdict, never inside it: neither makes a well-formed definition
	// malformed.
	rows := make([][2]string, 0, 2)
	if !report.Valid && evidence.structural {
		rows = append(rows, [2]string{"Architectural analysis",
			"indeterminate, " + countWithNoun(len(report.Problems), "error", "errors")})
	}
	if evidence.uncertainty > 0 {
		rows = append(rows, [2]string{"Uncertainty",
			countWithNoun(evidence.uncertainty, "warning", "warnings")})
	}
	if len(rows) > 0 {
		fmt.Fprintln(s.stdout)
		human.Summary(s.stdout, rows...)
	}
	writeValidationProblems(s.stdout, report.Problems)
}

// validationVerdict answers the question the command was asked. An
// A Form that validates is structurally valid even
// when the interpretation above it failed, so the verdict states which of the
// two answers is negative instead of merging them into one.
func validationVerdict(report validationReport, evidence validationEvidence) string {
	subject := report.Subject
	switch subject {
	case "form":
		subject = "Form"
	case "dialect set":
		subject = "Dialect set"
	}
	switch {
	case report.Valid:
		return subject + " valid"
	case evidence.structural:
		return subject + " structurally valid"
	default:
		return fmt.Sprintf("%s invalid (%s)", subject,
			countWithNoun(len(report.Problems), "error", "errors"))
	}
}

func validationStatus(report validationReport, evidence validationEvidence) human.Status {
	switch {
	case report.Valid:
		return human.Good
	case evidence.structural:
		return human.Warn
	default:
		return human.Bad
	}
}

// writeValidationProblems groups diagnostics under the file they come from, in
// file then line order, so a reader follows one source at a time.
func writeValidationProblems(writer io.Writer, problems []validationProblem) {
	ordered := make([]validationProblem, len(problems))
	copy(ordered, problems)
	for index, problem := range ordered {
		if problem.humanPath != "" {
			ordered[index].Path = problem.humanPath
		}
	}
	sort.SliceStable(ordered, func(left, right int) bool {
		first, second := ordered[left], ordered[right]
		switch {
		case first.Path != second.Path:
			return first.Path < second.Path
		case problemLine(first) != problemLine(second):
			return problemLine(first) < problemLine(second)
		case first.humanColumn != second.humanColumn:
			return first.humanColumn < second.humanColumn
		default:
			return first.Code < second.Code
		}
	})
	for start := 0; start < len(ordered); {
		end := start
		for end < len(ordered) && ordered[end].Path == ordered[start].Path {
			end++
		}
		writeValidationGroup(writer, ordered[start:end])
		start = end
	}
}

func writeValidationGroup(writer io.Writer, group []validationProblem) {
	if group[0].Path != "" {
		human.Section(writer, group[0].Path)
	} else {
		fmt.Fprintln(writer)
	}
	locations := make([]string, len(group))
	locationWidth, codeWidth := 0, 0
	for index, problem := range group {
		locations[index] = problemLocation(problem)
		if len(locations[index]) > locationWidth {
			locationWidth = len(locations[index])
		}
		if len(problem.Code) > codeWidth {
			codeWidth = len(problem.Code)
		}
	}
	for index, problem := range group {
		if locationWidth == 0 {
			fmt.Fprintf(writer, "  %-*s  %s\n", codeWidth, problem.Code, problem.Message)
			continue
		}
		fmt.Fprintf(writer, "  %-*s  %-*s  %s\n",
			locationWidth, locations[index], codeWidth, problem.Code, problem.Message)
	}
}

func problemLocation(problem validationProblem) string {
	line := problemLine(problem)
	switch {
	case line != 0 && problem.humanColumn != 0:
		return strconv.Itoa(line) + ":" + strconv.Itoa(problem.humanColumn)
	case line != 0:
		return strconv.Itoa(line)
	default:
		return ""
	}
}

// problemLine prefers the line resolved for a reader, and falls back to the
// one the machine record already carried.
func problemLine(problem validationProblem) int {
	if problem.humanLine != 0 {
		return problem.humanLine
	}
	return problem.Line
}

func (s validateService) undecided(message string) (cli.ValidateOutcome, error) {
	message, _, _ = strings.Cut(message, "\n")
	human.Failure(s.stderr, message)
	return cli.ValidateFailure, nil
}

func (s validateService) refused(message string) (cli.ValidateOutcome, error) {
	human.Failure(s.stderr, message)
	return cli.ValidateUndecided, nil
}
