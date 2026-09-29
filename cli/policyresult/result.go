// Package policyresult defines the Policy result, format 1, that records the
// evaluation of Policies against the architectures of a Form, and its SARIF
// 2.1.0 rendering.
package policyresult

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"sort"

	"github.com/rootform-dev/rootform/cli/form"
)

// FormatVersion names the Policy result contract family. It is versioned apart
// from the Form it evaluates, whose format a result names separately.
const FormatVersion = "1"

const (
	maxPolicies       = 1024
	maxEvaluations    = 100000
	maxFactReferences = 100000
)

type Outcome string

const (
	OutcomePassed        Outcome = "passed"
	OutcomeViolated      Outcome = "violated"
	OutcomeIndeterminate Outcome = "indeterminate"
)

type PolicyOutcome string

const (
	PolicyPassed        PolicyOutcome = "passed"
	PolicyViolated      PolicyOutcome = "violated"
	PolicyIndeterminate PolicyOutcome = "indeterminate"
	PolicyNoTarget      PolicyOutcome = "no_target"
)

type Status string

const (
	StatusPassed        Status = "passed"
	StatusViolated      Status = "violated"
	StatusIndeterminate Status = "indeterminate"
	StatusNoDecision    Status = "no_decision"
	StatusFailed        Status = "failed"
)

// Scope names the architectures an invocation asked to evaluate: the one
// architecture of a plan, state or saved single-input Form, or the sides of a
// comparison Form.
type Scope string

const (
	ScopeInput  Scope = "input"
	ScopeBefore Scope = "before"
	ScopeAfter  Scope = "after"
	ScopeBoth   Scope = "both"
)

type Severity string

const (
	SeverityError   Severity = "error"
	SeverityWarning Severity = "warning"
	SeverityInfo    Severity = "info"
)

type FormIdentity struct {
	Kind      string         `json:"kind"`
	Origin    string         `json:"origin"`
	Digest    string         `json:"digest"`
	Generator form.Generator `json:"generator"`
}

type Selection struct {
	Selectors []string `json:"selectors"`
	Policies  []string `json:"policies"`
}

type SemanticOwner struct {
	ID             string                 `json:"id"`
	Kind           form.SemanticOwnerKind `json:"kind"`
	Version        string                 `json:"version"`
	SemanticDigest string                 `json:"semantic_digest"`
}

type PolicyPack struct {
	ID            string        `json:"id"`
	Version       string        `json:"version"`
	ContentDigest string        `json:"content_digest"`
	Linked        bool          `json:"linked"`
	LinkedDigest  string        `json:"linked_digest,omitempty"`
	Pins          []SemanticPin `json:"pins,omitempty"`
}

type SemanticPin struct {
	Owner          string `json:"owner"`
	Kind           string `json:"kind"`
	Version        string `json:"version"`
	SemanticDigest string `json:"semantic_digest"`
}

type TargetDefinition struct {
	Concept  string   `json:"concept,omitempty"`
	Rules    []string `json:"rules"`
	Dialects []string `json:"dialects"`
}

type PolicyResult struct {
	ID        string           `json:"id"`
	Message   string           `json:"message"`
	Assertion string           `json:"assertion"`
	Target    TargetDefinition `json:"target"`
	Targets   int              `json:"targets"`
	Complete  bool             `json:"complete"`
	Reasons   []string         `json:"reasons"`
	Outcome   PolicyOutcome    `json:"outcome"`
}

type Evaluation struct {
	ID                string     `json:"id"`
	Policy            string     `json:"policy"`
	Message           string     `json:"message"`
	Target            string     `json:"target"`
	Address           string     `json:"address"`
	Rule              string     `json:"rule"`
	Concept           string     `json:"concept"`
	Stage             form.Stage `json:"stage"`
	Outcome           Outcome    `json:"outcome"`
	Reasons           []string   `json:"reasons"`
	InspectedFacts    []string   `json:"inspected_facts"`
	InspectedClosures []string   `json:"inspected_closures"`
}

type Violation struct {
	ID                string   `json:"id"`
	Policy            string   `json:"policy"`
	Target            string   `json:"target"`
	Address           string   `json:"address"`
	Message           string   `json:"message"`
	InspectedFacts    []string `json:"inspected_facts"`
	InspectedClosures []string `json:"inspected_closures"`
}

type Diagnostic struct {
	Severity Severity `json:"severity"`
	Code     string   `json:"code"`
	Message  string   `json:"message"`
	Policy   string   `json:"policy,omitempty"`
	Target   string   `json:"target,omitempty"`
}

type PolicyCounts struct {
	Selected      int `json:"selected"`
	Passed        int `json:"passed"`
	Violated      int `json:"violated"`
	Indeterminate int `json:"indeterminate"`
	NoTarget      int `json:"no_target"`
}

type EvaluationCounts struct {
	Total         int `json:"total"`
	Passed        int `json:"passed"`
	Violated      int `json:"violated"`
	Indeterminate int `json:"indeterminate"`
}

type Summary struct {
	Policies    PolicyCounts     `json:"policies"`
	Evaluations EvaluationCounts `json:"evaluations"`
}

// Architecture is the evaluation of the selected Policies against one
// architecture stage: the single architecture of an input, or one side of a
// comparison Form. Each side is linked against its own recorded semantics.
type Architecture struct {
	Side           string          `json:"side,omitempty"`
	Kind           string          `json:"kind"`
	Stage          form.Stage      `json:"stage"`
	Digest         string          `json:"digest"`
	ReleaseSet     form.ReleaseSet `json:"release_set"`
	SemanticOwners []SemanticOwner `json:"semantic_owners"`
	PolicyPacks    []PolicyPack    `json:"policy_packs"`
	Status         Status          `json:"status"`
	Summary        Summary         `json:"summary"`
	Policies       []PolicyResult  `json:"policies"`
	Evaluations    []Evaluation    `json:"evaluations"`
	Violations     []Violation     `json:"violations"`
	Diagnostics    []Diagnostic    `json:"diagnostics"`
}

// Result is one check invocation: the Form it received, the scope it asked
// for, one selection shared by every architecture, and the overall status.
type Result struct {
	FormatVersion     string         `json:"format_version"`
	FormFormatVersion string         `json:"form_format_version"`
	Generator         form.Generator `json:"generator"`
	Form              *FormIdentity  `json:"form,omitempty"`
	Scope             Scope          `json:"scope,omitempty"`
	Selection         Selection      `json:"selection"`
	Status            Status         `json:"status"`
	Architectures     []Architecture `json:"architectures"`
	Diagnostics       []Diagnostic   `json:"diagnostics"`
}

// NewResult starts an invocation result without architectures.
func NewResult() Result {
	return Result{FormatVersion: FormatVersion, FormFormatVersion: form.FormatVersion, Selection: Selection{Selectors: []string{}, Policies: []string{}}, Architectures: []Architecture{}, Diagnostics: []Diagnostic{}, Status: StatusNoDecision}
}

func newArchitecture(selected int) Architecture {
	return Architecture{SemanticOwners: []SemanticOwner{}, PolicyPacks: []PolicyPack{}, Policies: []PolicyResult{}, Evaluations: []Evaluation{}, Violations: []Violation{}, Diagnostics: []Diagnostic{}, Status: StatusNoDecision, Summary: Summary{Policies: PolicyCounts{Selected: selected}}}
}

// Finalized counts one architecture's outcomes and derives its status. The
// number of selected Policies is kept from the summary, so a decoded result
// finalizes to itself.
func (a Architecture) Finalized() Architecture {
	selected := a.Summary.Policies.Selected
	a = a.canonical()
	a.Summary = Summary{Policies: PolicyCounts{Selected: selected}}
	if a.Status == StatusFailed {
		a.Policies = []PolicyResult{}
		a.Evaluations = []Evaluation{}
		a.Violations = []Violation{}
		return a
	}
	for _, p := range a.Policies {
		switch p.Outcome {
		case PolicyPassed:
			a.Summary.Policies.Passed++
		case PolicyViolated:
			a.Summary.Policies.Violated++
		case PolicyIndeterminate:
			a.Summary.Policies.Indeterminate++
		case PolicyNoTarget:
			a.Summary.Policies.NoTarget++
		}
	}
	a.Summary.Evaluations.Total = len(a.Evaluations)
	for _, e := range a.Evaluations {
		switch e.Outcome {
		case OutcomePassed:
			a.Summary.Evaluations.Passed++
		case OutcomeViolated:
			a.Summary.Evaluations.Violated++
		case OutcomeIndeterminate:
			a.Summary.Evaluations.Indeterminate++
		}
	}
	switch {
	case a.Summary.Policies.Selected == 0:
		a.Status = StatusNoDecision
	case a.Summary.Policies.Violated > 0:
		a.Status = StatusViolated
	case a.Summary.Policies.Indeterminate > 0:
		a.Status = StatusIndeterminate
	case a.Summary.Policies.Passed == a.Summary.Policies.Selected:
		a.Status = StatusPassed
	default:
		// A selected Policy without a passing outcome never lets the result pass.
		a.Status = StatusNoDecision
	}
	return a
}

// statusRank orders statuses for the overall verdict: a confirmed violation on
// any side decides it; otherwise any side without a decision withholds it.
var statusRank = map[Status]int{StatusViolated: 0, StatusFailed: 1, StatusIndeterminate: 2, StatusNoDecision: 3, StatusPassed: 4}

// Finalized canonicalizes the invocation and derives its overall status from
// the requested architectures. A result without architectures keeps a failed
// status set by Unavailable, and otherwise decides nothing.
func (r Result) Finalized() Result {
	o := r
	o.Selection = Selection{Selectors: sorted(r.Selection.Selectors), Policies: sorted(r.Selection.Policies)}
	o.Architectures = make([]Architecture, len(r.Architectures))
	for i, a := range r.Architectures {
		o.Architectures[i] = a.Finalized()
	}
	sort.SliceStable(o.Architectures, func(i, j int) bool {
		return sideRank(o.Architectures[i].Side) < sideRank(o.Architectures[j].Side)
	})
	o.Diagnostics = canonicalDiagnostics(r.Diagnostics)
	if len(o.Architectures) == 0 {
		if o.Status != StatusFailed {
			o.Status = StatusNoDecision
		}
		return o
	}
	o.Status = StatusPassed
	for _, a := range o.Architectures {
		if statusRank[a.Status] < statusRank[o.Status] {
			o.Status = a.Status
		}
	}
	return o
}

func sideRank(side string) int {
	switch side {
	case form.SideBefore:
		return 1
	case form.SideAfter:
		return 2
	}
	return 0
}

// ExitCode is the process status of a check verdict: 0 passed, 1 violated,
// 3 when no verdict could be reached.
func ExitCode(s Status) int {
	switch s {
	case StatusPassed:
		return 0
	case StatusViolated:
		return 1
	default:
		return 3
	}
}

func (a Architecture) canonical() Architecture {
	o := a
	o.ReleaseSet.Units = append([]form.ReleaseSetUnit{}, a.ReleaseSet.Units...)
	o.SemanticOwners = append([]SemanticOwner{}, a.SemanticOwners...)
	o.PolicyPacks = append([]PolicyPack{}, a.PolicyPacks...)
	o.Policies = append([]PolicyResult{}, a.Policies...)
	o.Evaluations = append([]Evaluation{}, a.Evaluations...)
	o.Violations = append([]Violation{}, a.Violations...)
	o.Diagnostics = canonicalDiagnostics(a.Diagnostics)
	sort.Slice(o.SemanticOwners, func(i, j int) bool { return o.SemanticOwners[i].ID < o.SemanticOwners[j].ID })
	sort.Slice(o.PolicyPacks, func(i, j int) bool { return o.PolicyPacks[i].ID < o.PolicyPacks[j].ID })
	for i := range o.PolicyPacks {
		o.PolicyPacks[i].Pins = append([]SemanticPin{}, o.PolicyPacks[i].Pins...)
		sort.Slice(o.PolicyPacks[i].Pins, func(a, b int) bool { return o.PolicyPacks[i].Pins[a].Owner < o.PolicyPacks[i].Pins[b].Owner })
		if len(o.PolicyPacks[i].Pins) == 0 {
			o.PolicyPacks[i].Pins = nil
		}
	}
	for i := range o.Policies {
		o.Policies[i].Target.Rules = sorted(o.Policies[i].Target.Rules)
		o.Policies[i].Target.Dialects = sorted(o.Policies[i].Target.Dialects)
		o.Policies[i].Reasons = sorted(o.Policies[i].Reasons)
	}
	sort.Slice(o.Policies, func(i, j int) bool { return o.Policies[i].ID < o.Policies[j].ID })
	for i := range o.Evaluations {
		o.Evaluations[i].Reasons = sorted(o.Evaluations[i].Reasons)
		o.Evaluations[i].InspectedFacts = sorted(o.Evaluations[i].InspectedFacts)
		o.Evaluations[i].InspectedClosures = sorted(o.Evaluations[i].InspectedClosures)
	}
	sort.Slice(o.Evaluations, func(i, j int) bool { return o.Evaluations[i].ID < o.Evaluations[j].ID })
	for i := range o.Violations {
		o.Violations[i].InspectedFacts = sorted(o.Violations[i].InspectedFacts)
		o.Violations[i].InspectedClosures = sorted(o.Violations[i].InspectedClosures)
	}
	sort.Slice(o.Violations, func(i, j int) bool { return o.Violations[i].ID < o.Violations[j].ID })
	return o
}

func canonicalDiagnostics(diagnostics []Diagnostic) []Diagnostic {
	o := append([]Diagnostic{}, diagnostics...)
	sort.Slice(o, func(i, j int) bool {
		a, b := o[i], o[j]
		if a.Code != b.Code {
			return a.Code < b.Code
		}
		if a.Policy != b.Policy {
			return a.Policy < b.Policy
		}
		return a.Target < b.Target
	})
	return o
}

func sorted(v []string) []string {
	o := append([]string{}, v...)
	sort.Strings(o)
	return o
}

func Serialize(r Result) ([]byte, error) {
	data, err := json.MarshalIndent(r.Finalized(), "", "  ")
	if err != nil {
		return nil, err
	}
	return append(data, '\n'), nil
}

// Decode reads a serialized Policy result. It refuses unknown fields and any
// other format family, and never evaluates anything.
func Decode(data []byte) (Result, error) {
	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.DisallowUnknownFields()
	var r Result
	if err := decoder.Decode(&r); err != nil {
		return Result{}, errors.New("the Policy result is not valid JSON of format 1")
	}
	if decoder.More() {
		return Result{}, errors.New("the Policy result holds more than one JSON value")
	}
	if r.FormatVersion != FormatVersion {
		return Result{}, fmt.Errorf("Policy result format %q is not supported; this rootform reads format %s", r.FormatVersion, FormatVersion)
	}
	if !validStatus(r.Status) {
		return Result{}, errors.New("the Policy result has no valid status")
	}
	for _, a := range r.Architectures {
		if !validStatus(a.Status) || a.Stage == "" || a.Kind == "" {
			return Result{}, errors.New("the Policy result holds an incomplete architecture")
		}
		if a.Side != "" && a.Side != form.SideBefore && a.Side != form.SideAfter {
			return Result{}, errors.New("the Policy result names an unknown side")
		}
	}
	return r, nil
}

func validStatus(s Status) bool {
	_, ok := statusRank[s]
	return ok
}

// Unavailable is an invocation that stopped before any architecture was
// evaluated.
func Unavailable(code, message string) Result {
	r := NewResult()
	r.Status = StatusFailed
	r.Diagnostics = []Diagnostic{{Severity: SeverityError, Code: code, Message: message}}
	return r.Finalized()
}

// ArchitectureUnavailable is one requested architecture that could not be
// evaluated, while the others still are.
func ArchitectureUnavailable(selected int, code, message string) Architecture {
	return failure(newArchitecture(selected), code, message)
}

func failure(a Architecture, code, message string) Architecture {
	a.Status = StatusFailed
	a.Diagnostics = []Diagnostic{{Severity: SeverityError, Code: code, Message: message}}
	return a.Finalized()
}
