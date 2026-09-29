package app

import (
	"fmt"
	"sort"
	"strings"

	"github.com/rootform-dev/rootform/cli/policyresult"
)

// checkPreview ends a check review whose lists show a preview.
const checkPreview = "Each list above shows at most 10 evaluations, each with at most 5 evidence lines. A report written with `--details` lists every evaluation and evidence line."

// checkMarkdown renders a Policy result as a review document: the verdict
// with the architecture it covers and the counts or, when the check covers
// several sides, the overall verdict, the evaluation scope and a table of
// each side's stage, counts and verdict; then for each side the Policies that
// need attention, each stating its requirement once and, per evaluation, the
// resource and the evidence the result records, then the coverage limits and
// the provenance. It states the statuses the result records; it evaluates
// and recomputes nothing.
func checkMarkdown(r policyresult.Result, run *checkRun) []byte {
	o := run.options
	v := &review{}
	v.heading(2, "Rootform Policies")
	if len(r.Architectures) == 0 {
		v.paragraph(strong("NOT EVALUATED: the Policy check did not complete."))
		if n := len(r.Selection.Policies); n > 0 {
			v.paragraph(mdText(policiesSelected(n) + "."))
		}
		writeNotEvaluated(v, 3, r.Diagnostics, o.Details)
	} else {
		indexes := run.evidence()
		if len(r.Architectures) == 1 {
			a := r.Architectures[0]
			v.paragraph(strong(verdictWord(r.Status) + ": " + architectureWords(a)))
			v.paragraph(mdText(checkCounts(len(r.Selection.Policies), a)))
			writeCheckSide(v, 3, a, indexes[a.Side], o.Details, false)
		} else {
			v.paragraph(strong("Overall verdict: " + verdictWord(r.Status)))
			v.paragraph("Evaluation scope: " + strong(scopeWords(r)) + ". " + mdText(policiesSelected(len(r.Selection.Policies))+"."))
			writeSidesTable(v, r.Architectures)
			for _, a := range r.Architectures {
				v.heading(3, mdText(titleWord(a.Side)))
				writeCheckSide(v, 4, a, indexes[a.Side], o.Details, true)
			}
		}
	}
	v.heading(3, "Provenance")
	rows := [][2]string{{"Input", inputWords(o.Input)}}
	if len(r.Architectures) == 1 {
		a := r.Architectures[0]
		if a.Side != "" {
			rows = append(rows, [2]string{"Side", titleWord(a.Side)})
		}
		rows = append(rows, [2]string{"Origin", originLabel(r.Form, a)})
	}
	if o.Details && len(r.Architectures) > 0 {
		rows = append(rows, [2]string{"Policy Packs", packIdentities(r.Architectures)})
	}
	v.rows(rows, map[string]bool{"Input": o.Input != "-"})
	if v.truncated {
		v.paragraph(checkPreview)
	}
	return v.bytes()
}

// architectureWords names the one architecture a check evaluated: its stage,
// and its side when it is one side of a comparison Form.
func architectureWords(a policyresult.Architecture) string {
	words := stageWords(a.Stage) + " architecture"
	if a.Side != "" {
		words += " of the " + titleWord(a.Side) + " side"
	}
	return words
}

// scopeWords names the sides a check of several architectures evaluated, as
// the result records its scope. Each side's stage is stated by the sides
// table, never folded into these words.
func scopeWords(r policyresult.Result) string {
	if r.Scope == policyresult.ScopeBoth {
		return "Both sides"
	}
	sides := make([]string, len(r.Architectures))
	for i, a := range r.Architectures {
		sides[i] = titleWord(a.Side)
	}
	return joinWords(sides) + " sides"
}

func policiesSelected(n int) string {
	switch n {
	case 0:
		return "No Policy selected"
	case 1:
		return "1 Policy selected"
	}
	return fmt.Sprintf("%d Policies selected", n)
}

// checkCounts states the selected Policies and the evaluations of one
// architecture by outcome.
func checkCounts(policies int, a policyresult.Architecture) string {
	words := policiesSelected(policies) + "."
	if a.Status == policyresult.StatusFailed {
		return words
	}
	e := a.Summary.Evaluations
	var parts []string
	for _, outcome := range []struct {
		count int
		word  string
	}{{e.Violated, "violated"}, {e.Indeterminate, "indeterminate"}, {e.Passed, "passed"}} {
		if outcome.count > 0 {
			parts = append(parts, fmt.Sprintf("%d %s", outcome.count, outcome.word))
		}
	}
	evaluations := countWithNoun(e.Total, "evaluation", "evaluations")
	if e.Total == 0 {
		evaluations = "No evaluation"
	}
	switch len(parts) {
	case 0:
		return words + " " + evaluations + "."
	case 1:
		if e.Violated+e.Indeterminate+e.Passed == e.Total {
			return words + " " + evaluations + " " + parts[0][len(fmt.Sprint(e.Total))+1:] + "."
		}
	}
	return words + " " + evaluations + ": " + joinWords(parts) + "."
}

// writeSidesTable states each evaluated side: where it comes from, its stage,
// its evaluations by outcome and the verdict the result records for it.
func writeSidesTable(v *review, architectures []policyresult.Architecture) {
	header := []string{""}
	labels := []string{"Origin", "Stage", "Evaluations", "Passed", "Violated", "Indeterminate", "Verdict"}
	rows := make([][]string, len(labels))
	for i, label := range labels {
		rows[i] = []string{mdText(label)}
	}
	for _, a := range architectures {
		header = append(header, mdText(titleWord(a.Side)))
		values := []string{originLabel(nil, a), stageWords(a.Stage), "-", "-", "-", "-", verdictWord(a.Status)}
		if a.Status != policyresult.StatusFailed {
			e := a.Summary.Evaluations
			values[2], values[3], values[4], values[5] = fmt.Sprint(e.Total), fmt.Sprint(e.Passed), fmt.Sprint(e.Violated), fmt.Sprint(e.Indeterminate)
		}
		for i := range labels {
			rows[i] = append(rows[i], mdText(values[i]))
		}
	}
	v.grid(header, false, rows)
}

// policyEvaluations are the evaluations of one Policy on one architecture, by
// outcome, and the requirement the Policy declares.
type policyEvaluations struct {
	id          string
	requirement string
	outcomes    map[policyresult.Outcome][]policyresult.Evaluation
}

// policyGroups groups the evaluations of an architecture by Policy: Policies
// with a violated evaluation first, then those with an indeterminate one,
// then the others, each group by Policy identity.
func policyGroups(a policyresult.Architecture) []*policyEvaluations {
	byID := map[string]*policyEvaluations{}
	var groups []*policyEvaluations
	for _, e := range sortedEvaluations(a.Evaluations) {
		g := byID[e.Policy]
		if g == nil {
			g = &policyEvaluations{id: e.Policy, requirement: evaluationMessage(policyresult.Evaluation{Policy: e.Policy}, a), outcomes: map[policyresult.Outcome][]policyresult.Evaluation{}}
			if g.requirement == "" {
				g.requirement = e.Message
			}
			byID[e.Policy] = g
			groups = append(groups, g)
		}
		g.outcomes[e.Outcome] = append(g.outcomes[e.Outcome], e)
	}
	rank := func(g *policyEvaluations) int {
		switch {
		case len(g.outcomes[policyresult.OutcomeViolated]) > 0:
			return 0
		case len(g.outcomes[policyresult.OutcomeIndeterminate]) > 0:
			return 1
		}
		return 2
	}
	sort.SliceStable(groups, func(i, j int) bool { return rank(groups[i]) < rank(groups[j]) })
	return groups
}

// writeCheckSide writes what one architecture needs a reader to act on: each
// Policy with violated or indeterminate evaluations, and passed ones with
// --details, then the Policies whose coverage is incomplete and those without
// target. level is the heading level of its parts.
func writeCheckSide(v *review, level int, a policyresult.Architecture, index *evidenceIndex, details, sides bool) {
	if a.Status == policyresult.StatusFailed {
		writeNotEvaluated(v, level, a.Diagnostics, details)
		return
	}
	wrote := false
	outcomes := []policyresult.Outcome{policyresult.OutcomeViolated, policyresult.OutcomeIndeterminate}
	if details {
		outcomes = append(outcomes, policyresult.OutcomePassed)
	}
	for _, g := range policyGroups(a) {
		listed := false
		for _, outcome := range outcomes {
			listed = listed || len(g.outcomes[outcome]) > 0
		}
		if !listed {
			continue
		}
		wrote = true
		v.heading(level, mdCode(g.id))
		if g.requirement != "" {
			v.paragraph("**Requirement:** " + mdText(g.requirement))
		}
		for _, outcome := range outcomes {
			writeEvaluations(v, titleWord(string(outcome)), g.outcomes[outcome], g.requirement, a, index, details)
		}
	}
	var coverage, noTarget []string
	for _, p := range a.Policies {
		if !p.Complete {
			coverage = append(coverage, mdCode(p.ID)+": "+mdText(countWithNoun(p.Targets, "instance", "instances")+" evaluated; coverage is incomplete ("+reasonWords(p.Reasons)+")."))
		}
		if p.Outcome == policyresult.PolicyNoTarget {
			noTarget = append(noTarget, mdCode(p.ID)+": "+mdText("no instance matches its target ("+targetWords(p.Target)+")."))
		}
	}
	for _, section := range []struct {
		title string
		items []string
	}{{"Incomplete coverage", coverage}, {"Without target", noTarget}} {
		if len(section.items) == 0 {
			continue
		}
		wrote = true
		v.heading(level, section.title)
		for _, item := range section.items {
			v.item(0, item)
		}
		v.endList()
	}
	if !wrote && sides {
		switch {
		case a.Status == policyresult.StatusPassed:
			v.paragraph("All selected evaluations passed.")
		case a.Summary.Policies.Selected == 0:
			v.paragraph("No Policy is selected.")
		}
	}
}

// writeEvaluations lists the evaluations of one Policy with one outcome: at
// most checkEntryLimit of them unless --details asks for all, folded when
// --details lists more.
func writeEvaluations(v *review, outcome string, evaluations []policyresult.Evaluation, requirement string, a policyresult.Architecture, index *evidenceIndex, details bool) {
	if len(evaluations) == 0 {
		return
	}
	shown := evaluations
	if !details && len(shown) > checkEntryLimit {
		shown = shown[:checkEntryLimit]
		v.truncated = true
	}
	title := outcome + ": " + countWithNoun(len(evaluations), "evaluation", "evaluations")
	if len(shown) < len(evaluations) {
		title = fmt.Sprintf("%s: %d of %d evaluations shown", outcome, len(shown), len(evaluations))
	}
	fold := len(shown) > checkEntryLimit
	if fold {
		v.fold(title)
	} else {
		v.paragraph(strong(title))
	}
	for _, e := range shown {
		writeEvaluation(v, e, requirement, a, index, details)
	}
	v.endList()
	if fold {
		v.unfold()
	}
}

// writeEvaluation states one evaluation: its resource, a requirement that
// differs from its Policy's, and the evidence the result records, with a
// reason only for a limit that evidence does not state.
func writeEvaluation(v *review, e policyresult.Evaluation, requirement string, a policyresult.Architecture, index *evidenceIndex, details bool) {
	resource := e.Address
	if resource == "" {
		resource = e.Target
	}
	var lines []string
	if message := evaluationMessage(e, a); message != "" && message != requirement {
		lines = append(lines, "Requirement: "+mdText(message))
	}
	switch {
	case index != nil:
		described := index.describe(e)
		evidence, cut := previewEvidence(evidenceSentences(described, details), details)
		v.truncated = v.truncated || cut
		lines = append(lines, evidence...)
		if reasons := unstatedReasons(described); len(reasons) > 0 {
			lines = append(lines, "Reason: "+mdText(sentence(joinWords(reasons)))+".")
		}
	case e.Outcome == policyresult.OutcomeIndeterminate:
		lines = append(lines, "Reason: "+mdText(sentence(reasonWords(e.Reasons)))+".")
	}
	switch len(lines) {
	case 0:
		v.item(0, mdCode(resource))
	case 1:
		v.item(0, mdCode(resource)+": "+lines[0])
	default:
		v.item(0, mdCode(resource))
		for _, line := range lines {
			v.item(1, line)
		}
	}
}

// previewEvidence keeps the first reportFactLimit evidence lines of an
// evaluation, and says how many it shows, unless details asks for every line.
func previewEvidence(lines []string, details bool) ([]string, bool) {
	if details || len(lines) <= reportFactLimit {
		return lines, false
	}
	return append(lines[:reportFactLimit:reportFactLimit], mdText(fmt.Sprintf("%d of %d evidence lines shown.", reportFactLimit, len(lines)))), true
}

// writeNotEvaluated lists why a check, or one side of it, could not be
// evaluated; --details adds the diagnostic codes.
func writeNotEvaluated(v *review, level int, diagnostics []policyresult.Diagnostic, details bool) {
	v.heading(level, "Not evaluated")
	shown := diagnostics
	if !details && len(shown) > checkEntryLimit {
		shown = shown[:checkEntryLimit]
		v.truncated = true
	}
	for _, d := range shown {
		line := mdText(closed(sentence(d.Message)))
		if details && d.Code != "" {
			line += " (" + mdCode(d.Code) + ")"
		}
		v.item(0, line)
	}
	v.endList()
	if len(shown) < len(diagnostics) {
		v.paragraph(mdText(shownWords(len(shown), len(diagnostics)) + "."))
	}
}

// closed ends a sentence with a period unless it already ends with one.
func closed(words string) string {
	if strings.HasSuffix(words, ".") || strings.HasSuffix(words, "?") || strings.HasSuffix(words, "!") {
		return words
	}
	return words + "."
}
