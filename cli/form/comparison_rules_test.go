package form

import "testing"

const addrOld = "local_file.old"

func movedChange(comparison, representation, previous string) RepresentationChange {
	return RepresentationChange{ID: RepresentationChangeID(comparison, ChangeMoved, representation), Change: ChangeMoved, Representation: representation, PreviousAddress: previous}
}

func linkChange(comparison string, change ChangeKind) FactChange {
	factBA := ContributionID(repB, repA)
	return FactChange{ID: FactChangeID(comparison, change, factBA), Change: change, Kind: FactContribution, Fact: factBA, From: repB, To: repA, Emission: testEmission().ID}
}

func recount(c *Comparison) { c.Counts = DeriveComparisonCounts(c) }

// moveFixture moves A in the plan. Producers apply moved blocks before
// refresh, so the recorded and refreshed stages already hold A at its new
// address and only the planned representation records the previous one.
func moveFixture() *InputForm {
	a := planFixture()
	planned := a.Stages[StagePlanned]
	for i := range planned.Representations {
		if planned.Representations[i].ID == repA {
			planned.Representations[i].PreviousAddress = addrOld
		}
	}
	for _, c := range []*Comparison{a.Comparisons.Changes, a.Comparisons.Net} {
		c.Representations = append(c.Representations, movedChange(c.Name, repA, addrOld))
		recount(c)
	}
	return a
}

// relocate renames A to address in one stage, as recorded before a moved
// block took effect.
func relocate(stage *Architecture, address string) {
	representation := RepresentationID(address)
	rename := func(id string) string {
		if id == repA {
			return representation
		}
		return id
	}
	for i := range stage.Declarations {
		if stage.Declarations[i].ID == declA {
			stage.Declarations[i] = declaration(DeclarationID(address), address, "old", 1)
		}
	}
	for i := range stage.Representations {
		if item := &stage.Representations[i]; item.ID == repA {
			item.ID, item.Address, item.Declaration = representation, address, DeclarationID(address)
		}
	}
	for i := range stage.Contributions {
		fact := &stage.Contributions[i]
		previous := fact.ID
		fact.From, fact.To = rename(fact.From), rename(fact.To)
		fact.ID = ContributionID(fact.From, fact.To)
		for j := range stage.Closures {
			for k, id := range stage.Closures[j].Facts {
				if id == previous {
					stage.Closures[j].Facts[k] = fact.ID
				}
			}
		}
	}
	for i := range stage.Dependencies {
		dependency := &stage.Dependencies[i]
		dependency.From, dependency.To = rename(dependency.From), rename(dependency.To)
		dependency.ID = DependencyID(dependency.From, dependency.To)
	}
	stage.Accounting = DeriveAccounting(stage)
}

func TestMovesArePlannedActions(t *testing.T) {
	mustValid(t, "move applied before refresh", moveFixture().Validate())

	unlisted := moveFixture()
	unlisted.Comparisons.Changes.Representations = unlisted.Comparisons.Changes.Representations[:2]
	recount(unlisted.Comparisons.Changes)
	expectProblem(t, "planned move not listed", unlisted.Validate(), CodeInconsistent, "is not listed as moved")

	mismatched := moveFixture()
	mismatched.Comparisons.Net.Representations[2].PreviousAddress = "local_file.elsewhere"
	expectProblem(t, "previous address differs", mismatched.Validate(), CodeInconsistent, "does not carry this previous address")

	drift := moveFixture()
	drift.Comparisons.Drift.Representations = []RepresentationChange{movedChange(ComparisonDrift, repA, addrOld)}
	recount(drift.Comparisons.Drift)
	expectProblem(t, "move reported as drift", drift.Validate(), CodeInconsistent, "never drift")

	nowhere := moveFixture()
	for i := range nowhere.Stages[StagePlanned].Representations {
		if item := &nowhere.Stages[StagePlanned].Representations[i]; item.ID == repC {
			item.PreviousAddress = "local_file.gone"
		}
	}
	for _, c := range []*Comparison{nowhere.Comparisons.Changes, nowhere.Comparisons.Net} {
		c.Representations[0] = movedChange(c.Name, repC, "local_file.gone")
		recount(c)
	}
	expectProblem(t, "moved representation absent before", nowhere.Validate(), CodeInconsistent, "exists before at its previous or current address")

	cross := crossFixture()
	cross.After.Form = *moveFixture()
	cross.Comparison.Representations = append(cross.Comparison.Representations, movedChange(ComparisonCross, repA, addrOld))
	recount(&cross.Comparison)
	expectProblem(t, "cross move without its previous address", cross.Validate(), CodeInconsistent, "is not on the before side")

	relocated := func() *ComparisonForm {
		c := crossFixture()
		c.After.Form = *moveFixture()
		relocate(c.Before.Form.Stages[StageRecorded], addrOld)
		c.Comparison.Representations = append(c.Comparison.Representations, movedChange(ComparisonCross, repA, addrOld))
		recount(&c.Comparison)
		return c
	}
	mustValid(t, "cross move from the previous address", relocated().Validate())

	echoed := relocated()
	echoed.Comparison.Facts = append(echoed.Comparison.Facts, linkChange(ComparisonCross, ChangeAdded))
	recount(&echoed.Comparison)
	expectProblem(t, "fact that moved with its endpoint is not added", echoed.Validate(), CodeInconsistent, "although the other side establishes it")
}

// sensitiveRefreshed leaves B's link closure indeterminate in the refreshed
// stage, as when the refreshed value of its via is sensitive. The drift and
// planned comparisons list that closure as indeterminate.
func sensitiveRefreshed() *InputForm {
	emission := testEmission()
	closureB := ClosureID(repB, emission.ID)
	a := planFixture()
	refreshed := a.Stages[StageRefreshed]
	refreshed.Contributions = []Contribution{}
	for i := range refreshed.Closures {
		if closure := &refreshed.Closures[i]; closure.ID == closureB {
			closure.Outcome, closure.Reason = OutcomeIndeterminate, ReasonSensitive
			closure.Facts, closure.Candidates = []string{}, Candidates{}
		}
	}
	refreshed.Accounting = DeriveAccounting(refreshed)
	for _, entry := range []struct {
		comparison *Comparison
		side       string
	}{{a.Comparisons.Drift, SideAfter}, {a.Comparisons.Changes, SideBefore}} {
		c := entry.comparison
		c.Indeterminate = append(c.Indeterminate, IndeterminateClosure{ID: IndeterminateID(c.Name, closureB, entry.side), Closure: closureB, Representation: repB, Emission: emission.ID, Side: entry.side, Reasons: []Reason{ReasonSensitive}})
		recount(c)
	}
	return a
}

// failedPlanned fails B's interpretation on the planned stage, as when its
// provider is bound to no selected Dialect: B has no closure there, so the
// planned and net comparisons list its link closure as indeterminate.
func failedPlanned() *InputForm {
	emission := testEmission()
	closureB := ClosureID(repB, emission.ID)
	factBA := ContributionID(repB, repA)
	a := planFixture()
	diagnostic := Diagnostic{Phase: PhaseInterpretation, Severity: SeverityError, Code: "PROVIDER_UNBOUND", Message: "the provider of this instance is bound to no selected Dialect", Stage: StagePlanned, Representation: repB}
	diagnostic.ID = DiagnosticID(diagnostic)
	a.Diagnostics = append(a.Diagnostics, diagnostic)
	planned := a.Stages[StagePlanned]
	for i := range planned.Representations {
		if item := &planned.Representations[i]; item.ID == repB {
			item.Interpretation = &Interpretation{Status: InterpretationFailed, Candidates: []string{testRuleFile, testRuleLink}, Diagnostics: []string{diagnostic.ID}}
			item.Rule, item.Concept = "", ""
		}
	}
	var contributions []Contribution
	for _, fact := range planned.Contributions {
		if fact.ID != factBA {
			contributions = append(contributions, fact)
		}
	}
	planned.Contributions = contributions
	var closures []Closure
	for _, closure := range planned.Closures {
		if closure.ID != closureB {
			closures = append(closures, closure)
		}
	}
	planned.Closures = closures
	planned.Accounting = DeriveAccounting(planned)
	for _, c := range []*Comparison{a.Comparisons.Changes, a.Comparisons.Net} {
		c.Representations = append(c.Representations, RepresentationChange{ID: RepresentationChangeID(c.Name, ChangeChanged, repB), Change: ChangeChanged, Representation: repB, Fields: []string{FieldConcept, FieldRule}})
		c.Indeterminate = []IndeterminateClosure{{ID: IndeterminateID(c.Name, closureB, SideAfter), Closure: closureB, Representation: repB, Emission: emission.ID, Side: SideAfter, Reasons: []Reason{ReasonInterpretationFailed}}}
		recount(c)
	}
	return a
}

// TestFactChangesNeedSettledCounterparts covers the counterpart rule: a fact is
// added or removed only when the closure that could establish it on the other
// side is settled, and only when the other side does not establish it.
func TestFactChangesNeedSettledCounterparts(t *testing.T) {
	mustValid(t, "closure indeterminate on one side", sensitiveRefreshed().Validate())

	added := sensitiveRefreshed()
	added.Comparisons.Changes.Indeterminate = nil
	added.Comparisons.Changes.Facts = append(added.Comparisons.Changes.Facts, linkChange(ComparisonChanges, ChangeAdded))
	recount(added.Comparisons.Changes)
	expectProblem(t, "fact added over an indeterminate closure", added.Validate(), CodeInconsistent, "is incomplete on the other side")

	removed := sensitiveRefreshed()
	removed.Comparisons.Drift.Indeterminate = nil
	removed.Comparisons.Drift.Facts = []FactChange{linkChange(ComparisonDrift, ChangeRemoved)}
	recount(removed.Comparisons.Drift)
	expectProblem(t, "fact removed toward an indeterminate closure", removed.Validate(), CodeInconsistent, "is incomplete on the other side")

	mustValid(t, "failed interpretation leaves its closures unsettled", failedPlanned().Validate())

	failed := failedPlanned()
	for _, c := range []*Comparison{failed.Comparisons.Changes, failed.Comparisons.Net} {
		c.Indeterminate = nil
		c.Facts = append(c.Facts, linkChange(c.Name, ChangeRemoved))
		recount(c)
	}
	expectProblem(t, "fact removed under a failed interpretation", failed.Validate(), CodeInconsistent, "is incomplete on the other side")

	present := planFixture()
	present.Comparisons.Changes.Facts = append(present.Comparisons.Changes.Facts, linkChange(ComparisonChanges, ChangeAdded))
	recount(present.Comparisons.Changes)
	expectProblem(t, "fact present on both sides", present.Validate(), CodeInconsistent, "although the other side establishes it")
}

// ruleTargeted retargets the link emission from the file concept to a rule:
// a managed target is interpreted by that rule, and an external endpoint
// carries that rule's concept and no rule.
func ruleTargeted(rule string) *InputForm {
	a := planFixture()
	previous := a.Semantics.Emissions[0].ID
	emission := a.Semantics.Emissions[0]
	emission.To = TargetRef{Kind: TargetRule, ID: rule}
	emission.ID = EmissionID(emission)
	a.Semantics.Emissions[0] = emission
	a.Semantics.Rules[1].Emissions = []string{emission.ID}
	for _, stage := range a.Stages {
		for i := range stage.Closures {
			if closure := &stage.Closures[i]; closure.Emission == previous {
				closure.ID, closure.Emission = ClosureID(closure.Representation, emission.ID), emission.ID
			}
		}
		for i := range stage.Contributions {
			fact := &stage.Contributions[i]
			for j := range fact.Provenance {
				if fact.Provenance[j].Emission == previous {
					fact.Provenance[j].Emission, fact.Provenance[j].Closure = emission.ID, ClosureID(fact.From, emission.ID)
				}
			}
		}
		stage.Accounting = DeriveAccounting(stage)
	}
	for _, c := range []*Comparison{a.Comparisons.Drift, a.Comparisons.Changes, a.Comparisons.Net} {
		for i := range c.Facts {
			if c.Facts[i].Emission == previous {
				c.Facts[i].Emission = emission.ID
			}
		}
	}
	return a
}

func TestExternalEndpointOfRuleTargetedEmission(t *testing.T) {
	mustValid(t, "external endpoint carries the target rule concept", ruleTargeted(testRuleFile).Validate())
	expectProblem(t, "external concept differs from the target rule", ruleTargeted(testRuleLink).Validate(), CodeInconsistent, "differs from the concept of target rule")
}
