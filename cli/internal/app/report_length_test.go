package app

import (
	"bytes"
	"fmt"
	"strings"
	"testing"

	"github.com/rootform-dev/rootform/cli/form"
	cli "github.com/rootform-dev/rootform/cli/internal/command"
	"github.com/rootform-dev/rootform/cli/internal/human"
	"github.com/rootform-dev/rootform/cli/policyresult"
)

// The text summary lists every violated and indeterminate evaluation and every
// evidence line; a Markdown review keeps ten evaluations per outcome and five
// evidence lines unless --details asks for all of them.
func TestCheckTextListsEveryEntryWhileMarkdownAbbreviates(t *testing.T) {
	a := policyresult.Architecture{Kind: "plan", Stage: form.StagePlanned, Summary: policyresult.Summary{Policies: policyresult.PolicyCounts{Selected: 1}}}
	for i := range 12 {
		a.Evaluations = append(a.Evaluations, policyresult.Evaluation{ID: fmt.Sprintf("v%02d", i), Policy: "pack.policy.tagged", Address: fmt.Sprintf("res.item_%02d", i), Stage: form.StagePlanned, Outcome: policyresult.OutcomeViolated})
	}
	for i := range 11 {
		a.Evaluations = append(a.Evaluations, policyresult.Evaluation{ID: fmt.Sprintf("i%02d", i), Policy: "pack.policy.tagged", Address: fmt.Sprintf("res.open_%02d", i), Stage: form.StagePlanned, Outcome: policyresult.OutcomeIndeterminate, Reasons: []string{"unknown_value"}})
	}
	r := policyresult.Result{Scope: policyresult.ScopeInput, Selection: policyresult.Selection{Selectors: []string{}, Policies: []string{"pack.policy.tagged"}}, Architectures: []policyresult.Architecture{a}}.Finalized()
	complete := architectureSide("", r.Architectures[0], nil, false)
	if len(complete.sections) != 2 || len(complete.sections[0].entries) != 12 || len(complete.sections[1].entries) != 11 {
		t.Fatalf("text sections: %+v", complete.sections)
	}
	preview := string(checkMarkdown(r, &checkRun{}))
	if !strings.Contains(preview, "**Violated: 10 of 12 evaluations shown**") || !strings.Contains(preview, "**Indeterminate: 10 of 11 evaluations shown**") || !strings.Contains(preview, "1 Policy selected. 23 evaluations: 12 violated and 11 indeterminate.") || !strings.Contains(preview, checkPreview) || strings.Contains(preview, "res.item_10") || strings.Contains(preview, "res.open_10") {
		t.Fatalf("Markdown preview:\n%s", preview)
	}
	full := string(checkMarkdown(r, &checkRun{options: cli.CheckOptions{Details: true}}))
	if !strings.Contains(full, "res.item_11") || !strings.Contains(full, "res.open_10") || strings.Contains(full, "shown") || strings.Contains(full, checkPreview) {
		t.Fatalf("--details review:\n%s", full)
	}
	lines := []string{"a", "b", "c", "d", "e", "f", "g"}
	if rows := labeledLines("Evidence", lines); len(rows) != len(lines) {
		t.Fatalf("every evidence line was not listed: %v", rows)
	}
	if shown, cut := previewEvidence(lines, false); !cut || len(shown) != reportFactLimit+1 || shown[reportFactLimit] != "5 of 7 evidence lines shown." {
		t.Fatalf("Markdown evidence was not abbreviated: %v", shown)
	}
	if shown, cut := previewEvidence(lines, true); cut || len(shown) != len(lines) {
		t.Fatalf("--details evidence: %v", shown)
	}
}

// An explanation lists every row of a list; --details adds codes, never rows.
func TestExplanationListsEveryRow(t *testing.T) {
	rows := [][]string{}
	for i := range 14 {
		rows = append(rows, []string{fmt.Sprintf("-> contribution part.%02d", i), "whole", "evidence: attribute"})
	}
	var b bytes.Buffer
	writeList(&b, "Facts", rows, func(string) human.Status { return human.Unknown })
	if text := b.String(); !strings.Contains(text, "part.00") || !strings.Contains(text, "part.13") || strings.Contains(text, "shown") || strings.Contains(text, "--details") {
		t.Fatalf("list:\n%s", text)
	}
}
