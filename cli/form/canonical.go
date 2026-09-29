package form

import (
	"sort"
	"strings"
)

func strs(values []string) []string {
	out := append([]string{}, values...)
	if out == nil {
		out = []string{}
	}
	sort.Strings(out)
	return out
}

func keepOrder(values []string) []string {
	if values == nil {
		return []string{}
	}
	return append([]string{}, values...)
}

// Canonicalize returns a deep copy whose every collection is in canonical
// order and whose nil slices are empty, so that equal Forms serialize to
// identical bytes.
func (a *InputForm) Canonicalize() *InputForm {
	if a == nil {
		return nil
	}
	out := *a
	out.Evidence.Producer.Hints = strs(a.Evidence.Producer.Hints)
	out.Evidence.Attestations = cloneAttestations(a.Evidence.Attestations)
	out.Semantics = canonicalSemantics(a.Semantics)
	out.Stages = make(map[Stage]*Architecture, len(a.Stages))
	for stage, architecture := range a.Stages {
		out.Stages[stage] = canonicalArchitecture(architecture)
	}
	if a.Comparisons != nil {
		comparisons := Comparisons{}
		if a.Comparisons.Drift != nil {
			comparisons.Drift = canonicalComparison(a.Comparisons.Drift)
		}
		if a.Comparisons.Changes != nil {
			comparisons.Changes = canonicalComparison(a.Comparisons.Changes)
		}
		if a.Comparisons.Net != nil {
			comparisons.Net = canonicalComparison(a.Comparisons.Net)
		}
		out.Comparisons = &comparisons
	}
	if a.DriftReport != nil {
		report := DriftReport{Summary: a.DriftReport.Summary, Entries: append([]DriftEntry{}, a.DriftReport.Entries...)}
		for i := range report.Entries {
			report.Entries[i].Actions = keepOrder(a.DriftReport.Entries[i].Actions)
			report.Entries[i].ChangedPaths = strs(a.DriftReport.Entries[i].ChangedPaths)
			report.Entries[i].FactChanges = strs(a.DriftReport.Entries[i].FactChanges)
		}
		sort.SliceStable(report.Entries, func(i, j int) bool { return report.Entries[i].ID < report.Entries[j].ID })
		out.DriftReport = &report
	}
	out.Diagnostics = canonicalDiagnostics(a.Diagnostics)
	return &out
}

// Canonicalize returns a deep copy of a comparison Form in canonical
// order.
func (c *ComparisonForm) Canonicalize() *ComparisonForm {
	if c == nil {
		return nil
	}
	out := *c
	out.Before.Form = *c.Before.Form.Canonicalize()
	out.After.Form = *c.After.Form.Canonicalize()
	out.Comparison = *canonicalComparison(&c.Comparison)
	out.Diagnostics = canonicalDiagnostics(c.Diagnostics)
	return &out
}

func cloneAttestations(values []Attestation) []Attestation {
	out := append([]Attestation{}, values...)
	if out == nil {
		out = []Attestation{}
	}
	sort.SliceStable(out, func(i, j int) bool {
		if out[i].Name != out[j].Name {
			return out[i].Name < out[j].Name
		}
		return out[i].Value < out[j].Value
	})
	return out
}

func canonicalSemantics(s Semantics) Semantics {
	out := s
	out.ReleaseSet.Units = append([]ReleaseSetUnit{}, s.ReleaseSet.Units...)
	if out.ReleaseSet.Units == nil {
		out.ReleaseSet.Units = []ReleaseSetUnit{}
	}
	sort.SliceStable(out.ReleaseSet.Units, func(i, j int) bool { return out.ReleaseSet.Units[i].Owner < out.ReleaseSet.Units[j].Owner })
	out.Selection.ActiveOwners = strs(s.Selection.ActiveOwners)
	out.Selection.ExcludedOwners = strs(s.Selection.ExcludedOwners)
	out.Selection.Replacements = append([]OwnerReplacement{}, s.Selection.Replacements...)
	if out.Selection.Replacements == nil {
		out.Selection.Replacements = []OwnerReplacement{}
	}
	sort.SliceStable(out.Selection.Replacements, func(i, j int) bool { return out.Selection.Replacements[i].Owner < out.Selection.Replacements[j].Owner })
	out.Selection.ProviderMap = cloneAttestations(s.Selection.ProviderMap)
	out.Owners = append([]SemanticOwner{}, s.Owners...)
	if out.Owners == nil {
		out.Owners = []SemanticOwner{}
	}
	for i := range out.Owners {
		out.Owners[i].Providers = append([]SemanticProvider{}, s.Owners[i].Providers...)
		if out.Owners[i].Providers == nil {
			out.Owners[i].Providers = []SemanticProvider{}
		}
		for p := range out.Owners[i].Providers {
			out.Owners[i].Providers[p].Hosts = strs(s.Owners[i].Providers[p].Hosts)
		}
		sort.SliceStable(out.Owners[i].Providers, func(a, b int) bool {
			left, right := out.Owners[i].Providers[a], out.Owners[i].Providers[b]
			if left.Source != right.Source {
				return left.Source < right.Source
			}
			return left.Version < right.Version
		})
		out.Owners[i].Dependencies = strs(s.Owners[i].Dependencies)
	}
	sort.SliceStable(out.Owners, func(i, j int) bool { return out.Owners[i].ID < out.Owners[j].ID })
	out.Concepts = append([]ConceptDefinition{}, s.Concepts...)
	if out.Concepts == nil {
		out.Concepts = []ConceptDefinition{}
	}
	sort.SliceStable(out.Concepts, func(i, j int) bool { return out.Concepts[i].ID < out.Concepts[j].ID })
	out.Contexts = append([]ContextDefinition{}, s.Contexts...)
	if out.Contexts == nil {
		out.Contexts = []ContextDefinition{}
	}
	sort.SliceStable(out.Contexts, func(i, j int) bool { return out.Contexts[i].ID < out.Contexts[j].ID })
	out.Relations = append([]RelationDefinition{}, s.Relations...)
	if out.Relations == nil {
		out.Relations = []RelationDefinition{}
	}
	sort.SliceStable(out.Relations, func(i, j int) bool { return out.Relations[i].ID < out.Relations[j].ID })
	out.Rules = append([]RuleDefinition{}, s.Rules...)
	if out.Rules == nil {
		out.Rules = []RuleDefinition{}
	}
	for i := range out.Rules {
		out.Rules[i].Emissions = strs(s.Rules[i].Emissions)
		if s.Rules[i].Identity != nil {
			identity := *s.Rules[i].Identity
			identity.Attributes = strs(s.Rules[i].Identity.Attributes)
			out.Rules[i].Identity = &identity
		}
		if s.Rules[i].Endpoint != nil {
			endpoint := *s.Rules[i].Endpoint
			endpoint.Attributes = strs(s.Rules[i].Endpoint.Attributes)
			out.Rules[i].Endpoint = &endpoint
		}
		if s.Rules[i].Composition != nil {
			composition := *s.Rules[i].Composition
			composition.Members = append([]CompositionMemberDefinition{}, s.Rules[i].Composition.Members...)
			out.Rules[i].Composition = &composition
		}
	}
	sort.SliceStable(out.Rules, func(i, j int) bool { return out.Rules[i].ID < out.Rules[j].ID })
	out.Emissions = append([]Emission{}, s.Emissions...)
	if out.Emissions == nil {
		out.Emissions = []Emission{}
	}
	for i := range out.Emissions {
		if s.Emissions[i].Match != nil {
			match := *s.Emissions[i].Match
			out.Emissions[i].Match = &match
		}
	}
	sort.SliceStable(out.Emissions, func(i, j int) bool { return out.Emissions[i].ID < out.Emissions[j].ID })
	return out
}

func canonicalArchitecture(a *Architecture) *Architecture {
	if a == nil {
		return nil
	}
	out := *a
	if a.Reconstruction != nil {
		reconstruction := *a.Reconstruction
		out.Reconstruction = &reconstruction
	}
	out.Declarations = append([]Declaration{}, a.Declarations...)
	if out.Declarations == nil {
		out.Declarations = []Declaration{}
	}
	for i := range out.Declarations {
		out.Declarations[i].Diagnostics = strs(a.Declarations[i].Diagnostics)
	}
	sort.SliceStable(out.Declarations, func(i, j int) bool { return out.Declarations[i].ID < out.Declarations[j].ID })
	out.Representations = append([]Representation{}, a.Representations...)
	if out.Representations == nil {
		out.Representations = []Representation{}
	}
	for i := range out.Representations {
		out.Representations[i].Actions = keepOrder(a.Representations[i].Actions)
		out.Representations[i].Diagnostics = strs(a.Representations[i].Diagnostics)
		if a.Representations[i].Interpretation != nil {
			interpretation := *a.Representations[i].Interpretation
			interpretation.Candidates = strs(interpretation.Candidates)
			interpretation.Diagnostics = strs(interpretation.Diagnostics)
			out.Representations[i].Interpretation = &interpretation
		}
		if a.Representations[i].Provider != nil {
			provider := *a.Representations[i].Provider
			out.Representations[i].Provider = &provider
		}
		if a.Representations[i].Identity != nil {
			identity := make(map[string]string, len(a.Representations[i].Identity))
			for key, value := range a.Representations[i].Identity {
				identity[key] = value
			}
			out.Representations[i].Identity = identity
		}
		members := append([]CompositionMember{}, a.Representations[i].Implementation.Members...)
		sort.SliceStable(members, func(x, y int) bool { return members[x].ID < members[y].ID })
		if len(members) == 0 {
			members = nil
		}
		out.Representations[i].Implementation.Members = members
		unresolved := append([]UnresolvedMember{}, a.Representations[i].Implementation.Unresolved...)
		sort.SliceStable(unresolved, func(x, y int) bool { return unresolved[x].Name < unresolved[y].Name })
		if len(unresolved) == 0 {
			unresolved = nil
		}
		out.Representations[i].Implementation.Unresolved = unresolved
	}
	sort.SliceStable(out.Representations, func(i, j int) bool { return out.Representations[i].ID < out.Representations[j].ID })
	out.Contexts = append([]Context{}, a.Contexts...)
	if out.Contexts == nil {
		out.Contexts = []Context{}
	}
	for i := range out.Contexts {
		out.Contexts[i].Provenance = canonicalProvenance(a.Contexts[i].Provenance)
	}
	sort.SliceStable(out.Contexts, func(i, j int) bool { return out.Contexts[i].ID < out.Contexts[j].ID })
	out.Contributions = append([]Contribution{}, a.Contributions...)
	if out.Contributions == nil {
		out.Contributions = []Contribution{}
	}
	for i := range out.Contributions {
		out.Contributions[i].Provenance = canonicalProvenance(a.Contributions[i].Provenance)
	}
	sort.SliceStable(out.Contributions, func(i, j int) bool { return out.Contributions[i].ID < out.Contributions[j].ID })
	out.Relations = append([]Relation{}, a.Relations...)
	if out.Relations == nil {
		out.Relations = []Relation{}
	}
	for i := range out.Relations {
		out.Relations[i].Provenance = canonicalProvenance(a.Relations[i].Provenance)
	}
	sort.SliceStable(out.Relations, func(i, j int) bool { return out.Relations[i].ID < out.Relations[j].ID })
	out.Closures = append([]Closure{}, a.Closures...)
	if out.Closures == nil {
		out.Closures = []Closure{}
	}
	for i := range out.Closures {
		out.Closures[i].Facts = strs(a.Closures[i].Facts)
	}
	sort.SliceStable(out.Closures, func(i, j int) bool { return out.Closures[i].ID < out.Closures[j].ID })
	out.Dependencies = append([]Dependency{}, a.Dependencies...)
	if out.Dependencies == nil {
		out.Dependencies = []Dependency{}
	}
	for i := range out.Dependencies {
		roles := append([]DependencyRole{}, a.Dependencies[i].Roles...)
		sort.SliceStable(roles, func(x, y int) bool { return roles[x] < roles[y] })
		out.Dependencies[i].Roles = roles
	}
	sort.SliceStable(out.Dependencies, func(i, j int) bool { return out.Dependencies[i].ID < out.Dependencies[j].ID })
	out.Deposed = strs(a.Deposed)
	out.Accounting = DeriveAccounting(&out)
	return &out
}

func canonicalProvenance(values []FactProvenance) []FactProvenance {
	out := append([]FactProvenance{}, values...)
	if out == nil {
		out = []FactProvenance{}
	}
	sort.SliceStable(out, func(i, j int) bool {
		if out[i].Emission != out[j].Emission {
			return out[i].Emission < out[j].Emission
		}
		return out[i].Closure < out[j].Closure
	})
	return out
}

func canonicalComparison(c *Comparison) *Comparison {
	out := *c
	out.Problems = append([]ComparisonProblem{}, c.Problems...)
	if out.Problems == nil {
		out.Problems = []ComparisonProblem{}
	}
	sort.SliceStable(out.Problems, func(i, j int) bool {
		return out.Problems[i].Code+out.Problems[i].Message < out.Problems[j].Code+out.Problems[j].Message
	})
	out.Representations = append([]RepresentationChange{}, c.Representations...)
	if out.Representations == nil {
		out.Representations = []RepresentationChange{}
	}
	for i := range out.Representations {
		out.Representations[i].Fields = strs(c.Representations[i].Fields)
		if len(out.Representations[i].Fields) == 0 {
			out.Representations[i].Fields = nil
		}
	}
	sort.SliceStable(out.Representations, func(i, j int) bool { return out.Representations[i].ID < out.Representations[j].ID })
	out.Facts = append([]FactChange{}, c.Facts...)
	if out.Facts == nil {
		out.Facts = []FactChange{}
	}
	sort.SliceStable(out.Facts, func(i, j int) bool { return out.Facts[i].ID < out.Facts[j].ID })
	out.Indeterminate = append([]IndeterminateClosure{}, c.Indeterminate...)
	if out.Indeterminate == nil {
		out.Indeterminate = []IndeterminateClosure{}
	}
	for i := range out.Indeterminate {
		reasons := append([]Reason{}, out.Indeterminate[i].Reasons...)
		sort.Slice(reasons, func(a, b int) bool { return reasons[a] < reasons[b] })
		out.Indeterminate[i].Reasons = reasons
	}
	sort.SliceStable(out.Indeterminate, func(i, j int) bool { return out.Indeterminate[i].ID < out.Indeterminate[j].ID })
	out.Cancelled = append([]Cancellation{}, c.Cancelled...)
	if out.Cancelled == nil {
		out.Cancelled = []Cancellation{}
	}
	sort.SliceStable(out.Cancelled, func(i, j int) bool { return out.Cancelled[i].ID < out.Cancelled[j].ID })
	out.ExternalMatches = nil
	if len(c.ExternalMatches) != 0 {
		out.ExternalMatches = append([]ExternalMatch{}, c.ExternalMatches...)
		sort.SliceStable(out.ExternalMatches, func(i, j int) bool {
			return out.ExternalMatches[i].Before < out.ExternalMatches[j].Before
		})
	}
	out.Counts = DeriveComparisonCounts(&out)
	return &out
}

func canonicalDiagnostics(values []Diagnostic) []Diagnostic {
	out := append([]Diagnostic{}, values...)
	if out == nil {
		out = []Diagnostic{}
	}
	sort.SliceStable(out, func(i, j int) bool {
		if out[i].Phase != out[j].Phase {
			return out[i].Phase < out[j].Phase
		}
		if out[i].Code != out[j].Code {
			return out[i].Code < out[j].Code
		}
		return strings.Compare(out[i].ID, out[j].ID) < 0
	})
	return out
}

// DeriveAccounting recomputes the counts of one stage from its collections.
func DeriveAccounting(a *Architecture) Accounting {
	var out Accounting
	if a == nil {
		return out
	}
	out.Declarations = len(a.Declarations)
	for _, declaration := range a.Declarations {
		switch declaration.Kind {
		case DeclarationResource:
			out.Resources++
		case DeclarationData:
			out.DataSources++
		}
	}
	for _, representation := range a.Representations {
		switch representation.Kind {
		case RepresentationManaged:
			out.Instances++
			out.ManagedInstances++
		case RepresentationData:
			out.Instances++
			out.DataInstances++
		case RepresentationExternal:
			out.ExternalEndpoints++
		}
		if representation.Interpretation != nil {
			switch representation.Interpretation.Status {
			case InterpretationApplied:
				out.AppliedInterpretations++
			case InterpretationIndeterminate:
				out.IndeterminateInterpretations++
			case InterpretationFailed:
				out.FailedInterpretations++
			case InterpretationNone:
				out.UninterpretedInstances++
			}
		}
		switch representation.Status {
		case StatusCarried:
			out.Carried++
		case StatusDeferred:
			out.Deferred++
		}
	}
	out.Facts = len(a.Contexts) + len(a.Contributions) + len(a.Relations)
	out.Closures = len(a.Closures)
	for _, closure := range a.Closures {
		switch closure.Outcome {
		case OutcomeResolved:
			out.Resolved++
		case OutcomeAbsent:
			out.Absent++
		case OutcomeIndeterminate:
			out.Indeterminate++
		}
	}
	out.Dependencies = len(a.Dependencies)
	out.Deposed = len(a.Deposed)
	return out
}

// DeriveComparisonCounts recomputes comparison counts from its collections.
func DeriveComparisonCounts(c *Comparison) ComparisonCounts {
	var out ComparisonCounts
	if c == nil {
		return out
	}
	for _, change := range c.Representations {
		switch change.Change {
		case ChangeAdded:
			out.RepresentationsAdded++
		case ChangeRemoved:
			out.RepresentationsRemoved++
		case ChangeChanged:
			out.RepresentationsChanged++
		case ChangeMoved:
			out.Moved++
		case ChangeReplaced:
			out.Replaced++
		case ChangeRecreated:
			out.Recreated++
		}
	}
	for _, change := range c.Facts {
		switch change.Change {
		case ChangeAdded:
			out.FactsAdded++
		case ChangeRemoved:
			out.FactsRemoved++
		}
	}
	out.Indeterminate = len(c.Indeterminate)
	out.Cancelled = len(c.Cancelled)
	return out
}
