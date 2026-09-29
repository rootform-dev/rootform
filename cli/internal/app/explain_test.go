package app

import (
	"testing"

	"github.com/rootform-dev/rootform/cli/form"
)

// Only a predicate evaluated false is a decided miss. An unknown predicate or
// an ambiguous match leaves the candidate undecided.
func TestCandidateCountsSeparateUndecidedCandidates(t *testing.T) {
	interpretation := func(status form.InterpretationStatus, candidates ...string) *form.Interpretation {
		return &form.Interpretation{Status: status, Candidates: candidates}
	}
	a := &form.Architecture{Representations: []form.Representation{
		{Rule: "x.rule.a", Interpretation: interpretation(form.InterpretationApplied, "x.rule.a")},
		{Interpretation: interpretation(form.InterpretationNone, "x.rule.a")},
		{Interpretation: interpretation(form.InterpretationNone, "x.rule.b")},
		{Interpretation: interpretation(form.InterpretationIndeterminate, "x.rule.a", "x.rule.b")},
		{Interpretation: interpretation(form.InterpretationFailed, "x.rule.a", "x.rule.b")},
		{Rule: "x.rule.b", Interpretation: interpretation(form.InterpretationApplied, "x.rule.a", "x.rule.b")},
		{},
	}}
	if unmatched, indeterminate := candidateCounts(a, "x.rule.a"); unmatched != 1 || indeterminate != 2 {
		t.Fatalf("candidateCounts = %d unmatched, %d indeterminate; want 1 and 2", unmatched, indeterminate)
	}
}
