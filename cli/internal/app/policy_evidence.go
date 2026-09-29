package app

import (
	"fmt"
	"slices"
	"sort"
	"strings"

	"github.com/rootform-dev/rootform/cli/form"
	"github.com/rootform-dev/rootform/cli/policyresult"
)

// evidenceLabel names an inspected fact or closure by its kind and the
// dimension or predicate it carries, as explain lists them.
func evidenceLabel(kind, name string) string {
	if name == "" {
		return kind
	}
	return kind + " " + name
}

// subjectWords names what a fact or closure is about as a sentence says it:
// "network context", "connects-to relation", "contribution".
func subjectWords(kind, name string) string {
	if name == "" {
		return kind
	}
	return name + " " + kind
}

// inlineReason is a reason label inside a sentence.
func inlineReason(code string) string {
	label := reasonLabel(code)
	return strings.ToLower(label[:1]) + label[1:]
}

// incoming reports whether a closure was inspected for the facts entering
// the evaluated instance. A contribution query is the only one that looks at
// the closures of other instances; contexts and relations leave the instance.
func incoming(c inspectedClosure) bool {
	return c.Kind == string(form.EmissionContribution)
}

// closureOutcome states what one closure concluded as the evaluated instance
// sees it. An incoming closure that stayed undecided either matched no
// instance, so no fact of it can enter this one, or could still reach it.
func closureOutcome(c inspectedClosure, details bool) string {
	switch c.Outcome {
	case form.OutcomeResolved:
		words := "resolved"
		if len(c.Endpoints) > 0 {
			words += " to " + listWords(c.Endpoints)
		}
		if details && len(c.Evidence) > 0 {
			words += " (evidence: " + strings.Join(c.Evidence, ", ") + ")"
		}
		return words
	case form.OutcomeIndeterminate:
		words := "indeterminate (" + inlineReason(string(c.Reason)) + ")"
		if incoming(c) {
			if c.MatchesNoInstance {
				return words + "; matches no instance"
			}
			return words + "; could reach this instance"
		}
		return words
	case form.OutcomeAbsent:
		return "absent"
	}
	return string(c.Outcome)
}

// closureRank orders the closures an evaluation inspected by how directly
// they bear on the evaluated instance: its own facts and the facts entering
// it, then the undecided closures that could still reach it, then incoming
// closures that settled elsewhere or matched no instance.
func closureRank(c inspectedClosure, address string) int {
	switch {
	case !incoming(c) || slices.Contains(c.Endpoints, address):
		return 0
	case c.Outcome == form.OutcomeIndeterminate && !c.MatchesNoInstance:
		return 1
	}
	return 2
}

// noEvidence states an evaluation whose queries found no fact or closure.
const noEvidence = "none: the assertion's queries found no fact or closure"

// evidenceRecord is one line of the evidence an evaluation inspected: a
// closure, standing for count closures that read alike, with its subject and
// outcome in text words, or a fact no listed closure established.
type evidenceRecord struct {
	closure inspectedClosure
	count   int
	head    string
	outcome string
	fact    *inspectedFact
}

// evidenceRecords orders what one evaluation inspected, relative to the
// instance it evaluated: each closure with the reference it followed and what
// it concluded for that instance, most direct first, and closures that read
// alike once; then each fact no listed closure established. details adds
// match strategies and the evidence facts rest on.
func evidenceRecords(e explainedEvaluation, details bool) []evidenceRecord {
	closures := append([]inspectedClosure{}, e.Closures...)
	sort.SliceStable(closures, func(i, j int) bool {
		x, y := closures[i], closures[j]
		if a, b := closureRank(x, e.Address), closureRank(y, e.Address); a != b {
			return a < b
		}
		if x.Instance != y.Instance {
			return x.Instance < y.Instance
		}
		return x.Via+" "+x.Match < y.Via+" "+y.Match
	})
	var records []evidenceRecord
	seen := map[string]int{}
	established := map[string]bool{}
	for _, c := range closures {
		for _, id := range c.FactIDs {
			established[id] = true
		}
		head := evidenceLabel(c.Kind, c.Name)
		if incoming(c) {
			head += " from " + c.Instance
		} else {
			head += " -> " + c.Target
		}
		head += " via " + c.Via
		if details && c.Match != "" {
			head += " (match " + c.Match + ")"
		}
		outcome := closureOutcome(c, details)
		key := head + "\x00" + outcome
		if i, found := seen[key]; found {
			records[i].count++
			continue
		}
		seen[key] = len(records)
		records = append(records, evidenceRecord{closure: c, count: 1, head: head, outcome: outcome})
	}
	for i := range e.Facts {
		if !established[e.Facts[i].ID] {
			records = append(records, evidenceRecord{fact: &e.Facts[i]})
		}
	}
	return records
}

// evidenceLines states the evidence of one evaluation in text words. A
// newline separates a closure's subject from what it concluded, so a
// renderer can put the conclusion under a long subject. Closures that read
// alike are stated once with their number.
func evidenceLines(e explainedEvaluation, details bool) []string {
	if len(e.Facts) == 0 && len(e.Closures) == 0 {
		if e.InterpretationReason != "" {
			return []string{"none: no query of the assertion ran, as the interpretation of this instance is undecided (" + inlineReason(e.InterpretationReason) + ")"}
		}
		return []string{noEvidence}
	}
	records := evidenceRecords(e, details)
	out := make([]string, 0, len(records))
	for _, r := range records {
		if r.fact == nil {
			head := r.head
			if r.count > 1 {
				head += fmt.Sprintf(" (%d closures)", r.count)
			}
			out = append(out, safeText(head)+":\n"+safeText(r.outcome))
			continue
		}
		f := *r.fact
		label := evidenceLabel(f.Kind, f.Name)
		var line string
		switch e.Address {
		case f.From:
			line = label + " -> " + f.To
		case f.To:
			line = label + " <- " + f.From
		default:
			line = f.From + " " + label + " -> " + f.To
		}
		if details && len(f.Evidence) > 0 {
			line += " (evidence: " + strings.Join(f.Evidence, ", ") + ")"
		}
		out = append(out, line)
	}
	return out
}

// evidenceSentences states the evidence of one evaluation as the sentences
// of a review document, with references and addresses in code spans. It
// states what evidenceLines states.
func evidenceSentences(e explainedEvaluation, details bool) []string {
	if len(e.Facts) == 0 && len(e.Closures) == 0 {
		if e.InterpretationReason != "" {
			return []string{"No query of the assertion ran: the interpretation of this instance is undecided (" + mdText(inlineReason(e.InterpretationReason)) + ")."}
		}
		return []string{"The assertion's queries found no fact or closure."}
	}
	records := evidenceRecords(e, details)
	out := make([]string, 0, len(records))
	for _, r := range records {
		if r.fact != nil {
			out = append(out, factSentence(*r.fact, e.Address, details))
			continue
		}
		out = append(out, closureSentence(r.closure, r.count, details))
	}
	return out
}

// closureSentence states one inspected closure: what it is about, which way
// it leads, the reference it followed and what it concluded for the
// evaluated instance.
func closureSentence(c inspectedClosure, count int, details bool) string {
	s := "The " + mdText(subjectWords(c.Kind, c.Name))
	if incoming(c) {
		s += " from " + mdCode(c.Instance)
	} else {
		s += " toward " + mdText(c.Target)
	}
	if c.Via != "" {
		s += " through " + mdCode(c.Via)
	}
	if details && c.Match != "" {
		s += " (match " + mdText(c.Match) + ")"
	}
	if count > 1 {
		s += fmt.Sprintf(" (%d closures)", count)
	}
	switch c.Outcome {
	case form.OutcomeResolved:
		s += " resolved"
		if len(c.Endpoints) > 0 {
			s += " to " + codeList(c.Endpoints)
		}
		if details && len(c.Evidence) > 0 {
			s += " (evidence: " + mdText(strings.Join(c.Evidence, ", ")) + ")"
		}
	case form.OutcomeIndeterminate:
		s += " is indeterminate (" + mdText(inlineReason(string(c.Reason))) + ")"
		if incoming(c) && c.MatchesNoInstance {
			s += "; it matches no instance"
		} else if incoming(c) {
			s += "; it could reach this instance"
		}
	case form.OutcomeAbsent:
		s += " is absent"
	default:
		s += " is " + mdText(string(c.Outcome))
	}
	return s + "."
}

// factSentence states a determined fact no listed closure established,
// relative to the evaluated instance.
func factSentence(f inspectedFact, address string, details bool) string {
	s := "The " + mdText(subjectWords(f.Kind, f.Name))
	switch address {
	case f.From:
		s += " to " + mdCode(f.To)
	case f.To:
		s += " from " + mdCode(f.From)
	default:
		s += " from " + mdCode(f.From) + " to " + mdCode(f.To)
	}
	s += " is determined"
	if details && len(f.Evidence) > 0 {
		s += " (evidence: " + mdText(strings.Join(f.Evidence, ", ")) + ")"
	}
	return s + "."
}

// codeList names at most three values in code spans and counts the rest.
func codeList(values []string) string {
	shown := values
	if len(shown) > 3 {
		shown = shown[:3]
	}
	codes := make([]string, len(shown))
	for i, value := range shown {
		codes[i] = mdCode(value)
	}
	if len(values) > len(shown) {
		return strings.Join(codes, ", ") + fmt.Sprintf(", and %d more", len(values)-len(shown))
	}
	return joinWords(codes)
}

// labeledLines lays lines out as rows under one label.
func labeledLines(label string, lines []string) [][2]string {
	rows := make([][2]string, 0, len(lines))
	for i, line := range lines {
		name := ""
		if i == 0 {
			name = label
		}
		rows = append(rows, [2]string{name, line})
	}
	return rows
}

// unstatedReasons states the reasons an undecided evaluation records that
// its evidence lines do not already give: no inspected closure states them,
// and they are not why the instance went uninterpreted. An unavailable
// reason no closure carries means a query of the assertion had nothing to
// inspect, as no emission or recorded closure could supply that evidence.
func unstatedReasons(e explainedEvaluation) []string {
	if e.Outcome != policyresult.OutcomeIndeterminate {
		return nil
	}
	covered := map[string]bool{e.InterpretationReason: true}
	for _, c := range e.Closures {
		if !incoming(c) || !c.MatchesNoInstance {
			covered[string(c.Reason)] = true
		}
	}
	var words []string
	for _, reason := range e.Reasons {
		switch {
		case covered[reason]:
		case reason == string(form.ReasonUnavailable):
			words = append(words, "a query of the assertion has no evidence to inspect")
		default:
			words = append(words, inlineReason(reason))
		}
	}
	return words
}

// subjectStates sums up inspected evidence by what it is about: the facts
// determined, what stayed indeterminate, else a determined absence. For
// facts entering the instance, an incoming closure bears on it only when it
// reached it or could still reach it.
func subjectStates(e explainedEvaluation) []string {
	type state struct {
		words    string
		ends     []string
		reasons  []string
		incoming bool
		absent   bool
	}
	var order []string
	states := map[string]*state{}
	of := func(kind, name string) *state {
		key := kind + "\x00" + name
		if states[key] == nil {
			states[key] = &state{words: subjectWords(kind, name)}
			order = append(order, key)
		}
		return states[key]
	}
	for _, f := range e.Facts {
		s := of(f.Kind, f.Name)
		switch e.Address {
		case f.From:
			s.ends = append(s.ends, "to "+f.To)
		case f.To:
			s.ends = append(s.ends, "from "+f.From)
		default:
			s.ends = append(s.ends, f.From+" to "+f.To)
		}
	}
	for _, c := range e.Closures {
		s := of(c.Kind, c.Name)
		s.incoming = s.incoming || incoming(c)
		switch {
		case c.Outcome == form.OutcomeIndeterminate && !(incoming(c) && c.MatchesNoInstance):
			s.reasons = append(s.reasons, inlineReason(string(c.Reason)))
		case c.Outcome == form.OutcomeAbsent && !incoming(c):
			s.absent = true
		}
	}
	parts := make([]string, 0, len(order))
	for _, key := range order {
		s := states[key]
		undecided := ""
		if len(s.reasons) > 0 {
			undecided = "indeterminate (" + strings.Join(unique(s.reasons), ", ") + ")"
		}
		switch {
		case len(s.ends) > 0 && undecided != "":
			parts = append(parts, s.words+" determined ("+listWords(s.ends)+") and partly "+undecided)
		case len(s.ends) > 0:
			parts = append(parts, s.words+" determined ("+listWords(s.ends)+")")
		case undecided != "":
			parts = append(parts, s.words+" "+undecided)
		case s.incoming:
			parts = append(parts, "no "+s.words+" reaches it")
		case s.absent:
			parts = append(parts, s.words+" absent")
		default:
			parts = append(parts, s.words+" determined")
		}
	}
	return parts
}

// listWords names at most three values and counts the rest.
func listWords(values []string) string {
	if len(values) <= 3 {
		return strings.Join(values, ", ")
	}
	return strings.Join(values[:3], ", ") + fmt.Sprintf(", and %d more", len(values)-3)
}

// evaluationConclusion states what one recorded outcome means for the
// evaluated instance: from the evidence it inspected when the Form describes
// it, and from the outcome and its recorded reasons otherwise. It never reads
// the Policy message and never evaluates again.
func evaluationConclusion(e explainedEvaluation, place string, described bool) string {
	subject := e.Address
	if subject == "" {
		subject = e.Target
	}
	var lead string
	switch e.Outcome {
	case policyresult.OutcomePassed:
		lead = "The assertion holds for " + subject + " " + place
	case policyresult.OutcomeViolated:
		lead = "The assertion is false for " + subject + " " + place
	default:
		lead = "The evidence cannot settle the assertion for " + subject + " " + place
	}
	if !described {
		if e.Outcome == policyresult.OutcomeIndeterminate && len(e.Reasons) > 0 {
			labels := make([]string, len(e.Reasons))
			for i, reason := range e.Reasons {
				labels[i] = inlineReason(reason)
			}
			return lead + "; the result records these reasons: " + strings.Join(labels, ", ") + "."
		}
		return lead + "."
	}
	var parts []string
	if e.InterpretationReason != "" {
		parts = append(parts, "its interpretation is undecided ("+inlineReason(e.InterpretationReason)+")")
	}
	parts = append(parts, subjectStates(e)...)
	parts = append(parts, unstatedReasons(e)...)
	if len(parts) == 0 {
		return lead + "; its queries found no fact or closure."
	}
	return lead + ": " + strings.Join(parts, "; ") + "."
}

// inspectedWords counts what an evaluation inspected when only the result,
// which identifies that evidence without describing it, is at hand.
func inspectedWords(e policyresult.Evaluation) string {
	var parts []string
	if n := len(e.InspectedFacts); n > 0 {
		parts = append(parts, countWithNoun(n, "fact", "facts"))
	}
	if n := len(e.InspectedClosures); n > 0 {
		parts = append(parts, countWithNoun(n, "closure", "closures"))
	}
	if len(parts) == 0 {
		return noEvidence
	}
	pronoun := "them"
	if len(e.InspectedFacts)+len(e.InspectedClosures) == 1 {
		pronoun = "it"
	}
	return strings.Join(parts, " and ") + " inspected; the Form, not the result, describes " + pronoun
}

// placeWords names where an evaluation took place: its stage and, in a
// comparison, its side.
func placeWords(stage form.Stage, side string) string {
	words := "in the " + stageWords(stage) + " stage"
	if side != "" {
		words += " of the " + titleWord(side) + " side"
	}
	return words
}
