package app

import (
	"fmt"
	"io"
	"sort"
	"strings"
	"unicode"
	"unicode/utf8"

	"github.com/rootform-dev/rootform/cli/internal/human"
	"github.com/rootform-dev/rootform/cli/policyresult"
)

// A Markdown check review lists at most checkEntryLimit evaluations per
// outcome unless --details asks for all of them; the text summary lists every
// entry.
const checkEntryLimit = 10

// checkEntry is one listed outcome. Values marked code are untrusted text
// shown literally: a Policy identity, an address or a target. A row without
// a label continues the row above it. An explanation entry names its
// instance in heading and states its evidence and conclusion in blocks.
type checkEntry struct {
	fields  [][2]string
	code    map[string]bool
	heading string
	blocks  []entryBlock
}

// entryBlock is one titled part of an explanation entry.
type entryBlock struct {
	title string
	lines []string
}

// checkSection is one outcome of one architecture, such as its violated
// evaluations.
type checkSection struct {
	title   string
	status  human.Status
	entries []checkEntry
}

// checkSide is the detail of one architecture; title names its side of a
// comparison Form and stays empty for a single architecture.
type checkSide struct {
	title    string
	sections []checkSection
	lines    []string
}

// checkReport is the human summary of one Policy result. Every fact comes
// from the result and the Form it evaluated; nothing is recompiled, reread
// or evaluated again. An explanation also states the Policy's requirement,
// and tail closes it with what could describe it further.
type checkReport struct {
	title           string
	head            [][2]string
	counts          [][2]string
	columns         []string
	table           [][]string
	verdict         [2]string
	status          policyresult.Status
	requirement     []string
	requirementRows [][2]string
	sides           []checkSide
	tail            []string
}

// buildCheckReport designs the text summary of one result. It lists every
// entry; --details adds passed evaluations, identities and codes.
func buildCheckReport(r policyresult.Result, run *checkRun) checkReport {
	o := run.options
	rep := checkReport{title: "Policy check completed", status: r.Status}
	indexes := run.evidence()
	rep.head = append(rep.head, [2]string{"Input", inputWords(o.Input)})
	if len(r.Architectures) == 0 {
		rep.title = "Policy check not completed"
		if n := len(r.Selection.Policies); n > 0 {
			rep.head = append(rep.head, [2]string{"Policies", fmt.Sprintf("%d selected", n)})
		}
		rep.verdict = [2]string{"Verdict", verdictWord(r.Status)}
		rep.sides = []checkSide{{sections: []checkSection{failedSection(r.Diagnostics, o.Details)}}}
		return rep
	}
	if len(r.Architectures) == 1 {
		a := r.Architectures[0]
		if a.Side != "" {
			rep.head = append(rep.head, [2]string{"Side", titleWord(a.Side)})
		}
		rep.head = append(rep.head, [2]string{"Origin", originLabel(r.Form, a)}, [2]string{"Stage", stageWords(a.Stage)}, [2]string{"Policies", selectedWords(len(r.Selection.Policies))})
		if o.Details {
			rep.head = append(rep.head, [2]string{"Policy Packs", packIdentities(r.Architectures)})
		}
		if a.Status != policyresult.StatusFailed {
			rep.counts = [][2]string{
				{"Evaluations", fmt.Sprint(a.Summary.Evaluations.Total)},
				{"Passed", fmt.Sprint(a.Summary.Evaluations.Passed)},
				{"Violated", fmt.Sprint(a.Summary.Evaluations.Violated)},
				{"Indeterminate", fmt.Sprint(a.Summary.Evaluations.Indeterminate)},
			}
		}
		rep.verdict = [2]string{"Verdict", verdictWord(r.Status)}
		rep.sides = []checkSide{architectureSide("", a, indexes[a.Side], o.Details)}
		return rep
	}
	rep.head = append(rep.head, [2]string{"Policies", selectedWords(len(r.Selection.Policies))}, [2]string{"Scope", "Both sides"})
	if o.Details {
		rep.head = append(rep.head, [2]string{"Policy Packs", packIdentities(r.Architectures)})
	}
	labels := []string{"Origin", "Stage", "Evaluations", "Passed", "Violated", "Indeterminate", "Verdict"}
	for _, label := range labels {
		rep.table = append(rep.table, []string{label})
	}
	for _, a := range r.Architectures {
		rep.columns = append(rep.columns, titleWord(a.Side))
		values := []string{originLabel(nil, a), stageWords(a.Stage), "-", "-", "-", "-", verdictWord(a.Status)}
		if a.Status != policyresult.StatusFailed {
			e := a.Summary.Evaluations
			values[2], values[3], values[4], values[5] = fmt.Sprint(e.Total), fmt.Sprint(e.Passed), fmt.Sprint(e.Violated), fmt.Sprint(e.Indeterminate)
		}
		for i := range labels {
			rep.table[i] = append(rep.table[i], values[i])
		}
		rep.sides = append(rep.sides, architectureSide(titleWord(a.Side), a, indexes[a.Side], o.Details))
	}
	rep.verdict = [2]string{"Overall verdict", verdictWord(r.Status)}
	return rep
}

// evidence indexes each architecture the check evaluated by its side, so the
// summary describes what every evaluation inspected.
func (run *checkRun) evidence() map[string]*evidenceIndex {
	indexes := map[string]*evidenceIndex{}
	for i := range run.targets {
		t := &run.targets[i]
		if t.refusal != nil {
			continue
		}
		if stage := t.form.Stages[t.stage]; stage != nil {
			indexes[t.side] = newEvidenceIndex(&t.form, stage)
		}
	}
	return indexes
}

// architectureSide lists what one architecture needs a reader to act on:
// violations, then what the evidence could not decide, then the Policies it
// could not apply. Passed evaluations appear only with --details. Each entry
// states the Policy's requirement apart from the evidence the evaluation
// inspected, which index describes from the evaluated Form.
func architectureSide(title string, a policyresult.Architecture, index *evidenceIndex, details bool) checkSide {
	side := checkSide{title: title}
	if a.Status == policyresult.StatusFailed {
		side.sections = append(side.sections, failedSection(a.Diagnostics, details))
		return side
	}
	violated := checkSection{title: "VIOLATED", status: human.Bad}
	indeterminate := checkSection{title: "INDETERMINATE", status: human.Warn}
	passed := checkSection{title: "PASSED", status: human.Good}
	for _, e := range sortedEvaluations(a.Evaluations) {
		resource := e.Address
		if resource == "" {
			resource = e.Target
		}
		fields := [][2]string{{"Policy", e.Policy}, {"Resource", resource}}
		if requirement := evaluationMessage(e, a); requirement != "" && e.Outcome != policyresult.OutcomePassed {
			fields = append(fields, [2]string{"Requirement", requirement})
		}
		var unstated []string
		if index != nil {
			described := index.describe(e)
			lines := evidenceLines(described, details)
			fields = append(fields, labeledLines("Evidence", lines)...)
			unstated = unstatedReasons(described)
		} else if e.Outcome == policyresult.OutcomeIndeterminate {
			unstated = []string{reasonWords(e.Reasons)}
		}
		if len(unstated) > 0 {
			fields = append(fields, [2]string{"Reason", sentence(strings.Join(unstated, "; ")) + "."})
		}
		entry := codeEntry(fields...)
		switch e.Outcome {
		case policyresult.OutcomeViolated:
			violated.entries = append(violated.entries, entry)
		case policyresult.OutcomeIndeterminate:
			indeterminate.entries = append(indeterminate.entries, entry)
		default:
			passed.entries = append(passed.entries, entry)
		}
	}
	coverage := checkSection{title: "INCOMPLETE COVERAGE", status: human.Warn}
	noTarget := checkSection{title: "WITHOUT TARGET", status: human.Unknown}
	for _, p := range a.Policies {
		if !p.Complete {
			coverage.entries = append(coverage.entries, codeEntry([2]string{"Policy", p.ID}, [2]string{"Evaluated", countWithNoun(p.Targets, "instance", "instances")}, [2]string{"Reason", sentence(reasonWords(p.Reasons))}))
		}
		if p.Outcome == policyresult.PolicyNoTarget {
			noTarget.entries = append(noTarget.entries, codeEntry([2]string{"Policy", p.ID}, [2]string{"Target", targetWords(p.Target)}))
		}
	}
	sections := []checkSection{violated, indeterminate, coverage, noTarget}
	if details {
		sections = append(sections, passed)
	}
	for _, section := range sections {
		if len(section.entries) > 0 {
			side.sections = append(side.sections, section)
		}
	}
	if len(side.sections) == 0 {
		switch {
		case a.Status == policyresult.StatusPassed:
			side.lines = append(side.lines, "All selected evaluations passed.")
		case a.Summary.Policies.Selected == 0:
			side.lines = append(side.lines, "No Policy is selected.")
		}
	}
	return side
}

func failedSection(diagnostics []policyresult.Diagnostic, details bool) checkSection {
	section := checkSection{title: "NOT EVALUATED", status: human.Bad}
	for _, d := range diagnostics {
		entry := codeEntry([2]string{"Reason", sentence(d.Message)})
		entry.code = map[string]bool{}
		if details {
			entry.fields = append(entry.fields, [2]string{"Code", d.Code})
			entry.code["Code"] = true
		}
		section.entries = append(section.entries, entry)
	}
	return section
}

// codeEntry builds an entry whose Policy, Resource and Target values are
// literal text.
func codeEntry(fields ...[2]string) checkEntry {
	entry := checkEntry{fields: fields, code: map[string]bool{}}
	for _, field := range fields {
		switch field[0] {
		case "Policy", "Resource":
			entry.code[field[0]] = true
		}
	}
	return entry
}

// evaluationMessage is the requirement a Policy declares, as its message
// states it.
func evaluationMessage(e policyresult.Evaluation, a policyresult.Architecture) string {
	if e.Message != "" {
		return e.Message
	}
	for _, p := range a.Policies {
		if p.ID == e.Policy && p.Message != "" {
			return p.Message
		}
	}
	return ""
}

func sortedEvaluations(evaluations []policyresult.Evaluation) []policyresult.Evaluation {
	ordered := append([]policyresult.Evaluation{}, evaluations...)
	sort.SliceStable(ordered, func(i, j int) bool {
		if ordered[i].Policy != ordered[j].Policy {
			return ordered[i].Policy < ordered[j].Policy
		}
		return ordered[i].Address < ordered[j].Address
	})
	return ordered
}

func verdictWord(status policyresult.Status) string {
	switch status {
	case policyresult.StatusPassed:
		return "PASSED"
	case policyresult.StatusViolated:
		return "VIOLATED"
	case policyresult.StatusIndeterminate:
		return "INDETERMINATE"
	case policyresult.StatusNoDecision:
		return "NO DECISION"
	}
	return "NOT EVALUATED"
}

func verdictStatus(status policyresult.Status) human.Status {
	switch status {
	case policyresult.StatusPassed:
		return human.Good
	case policyresult.StatusViolated, policyresult.StatusFailed:
		return human.Bad
	case policyresult.StatusIndeterminate:
		return human.Warn
	}
	return human.Unknown
}

// originLabel names the evidence an architecture comes from, and whether the
// Form was saved or compiled by this invocation.
func originLabel(form *policyresult.FormIdentity, a policyresult.Architecture) string {
	words := titleWord(a.Kind)
	if form != nil && form.Origin == "saved" && a.Side == "" {
		words += " (saved Form)"
	}
	return words
}

func selectedWords(n int) string {
	if n == 0 {
		return "none selected"
	}
	return fmt.Sprintf("%d selected", n)
}

// packIdentities names each Policy Pack once, linked when any evaluated
// architecture linked it.
func packIdentities(architectures []policyresult.Architecture) string {
	linked := map[string]bool{}
	names := []string{}
	for _, a := range architectures {
		for _, p := range a.PolicyPacks {
			name := p.ID + " " + p.Version
			if _, seen := linked[name]; !seen {
				names = append(names, name)
			}
			linked[name] = linked[name] || p.Linked
		}
	}
	sort.Strings(names)
	parts := make([]string, 0, len(names))
	for _, name := range names {
		if linked[name] {
			parts = append(parts, name)
			continue
		}
		parts = append(parts, name+" (not linked)")
	}
	if len(parts) == 0 {
		return "none"
	}
	return strings.Join(parts, ", ")
}

func titleWord(value string) string {
	if value == "" {
		return value
	}
	r, size := utf8.DecodeRuneInString(value)
	return string(unicode.ToUpper(r)) + value[size:]
}

// sentence capitalizes recorded wording without changing it.
func sentence(value string) string {
	return titleWord(value)
}

func reasonWords(reasons []string) string {
	words := make([]string, len(reasons))
	for i, reason := range reasons {
		words[i] = strings.ReplaceAll(reason, "_", " ")
	}
	if len(words) == 0 {
		return "no reason recorded"
	}
	return strings.Join(words, ", ")
}

func targetWords(t policyresult.TargetDefinition) string {
	parts := []string{}
	if t.Concept != "" {
		parts = append(parts, "Concept "+t.Concept)
	}
	if len(t.Rules) > 0 {
		parts = append(parts, "Rules "+strings.Join(t.Rules, ", "))
	}
	if len(t.Dialects) > 0 {
		parts = append(parts, "Dialects "+strings.Join(t.Dialects, ", "))
	}
	if len(parts) == 0 {
		return "any instance"
	}
	return strings.Join(parts, "; ")
}

// writeText renders the summary for a terminal or a .txt file. Color follows
// the writer; every word stands without it.
func (rep checkReport) writeText(w io.Writer) {
	human.Verdict(w, rep.title, human.Neutral)
	width := labelWidth(rep.head, rep.counts, [][2]string{rep.verdict})
	for _, row := range rep.table {
		width = max(width, utf8.RuneCountInString(row[0]))
	}
	fmt.Fprintln(w)
	writeAligned(w, "", rep.head, width)
	if len(rep.counts) > 0 {
		fmt.Fprintln(w)
		writeAligned(w, "", rep.counts, width)
	}
	if len(rep.columns) > 0 {
		fmt.Fprintln(w)
		rep.writeTable(w, width)
	}
	if rep.verdict[0] != "" {
		fmt.Fprintln(w)
		fmt.Fprintf(w, "%s%s%s\n", human.Dim(w, rep.verdict[0]), strings.Repeat(" ", width-utf8.RuneCountInString(rep.verdict[0])+2), human.Emphasis(w, rep.verdict[1], verdictStatus(rep.status)))
	}
	if len(rep.requirement)+len(rep.requirementRows) > 0 {
		human.Section(w, "Requirement")
		for _, line := range rep.requirement {
			for _, wrapped := range wrapWords(safeText(line), reportLineWidth-2) {
				fmt.Fprintf(w, "  %s\n", wrapped)
			}
		}
		if len(rep.requirement) > 0 && len(rep.requirementRows) > 0 {
			fmt.Fprintln(w)
		}
		width := labelWidth(rep.requirementRows)
		var rows [][2]string
		for _, row := range rep.requirementRows {
			if row[0] != "Assertion" {
				rows = append(rows, row)
				continue
			}
			for i, line := range assertionLines(row[1], reportLineWidth-2-width-2) {
				label := ""
				if i == 0 {
					label = row[0]
				}
				rows = append(rows, [2]string{label, line})
			}
		}
		writeWrapped(w, "  ", rows, width, map[string]bool{"Assertion": true, "": true})
	}
	for _, side := range rep.sides {
		indent := ""
		if side.title != "" {
			human.Section(w, side.title)
			indent = "  "
		}
		for i, section := range side.sections {
			if side.title == "" || i > 0 {
				fmt.Fprintln(w)
			}
			fmt.Fprintf(w, "%s%s\n", indent, human.Emphasis(w, section.title, section.status))
			section.writeText(w, indent+"  ")
		}
		for _, line := range side.lines {
			if side.title == "" {
				fmt.Fprintln(w)
			}
			for _, wrapped := range wrapWords(line, reportLineWidth-len(indent)) {
				fmt.Fprintf(w, "%s%s\n", indent, wrapped)
			}
		}
	}
	if len(rep.tail) > 0 {
		fmt.Fprintln(w)
		for _, line := range rep.tail {
			if strings.HasPrefix(line, "  ") {
				fmt.Fprintln(w, safeText(line))
				continue
			}
			for _, wrapped := range wrapWords(safeText(line), reportLineWidth) {
				fmt.Fprintln(w, wrapped)
			}
		}
	}
}

func (rep checkReport) writeTable(w io.Writer, width int) {
	widths := make([]int, len(rep.columns))
	for i, column := range rep.columns {
		widths[i] = utf8.RuneCountInString(column)
		for _, row := range rep.table {
			widths[i] = max(widths[i], utf8.RuneCountInString(row[i+1]))
		}
	}
	header := strings.Repeat(" ", width+2)
	for i, column := range rep.columns {
		header += human.Dim(w, column) + columnPad(column, widths[i]+3, i == len(rep.columns)-1)
	}
	fmt.Fprintln(w, strings.TrimRight(header, " "))
	for _, row := range rep.table {
		line := human.Dim(w, row[0]) + strings.Repeat(" ", width-utf8.RuneCountInString(row[0])+2)
		for i, value := range row[1:] {
			shown := value
			if row[0] == "Verdict" || row[0] == "Outcome" {
				shown = human.Tint(w, value, verdictStatus(statusOfWord(value)))
			}
			line += shown + columnPad(value, widths[i]+3, i == len(row)-2)
		}
		fmt.Fprintln(w, strings.TrimRight(line, " "))
	}
}

func columnPad(value string, width int, last bool) string {
	if last {
		return ""
	}
	return strings.Repeat(" ", max(width-utf8.RuneCountInString(value), 1))
}

func statusOfWord(word string) policyresult.Status {
	if word == "NO TARGET" {
		return policyresult.StatusNoDecision
	}
	for _, status := range []policyresult.Status{policyresult.StatusPassed, policyresult.StatusViolated, policyresult.StatusIndeterminate, policyresult.StatusNoDecision, policyresult.StatusFailed} {
		if verdictWord(status) == word {
			return status
		}
	}
	return policyresult.StatusFailed
}

func (s checkSection) writeText(w io.Writer, indent string) {
	for i, entry := range s.entries {
		if i > 0 {
			fmt.Fprintln(w)
		}
		if entry.heading != "" {
			entry.writeBlocks(w, indent)
			continue
		}
		width := labelWidth(entry.fields)
		for _, field := range entry.fields {
			lines := []string{safeText(field[1])}
			if !entry.code[field[0]] {
				lines = layoutLine(field[1], max(reportLineWidth-len(indent)-width-2, 24))
			}
			for j, line := range lines {
				label := field[0]
				if j > 0 {
					label = ""
				}
				gap := strings.Repeat(" ", width-utf8.RuneCountInString(label)+2)
				fmt.Fprintf(w, "%s%s%s%s\n", indent, human.Dim(w, label), gap, line)
			}
		}
	}
}

// writeBlocks writes an explanation entry: its instance, then each titled
// block with its lines indented under the title.
func (entry checkEntry) writeBlocks(w io.Writer, indent string) {
	fmt.Fprintf(w, "%s%s\n", indent, safeText(entry.heading))
	for _, block := range entry.blocks {
		fmt.Fprintf(w, "%s  %s\n", indent, human.Dim(w, block.title))
		for _, line := range block.lines {
			for _, wrapped := range layoutLine(line, max(reportLineWidth-len(indent)-4, 24)) {
				fmt.Fprintf(w, "%s    %s\n", indent, wrapped)
			}
		}
	}
}

// layoutLine lays one value out within width columns. An evidence line
// separates what was inspected from what it concluded with a newline: both
// share one line when they fit, and the conclusion goes under the subject,
// indented like any continuation of the subject, otherwise. Words are
// wrapped, never cut.
func layoutLine(value string, width int) []string {
	subject, conclusion, split := strings.Cut(value, "\n")
	if !split {
		return wrapWords(safeText(value), width)
	}
	if one := safeText(subject + " " + conclusion); utf8.RuneCountInString(one) <= width {
		return []string{one}
	}
	lines := wrapWords(safeText(subject), width)
	if len(lines) > 1 {
		lines = append(lines[:1], wrapWords(strings.Join(lines[1:], " "), width-2)...)
		for i := 1; i < len(lines); i++ {
			lines[i] = "  " + lines[i]
		}
		last := len(lines) - 1
		if joined := lines[last] + " " + safeText(conclusion); utf8.RuneCountInString(joined) <= width {
			lines[last] = joined
			return lines
		}
	}
	for _, line := range wrapWords(safeText(conclusion), width-2) {
		lines = append(lines, "  "+line)
	}
	return lines
}

// assertionLines breaks an assertion that does not fit before its && and ||
// operators, so each line after the first starts with the operator joining
// it to the rest. Operands are never broken.
func assertionLines(assertion string, width int) []string {
	if utf8.RuneCountInString(assertion) <= width {
		return []string{assertion}
	}
	var parts []string
	rest := assertion
	for {
		i := -1
		for _, operator := range []string{" || ", " && "} {
			if j := strings.Index(rest, operator); j >= 0 && (i < 0 || j < i) {
				i = j
			}
		}
		if i < 0 {
			parts = append(parts, rest)
			break
		}
		parts = append(parts, rest[:i])
		rest = rest[i+1:]
	}
	var lines []string
	for _, part := range parts {
		if n := len(lines); n > 0 && utf8.RuneCountInString(lines[n-1])+1+utf8.RuneCountInString(part) <= width {
			lines[n-1] += " " + part
			continue
		}
		lines = append(lines, part)
	}
	return lines
}

func labelWidth(groups ...[][2]string) int {
	width := 0
	for _, rows := range groups {
		for _, row := range rows {
			width = max(width, utf8.RuneCountInString(row[0]))
		}
	}
	return width
}

// writeAligned writes label and value rows with the labels padded to width.
func writeAligned(w io.Writer, indent string, rows [][2]string, width int) {
	for _, row := range rows {
		gap := strings.Repeat(" ", width-utf8.RuneCountInString(row[0])+2)
		fmt.Fprintf(w, "%s%s%s%s\n", indent, human.Dim(w, safeText(row[0])), gap, safeText(row[1]))
	}
}

// mdCellCode renders a code span inside a table cell. GFM splits a row at
// every unescaped pipe, even inside a code span, and drops the escape before
// the span renders.
func mdCellCode(value string) string {
	return strings.ReplaceAll(mdCode(value), "|", "\\|")
}
