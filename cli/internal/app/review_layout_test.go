package app

import (
	"fmt"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"

	"github.com/rootform-dev/rootform/cli/form"
	cli "github.com/rootform-dev/rootform/cli/internal/command"
	"github.com/rootform-dev/rootform/cli/policyresult"
)

func TestReviewUncertaintyOrientationPreservesGrouping(t *testing.T) {
	for _, tc := range []struct {
		name  string
		table *reportTable
		first string
	}{
		{"stage", &reportTable{header: []string{"", "Planned"}, numeric: true, rows: [][]string{{"Indeterminate closures", "27"}, {"  Unavailable", "26"}, {"  Unknown until apply", "1"}}}, "| Stage | Indeterminate closures | Unavailable | Unknown until apply |\n"},
		{"several kinds", &reportTable{header: []string{"", "Planned"}, numeric: true, rows: [][]string{{"Indeterminate closures", "2"}, {"  Unavailable", "1"}, {"Indeterminate interpretations", "1"}, {"  Unavailable", "1"}}}, "|  | Planned |\n"},
		{"many causes", &reportTable{header: []string{"", "Before", "After"}, numeric: true, rows: [][]string{{"Indeterminate closures", "5", "5"}, {"  Unavailable", "1", "1"}, {"  Unknown until apply", "1", "1"}, {"  Sensitive", "1", "1"}, {"  Incomplete identity", "1", "1"}, {"  External endpoint denied", "1", "1"}}}, "|  | Before | After |\n"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			before := &review{}
			before.table(tc.table)
			v := &review{}
			v.uncertainty(tc.table)
			got := string(v.bytes())
			if !strings.HasPrefix(got, tc.first) {
				t.Fatal(got)
			}
			assertInertReview(t, got, 0)
			after := &review{}
			after.table(tc.table)
			if string(after.bytes()) != string(before.bytes()) {
				t.Fatal("Markdown changed the terminal table model")
			}
		})
	}
}

func TestReviewKeepsDistinctUncertaintyEvidence(t *testing.T) {
	c := plannedChanges(1, 0)
	c.Indeterminate = []form.IndeterminateClosure{{Side: form.SideAfter, Reasons: []form.Reason{form.ReasonUnavailable}}}
	rep := runReport{views: []stageView{{stage: form.StagePlanned}}, blocks: []reportBlock{{role: roleUncertainty, table: &reportTable{rows: [][]string{{"Indeterminate closures", "1"}}}}}}
	if !rep.uncertaintyShown(c) {
		t.Fatal("the same selected-stage count should not repeat")
	}
	c.Indeterminate[0].Side = form.SideBefore
	if rep.uncertaintyShown(c) {
		t.Fatal("the other stage's count is distinct evidence")
	}
	c.Indeterminate[0].Side = form.SideAfter
	c.Indeterminate = append(c.Indeterminate, form.IndeterminateClosure{Side: form.SideAfter})
	if rep.uncertaintyShown(c) {
		t.Fatal("a different comparison count is distinct evidence")
	}
}

func TestReviewChangesKeepStatusesAndSeparateKinds(t *testing.T) {
	c := withFacts(withFacts(plannedChanges(3, 1), form.FactRelation, form.ChangeRemoved, "relation:a:b"), form.FactContext, form.ChangeAdded, "context:a:b")
	c.Representations = append(c.Representations, form.RepresentationChange{Change: form.ChangeMoved, Representation: "object.moved"})
	rep := runReport{}
	v := &review{}
	rep.writeCounts(v, &reportBlock{comparison: c})
	want := "| Change | Instances | Relations | Contexts |\n| --- | :---: | :---: | :---: |\n| + Added | 3 | 0 | 1 |\n| − Removed | 1 | 1 | 0 |\n| Moved | 1 | 0 | 0 |\n"
	if !strings.Contains(string(v.bytes()), want) {
		t.Fatal(string(v.bytes()))
	}
}

func TestReviewSideCountsStaySeparateFromLongProvenance(t *testing.T) {
	f := &form.InputForm{Kind: form.KindState, Stages: map[form.Stage]*form.Architecture{form.StageRecorded: {Stage: form.StageRecorded}}}
	rep := runReport{views: []stageView{{side: "Before", stage: form.StageRecorded, form: f}, {side: "After", stage: form.StageRecorded, form: f}}, sides: &reportTable{header: []string{"", "Before", "After"}, rows: [][]string{{"Stage", "Recorded", "Recorded"}, {"Instances", "3", "4"}, {"Interpreted", "2", "4"}, {"Semantics", "exact first pin", "exact second pin"}}}}
	original := [][]string{{"Stage", "Recorded", "Recorded"}, {"Instances", "3", "4"}, {"Interpreted", "2", "4"}, {"Semantics", "exact first pin", "exact second pin"}}
	v := &review{}
	rep.writeSideCounts(v)
	rep.writeSides(v)
	got := string(v.bytes())
	inOrder(t, got, "| Side | Instances | Interpreted |\n", "| Before | 3 | 2 |\n", "| After | 4 | 4 |\n", "| Field | Before | After |\n", "| Semantics | exact first pin | exact second pin |\n")
	if strings.Contains(got, "| Instances | 3 | 4 |") || !reflect.DeepEqual(rep.sides.rows, original) {
		t.Fatal(got)
	}
}

func TestReviewFailedSideNeverFabricatesZeroCounts(t *testing.T) {
	v := &review{}
	writeSidesTable(v, []policyresult.Architecture{{Side: form.SideBefore, Kind: "state", Stage: form.StageRecorded, Status: policyresult.StatusFailed}})
	got := string(v.bytes())
	if !strings.Contains(got, "| Before | NOT EVALUATED | State | Recorded | - | - | - | - |") {
		t.Fatal(got)
	}
}

func reviewPolicyFixture() policyresult.Result {
	id := "review.policy.requirement"
	side := func(name, kind string, stage form.Stage, outcome policyresult.Outcome) policyresult.Architecture {
		verdict := policyresult.PolicyPassed
		if outcome == policyresult.OutcomeViolated {
			verdict = policyresult.PolicyViolated
		}
		return policyresult.Architecture{Side: name, Kind: kind, Stage: stage, Summary: policyresult.Summary{Policies: policyresult.PolicyCounts{Selected: 1}},
			Policies:    []policyresult.PolicyResult{{ID: id, Message: "Each instance must satisfy the recorded requirement.", Complete: true, Targets: 1, Outcome: verdict}},
			Evaluations: []policyresult.Evaluation{{ID: name, Policy: id, Address: "object." + name, Stage: stage, Outcome: outcome}}}
	}
	return policyresult.Result{Scope: policyresult.ScopeBoth, Selection: policyresult.Selection{Policies: []string{id}}, Architectures: []policyresult.Architecture{side(form.SideBefore, "state", form.StageRecorded, policyresult.OutcomeViolated), side(form.SideAfter, "plan", form.StagePlanned, policyresult.OutcomePassed)}}.Finalized()
}

func TestReviewMarkdownGoldens(t *testing.T) {
	cases := map[string][]byte{}
	for _, name := range []string{"plan", "state", "comparison"} {
		data, err := os.ReadFile(filepath.Join("..", "..", "form", "testdata", name+".json"))
		if err != nil {
			t.Fatal(err)
		}
		decoded, err := form.Decode(data)
		if err != nil {
			t.Fatal(err)
		}
		r := runResult{decoded: decoded, operands: []operand{{name: name + ".json", compiled: name != "comparison"}}}
		if decoded.Input != nil {
			r.focus, r.focusStage = decoded.Input, decoded.Input.DefaultStage
		}
		cases[name] = buildRunReport(r, cli.Options{}).markdown()
	}
	c := plannedChanges(76, 0)
	for _, kind := range []struct {
		kind   form.FactKind
		count  int
		prefix string
	}{{form.FactRelation, 18, "relation:rf.relation.routes-to"}, {form.FactContext, 68, "context:rf.context.network"}, {form.FactContribution, 14, "contribution"}} {
		for i := 0; i < kind.count; i++ {
			withFacts(c, kind.kind, form.ChangeAdded, fmt.Sprintf("%s:object.part.%02d:object.whole", kind.prefix, i))
		}
	}
	rep := runReport{verdict: "Plan analyzed", head: [][2]string{{"Input", "plan.json"}}, literal: map[string]bool{"Input": true}, blocks: []reportBlock{comparisonBlock("Planned changes", c, nil, nil, false, true)}}
	cases["changes"] = rep.markdown()
	rep.details = true
	cases["changes-complete"] = rep.markdown()
	rep.details = false
	rep.blocks = append([]reportBlock{{role: roleUncertainty, table: &reportTable{header: []string{"", "Planned"}, numeric: true, rows: [][]string{{"Indeterminate closures", "27"}, {"  Unavailable", "26"}, {"  Unknown until apply", "1"}}}}}, rep.blocks...)
	cases["uncertainty"] = rep.markdown()
	drift := &form.InputForm{DriftReport: &form.DriftReport{Entries: []form.DriftEntry{{Address: "object.drift", Actions: []string{"update"}, Consequence: form.DriftArchitectural, FactChanges: []string{"relation:a:b"}}}}}
	driftBlock := driftBlock(drift, nil)
	driftBlock.comparison = &form.Comparison{Before: form.StageRecorded, After: form.StageRefreshed, Comparable: true, Indeterminate: []form.IndeterminateClosure{{Side: form.SideBefore, Reasons: []form.Reason{form.ReasonUnavailable}}}}
	driftBlock.table, _ = indeterminateTable(driftBlock.comparison.Indeterminate, "Recorded", "Refreshed")
	net := plannedChanges(2, 1)
	net.Before = form.StageRecorded
	rep.blocks = []reportBlock{comparisonBlock("Planned changes", c, nil, nil, false, true), driftBlock, comparisonBlock("Net change", net, nil, nil, false, true)}
	rep.blocks[2].role = roleNet
	cases["drift-net"] = rep.markdown()
	policy := reviewPolicyFixture()
	if policy.Status != policyresult.StatusViolated {
		t.Fatal("Policy fixture must record a violation")
	}
	cases["policies"] = checkMarkdown(policy, &checkRun{options: cli.CheckOptions{Input: "comparison.json"}})
	for _, variant := range []struct {
		name    string
		outcome policyresult.Outcome
		verdict policyresult.PolicyOutcome
	}{
		{"policies-pass", policyresult.OutcomePassed, policyresult.PolicyPassed},
		{"policies-indeterminate", policyresult.OutcomeIndeterminate, policyresult.PolicyIndeterminate},
	} {
		result := reviewPolicyFixture()
		result.Architectures[0].Evaluations[0].Outcome = variant.outcome
		result.Architectures[0].Policies[0].Outcome = variant.verdict
		if variant.outcome == policyresult.OutcomeIndeterminate {
			result.Architectures[0].Evaluations[0].Reasons = []string{string(form.ReasonUnavailable)}
		}
		cases[variant.name] = checkMarkdown(result.Finalized(), &checkRun{options: cli.CheckOptions{Input: "comparison.json"}})
	}
	for _, incomplete := range []bool{false, true} {
		result := reviewPolicyFixture()
		result.Architectures = result.Architectures[1:]
		result.Architectures[0].Side = ""
		result.Scope = policyresult.ScopeInput
		result.Architectures[0].Evaluations = nil
		p := &result.Architectures[0].Policies[0]
		p.Targets, p.Outcome = 0, policyresult.PolicyNoTarget
		name := "policies-no-target"
		if incomplete {
			p.Complete, p.Reasons = false, []string{string(form.ReasonUnavailable)}
			name = "policies-incomplete"
		}
		cases[name] = checkMarkdown(result.Finalized(), &checkRun{options: cli.CheckOptions{Input: "form.json"}})
	}
	policy.Architectures[1].Status = policyresult.StatusFailed
	policy.Architectures[1].Diagnostics = []policyresult.Diagnostic{{Message: "This side could not be evaluated."}}
	cases["policy-failed"] = checkMarkdown(policy, &checkRun{options: cli.CheckOptions{Input: "comparison.json"}})
	for name, got := range cases {
		t.Run(name, func(t *testing.T) {
			path := filepath.Join("testdata", "review", name+".md")
			if os.Getenv("ROOTFORM_UPDATE_REVIEW_GOLDENS") == "1" {
				if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
					t.Fatal(err)
				}
				if err := os.WriteFile(path, got, 0o644); err != nil {
					t.Fatal(err)
				}
			}
			want, err := os.ReadFile(path)
			if err != nil {
				t.Fatal(err)
			}
			if string(got) != string(want) {
				t.Fatalf("review golden %s differs; inspect rendering before updating", name)
			}
			assertInertReview(t, string(got), strings.Count(string(got), "<details>"))
			if strings.Count(string(got), "## Rootform\n") != 1 || strings.Count(string(got), "\n---\n") != 1 {
				t.Fatal("review must have one identity and one separator before provenance")
			}
			for _, line := range strings.Split(string(got), "\n") {
				if strings.HasPrefix(line, "# ") || strings.HasPrefix(line, "#####") || strings.HasPrefix(line, "## ") && line != "## Rootform" {
					t.Fatalf("unexpected heading depth: %s", line)
				}
			}
			inOrder(t, string(got), "---\n\n### Details\n", "<summary>Provenance</summary>")
			if name == "changes-complete" && (strings.Contains(string(got), "shown") || strings.Contains(string(got), reviewPreview) || !strings.Contains(string(got), "object.added.75")) {
				t.Fatal("complete folded report must contain all entries without preview wording")
			}
			if name == "policies-no-target" || name == "policies-incomplete" {
				if strings.Contains(string(got), "#### Without target") || strings.Contains(string(got), "#### Incomplete coverage") || !strings.Contains(string(got), "**Without target**") {
					t.Fatal("coverage and target states are content, not navigation")
				}
			}
			if name == "policies" && !strings.Contains(string(got), "> [!CAUTION]\n> **Overall verdict: VIOLATED**") || name == "policies-indeterminate" && !strings.Contains(string(got), "> [!WARNING]\n> **Overall verdict: INDETERMINATE**") || name == "policies-pass" && strings.Contains(string(got), "> [!") {
				t.Fatal("alert does not match the recorded verdict")
			}
		})
	}
}
