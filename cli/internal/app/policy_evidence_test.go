package app

import (
	"strings"
	"testing"

	"github.com/rootform-dev/rootform/cli/form"
	"github.com/rootform-dev/rootform/cli/policyresult"
)

func inspectedContext(outcome form.Outcome, reason form.Reason, endpoints ...string) inspectedClosure {
	return inspectedClosure{Instance: "aws_subnet.a", Kind: "context", Name: "network", Target: "virtual-network", Via: "source.vpc_id", Match: "exact by id", Outcome: outcome, Reason: reason, Endpoints: endpoints}
}

func inspectedContribution(from string, outcome form.Outcome, reason form.Reason, none bool, endpoints ...string) inspectedClosure {
	return inspectedClosure{Instance: from, Kind: "contribution", Target: "subnet", Via: "source.subnet_id", Match: "exact by id", Outcome: outcome, Reason: reason, MatchesNoInstance: none, Endpoints: endpoints}
}

func recordedEvaluation(outcome policyresult.Outcome, reasons ...string) policyresult.Evaluation {
	return policyresult.Evaluation{Address: "aws_subnet.a", Target: "representation-a", Stage: form.StagePlanned, Outcome: outcome, Reasons: append([]string{}, reasons...)}
}

// A conclusion follows the recorded outcome and the evidence the evaluation
// inspected. It never reads the Policy message, never counts its way to a
// reason, and says so when only the result is at hand.
func TestEvaluationConclusionFollowsTheRecordedEvidence(t *testing.T) {
	unknown := string(form.ReasonUnknownUntilApply)
	unavailable := string(form.ReasonUnavailable)
	for _, c := range []struct {
		name      string
		e         explainedEvaluation
		described bool
		want      string
	}{
		{"determined", explainedEvaluation{
			Evaluation: recordedEvaluation(policyresult.OutcomePassed),
			Facts:      []inspectedFact{{ID: "fact", Kind: "context", Name: "network", From: "aws_subnet.a", To: "aws_vpc.main"}},
			Closures:   []inspectedClosure{inspectedContext(form.OutcomeResolved, "", "aws_vpc.main")},
		}, true, "The assertion holds for aws_subnet.a in the Planned stage: network context determined (to aws_vpc.main)."},
		{"absent", explainedEvaluation{
			Evaluation: recordedEvaluation(policyresult.OutcomeViolated),
			Closures:   []inspectedClosure{inspectedContext(form.OutcomeAbsent, "")},
		}, true, "The assertion is false for aws_subnet.a in the Planned stage: network context absent."},
		{"no incoming fact", explainedEvaluation{
			Evaluation: recordedEvaluation(policyresult.OutcomeViolated),
			Closures: []inspectedClosure{
				inspectedContribution("aws_instance.a", form.OutcomeIndeterminate, form.ReasonExternalDenied, true),
				inspectedContribution("aws_instance.b", form.OutcomeResolved, "", false, "aws_subnet.b"),
			},
		}, true, "The assertion is false for aws_subnet.a in the Planned stage: no contribution reaches it."},
		{"incoming undecided", explainedEvaluation{
			Evaluation: recordedEvaluation(policyresult.OutcomeIndeterminate, unknown),
			Closures:   []inspectedClosure{inspectedContribution("aws_instance.a", form.OutcomeIndeterminate, form.ReasonUnknownUntilApply, false)},
		}, true, "The evidence cannot settle the assertion for aws_subnet.a in the Planned stage: contribution indeterminate (unknown until apply)."},
		{"uninterpreted", explainedEvaluation{
			Evaluation:           recordedEvaluation(policyresult.OutcomeIndeterminate, unknown),
			InterpretationReason: unknown,
		}, true, "The evidence cannot settle the assertion for aws_subnet.a in the Planned stage: its interpretation is undecided (unknown until apply)."},
		{"query without evidence", explainedEvaluation{
			Evaluation: recordedEvaluation(policyresult.OutcomeIndeterminate, unavailable, unknown),
			Closures:   []inspectedClosure{inspectedContext(form.OutcomeIndeterminate, form.ReasonUnknownUntilApply)},
		}, true, "The evidence cannot settle the assertion for aws_subnet.a in the Planned stage: network context indeterminate (unknown until apply); a query of the assertion has no evidence to inspect."},
		{"no evidence", explainedEvaluation{Evaluation: recordedEvaluation(policyresult.OutcomePassed)}, true, "The assertion holds for aws_subnet.a in the Planned stage; its queries found no fact or closure."},
		{"result only", explainedEvaluation{Evaluation: recordedEvaluation(policyresult.OutcomeViolated)}, false, "The assertion is false for aws_subnet.a in the Planned stage."},
		{"result only undecided", explainedEvaluation{Evaluation: recordedEvaluation(policyresult.OutcomeIndeterminate, unavailable, unknown)}, false, "The evidence cannot settle the assertion for aws_subnet.a in the Planned stage; the result records these reasons: unavailable, unknown until apply."},
	} {
		t.Run(c.name, func(t *testing.T) {
			if got := evaluationConclusion(c.e, placeWords(form.StagePlanned, ""), c.described); got != c.want {
				t.Fatalf("conclusion:\n got %s\nwant %s", got, c.want)
			}
		})
	}
	if got := placeWords(form.StageRefreshed, "before"); got != "in the Refreshed stage of the Before side" {
		t.Fatalf("place: %s", got)
	}
}

// Evidence lines lead with what bears on the evaluated instance, state
// closures that read alike once, keep untrusted names inert, and separate
// what was inspected from what it concluded so a renderer can stack them.
func TestEvidenceLinesStateWhatBearsOnTheInstance(t *testing.T) {
	e := explainedEvaluation{
		Evaluation: recordedEvaluation(policyresult.OutcomeIndeterminate, string(form.ReasonUnknownUntilApply)),
		Closures: []inspectedClosure{
			inspectedContribution("aws_instance.c", form.OutcomeIndeterminate, form.ReasonExternalDenied, true),
			inspectedContribution("aws_instance.c", form.OutcomeIndeterminate, form.ReasonExternalDenied, true),
			inspectedContribution("aws_instance.b", form.OutcomeIndeterminate, form.ReasonUnknownUntilApply, false),
			inspectedContribution("aws_instance.a\x1b[31m", form.OutcomeResolved, "", false, "aws_subnet.a"),
		},
	}
	lines := evidenceLines(e, false)
	want := []string{
		"contribution from aws_instance.a\\u001b[31m via source.subnet_id:\nresolved to aws_subnet.a",
		"contribution from aws_instance.b via source.subnet_id:\nindeterminate (unknown until apply); could reach this instance",
		"contribution from aws_instance.c via source.subnet_id (2 closures):\nindeterminate (external endpoint denied); matches no instance",
	}
	if strings.Join(lines, "|") != strings.Join(want, "|") {
		t.Fatalf("evidence lines:\n%q\nwant\n%q", lines, want)
	}
	if detailed := evidenceLines(e, true); len(detailed) != 3 || !strings.Contains(detailed[2], "(match exact by id) (2 closures):") {
		t.Fatalf("detailed lines: %q", detailed)
	}
	uninterpreted := explainedEvaluation{Evaluation: recordedEvaluation(policyresult.OutcomeIndeterminate, "unknown_until_apply"), InterpretationReason: "unknown_until_apply"}
	if got := evidenceLines(uninterpreted, false); len(got) != 1 || got[0] != "none: no query of the assertion ran, as the interpretation of this instance is undecided (unknown until apply)" {
		t.Fatalf("uninterpreted evidence: %q", got)
	}
	if got := evidenceLines(explainedEvaluation{Evaluation: recordedEvaluation(policyresult.OutcomePassed)}, false); len(got) != 1 || got[0] != noEvidence {
		t.Fatalf("no evidence: %q", got)
	}
	short := layoutLine("context network -> vpc via source.vpc_id:\nabsent", 80)
	stacked := layoutLine("contribution from aws_instance.b via source.subnet_id:\nindeterminate (unknown until apply); could reach this instance", 70)
	if len(short) != 1 || short[0] != "context network -> vpc via source.vpc_id: absent" || len(stacked) != 2 || stacked[1] != "  indeterminate (unknown until apply); could reach this instance" {
		t.Fatalf("layout:\n%q\n%q", short, stacked)
	}
}

// An assertion too long for its line breaks before an operator, never
// inside an operand.
func TestAssertionLinesBreakBeforeOperators(t *testing.T) {
	assertion := "exists(contexts(rf.context.network, rf.concept.virtual-network)) || exists(contexts(rf.context.network, rf.concept.subnet))"
	lines := assertionLines(assertion, 65)
	if len(lines) != 2 || lines[0] != "exists(contexts(rf.context.network, rf.concept.virtual-network))" || lines[1] != "|| exists(contexts(rf.context.network, rf.concept.subnet))" {
		t.Fatalf("lines: %q", lines)
	}
	if got := assertionLines("exists(contexts(rf.context.network))", 65); len(got) != 1 {
		t.Fatalf("short assertion: %q", got)
	}
}
