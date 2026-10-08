package app

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"strings"

	"github.com/rootform-dev/rootform/cli/backend"
	"github.com/rootform-dev/rootform/cli/form"
	cli "github.com/rootform-dev/rootform/cli/internal/command"
	"github.com/rootform-dev/rootform/cli/internal/fixture"
	"github.com/rootform-dev/rootform/cli/internal/human"
)

// testService analyzes each fixture export and compares the Form it produces
// with the one the fixture records.
type testService struct {
	stdout  io.Writer
	stderr  io.Writer
	backend backend.Backend
}

type caseStatus string

const (
	casePassed  caseStatus = "passed"
	caseFailed  caseStatus = "failed"
	caseErrored caseStatus = "errored"
	// caseUpdated is a case whose golden an --update run wrote because it
	// differed or did not exist yet.
	caseUpdated caseStatus = "updated"
)

// reportedChanges bounds how much of a failing comparison one case prints. A
// fixture can differ in hundreds of objects, and the first differences are the
// ones that explain the rest.
const reportedChanges = 5

type reportedDifference struct {
	Offset   int    `json:"offset"`
	Expected string `json:"expected"`
	Actual   string `json:"actual"`
}

type reportedCase struct {
	Name       string              `json:"name"`
	Status     caseStatus          `json:"status"`
	Difference *reportedDifference `json:"difference,omitempty"`
	Reason     string              `json:"reason,omitempty"`
	// changes explain a failure to a reader as architecture differences.
	changes []string
	// fileFailure marks a case whose fixture files could not be read or
	// written: the command failed, the fixture did not.
	fileFailure bool
}

type testReport struct {
	Cases   []reportedCase `json:"cases"`
	Total   int            `json:"total"`
	Passed  int            `json:"passed"`
	Failed  int            `json:"failed"`
	Errored int            `json:"errored"`
	Updated int            `json:"updated"`
}

func (s testService) Test(options cli.TestOptions) (cli.TestOutcome, error) {
	ctx := context.Background()
	// The project at the test directory selects the Dialects every case
	// compiles against; they load once, before any fixture is read.
	session := s.backend.Open(ctx, backend.Selection{Project: options.Path, Dialects: options.Dialect}, s.stderr)
	if _, err := session.Definitions(ctx); err != nil {
		return s.unloaded(err)
	}
	discovered, err := fixture.DiscoverCases(options.Path, options.Run, options.Update)
	if err != nil {
		return s.undecided("that fixture directory could not be read")
	}
	// A run that compared nothing proved nothing, so it never reads as a pass.
	if len(discovered) == 0 {
		return s.empty(options)
	}

	report := testReport{Cases: make([]reportedCase, 0, len(discovered))}
	for _, testCase := range discovered {
		report.Cases = append(report.Cases, s.run(ctx, session, testCase, options.Update))
	}
	for _, reported := range report.Cases {
		report.Total++
		switch reported.Status {
		case casePassed:
			report.Passed++
		case caseFailed:
			report.Failed++
		case caseUpdated:
			report.Updated++
		default:
			report.Errored++
		}
	}
	if !s.write(report, options.Format) {
		return cli.TestFailure, nil
	}
	failed := 0
	for _, reported := range report.Cases {
		if reported.fileFailure {
			failed++
		}
	}
	if failed != 0 {
		human.Failure(s.stderr, "the fixture files of "+countWithNoun(failed, "case", "cases")+" could not be read or written")
		return cli.TestFailure, nil
	}
	if report.Failed == 0 && report.Errored == 0 {
		return cli.TestPassed, nil
	}
	return cli.TestFailed, nil
}

// run analyzes one case and compares its fixture form with the recorded one.
// When updating, a case that differs or has no golden yet gets the produced
// fixture form as its golden.
func (s testService) run(ctx context.Context, session backend.Session, testCase fixture.Case, update bool) reportedCase {
	expected, err := os.ReadFile(testCase.Expected)
	missing := update && errors.Is(err, fs.ErrNotExist)
	if err != nil && !missing {
		return reportedCase{Name: testCase.Name, Status: caseErrored, Reason: "the recorded Form could not be read", fileFailure: true}
	}
	input, err := readInputFile(testCase.Input)
	if err != nil {
		return reportedCase{Name: testCase.Name, Status: caseErrored, Reason: "the fixture export could not be read", fileFailure: true}
	}
	// A saved plan kept beside the export must pair with it: a fixture that
	// ships one records the enriched analysis, never a silent fallback.
	compiled, err := session.Compile(ctx, backend.Export{
		Data: input, PlanFile: testCase.PlanFile, RequireEnrichment: testCase.PlanFile != "",
	})
	if err != nil {
		return reportedCase{Name: testCase.Name, Status: caseErrored, Reason: compileFailure(err)}
	}
	if compiled.Form == nil {
		return reportedCase{Name: testCase.Name, Status: caseErrored, Reason: "the produced Form failed validation"}
	}
	actual, err := form.FixtureJSON(compiled.Form)
	if err != nil {
		return reportedCase{Name: testCase.Name, Status: caseErrored, Reason: "the produced Form failed validation"}
	}
	if !missing {
		// One final newline is insignificant on either side: every encoded
		// document ends with one, and a hand-edited golden may not.
		recorded, narrowed := recordedFixture(expected, compiled.Form)
		difference, equal := fixture.CompareGolden(bytes.TrimSuffix(recorded, []byte("\n")), bytes.TrimSuffix(actual, []byte("\n")))
		// A golden recorded in another form, such as the complete document
		// "rootform run" writes, still compares; updating rewrites it.
		if equal && (narrowed || !update) {
			return reportedCase{Name: testCase.Name, Status: casePassed}
		}
		if !equal && !update {
			return reportedCase{Name: testCase.Name, Status: caseFailed, Difference: &reportedDifference{
				Offset: difference.Offset, Expected: difference.Expected, Actual: difference.Actual,
			}, changes: s.documentChanges(ctx, expected, form.Form{Input: compiled.Form})}
		}
	}
	if err := os.WriteFile(testCase.Expected, actual, 0o644); err != nil {
		return reportedCase{Name: testCase.Name, Status: caseErrored, Reason: "the golden could not be written", fileFailure: true}
	}
	return reportedCase{Name: testCase.Name, Status: caseUpdated}
}

// compileFailure states why a fixture export did not compile. The backend
// already sanitized its message; any other failure keeps to a diagnostic
// that names no path, value or internal detail.
func compileFailure(err error) string {
	var failure *backend.Error
	if errors.As(err, &failure) {
		return failure.Message
	}
	return safeRunError(err)
}

// documentChanges states a mismatch as architecture: what this run adds,
// removes or changes against the document the fixture records, at the default
// stage. It returns nothing when the recorded bytes are not a readable
// document, leaving the byte position as the only claim the run can make.
func (s testService) documentChanges(ctx context.Context, expected []byte, produced form.Form) []string {
	recorded, err := form.Decode(expected)
	if err != nil || recorded.Input == nil || produced.Input == nil {
		return nil
	}
	stage := produced.Input.DefaultStage
	before, err := form.Select(recorded, stage, "")
	if err != nil {
		return []string{fmt.Sprintf("the recorded Form has no %s stage", stageWords(stage))}
	}
	after, err := form.Select(produced, stage, "")
	if err != nil {
		return nil
	}
	result := s.backend.Compare(ctx, before, after)
	if result == nil {
		return nil
	}
	names := representationNames(form.Form{Comparison: result})
	lines := []string{}
	for _, change := range result.Comparison.Representations {
		item := representationChangeItem(change, names, false)
		lines = append(lines, item.mark+" "+safeText(item.code)+"  "+item.text)
	}
	for _, change := range result.Comparison.Facts {
		item := factChangeItem(change, names)
		if item.target == "" {
			lines = append(lines, item.mark+" "+safeText(item.code)+"  "+item.text+" "+string(change.Kind))
			continue
		}
		lines = append(lines, item.mark+" "+safeText(item.code)+"  "+safeText(item.linkWords())+"  "+item.text+" "+string(change.Kind))
	}
	for _, entry := range result.Comparison.Indeterminate {
		lines = append(lines, fmt.Sprintf("? %s  indeterminate on the %s side", safeText(nameOf(entry.Representation, names)), entry.Side))
	}
	return lines
}

// recordedFixture states a golden the way the run compares it: in fixture
// form, carrying the generator and the Dialect artifacts (release set,
// selection and owners) of the produced analysis. Which Rootform version and
// which Dialect artifacts recorded a golden is not what the fixture expects,
// so a golden recorded by another build, against another release set or
// with a Dialect override compares equal on everything else. Bytes that are
// not a readable analysis stay as they are for the byte comparison to report.
// It also reports whether the recorded bytes already are in fixture form.
func recordedFixture(content []byte, produced *form.InputForm) ([]byte, bool) {
	decoded, err := form.Decode(content)
	if err != nil || decoded.Input == nil {
		return content, false
	}
	recorded := decoded.Input
	narrowed := false
	if own, err := form.FixtureJSON(recorded); err == nil {
		narrowed = bytes.Equal(bytes.TrimSuffix(own, []byte("\n")), bytes.TrimSuffix(content, []byte("\n")))
	}
	recorded.Generator = produced.Generator
	recorded.Semantics.ReleaseSet = produced.Semantics.ReleaseSet
	recorded.Semantics.Selection = produced.Semantics.Selection
	recorded.Semantics.Owners = produced.Semantics.Owners
	encoded, err := form.FixtureJSON(recorded)
	if err != nil {
		return content, narrowed
	}
	return encoded, narrowed
}

// empty reports a directory that holds nothing to compare. The run decided
// nothing, so it keeps the undecided outcome and the diagnostic stream.
func (s testService) empty(options cli.TestOptions) (cli.TestOutcome, error) {
	if options.Run != "" {
		human.Empty(s.stderr, fmt.Sprintf("fixture name contains %q in that directory", options.Run))
		return cli.TestNoMatch, nil
	}
	human.Empty(s.stderr, "fixtures in that directory")
	fmt.Fprintln(s.stderr)
	human.Summary(s.stderr,
		[2]string{"Expected", "a directory holding plan.json or state.json and an " + fixture.GoldenName + " file"},
		[2]string{"Optional", "a " + fixture.SavedPlanName + " saved plan beside plan.json"})
	return cli.TestNoMatch, nil
}

func (s testService) write(report testReport, format cli.Format) bool {
	if format == cli.FormatJSON {
		encoded, err := json.MarshalIndent(report, "", "  ")
		if err != nil {
			human.Failure(s.stderr, "the fixture results could not be written")
			return false
		}
		if _, err := s.stdout.Write(append(encoded, '\n')); err != nil {
			human.Failure(s.stderr, "the fixture results could not be written")
			return false
		}
		return true
	}
	s.writeText(report)
	return true
}

// writeText leads with the result of the suite. A passing run says so in two
// lines; only the cases that did not pass are described.
func (s testService) writeText(report testReport) {
	passed := report.Failed == 0 && report.Errored == 0
	status := human.Bad
	if passed {
		status = human.Good
	}
	human.Verdict(s.stdout, testVerdictLine(passed), status)
	fmt.Fprintln(s.stdout, testScale(report))
	for _, reported := range report.Cases {
		if reported.Status == casePassed {
			continue
		}
		human.Section(s.stdout, reported.Name)
		s.writeCase(reported)
	}
}

func testVerdictLine(passed bool) string {
	if passed {
		return "Tests passed"
	}
	return "Tests failed"
}

// testScale counts the run under its verdict. A case that could not be
// analyzed is stated as errored rather than counted as a failed comparison.
func testScale(report testReport) string {
	cases := countWithNoun(report.Total, "case", "cases")
	if report.Updated > 0 {
		cases += fmt.Sprintf(", %d updated", report.Updated)
	}
	switch {
	case report.Failed == 0 && report.Errored == 0:
		return cases
	case report.Errored == 0:
		return fmt.Sprintf("%d of %s failed", report.Failed, cases)
	case report.Failed == 0:
		return fmt.Sprintf("%d of %s errored", report.Errored, cases)
	default:
		return fmt.Sprintf("%d of %s failed, %d errored", report.Failed, cases, report.Errored)
	}
}

func (s testService) writeCase(reported reportedCase) {
	if reported.Status == caseUpdated {
		fmt.Fprintln(s.stdout, "  golden recorded from the produced Form")
		return
	}
	if reported.Reason != "" {
		fmt.Fprintf(s.stdout, "  %s\n", reported.Reason)
		return
	}
	if len(reported.changes) == 0 {
		s.writeByteDifference(reported)
		return
	}
	for index, change := range reported.changes {
		if index == reportedChanges {
			remaining := len(reported.changes) - index
			noun := "differences"
			if remaining == 1 {
				noun = "difference"
			}
			fmt.Fprintf(s.stdout, "  %d more %s\n", remaining, noun)
			return
		}
		fmt.Fprintf(s.stdout, "  %s\n", change)
	}
}

// writeByteDifference answers when the two sides differ only outside the
// architecture (for example in evidence metadata or diagnostics), or when a
// recorded fixture is no longer a readable document.
func (s testService) writeByteDifference(reported reportedCase) {
	if reported.Difference == nil {
		return
	}
	fmt.Fprintf(s.stdout, "  the recorded Form differs at byte %d\n", reported.Difference.Offset)
	human.Summary(s.stdout,
		[2]string{"  Recorded", reported.Difference.Expected},
		[2]string{"  Produced", reported.Difference.Actual})
}

func (s testService) undecided(message string) (cli.TestOutcome, error) {
	message, _, _ = strings.Cut(message, "\n")
	human.Failure(s.stderr, message)
	return cli.TestFailure, nil
}

// unloaded reports a fixture project whose selection could not be loaded. An
// invalid rootform.lock leaves no answer, as for every command that reads it.
func (s testService) unloaded(err error) (cli.TestOutcome, error) {
	if failureKind(err) == backend.NoAnswer {
		return cli.TestUndecided, noAnswerError{message: err.Error()}
	}
	return s.undecided(err.Error())
}
