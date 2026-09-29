package policyresult

import "github.com/rootform-dev/rootform/cli/form"

// InterpretationReason is the reason an evaluation records for an instance
// whose interpretation was not applied, so no query of its assertion ran.
func InterpretationReason(v *form.Interpretation) string {
	if v == nil {
		return string(form.ReasonUnavailable)
	}
	if v.Reason != "" {
		return string(v.Reason)
	}
	if v.Status == form.InterpretationFailed {
		return string(form.ReasonInterpretationFailed)
	}
	return string(form.ReasonUnavailable)
}

// MatchesNoInstance reports whether an undecided closure left every instance
// out as its endpoint: its value matched none and the Rule denies external
// endpoints, or no candidate stayed equal or unknown. Such a closure cannot
// establish a fact entering a Policy target.
func MatchesNoInstance(c form.Closure) bool {
	return c.Outcome == form.OutcomeIndeterminate && (c.Reason == form.ReasonExternalDenied || c.Candidates.KnownEqual == 0 && c.Candidates.Unknown == 0)
}
