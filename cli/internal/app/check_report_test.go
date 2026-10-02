package app

import (
	"fmt"
	"strings"
	"testing"

	"github.com/rootform-dev/rootform/cli/form"
	cli "github.com/rootform-dev/rootform/cli/internal/command"
	"github.com/rootform-dev/rootform/cli/policyresult"
)

func inOrder(t *testing.T, body string, markers ...string) {
	t.Helper()
	at := 0
	for _, marker := range markers {
		i := strings.Index(body[at:], marker)
		if i < 0 {
			t.Fatalf("%q is missing or out of order in:\n%s", marker, body)
		}
		at += i + len(marker)
	}
}

// unescapedPipes counts the pipes GFM splits a table row at.
func unescapedPipes(row string) int {
	count := 0
	for i := 0; i < len(row); i++ {
		if row[i] == '\\' {
			i++
			continue
		}
		if row[i] == '|' {
			count++
		}
	}
	return count
}

// Untrusted addresses and messages stay data in a Policy review: they never
// close a fold, open markup, split a table cell or start a line, and the
// overall verdict, the evaluation scope and each side's verdict stay apart.
func TestCheckReviewKeepsDataInert(t *testing.T) {
	digest := "sha256:" + strings.Repeat("a", 64)
	id := "checks.policy.pipes"
	message := "No | pipe </details><script>x</script> `tick`\u202e\nnext"
	side := func(name string, outcome policyresult.Outcome) policyresult.Architecture {
		verdict := policyresult.PolicyPassed
		if outcome == policyresult.OutcomeViolated {
			verdict = policyresult.PolicyViolated
		}
		a := policyresult.Architecture{Kind: "plan", Side: name, Stage: form.StagePlanned, Digest: digest, Summary: policyresult.Summary{Policies: policyresult.PolicyCounts{Selected: 1}}, Policies: []policyresult.PolicyResult{{ID: id, Message: message, Targets: 12, Complete: true, Outcome: verdict}}}
		for i := range 12 {
			a.Evaluations = append(a.Evaluations, policyresult.Evaluation{ID: fmt.Sprintf("%s%02d", name, i), Policy: id, Address: fmt.Sprintf("local_file.a[\"%02d|`</details>\"]", i), Message: message, Stage: form.StagePlanned, Outcome: outcome})
		}
		return a
	}
	r := policyresult.Result{
		Form:          &policyresult.FormIdentity{Kind: "comparison", Origin: "saved", Digest: digest},
		Scope:         policyresult.ScopeBoth,
		Selection:     policyresult.Selection{Selectors: []string{}, Policies: []string{id}},
		Architectures: []policyresult.Architecture{side(form.SideBefore, policyresult.OutcomeViolated), side(form.SideAfter, policyresult.OutcomePassed)},
	}.Finalized()
	preview := string(checkMarkdown(r, &checkRun{options: cli.CheckOptions{Input: "-"}}))
	assertInertReview(t, preview, 2)
	full := string(checkMarkdown(r, &checkRun{options: cli.CheckOptions{Input: "-", Details: true}}))
	assertInertReview(t, full, 4)
	for _, doc := range []string{preview, full} {
		inOrder(t, doc, "## Rootform\n\n### Policies\n\n> [!CAUTION]\n> **Overall verdict: VIOLATED**\n\nEvaluation scope: **Both sides**. 1 Policy selected.\n\n", "| Before | VIOLATED | Plan | Planned | 12 | 12 | 0 | 0 |\n", "| After | PASSED | Plan | Planned | 12 | 0 | 0 | 12 |\n", "\n#### Before\n", "\n**`checks.policy.pipes`**\n", "\n#### After\n", "\n### Details\n", "- **Input:** standard input\n")
		if strings.Contains(doc, "architecture of") {
			t.Fatalf("the verdict folds the sides into one phrase:\n%s", doc)
		}
		if strings.Count(doc, "**Requirement:**") != strings.Count(doc, "\n**`checks.policy.pipes`**") {
			t.Fatalf("the requirement is not stated once per Policy:\n%s", doc)
		}
	}
	if !strings.Contains(preview, "**Violated: 10 of 12 evaluations shown**") || !strings.Contains(preview, "All selected evaluations passed.") || !strings.Contains(preview, checkPreview) {
		t.Fatalf("preview:\n%s", preview)
	}
	if !strings.Contains(full, "<summary>Violated: 12 evaluations</summary>") || !strings.Contains(full, "<summary>Passed: 12 evaluations</summary>") || strings.Contains(full, "shown") {
		t.Fatalf("--details review:\n%s", full)
	}
}

// A check of both sides states the overall verdict the result records, the
// evaluation scope, and each side's origin, stage, counts and verdict apart:
// sides at different stages never share one phrase, and the review states
// the recorded statuses without recomputing any.
func TestCheckReviewStatesEachSideApart(t *testing.T) {
	digest := "sha256:" + strings.Repeat("c", 64)
	id := "checks.policy.sides"
	side := func(name, kind string, stage form.Stage, outcome policyresult.Outcome, verdict policyresult.PolicyOutcome) policyresult.Architecture {
		return policyresult.Architecture{Kind: kind, Side: name, Stage: stage, Digest: digest, Summary: policyresult.Summary{Policies: policyresult.PolicyCounts{Selected: 1}},
			Policies:    []policyresult.PolicyResult{{ID: id, Message: "Every file is reviewed.", Targets: 1, Complete: true, Outcome: verdict}},
			Evaluations: []policyresult.Evaluation{{ID: name, Policy: id, Address: "local_file." + name, Stage: stage, Outcome: outcome}}}
	}
	r := policyresult.Result{
		Form:          &policyresult.FormIdentity{Kind: "comparison", Origin: "saved", Digest: digest},
		Scope:         policyresult.ScopeBoth,
		Selection:     policyresult.Selection{Selectors: []string{}, Policies: []string{id}},
		Architectures: []policyresult.Architecture{side(form.SideBefore, "state", form.StageRecorded, policyresult.OutcomeViolated, policyresult.PolicyViolated), side(form.SideAfter, "plan", form.StagePlanned, policyresult.OutcomePassed, policyresult.PolicyPassed)},
	}.Finalized()
	run := &checkRun{options: cli.CheckOptions{Input: "sides.json"}}
	doc := string(checkMarkdown(r, run))
	assertInertReview(t, doc, 1)
	inOrder(t, doc, "## Rootform\n\n### Policies\n\n> [!CAUTION]\n> **Overall verdict: VIOLATED**\n\nEvaluation scope: **Both sides**. 1 Policy selected.\n\n| Side | Verdict | Origin | Stage | Evaluations | Violated | Indeterminate | Passed |\n| --- | --- | --- | --- | :---: | :---: | :---: | :---: |\n| Before | VIOLATED | State | Recorded | 1 | 1 | 0 | 0 |\n| After | PASSED | Plan | Planned | 1 | 0 | 0 | 1 |\n\n#### Before\n", "\n**`checks.policy.sides`**\n", "\n#### After\n\nAll selected evaluations passed.\n", "\n### Details\n")
	if strings.Contains(doc, "architecture of") || strings.Contains(doc, "both sides") {
		t.Fatalf("the stages of both sides are folded into one phrase:\n%s", doc)
	}
	r.Status = policyresult.StatusIndeterminate
	r.Architectures[1].Status = policyresult.StatusNoDecision
	doc = string(checkMarkdown(r, run))
	if !strings.Contains(doc, "**Overall verdict: INDETERMINATE**") || !strings.Contains(doc, "| After | NO DECISION | Plan | Planned | 1 | 0 | 0 | 1 |\n") {
		t.Fatalf("the review does not state the recorded statuses:\n%s", doc)
	}
}

// A Policy review shows at most ten evaluations of each outcome and five
// evidence lines of each evaluation. It states the exact totals and that it
// omits the rest, hides no violated or indeterminate evaluation from the
// counts, and --details lists every evaluation and evidence line; both
// render the same bytes, in the same order, every time.
func TestCheckReviewPreviewKeepsExactTotals(t *testing.T) {
	id := "checks.policy.limits"
	stage := &form.Architecture{Stage: form.StagePlanned}
	for j := range 7 {
		stage.Representations = append(stage.Representations, form.Representation{ID: fmt.Sprintf("rep:net.%d", j), Address: fmt.Sprintf("aws_vpc.n%d", j)})
	}
	a := policyresult.Architecture{Kind: "plan", Stage: form.StagePlanned, Digest: "sha256:" + strings.Repeat("d", 64), Summary: policyresult.Summary{Policies: policyresult.PolicyCounts{Selected: 1}},
		Policies: []policyresult.PolicyResult{{ID: id, Message: "Every file stays in its network.", Targets: 25, Complete: true, Outcome: policyresult.PolicyViolated}}}
	var addresses []string
	for _, group := range []struct {
		prefix  string
		count   int
		outcome policyresult.Outcome
	}{{"v", 12, policyresult.OutcomeViolated}, {"i", 11, policyresult.OutcomeIndeterminate}, {"p", 2, policyresult.OutcomePassed}} {
		for i := range group.count {
			addresses = append(addresses, fmt.Sprintf("local_file.%s%02d", group.prefix, i))
		}
		// The result lists them in reverse; the review orders them.
		for i := group.count - 1; i >= 0; i-- {
			address := fmt.Sprintf("local_file.%s%02d", group.prefix, i)
			target := "rep:" + address
			stage.Representations = append(stage.Representations, form.Representation{ID: target, Address: address})
			e := policyresult.Evaluation{ID: target, Policy: id, Target: target, Address: address, Stage: form.StagePlanned, Outcome: group.outcome}
			if group.outcome == policyresult.OutcomeIndeterminate {
				e.Reasons = []string{string(form.ReasonSensitive)}
			}
			for j := range 7 {
				fact := fmt.Sprintf("context:%s:%d", address, j)
				stage.Contexts = append(stage.Contexts, form.Context{ID: fact, From: target, To: fmt.Sprintf("rep:net.%d", j), Dimension: "rf.context.network"})
				e.InspectedFacts = append(e.InspectedFacts, fact)
			}
			a.Evaluations = append(a.Evaluations, e)
		}
	}
	r := policyresult.Result{Scope: policyresult.ScopeInput, Selection: policyresult.Selection{Selectors: []string{}, Policies: []string{id}}, Architectures: []policyresult.Architecture{a}}.Finalized()
	render := func(details bool) string {
		run := &checkRun{options: cli.CheckOptions{Input: "plan.json", Details: details}, targets: []checkTarget{{form: form.InputForm{Stages: map[form.Stage]*form.Architecture{form.StagePlanned: stage}}, stage: form.StagePlanned}}}
		doc := string(checkMarkdown(r, run))
		if again := string(checkMarkdown(r, run)); again != doc {
			t.Fatalf("two renderings differ:\n%s\n\n%s", doc, again)
		}
		return doc
	}
	evidence := func(address string, lines int) string {
		var b strings.Builder
		b.WriteString("- `" + address + "`\n")
		for j := range lines {
			fmt.Fprintf(&b, "  - The network context to `aws_vpc.n%d` is determined.\n", j)
		}
		return b.String()
	}

	preview := render(false)
	assertInertReview(t, preview, 3)
	markers := []string{"> **Verdict: VIOLATED**\n\n#### ▦ Planned architecture\n\n1 Policy selected. 25 evaluations: 12 violated, 11 indeterminate, and 2 passed.\n", "\n**Violated: 10 of 12 evaluations shown**\n\n"}
	for _, address := range addresses[:10] {
		markers = append(markers, evidence(address, 5)+"  - 5 of 7 evidence lines shown.\n")
	}
	markers = append(markers, "\n**Indeterminate: 10 of 11 evaluations shown**\n\n")
	for _, address := range addresses[12:22] {
		markers = append(markers, evidence(address, 5)+"  - 5 of 7 evidence lines shown.\n  - Reason: ")
	}
	inOrder(t, preview, append(markers, "\n### Details\n", "\n"+checkPreview+"\n")...)
	for _, hidden := range []string{"local_file.v10", "local_file.v11", "local_file.i10", "local_file.p00", "aws_vpc.n5", "aws_vpc.n6", "Passed"} {
		if strings.Contains(preview, hidden) {
			t.Fatalf("the preview shows %q:\n%s", hidden, preview)
		}
	}
	if n := strings.Count(preview, "  - 5 of 7 evidence lines shown.\n"); n != 20 || strings.Count(preview, "is determined.") != 100 {
		t.Fatalf("%d previews of evidence, want 20:\n%s", n, preview)
	}

	full := render(true)
	assertInertReview(t, full, 3)
	markers = []string{"<summary>Violated: 12 evaluations</summary>\n\n"}
	for i, address := range addresses {
		switch i {
		case 12:
			markers = append(markers, "</details>\n", "<summary>Indeterminate: 11 evaluations</summary>\n\n")
		case 23:
			markers = append(markers, "</details>\n", "**Passed: 2 evaluations**\n\n")
		}
		markers = append(markers, evidence(address, 7))
	}
	inOrder(t, full, markers...)
	if strings.Contains(full, "shown") || strings.Contains(full, checkPreview) || strings.Count(full, "is determined.") != 175 {
		t.Fatalf("--details review:\n%s", full)
	}
}
