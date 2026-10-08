package policyresult

import (
	"encoding/json"
	"sort"
	"strings"

	"github.com/rootform-dev/rootform/cli/form"
)

const sarifSchema = "https://docs.oasis-open.org/sarif/sarif/v2.1.0/errata01/os/schemas/sarif-schema-2.1.0.json"

type sarifText struct {
	Text string `json:"text"`
}
type sarifRule struct {
	ID               string    `json:"id"`
	ShortDescription sarifText `json:"shortDescription"`
	Properties       struct {
		Policy string `json:"policy"`
	} `json:"properties"`
}
type sarifLocation struct {
	LogicalLocations []sarifLogicalLocation `json:"logicalLocations"`
}
type sarifLogicalLocation struct {
	FullyQualifiedName string `json:"fullyQualifiedName"`
	Kind               string `json:"kind"`
}
type sarifResultProperties struct {
	Stage      form.Stage `json:"stage"`
	Address    string     `json:"address"`
	Target     string     `json:"target"`
	Evaluation string     `json:"evaluation"`
	Reasons    []string   `json:"reasons,omitempty"`
}
type sarifResult struct {
	RuleID              string                `json:"ruleId"`
	RuleIndex           int                   `json:"ruleIndex"`
	Kind                string                `json:"kind"`
	Level               string                `json:"level"`
	Message             sarifText             `json:"message"`
	Locations           []sarifLocation       `json:"locations"`
	PartialFingerprints map[string]string     `json:"partialFingerprints"`
	Properties          sarifResultProperties `json:"properties"`
}
type sarifNotification struct {
	Level      string    `json:"level"`
	Message    sarifText `json:"message"`
	Descriptor struct {
		ID string `json:"id"`
	} `json:"descriptor"`
}
type sarifInvocation struct {
	ExecutionSuccessful        bool                `json:"executionSuccessful"`
	ToolExecutionNotifications []sarifNotification `json:"toolExecutionNotifications,omitempty"`
}
type sarifDriver struct {
	Name           string      `json:"name"`
	Version        string      `json:"version"`
	InformationURI string      `json:"informationUri"`
	Rules          []sarifRule `json:"rules"`
}

// sarifRunProperties identify the architecture a run evaluated and the
// invocation it belongs to. A run without an architecture reports an
// invocation that stopped before any side was evaluated.
type sarifRunProperties struct {
	Side          string        `json:"side,omitempty"`
	Kind          string        `json:"kind,omitempty"`
	Stage         form.Stage    `json:"stage,omitempty"`
	Digest        string        `json:"digest,omitempty"`
	Status        Status        `json:"status"`
	Summary       *Summary      `json:"summary,omitempty"`
	OverallStatus Status        `json:"overall_status"`
	Form          *FormIdentity `json:"form,omitempty"`
	Scope         Scope         `json:"scope,omitempty"`
	Selection     Selection     `json:"selection"`
}
type sarifAutomation struct {
	ID string `json:"id"`
}
type sarifRun struct {
	Tool struct {
		Driver sarifDriver `json:"driver"`
	} `json:"tool"`
	AutomationDetails *sarifAutomation   `json:"automationDetails,omitempty"`
	Results           []sarifResult      `json:"results"`
	Invocations       []sarifInvocation  `json:"invocations"`
	Properties        sarifRunProperties `json:"properties"`
}
type sarifLog struct {
	Schema  string     `json:"$schema"`
	Version string     `json:"version"`
	Runs    []sarifRun `json:"runs"`
}

// SerializeSARIF writes one run per evaluated architecture, so the two sides
// of a comparison never read as duplicates of each other. Locations are
// logical only: a Form holds no source file, line or region.
func SerializeSARIF(result Result) ([]byte, error) {
	r := result.Finalized()
	runs := []sarifRun{}
	for i := range r.Architectures {
		runs = append(runs, sarifArchitectureRun(r, &r.Architectures[i]))
	}
	if len(runs) == 0 {
		runs = append(runs, sarifArchitectureRun(r, nil))
	}
	data, err := json.MarshalIndent(sarifLog{Schema: sarifSchema, Version: "2.1.0", Runs: runs}, "", "  ")
	if err != nil {
		return nil, err
	}
	return append(data, '\n'), nil
}

func sarifArchitectureRun(r Result, a *Architecture) sarifRun {
	run := sarifRun{Results: []sarifResult{}, Invocations: []sarifInvocation{{ExecutionSuccessful: r.Status != StatusFailed}}}
	run.Tool.Driver = sarifDriver{Name: "rootform", Version: r.Generator.Version, InformationURI: "https://rootform.dev", Rules: []sarifRule{}}
	run.Properties = sarifRunProperties{Status: r.Status, OverallStatus: r.Status, Form: r.Form, Scope: r.Scope, Selection: r.Selection}
	notices := r.Diagnostics
	var policies []PolicyResult
	var evaluations []Evaluation
	if a != nil {
		summary := a.Summary
		run.Properties.Side, run.Properties.Kind, run.Properties.Stage, run.Properties.Digest = a.Side, a.Kind, a.Stage, a.Digest
		run.Properties.Status, run.Properties.Summary = a.Status, &summary
		run.Invocations[0].ExecutionSuccessful = a.Status != StatusFailed
		if a.Side != "" {
			run.AutomationDetails = &sarifAutomation{ID: "rootform-check/" + a.Side + "/"}
		}
		notices = append(append([]Diagnostic{}, r.Diagnostics...), a.Diagnostics...)
		policies, evaluations = a.Policies, append([]Evaluation{}, a.Evaluations...)
	}
	messages := map[string]string{}
	for _, p := range policies {
		messages[p.ID] = p.Message
	}
	for _, id := range r.Selection.Policies {
		msg := messages[id]
		if msg == "" {
			msg = id
		}
		rule := sarifRule{ID: sarifPolicyID(id), ShortDescription: sarifText{Text: msg}}
		rule.Properties.Policy = id
		run.Tool.Driver.Rules = append(run.Tool.Driver.Rules, rule)
	}
	sort.Slice(run.Tool.Driver.Rules, func(i, j int) bool { return run.Tool.Driver.Rules[i].ID < run.Tool.Driver.Rules[j].ID })
	ruleIndexes := map[string]int{}
	for i, rule := range run.Tool.Driver.Rules {
		ruleIndexes[rule.Properties.Policy] = i
	}
	sort.Slice(evaluations, func(i, j int) bool {
		a, b := evaluations[i], evaluations[j]
		if sarifPolicyID(a.Policy) != sarifPolicyID(b.Policy) {
			return sarifPolicyID(a.Policy) < sarifPolicyID(b.Policy)
		}
		if a.Address != b.Address {
			return a.Address < b.Address
		}
		return a.ID < b.ID
	})
	for _, e := range evaluations {
		msg := messages[e.Policy]
		if msg == "" {
			msg = e.Policy
		}
		sr := sarifResult{
			RuleID: sarifPolicyID(e.Policy), RuleIndex: ruleIndexes[e.Policy],
			Locations:           []sarifLocation{{LogicalLocations: []sarifLogicalLocation{{FullyQualifiedName: e.Address, Kind: "resource"}}}},
			PartialFingerprints: map[string]string{"rootformEvaluation/v1": e.ID},
			Properties:          sarifResultProperties{Stage: e.Stage, Address: e.Address, Target: e.Target, Evaluation: e.ID},
		}
		switch e.Outcome {
		case OutcomePassed:
			sr.Kind, sr.Level, sr.Message = "pass", "none", sarifText{Text: "Passed: " + msg}
		case OutcomeViolated:
			sr.Kind, sr.Level, sr.Message = "fail", "error", sarifText{Text: msg}
		default:
			sr.Kind, sr.Level = "review", "none"
			sr.Message = sarifText{Text: "Indeterminate (" + strings.Join(e.Reasons, ", ") + "): " + msg}
			sr.Properties.Reasons = sorted(e.Reasons)
		}
		run.Results = append(run.Results, sr)
	}
	if !run.Invocations[0].ExecutionSuccessful {
		for _, d := range notices {
			if d.Severity != SeverityError {
				continue
			}
			n := sarifNotification{Level: "error", Message: sarifText{Text: d.Code + ": " + d.Message}}
			n.Descriptor.ID = d.Code
			run.Invocations[0].ToolExecutionNotifications = append(run.Invocations[0].ToolExecutionNotifications, n)
		}
	}
	return run
}

func sarifPolicyID(id string) string {
	parts := strings.SplitN(id, ".policy.", 2)
	if len(parts) == 2 {
		return parts[0] + "/" + parts[1]
	}
	return id
}
