package app

import (
	"fmt"
	"io"
	"os"
	"sort"
	"strings"

	"github.com/rootform-dev/rootform/cli/form"
	cli "github.com/rootform-dev/rootform/cli/internal/command"
	"github.com/rootform-dev/rootform/cli/internal/human"
	"github.com/rootform-dev/rootform/cli/policyresult"
)

// policyExplanation is one Policy's outcomes as a check result records them.
// Inspected evidence is described from a Form only when that Form is the one
// the result was computed from.
type policyExplanation struct {
	Policy        string                        `json:"policy"`
	Form          *policyresult.FormIdentity    `json:"form,omitempty"`
	Scope         policyresult.Scope            `json:"scope,omitempty"`
	InputEvidence bool                          `json:"input_evidence"`
	Architectures []explainedPolicyArchitecture `json:"architectures"`
	Diagnostics   []policyresult.Diagnostic     `json:"diagnostics"`
}

// explainedPolicyArchitecture is the Policy's outcome on one evaluated
// architecture, and the evaluations that decided it.
type explainedPolicyArchitecture struct {
	Side        string                     `json:"side,omitempty"`
	Kind        string                     `json:"kind"`
	Stage       form.Stage                 `json:"stage"`
	Digest      string                     `json:"digest"`
	Outcome     string                     `json:"outcome"`
	Result      *policyresult.PolicyResult `json:"result,omitempty"`
	Evaluations []explainedEvaluation      `json:"evaluations"`
	Diagnostics []policyresult.Diagnostic  `json:"diagnostics"`
}

type explainedEvaluation struct {
	policyresult.Evaluation
	Facts    []inspectedFact    `json:"facts,omitempty"`
	Closures []inspectedClosure `json:"closures,omitempty"`
	// InterpretationReason is why the evaluated instance went uninterpreted,
	// so no query of the assertion ran.
	InterpretationReason string `json:"interpretation_reason,omitempty"`
}

type inspectedFact struct {
	ID       string   `json:"id"`
	Kind     string   `json:"kind"`
	Name     string   `json:"name,omitempty"`
	From     string   `json:"from"`
	To       string   `json:"to"`
	Evidence []string `json:"evidence"`
	Rules    []string `json:"rules"`
}

// inspectedClosure is one closure an evaluation inspected: the instance it
// belongs to, the reference it followed and what it concluded. Endpoints
// name where its facts lead. MatchesNoInstance marks an undecided closure
// that left every instance out, so no fact of it can enter the evaluated one.
type inspectedClosure struct {
	ID                string       `json:"id"`
	Instance          string       `json:"instance"`
	Kind              string       `json:"kind"`
	Name              string       `json:"name,omitempty"`
	Target            string       `json:"target"`
	Via               string       `json:"via"`
	Match             string       `json:"match,omitempty"`
	Outcome           form.Outcome `json:"outcome"`
	Reason            form.Reason  `json:"reason,omitempty"`
	Facts             int          `json:"facts"`
	Endpoints         []string     `json:"endpoints,omitempty"`
	Evidence          []string     `json:"evidence,omitempty"`
	MatchesNoInstance bool         `json:"matches_no_instance,omitempty"`
	FactIDs           []string     `json:"-"`
}

// outcomeNotEvaluated is the outcome of a Policy on an architecture the
// check could not evaluate.
const outcomeNotEvaluated = "not_evaluated"

func (s explainService) explainPolicy(options cli.ExplainOptions) error {
	result, resultName, err := s.readResult(options.Result)
	if err != nil {
		return err
	}
	id, err := resultPolicy(result, options.Name, resultName)
	if err != nil {
		return err
	}
	architectures, err := resultArchitectures(result, options.Side, resultName)
	if err != nil {
		return err
	}
	view := policyExplanation{Policy: id, Form: result.Form, Scope: result.Scope, Architectures: []explainedPolicyArchitecture{}, Diagnostics: append([]policyresult.Diagnostic{}, result.Diagnostics...)}
	var decoded *form.Form
	inputName := ""
	if options.Input != "" {
		loaded, err := s.loadInput(options)
		if err != nil {
			return err
		}
		if err := matchResultForm(result, loaded, resultName); err != nil {
			return err
		}
		decoded, inputName, view.InputEvidence = &loaded.result.Decoded, loaded.name, true
	}
	for _, a := range architectures {
		view.Architectures = append(view.Architectures, explainPolicyArchitecture(id, a, decoded))
	}
	// A Policy the check could not evaluate has no outcome to explain; the
	// recorded failure is still shown, and the status says no answer exists.
	answered := len(view.Architectures) > 0
	for _, a := range view.Architectures {
		if a.Outcome == outcomeNotEvaluated {
			answered = false
		}
	}
	if options.Format == cli.FormatJSON {
		if err := s.writeJSON(view); err != nil {
			return err
		}
	} else if err := paged(s.stdout, s.stderr, func(w io.Writer) {
		policyExplanationReport(view, resultName, options.Result, inputName, options.Details).writeText(w)
	}); err != nil {
		return errExplanationNotWritten
	}
	if !answered {
		return cli.RunError{Code: cli.ExitNoAnswer}
	}
	return nil
}

// readResult reads and validates a Policy result. It evaluates nothing.
func (s explainService) readResult(path string) (policyresult.Result, string, error) {
	name := path
	var data []byte
	if path == "-" {
		name = "standard input"
		read, err := io.ReadAll(s.stdin)
		if err != nil {
			return policyresult.Result{}, name, cli.RunError{Code: cli.ExitFailure, Message: "RESULT_UNREADABLE: standard input could not be read"}
		}
		data = read
	} else {
		info, err := os.Stat(path)
		switch {
		case err != nil:
			return policyresult.Result{}, name, cli.RunError{Code: cli.ExitFailure, Message: fmt.Sprintf("RESULT_UNREADABLE: result %q could not be read", path)}
		case info.IsDir():
			return policyresult.Result{}, name, cli.RunError{Code: cli.ExitUsage, Message: fmt.Sprintf("--result %q is a directory; name the Policy result file that check wrote", path)}
		case !info.Mode().IsRegular():
			return policyresult.Result{}, name, cli.RunError{Code: cli.ExitUsage, Message: fmt.Sprintf("RESULT_UNREADABLE: result %q must be a regular file", path)}
		}
		read, err := os.ReadFile(path)
		if err != nil {
			return policyresult.Result{}, name, cli.RunError{Code: cli.ExitFailure, Message: fmt.Sprintf("RESULT_UNREADABLE: result %q could not be read", path)}
		}
		data = read
	}
	result, err := policyresult.Decode(data)
	if err != nil {
		return policyresult.Result{}, name, cli.RunError{Code: cli.ExitNoAnswer, Message: fmt.Sprintf("RESULT_INVALID: %s is not a Policy result: %s\n\nA Policy result is the JSON that check writes:\n  rootform check INPUT -o results.json", name, err.Error())}
	}
	return result, name, nil
}

// resultPolicy resolves a Policy name against the Policies a result
// selected: its identity, PACK/NAME, or a bare name that names exactly one.
func resultPolicy(result policyresult.Result, query, resultName string) (string, error) {
	ids := result.Selection.Policies
	if len(ids) == 0 {
		if result.Status == policyresult.StatusFailed {
			reason := "the check stopped before it selected a Policy"
			if len(result.Diagnostics) > 0 {
				reason += ": " + safeText(result.Diagnostics[0].Message)
			}
			return "", cli.RunError{Code: cli.ExitNoAnswer, Message: fmt.Sprintf("%s records no Policy outcome; %s", resultName, reason)}
		}
		return "", cli.RunError{Code: cli.ExitNegative, Message: fmt.Sprintf("%s records no selected Policy", resultName)}
	}
	wanted := policyIdentity(query)
	for _, id := range ids {
		if id == wanted {
			return id, nil
		}
	}
	matches := []string{}
	if !strings.ContainsAny(query, "./") {
		for _, id := range ids {
			if strings.HasSuffix(id, ".policy."+query) {
				matches = append(matches, id)
			}
		}
	}
	switch len(matches) {
	case 1:
		return matches[0], nil
	case 0:
		return "", cli.RunError{Code: cli.ExitNegative, Message: fmt.Sprintf("%s records no Policy named %q\n\nIt records:\n%s", resultName, query, policyList(ids))}
	}
	return "", cli.RunError{Code: cli.ExitNoAnswer, Message: fmt.Sprintf("%q names more than one Policy in %s; use <policy-pack>.policy.<name>\n\nIt could be any of:\n%s", query, resultName, policyList(matches))}
}

func policyList(ids []string) string {
	lines := []string{}
	for i, id := range ids {
		if i == reportTextLimit {
			lines = append(lines, fmt.Sprintf("  %d of %d Policies shown.", i, len(ids)))
			break
		}
		lines = append(lines, "  "+safeText(id))
	}
	return strings.Join(lines, "\n")
}

// resultArchitectures keeps the side --side names, or every recorded side.
func resultArchitectures(result policyresult.Result, side, resultName string) ([]policyresult.Architecture, error) {
	if side == "" {
		return result.Architectures, nil
	}
	recorded := []string{}
	for _, a := range result.Architectures {
		if a.Side == "" {
			return nil, cli.RunError{Code: cli.ExitUsage, Message: fmt.Sprintf("--side selects a side of a comparison; %s records the check of a %s Form", resultName, safeText(a.Kind))}
		}
		if a.Side == side {
			return []policyresult.Architecture{a}, nil
		}
		recorded = append(recorded, titleWord(a.Side))
	}
	words := "no side"
	if len(recorded) > 0 {
		words = "only the " + strings.Join(recorded, " and ") + " side"
	}
	headline := fmt.Sprintf("%s records no %s side; it records %s", resultName, titleWord(side), words)
	return nil, technicalError(cli.ExitNoAnswer, "SIDE_UNAVAILABLE", "SIDE_UNAVAILABLE: "+headline,
		headline, "")
}

// matchResultForm accepts an input only when it is the Form the result was
// computed from, so its evidence can never describe another evaluation.
func matchResultForm(result policyresult.Result, loaded operand, resultName string) error {
	if result.Form == nil || result.Form.Digest == "" {
		headline := fmt.Sprintf("%s records no Form, so no input can describe its evidence", resultName)
		return technicalError(cli.ExitNoAnswer, "FORM_MISMATCH", "FORM_MISMATCH: "+headline,
			headline, "")
	}
	digest, err := form.Digest(loaded.result.Decoded)
	if err != nil {
		return cli.RunError{Code: cli.ExitNoAnswer, Message: "DOCUMENT_INVALID: the Form failed validation"}
	}
	if digest != result.Form.Digest {
		headline := fmt.Sprintf("%s is not the Form %s was computed from", loaded.name, resultName)
		body := fmt.Sprintf("  Result  %s\n  Input   %s\n\nPass the saved Form that check read, or an export compiled with the same\nDialects and rootform version.", safeText(result.Form.Digest), digest)
		return technicalError(cli.ExitNoAnswer, "FORM_MISMATCH",
			"FORM_MISMATCH: "+headline+"\n\n"+body, headline, body)
	}
	return nil
}

// explainPolicyArchitecture reads one architecture of the result for one
// Policy. With the Form, it also describes each inspected fact and closure.
func explainPolicyArchitecture(id string, a policyresult.Architecture, decoded *form.Form) explainedPolicyArchitecture {
	out := explainedPolicyArchitecture{Side: a.Side, Kind: a.Kind, Stage: a.Stage, Digest: a.Digest, Outcome: outcomeNotEvaluated, Evaluations: []explainedEvaluation{}, Diagnostics: []policyresult.Diagnostic{}}
	if a.Status != policyresult.StatusFailed {
		for i := range a.Policies {
			if a.Policies[i].ID == id {
				p := a.Policies[i]
				out.Result, out.Outcome = &p, string(p.Outcome)
			}
		}
	}
	for _, d := range a.Diagnostics {
		if d.Policy == "" || d.Policy == id {
			out.Diagnostics = append(out.Diagnostics, d)
		}
	}
	var index *evidenceIndex
	if decoded != nil {
		if side, err := form.Select(*decoded, a.Stage, a.Side); err == nil {
			if stage := side.Form.Stages[a.Stage]; stage != nil {
				index = newEvidenceIndex(&side.Form, stage)
			}
		}
	}
	for _, e := range a.Evaluations {
		if e.Policy != id {
			continue
		}
		explained := explainedEvaluation{Evaluation: e}
		if index != nil {
			explained = index.describe(e)
		}
		out.Evaluations = append(out.Evaluations, explained)
	}
	rank := map[policyresult.Outcome]int{policyresult.OutcomeViolated: 0, policyresult.OutcomeIndeterminate: 1, policyresult.OutcomePassed: 2}
	sort.SliceStable(out.Evaluations, func(i, j int) bool {
		x, y := out.Evaluations[i], out.Evaluations[j]
		if rank[x.Outcome] != rank[y.Outcome] {
			return rank[x.Outcome] < rank[y.Outcome]
		}
		return x.Address < y.Address
	})
	return out
}

// evidenceIndex names the facts and closures of one stage by identity.
type evidenceIndex struct {
	names           map[string]string
	facts           map[string]inspectedFact
	closures        map[string]form.Closure
	emissions       map[string]form.Emission
	interpretations map[string]*form.Interpretation
}

func newEvidenceIndex(inputForm *form.InputForm, a *form.Architecture) *evidenceIndex {
	names, _ := stageNames(a)
	index := &evidenceIndex{names: names, facts: map[string]inspectedFact{}, closures: map[string]form.Closure{}, emissions: map[string]form.Emission{}, interpretations: map[string]*form.Interpretation{}}
	add := func(id, kind, name, from, to string, provenance []form.FactProvenance) {
		f := inspectedFact{ID: id, Kind: kind, Name: name, From: names[from], To: names[to], Evidence: []string{}, Rules: []string{}}
		for _, p := range provenance {
			f.Evidence = append(f.Evidence, string(p.Evidence))
			f.Rules = append(f.Rules, p.Rule)
		}
		f.Evidence, f.Rules = unique(f.Evidence), unique(f.Rules)
		index.facts[id] = f
	}
	for _, x := range a.Relations {
		add(x.ID, "relation", shortName(x.Predicate), x.From, x.To, x.Provenance)
	}
	for _, x := range a.Contexts {
		add(x.ID, "context", shortName(x.Dimension), x.From, x.To, x.Provenance)
	}
	for _, x := range a.Contributions {
		add(x.ID, "contribution", "", x.From, x.To, x.Provenance)
	}
	for _, c := range a.Closures {
		index.closures[c.ID] = c
	}
	for _, e := range inputForm.Semantics.Emissions {
		index.emissions[e.ID] = e
	}
	for _, r := range a.Representations {
		if r.Interpretation != nil && r.Interpretation.Status != form.InterpretationApplied {
			index.interpretations[r.ID] = r.Interpretation
		}
	}
	return index
}

// describe states what one evaluation inspected, from the Form it was
// computed from, and why no query ran when the evaluated instance went
// uninterpreted. It reads recorded evidence and evaluates nothing.
func (x *evidenceIndex) describe(e policyresult.Evaluation) explainedEvaluation {
	out := explainedEvaluation{Evaluation: e}
	if v, ok := x.interpretations[e.Target]; ok && len(e.InspectedFacts)+len(e.InspectedClosures) == 0 {
		out.InterpretationReason = policyresult.InterpretationReason(v)
	}
	facts := []inspectedFact{}
	for _, id := range e.InspectedFacts {
		if f, ok := x.facts[id]; ok {
			facts = append(facts, f)
		}
	}
	closures := []inspectedClosure{}
	for _, id := range e.InspectedClosures {
		c, ok := x.closures[id]
		if !ok {
			continue
		}
		d := closureOf(c, x.emissions[c.Emission])
		inspected := inspectedClosure{ID: id, Instance: x.names[c.Representation], Kind: d.Kind, Name: d.Name, Target: d.Target, Via: d.Via, Match: d.Match, Outcome: c.Outcome, Reason: c.Reason, Facts: d.Facts, MatchesNoInstance: policyresult.MatchesNoInstance(c), FactIDs: c.Facts}
		for _, fact := range c.Facts {
			if f, ok := x.facts[fact]; ok {
				inspected.Endpoints = append(inspected.Endpoints, f.To)
				inspected.Evidence = append(inspected.Evidence, f.Evidence...)
			}
		}
		inspected.Endpoints, inspected.Evidence = unique(inspected.Endpoints), unique(inspected.Evidence)
		closures = append(closures, inspected)
	}
	out.Facts, out.Closures = facts, closures
	return out
}

// policyExplanationReport lays the explanation out as a check summary of one
// Policy, so both commands read alike: the requirement the Policy declares,
// then per evaluation the evidence the result records and the conclusion it
// supports. resultPath is the --result the user typed.
func policyExplanationReport(view policyExplanation, resultName, resultPath, inputName string, details bool) checkReport {
	rep := checkReport{title: "Policy explained"}
	rep.head = [][2]string{{"Policy", view.Policy}, {"Result", resultName}}
	if inputName != "" {
		rep.head = append(rep.head, [2]string{"Input", inputName})
	}
	for _, a := range view.Architectures {
		if a.Result != nil {
			if a.Result.Message != "" {
				rep.requirement = []string{a.Result.Message}
			}
			if a.Result.Assertion != "" {
				rep.requirementRows = append(rep.requirementRows, [2]string{"Assertion", a.Result.Assertion})
			}
			rep.requirementRows = append(rep.requirementRows, [2]string{"Target", targetWords(a.Result.Target)})
			break
		}
	}
	switch len(view.Architectures) {
	case 0:
		rep.verdict = [2]string{"Outcome", outcomeWord(outcomeNotEvaluated)}
		rep.status = policyresult.StatusFailed
		rep.sides = []checkSide{{sections: []checkSection{failedSection(view.Diagnostics, details)}}}
	case 1:
		a := view.Architectures[0]
		if a.Side != "" {
			rep.head = append(rep.head, [2]string{"Side", titleWord(a.Side)})
		}
		origin := titleWord(a.Kind)
		if view.Form != nil && view.Form.Origin == "saved" && a.Side == "" {
			origin += " (saved Form)"
		}
		rep.head = append(rep.head, [2]string{"Origin", origin}, [2]string{"Stage", stageWords(a.Stage)})
		if a.Result != nil {
			counts := policyCounts(a)
			labels := []string{"Evaluations", "Passed", "Violated", "Indeterminate", "Coverage"}
			for i, label := range labels {
				rep.counts = append(rep.counts, [2]string{label, counts[i]})
			}
		}
		rep.verdict = [2]string{"Outcome", outcomeWord(a.Outcome)}
		rep.status = outcomeStatus(a.Outcome)
		rep.sides = []checkSide{policyExplanationSide("", a, details, view.InputEvidence)}
	default:
		rep.head = append(rep.head, [2]string{"Scope", "Both sides"})
		labels := []string{"Origin", "Stage", "Evaluations", "Passed", "Violated", "Indeterminate", "Coverage", "Outcome"}
		for _, label := range labels {
			rep.table = append(rep.table, []string{label})
		}
		for _, a := range view.Architectures {
			rep.columns = append(rep.columns, titleWord(a.Side))
			values := []string{titleWord(a.Kind), stageWords(a.Stage), "-", "-", "-", "-", "-", outcomeWord(a.Outcome)}
			if a.Result != nil {
				copy(values[2:7], policyCounts(a))
			}
			for i := range labels {
				rep.table[i] = append(rep.table[i], values[i])
			}
			rep.sides = append(rep.sides, policyExplanationSide(titleWord(a.Side), a, details, view.InputEvidence))
		}
	}
	if !view.InputEvidence {
		for _, a := range view.Architectures {
			if len(a.Evaluations) > 0 {
				rep.tail = evidenceHint(view.Policy, resultPath, view.Form)
				break
			}
		}
	}
	return rep
}

// evidenceHint says what describes the evidence a result only identifies,
// and how to pass it: the saved Form check read, or the export it compiled.
func evidenceHint(policyID, resultPath string, identity *policyresult.FormIdentity) []string {
	result := "RESULT"
	if resultPath != "-" {
		result = shellQuote(resultPath)
	}
	source := "the saved Form check read"
	if identity != nil && identity.Origin == "compiled" {
		source = "the export check compiled, or the Form saved from it,"
	}
	return []string{
		"The result identifies the evidence each evaluation inspected; the Form it was computed from describes it. To show that evidence, pass " + source + " as --input:",
		"  rootform explain policy " + shellQuote(policyID) + " --result " + result + " --input INPUT",
	}
}

// policyCounts counts one Policy's evaluations on one architecture and states
// its coverage: evaluations, passed, violated, indeterminate, coverage.
func policyCounts(a explainedPolicyArchitecture) []string {
	passed, violated, indeterminate := 0, 0, 0
	for _, e := range a.Evaluations {
		switch e.Outcome {
		case policyresult.OutcomePassed:
			passed++
		case policyresult.OutcomeViolated:
			violated++
		case policyresult.OutcomeIndeterminate:
			indeterminate++
		}
	}
	coverage := "Complete"
	if !a.Result.Complete {
		coverage = "Incomplete: " + reasonWords(a.Result.Reasons)
	}
	return []string{fmt.Sprint(len(a.Evaluations)), fmt.Sprint(passed), fmt.Sprint(violated), fmt.Sprint(indeterminate), coverage}
}

func policyExplanationSide(title string, a explainedPolicyArchitecture, details, evidence bool) checkSide {
	side := checkSide{title: title}
	if a.Outcome == outcomeNotEvaluated {
		side.sections = append(side.sections, failedSection(a.Diagnostics, details))
		return side
	}
	place := placeWords(a.Stage, a.Side)
	violated := checkSection{title: "VIOLATED", status: human.Bad}
	indeterminate := checkSection{title: "INDETERMINATE", status: human.Warn}
	passed := checkSection{title: "PASSED", status: human.Good}
	for _, e := range a.Evaluations {
		resource := e.Address
		if resource == "" {
			resource = e.Target
		}
		recorded := []string{inspectedWords(e.Evaluation)}
		if evidence {
			recorded = evidenceLines(e, details)
			if len(recorded) == 0 {
				recorded = []string{noEvidence}
			}
		}
		entry := checkEntry{heading: resource, blocks: []entryBlock{
			{title: "Recorded evidence", lines: recorded},
			{title: "Conclusion", lines: []string{evaluationConclusion(e, place, evidence)}},
		}}
		switch e.Outcome {
		case policyresult.OutcomeViolated:
			violated.entries = append(violated.entries, entry)
		case policyresult.OutcomeIndeterminate:
			indeterminate.entries = append(indeterminate.entries, entry)
		default:
			passed.entries = append(passed.entries, entry)
		}
	}
	sections := []checkSection{violated, indeterminate}
	if details {
		sections = append(sections, passed)
	}
	for _, section := range sections {
		if len(section.entries) > 0 {
			side.sections = append(side.sections, section)
		}
	}
	switch {
	case a.Outcome == string(policyresult.PolicyNoTarget):
		side.lines = append(side.lines, "No instance matches the Policy target at this stage.")
	case len(side.sections) == 0 && len(a.Evaluations) == 1:
		side.lines = append(side.lines, "The evaluation passed.")
	case len(side.sections) == 0 && len(a.Evaluations) > 1:
		side.lines = append(side.lines, fmt.Sprintf("All %d evaluations passed.", len(a.Evaluations)))
	}
	if a.Result != nil && !a.Result.Complete {
		side.lines = append(side.lines, "Coverage is incomplete ("+strings.ToLower(reasonWords(a.Result.Reasons))+"): instances the evidence does not settle could also match the target, so the outcome cannot be PASSED.")
	}
	return side
}

// outcomeWord states one Policy outcome as a verdict word.
func outcomeWord(outcome string) string {
	switch outcome {
	case string(policyresult.PolicyPassed):
		return "PASSED"
	case string(policyresult.PolicyViolated):
		return "VIOLATED"
	case string(policyresult.PolicyIndeterminate):
		return "INDETERMINATE"
	case string(policyresult.PolicyNoTarget):
		return "NO TARGET"
	}
	return "NOT EVALUATED"
}

func outcomeStatus(outcome string) policyresult.Status {
	switch outcome {
	case string(policyresult.PolicyPassed):
		return policyresult.StatusPassed
	case string(policyresult.PolicyViolated):
		return policyresult.StatusViolated
	case string(policyresult.PolicyIndeterminate):
		return policyresult.StatusIndeterminate
	case string(policyresult.PolicyNoTarget):
		return policyresult.StatusNoDecision
	}
	return policyresult.StatusFailed
}
