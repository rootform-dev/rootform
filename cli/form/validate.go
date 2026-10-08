package form

import (
	"fmt"
	"reflect"
	"regexp"
	"sort"
	"strconv"
	"strings"
)

// Comparison names and side selection vocabularies.
const (
	ComparisonDrift   = "drift"
	ComparisonChanges = "changes"
	ComparisonNet     = "net"
	ComparisonCross   = "cross"

	SideBefore = "before"
	SideAfter  = "after"

	SelectedFromInput  = "input"
	SelectedFromBefore = "before"
	SelectedFromAfter  = "after"

	ToolSourceAttested      = "attested"
	SnapshotTrustPaired     = "paired"
	RefreshScopeNotExported = "not_exported"
)

// Validation problem codes.
const (
	CodeFormatUnsupported  = "DOCUMENT_FORMAT_UNSUPPORTED"
	CodeKindInvalid        = "DOCUMENT_KIND_INVALID"
	CodeGeneratorInvalid   = "DOCUMENT_GENERATOR_INVALID"
	CodeVocabulary         = "DOCUMENT_VOCABULARY_INVALID"
	CodeFieldRequired      = "DOCUMENT_FIELD_REQUIRED"
	CodeFieldForbidden     = "DOCUMENT_FIELD_FORBIDDEN"
	CodeIDInvalid          = "DOCUMENT_ID_INVALID"
	CodeIDDuplicate        = "DOCUMENT_ID_DUPLICATE"
	CodeReferenceMissing   = "DOCUMENT_REFERENCE_MISSING"
	CodeStageInvalid       = "DOCUMENT_STAGE_INVALID"
	CodeClosureIncomplete  = "DOCUMENT_CLOSURE_INCOMPLETE"
	CodeClosureExtra       = "DOCUMENT_CLOSURE_EXTRA"
	CodeAccountingMismatch = "DOCUMENT_ACCOUNTING_MISMATCH"
	CodeInconsistent       = "DOCUMENT_INCONSISTENT"
)

var (
	diagnosticCodePattern = regexp.MustCompile(`^[A-Z][A-Z0-9_]{1,63}$`)
	digestPattern         = regexp.MustCompile(`^sha256:[0-9a-f]{64}$`)
)

// Problem is one validation finding located by a dotted path.
type Problem struct {
	Path    string
	Code    string
	Message string
}

// ValidationError aggregates every problem found in one Form. Problems are
// reported in field order so that the first one names the first offending
// field.
type ValidationError struct {
	Problems []Problem
}

func (e *ValidationError) Error() string {
	if e == nil || len(e.Problems) == 0 {
		return "Form validation failed"
	}
	parts := make([]string, 0, len(e.Problems))
	for i, problem := range e.Problems {
		if i == 8 {
			parts = append(parts, fmt.Sprintf("... %d more", len(e.Problems)-8))
			break
		}
		parts = append(parts, problem.Code+" at "+problem.Path+": "+problem.Message)
	}
	return strings.Join(parts, "; ")
}

// Has reports whether a problem with the code exists.
func (e *ValidationError) Has(code string) bool {
	if e == nil {
		return false
	}
	for _, problem := range e.Problems {
		if problem.Code == code {
			return true
		}
	}
	return false
}

type validator struct {
	problems []Problem
}

func (v *validator) add(path, code, format string, args ...any) {
	v.problems = append(v.problems, Problem{Path: path, Code: code, Message: fmt.Sprintf(format, args...)})
}

func (v *validator) result() error {
	if len(v.problems) == 0 {
		return nil
	}
	return &ValidationError{Problems: v.problems}
}

func (v *validator) vocabulary(path string, value string, allowed ...string) bool {
	for _, candidate := range allowed {
		if value == candidate {
			return true
		}
	}
	v.add(path, CodeVocabulary, "value %q is not one of %s", value, strings.Join(allowed, ", "))
	return false
}

func (v *validator) required(path, value string) bool {
	if value == "" {
		v.add(path, CodeFieldRequired, "field is required")
		return false
	}
	return true
}

func (v *validator) forbidden(path, value string) {
	if value != "" {
		v.add(path, CodeFieldForbidden, "field must be empty")
	}
}

func (v *validator) unique(path string, seen map[string]struct{}, id string) bool {
	if _, dup := seen[id]; dup {
		v.add(path, CodeIDDuplicate, "duplicate identifier %q", id)
		return false
	}
	seen[id] = struct{}{}
	return true
}

func stageStrings() []string {
	out := make([]string, 0, 3)
	for _, stage := range Stages() {
		out = append(out, string(stage))
	}
	return out
}

func reasonStrings() []string {
	out := make([]string, 0, 10)
	for _, reason := range Reasons() {
		out = append(out, string(reason))
	}
	return out
}

// Validate checks a state or plan Form against the format 1 contract:
// closed vocabularies, identifier derivations, referential integrity, one
// closure per (representation, emission), stage consistency, derived
// accounting and comparison counts, and the absence of value fields outside
// external identity.
func (a *InputForm) Validate() error {
	v := &validator{}
	if a == nil {
		v.add("", CodeFieldRequired, "Form is nil")
		return v.result()
	}
	v.inputForm(a, "")
	return v.result()
}

// Validate checks a comparison Form and both embedded input Forms.
func (c *ComparisonForm) Validate() error {
	v := &validator{}
	if c == nil {
		v.add("", CodeFieldRequired, "Form is nil")
		return v.result()
	}
	if c.FormatVersion != FormatVersion {
		v.add("format_version", CodeFormatUnsupported, "format %q is not supported; expected %q", c.FormatVersion, FormatVersion)
	}
	if c.Kind != KindComparison {
		v.add("kind", CodeKindInvalid, "kind %q is not %q", c.Kind, KindComparison)
	}
	v.generator("generator", c.Generator)
	before := v.side("before", c.Before)
	after := v.side("after", c.After)
	if c.Comparison.Name != ComparisonCross {
		v.add("comparison.name", CodeVocabulary, "cross-input comparison must be named %q", ComparisonCross)
	}
	if c.Comparison.Before != c.Before.Stage {
		v.add("comparison.before", CodeInconsistent, "comparison before stage %q differs from selected stage %q", c.Comparison.Before, c.Before.Stage)
	}
	if c.Comparison.After != c.After.Stage {
		v.add("comparison.after", CodeInconsistent, "comparison after stage %q differs from selected stage %q", c.Comparison.After, c.After.Stage)
	}
	if c.Comparison.Comparable {
		if c.Before.Form.Semantics.ReleaseSet.ID != c.After.Form.Semantics.ReleaseSet.ID {
			v.add("comparison.comparable", CodeInconsistent, "comparable sides must share one release set")
		}
		if !reflect.DeepEqual(canonicalSemantics(c.Before.Form.Semantics).Selection, canonicalSemantics(c.After.Form.Semantics).Selection) {
			v.add("comparison.comparable", CodeInconsistent, "comparable sides must share one semantic selection")
		}
	}
	if before != nil && after != nil {
		v.comparison("comparison", &c.Comparison, before, after, nil, nil)
	}
	v.diagnostics("diagnostics", c.Diagnostics, nil, map[string]struct{}{})
	return v.result()
}

func (v *validator) side(path string, side Side) *Architecture {
	v.inputForm(&side.Form, path+".form")
	v.vocabulary(path+".selected_from", side.SelectedFrom, SelectedFromInput, SelectedFromBefore, SelectedFromAfter)
	architecture, ok := side.Form.Stages[side.Stage]
	if !ok || architecture == nil {
		v.add(path+".stage", CodeStageInvalid, "selected stage %q is not present in the embedded Form", side.Stage)
		return nil
	}
	return architecture
}

func (v *validator) generator(path string, generator Generator) {
	if generator.Name != GeneratorName {
		v.add(path+".name", CodeGeneratorInvalid, "generator %q is not %q", generator.Name, GeneratorName)
	}
	v.required(path+".version", generator.Version)
}

func join(prefix, field string) string {
	if prefix == "" {
		return field
	}
	return prefix + "." + field
}

func (v *validator) inputForm(a *InputForm, prefix string) {
	if a.FormatVersion != FormatVersion {
		v.add(join(prefix, "format_version"), CodeFormatUnsupported, "format %q is not supported; expected %q", a.FormatVersion, FormatVersion)
	}
	if a.Kind != KindState && a.Kind != KindPlan {
		v.add(join(prefix, "kind"), CodeKindInvalid, "Form kind %q is not state or plan", a.Kind)
	}
	v.generator(join(prefix, "generator"), a.Generator)
	v.evidence(join(prefix, "evidence"), a.Kind, a.Evidence)
	semantics := v.semantics(join(prefix, "semantics"), a.Semantics)

	diagnosticIDs := map[string]struct{}{}
	for _, diagnostic := range a.Diagnostics {
		diagnosticIDs[diagnostic.ID] = struct{}{}
	}
	referencedDiagnostics := map[string]string{}

	stagePath := join(prefix, "stages")
	if len(a.Stages) == 0 {
		v.add(stagePath, CodeFieldRequired, "at least one stage is required")
	}
	stages := map[Stage]*Architecture{}
	for stage, architecture := range a.Stages {
		path := stagePath + "." + string(stage)
		if !v.vocabulary(path, string(stage), stageStrings()...) {
			continue
		}
		if architecture == nil {
			v.add(path, CodeFieldRequired, "stage is null")
			continue
		}
		if architecture.Stage != stage {
			v.add(path+".stage", CodeStageInvalid, "stage field %q differs from key %q", architecture.Stage, stage)
		}
		stages[stage] = architecture
	}
	switch a.Kind {
	case KindState:
		if len(a.Stages) != 1 || stages[StageRecorded] == nil {
			v.add(stagePath, CodeStageInvalid, "a state Form carries exactly one stage, %q", StageRecorded)
		}
		if a.Comparisons != nil {
			v.add(join(prefix, "comparisons"), CodeFieldForbidden, "a state Form carries no comparisons")
		}
		if a.DriftReport != nil {
			v.add(join(prefix, "drift_report"), CodeFieldForbidden, "a state Form carries no drift report")
		}
	case KindPlan:
		if stages[StagePlanned] == nil {
			v.add(stagePath, CodeStageInvalid, "a plan Form carries the %q stage", StagePlanned)
		}
		if stages[StageRecorded] != nil && stages[StageRefreshed] == nil {
			v.add(stagePath, CodeStageInvalid, "the %q stage of a plan Form is reconstructed from %q, which is absent", StageRecorded, StageRefreshed)
		}
		if a.Comparisons == nil {
			v.add(join(prefix, "comparisons"), CodeFieldRequired, "a plan Form carries comparisons")
		}
		if a.DriftReport == nil {
			v.add(join(prefix, "drift_report"), CodeFieldRequired, "a plan Form carries a drift report")
		}
	}
	if _, ok := stages[a.DefaultStage]; !ok {
		v.add(join(prefix, "default_stage"), CodeStageInvalid, "default stage %q is not present", a.DefaultStage)
	}
	externals := newExternalLedger()
	for _, stage := range Stages() {
		architecture := stages[stage]
		if architecture == nil {
			continue
		}
		path := stagePath + "." + string(stage)
		v.required(path+".label", architecture.Label)
		if architecture.Reconstruction != nil {
			if a.Kind != KindPlan || stage != StageRecorded {
				v.add(path+".reconstruction", CodeFieldForbidden, "only the recorded stage of a plan is reconstructed")
			} else if architecture.Reconstruction.From != StageRefreshed {
				v.add(path+".reconstruction.from", CodeStageInvalid, "the recorded stage is reconstructed from %q", StageRefreshed)
			}
			if architecture.Reconstruction.ReversedDriftEntries < 0 {
				v.add(path+".reconstruction.reversed_drift_entries", CodeInconsistent, "count is negative")
			}
		} else if a.Kind == KindPlan && stage == StageRecorded {
			v.add(path+".reconstruction", CodeFieldRequired, "the recorded stage of a plan states its reconstruction")
		}
		v.architecture(path, architecture, stage, semantics, referencedDiagnostics, externals)
	}
	v.externalOrdinals(stagePath, externals)

	if a.Kind == KindPlan && a.Comparisons != nil {
		v.comparisons(join(prefix, "comparisons"), a.Comparisons, stages)
	}
	if a.Kind == KindPlan && a.DriftReport != nil {
		v.driftReport(join(prefix, "drift_report"), a.DriftReport, a.Comparisons, stages)
	}
	v.diagnostics(join(prefix, "diagnostics"), a.Diagnostics, stages, diagnosticIDs)
	for id, path := range referencedDiagnostics {
		if _, ok := diagnosticIDs[id]; !ok {
			v.add(path, CodeReferenceMissing, "diagnostic %q is not declared", id)
		}
	}
}

func (v *validator) evidence(path string, kind Kind, e Evidence) {
	if v.vocabulary(path+".origin", string(e.Origin), string(OriginPlan), string(OriginState)) {
		switch {
		case kind == KindState && e.Origin != OriginState:
			v.add(path+".origin", CodeInconsistent, "a state Form is compiled from state evidence")
		case kind == KindPlan && e.Origin != OriginPlan:
			v.add(path+".origin", CodeInconsistent, "a plan Form is compiled from plan evidence")
		}
	}
	v.required(path+".input_format_version", e.InputFormatVersion)
	v.vocabulary(path+".producer.tool", string(e.Producer.Tool), string(ToolUnestablished), string(ToolTerraform), string(ToolOpenTofu))
	if e.Producer.ToolSource != "" {
		v.vocabulary(path+".producer.tool_source", e.Producer.ToolSource, ToolSourceAttested)
	}
	if e.Producer.Tool == ToolUnestablished && e.Producer.ToolSource != "" {
		v.add(path+".producer.tool_source", CodeInconsistent, "an unestablished tool has no source")
	}
	v.vocabulary(path+".completeness.producer_complete", string(e.Completeness.ProducerComplete), string(CompleteTrue), string(CompleteFalse), string(CompleteUnavailable))
	v.vocabulary(path+".enrichment.snapshot.status", string(e.Enrichment.Snapshot.Status), string(SnapshotVerified), string(SnapshotRefused), string(SnapshotAbsent))
	switch e.Enrichment.Snapshot.Status {
	case SnapshotVerified:
		v.vocabulary(path+".enrichment.snapshot.trust", e.Enrichment.Snapshot.Trust, SnapshotTrustPaired)
		v.forbidden(path+".enrichment.snapshot.diagnostic", e.Enrichment.Snapshot.Diagnostic)
	case SnapshotRefused:
		v.forbidden(path+".enrichment.snapshot.trust", e.Enrichment.Snapshot.Trust)
		v.required(path+".enrichment.snapshot.diagnostic", e.Enrichment.Snapshot.Diagnostic)
	case SnapshotAbsent:
		v.forbidden(path+".enrichment.snapshot.trust", e.Enrichment.Snapshot.Trust)
		v.forbidden(path+".enrichment.snapshot.diagnostic", e.Enrichment.Snapshot.Diagnostic)
		if e.Enrichment.Snapshot.Modules != 0 {
			v.add(path+".enrichment.snapshot.modules", CodeInconsistent, "an absent snapshot has no modules")
		}
	}
	if e.Enrichment.Snapshot.Modules < 0 {
		v.add(path+".enrichment.snapshot.modules", CodeInconsistent, "count is negative")
	}
	for i, attestation := range e.Attestations {
		v.required(fmt.Sprintf("%s.attestations[%d].name", path, i), attestation.Name)
	}
	v.vocabulary(path+".scope.refresh_scope", e.Scope.RefreshScope, RefreshScopeNotExported)
	if v.vocabulary(path+".scope.drift_records", string(e.Scope.DriftRecords), string(DriftRecordsPresent), string(DriftRecordsAbsent), string(DriftRecordsNotApplicable)) {
		if kind == KindState && e.Scope.DriftRecords != DriftRecordsNotApplicable {
			v.add(path+".scope.drift_records", CodeInconsistent, "drift records do not apply to a state Form")
		}
		if kind == KindPlan && e.Scope.DriftRecords == DriftRecordsNotApplicable {
			v.add(path+".scope.drift_records", CodeInconsistent, "a plan states whether drift records are present or absent")
		}
	}
	if e.Scope.DataSourcesCoveredByDrift || e.Scope.DeposedCoveredByDrift {
		v.add(path+".scope", CodeInconsistent, "producers never cover data sources or deposed objects in drift records")
	}
}

// semanticIndex is what later checks need from the semantics snapshot.
type semanticIndex struct {
	concepts  map[string]struct{}
	contexts  map[string]struct{}
	relations map[string]struct{}
	rules     map[string]*RuleDefinition
	emissions map[string]*Emission
}

func (v *validator) semantics(path string, s Semantics) *semanticIndex {
	index := &semanticIndex{
		concepts:  map[string]struct{}{},
		contexts:  map[string]struct{}{},
		relations: map[string]struct{}{},
		rules:     map[string]*RuleDefinition{},
		emissions: map[string]*Emission{},
	}
	v.required(path+".language_version", s.LanguageVersion)
	v.required(path+".release_set.version", s.ReleaseSet.Version)
	if !digestPattern.MatchString(s.ReleaseSet.ManifestDigest) {
		v.add(path+".release_set.manifest_digest", CodeIDInvalid, "manifest digest is not a sha256 digest")
	}
	unitOwners := map[string]struct{}{}
	for i, unit := range s.ReleaseSet.Units {
		unitPath := fmt.Sprintf("%s.release_set.units[%d]", path, i)
		v.required(unitPath+".owner", unit.Owner)
		v.unique(unitPath+".owner", unitOwners, unit.Owner)
		v.vocabulary(unitPath+".kind", string(unit.Kind), string(OwnerVocabulary), string(OwnerDialect))
		v.required(unitPath+".version", unit.Version)
		if !digestPattern.MatchString(unit.ContentDigest) {
			v.add(unitPath+".content_digest", CodeIDInvalid, "content digest is not a sha256 digest")
		}
		if !digestPattern.MatchString(unit.SemanticDigest) {
			v.add(unitPath+".semantic_digest", CodeIDInvalid, "semantic digest is not a sha256 digest")
		}
	}
	derived := ReleaseSetIdentity(s.ReleaseSet.Version, s.ReleaseSet.Units)
	if derived.ID != s.ReleaseSet.ID || derived.ManifestDigest != s.ReleaseSet.ManifestDigest {
		v.add(path+".release_set.id", CodeIDInvalid, "release-set identity is not derived from its units")
	}
	owners := map[string]struct{}{}
	for i, owner := range s.Owners {
		ownerPath := fmt.Sprintf("%s.owners[%d]", path, i)
		v.required(ownerPath+".id", owner.ID)
		v.unique(ownerPath+".id", owners, owner.ID)
		v.vocabulary(ownerPath+".kind", string(owner.Kind), string(OwnerVocabulary), string(OwnerDialect))
		v.vocabulary(ownerPath+".origin", string(owner.Origin), string(SemanticSupplied), string(SemanticLocal), string(SemanticOCI))
		v.required(ownerPath+".version", owner.Version)
		if !digestPattern.MatchString(owner.ContentDigest) {
			v.add(ownerPath+".content_digest", CodeIDInvalid, "content digest is not a sha256 digest")
		}
		if !digestPattern.MatchString(owner.SemanticDigest) {
			v.add(ownerPath+".semantic_digest", CodeIDInvalid, "semantic digest is not a sha256 digest")
		}
		for p, provider := range owner.Providers {
			providerPath := fmt.Sprintf("%s.providers[%d]", ownerPath, p)
			v.required(providerPath+".source", provider.Source)
			v.required(providerPath+".version", provider.Version)
			if len(provider.Hosts) == 0 {
				v.add(providerPath+".hosts", CodeFieldRequired, "a provider binding names at least one registry host")
			}
		}
	}
	for i, owner := range s.Selection.ActiveOwners {
		if _, ok := owners[owner]; !ok {
			v.add(fmt.Sprintf("%s.selection.active_owners[%d]", path, i), CodeReferenceMissing, "owner %q is not declared", owner)
		}
	}
	for i, replacement := range s.Selection.Replacements {
		replacementPath := fmt.Sprintf("%s.selection.replacements[%d]", path, i)
		v.required(replacementPath+".owner", replacement.Owner)
		v.vocabulary(replacementPath+".origin", string(replacement.Origin), string(SemanticSupplied), string(SemanticLocal), string(SemanticOCI))
		if !digestPattern.MatchString(replacement.Digest) {
			v.add(replacementPath+".digest", CodeIDInvalid, "digest is not a sha256 digest")
		}
	}
	for i, mapping := range s.Selection.ProviderMap {
		v.required(fmt.Sprintf("%s.selection.provider_map[%d].name", path, i), mapping.Name)
		v.required(fmt.Sprintf("%s.selection.provider_map[%d].value", path, i), mapping.Value)
	}
	ownerKnown := func(itemPath, owner string) {
		if _, ok := owners[owner]; !ok {
			v.add(itemPath, CodeReferenceMissing, "owner %q is not declared", owner)
		}
	}
	for i, concept := range s.Concepts {
		itemPath := fmt.Sprintf("%s.concepts[%d]", path, i)
		v.required(itemPath+".id", concept.ID)
		v.unique(itemPath+".id", index.concepts, concept.ID)
		v.required(itemPath+".name", concept.Name)
		ownerKnown(itemPath+".owner", concept.Owner)
	}
	for i, context := range s.Contexts {
		itemPath := fmt.Sprintf("%s.contexts[%d]", path, i)
		v.required(itemPath+".id", context.ID)
		v.unique(itemPath+".id", index.contexts, context.ID)
		v.required(itemPath+".name", context.Name)
		ownerKnown(itemPath+".owner", context.Owner)
	}
	for i, relation := range s.Relations {
		itemPath := fmt.Sprintf("%s.relations[%d]", path, i)
		v.required(itemPath+".id", relation.ID)
		v.unique(itemPath+".id", index.relations, relation.ID)
		v.required(itemPath+".name", relation.Name)
		ownerKnown(itemPath+".owner", relation.Owner)
	}
	ruleIDs := map[string]struct{}{}
	for i := range s.Rules {
		rule := &s.Rules[i]
		itemPath := fmt.Sprintf("%s.rules[%d]", path, i)
		v.required(itemPath+".id", rule.ID)
		if v.unique(itemPath+".id", ruleIDs, rule.ID) {
			index.rules[rule.ID] = rule
		}
		ownerKnown(itemPath+".owner", rule.Owner)
		v.required(itemPath+".match_kind", rule.MatchKind)
		v.required(itemPath+".match_type", rule.MatchType)
		if rule.Concept != "" {
			if _, ok := index.concepts[rule.Concept]; !ok {
				v.add(itemPath+".concept", CodeReferenceMissing, "concept %q is not declared", rule.Concept)
			}
		}
		if rule.Identity != nil {
			v.vocabulary(itemPath+".identity.scope", string(rule.Identity.Scope), string(IdentityScopeProvider), string(IdentityScopeGlobal))
			v.attributeList(itemPath+".identity.attributes", rule.Identity.Attributes)
		}
		if rule.Endpoint != nil {
			v.attributeList(itemPath+".endpoint.attributes", rule.Endpoint.Attributes)
		}
		if rule.Composition != nil {
			if len(rule.Composition.Members) == 0 {
				v.add(itemPath+".composition.members", CodeFieldRequired, "a composition names its members")
			}
			names := map[string]struct{}{}
			for m, member := range rule.Composition.Members {
				memberPath := fmt.Sprintf("%s.composition.members[%d]", itemPath, m)
				v.required(memberPath+".name", member.Name)
				v.unique(memberPath+".name", names, member.Name)
				v.required(memberPath+".via", member.Via)
				v.required(memberPath+".match_kind", member.MatchKind)
				v.required(memberPath+".match_type", member.MatchType)
			}
		}
	}
	emissionIDs := map[string]struct{}{}
	for i := range s.Emissions {
		emission := &s.Emissions[i]
		itemPath := fmt.Sprintf("%s.emissions[%d]", path, i)
		v.required(itemPath+".id", emission.ID)
		if v.unique(itemPath+".id", emissionIDs, emission.ID) {
			index.emissions[emission.ID] = emission
		}
		if EmissionID(*emission) != emission.ID {
			v.add(itemPath+".id", CodeIDInvalid, "emission identity is not derived from its shape")
		}
		rule, ok := index.rules[emission.Rule]
		if !ok {
			v.add(itemPath+".rule", CodeReferenceMissing, "rule %q is not declared", emission.Rule)
		} else if !contains(rule.Emissions, emission.ID) {
			v.add(itemPath+".rule", CodeInconsistent, "rule %q does not list emission %q", emission.Rule, emission.ID)
		}
		v.vocabulary(itemPath+".kind", string(emission.Kind), string(EmissionContext), string(EmissionContribution), string(EmissionRelation))
		if v.vocabulary(itemPath+".to.kind", string(emission.To.Kind), string(TargetConcept), string(TargetRule)) {
			switch emission.To.Kind {
			case TargetConcept:
				if _, ok := index.concepts[emission.To.ID]; !ok {
					v.add(itemPath+".to.id", CodeReferenceMissing, "concept %q is not declared", emission.To.ID)
				}
			case TargetRule:
				if _, ok := index.rules[emission.To.ID]; !ok {
					v.add(itemPath+".to.id", CodeReferenceMissing, "rule %q is not declared", emission.To.ID)
				}
			}
		}
		switch emission.Kind {
		case EmissionContext:
			if v.required(itemPath+".dimension", emission.Dimension) {
				if _, ok := index.contexts[emission.Dimension]; !ok {
					v.add(itemPath+".dimension", CodeReferenceMissing, "context %q is not declared", emission.Dimension)
				}
			}
			v.forbidden(itemPath+".predicate", emission.Predicate)
		case EmissionRelation:
			if v.required(itemPath+".predicate", emission.Predicate) {
				if _, ok := index.relations[emission.Predicate]; !ok {
					v.add(itemPath+".predicate", CodeReferenceMissing, "relation %q is not declared", emission.Predicate)
				}
			}
			v.forbidden(itemPath+".dimension", emission.Dimension)
		case EmissionContribution:
			v.forbidden(itemPath+".dimension", emission.Dimension)
			v.forbidden(itemPath+".predicate", emission.Predicate)
		}
		v.required(itemPath+".via", emission.Via)
		if emission.Match != nil {
			if len(emission.Match.By) == 0 {
				v.add(itemPath+".match.by", CodeFieldRequired, "a match names at least one target attribute")
			}
			seen := map[string]bool{}
			for i, by := range emission.Match.By {
				v.required(fmt.Sprintf("%s.match.by[%d]", itemPath, i), by)
				if seen[by] {
					v.add(fmt.Sprintf("%s.match.by[%d]", itemPath, i), CodeInconsistent, "a match attribute is listed once")
				}
				seen[by] = true
			}
			v.vocabulary(itemPath+".match.strategy", string(emission.Match.Strategy), string(MatchExact), string(MatchDotAncestor), string(MatchLastSegment))
		} else if emission.Prefix != "" {
			v.add(itemPath+".prefix", CodeFieldForbidden, "a prefix applies to evaluated matching only")
		}
		v.vocabulary(itemPath+".on_null", string(emission.OnNull), string(NullAbsent), string(NullIndeterminate))
		v.vocabulary(itemPath+".on_empty", string(emission.OnEmpty), string(NullAbsent), string(NullIndeterminate))
		v.vocabulary(itemPath+".external", string(emission.External), string(ExternalAllow), string(ExternalDeny))
		if v.vocabulary(itemPath+".disclose", string(emission.Disclose), string(DiscloseNone), string(DiscloseRecord), string(DiscloseReport)) {
			if emission.Disclose != DiscloseNone && emission.External != ExternalAllow {
				v.add(itemPath+".disclose", CodeInconsistent, "disclosure requires external = allow")
			}
		}
	}
	for i, rule := range s.Rules {
		for e, id := range rule.Emissions {
			emission, ok := index.emissions[id]
			if !ok {
				v.add(fmt.Sprintf("%s.rules[%d].emissions[%d]", path, i, e), CodeReferenceMissing, "emission %q is not declared", id)
			} else if emission.Rule != rule.ID {
				v.add(fmt.Sprintf("%s.rules[%d].emissions[%d]", path, i, e), CodeInconsistent, "emission %q belongs to rule %q", id, emission.Rule)
			}
		}
	}
	return index
}

func (v *validator) attributeList(path string, attributes []string) {
	if len(attributes) == 0 {
		v.add(path, CodeFieldRequired, "at least one attribute is required")
	}
	seen := map[string]struct{}{}
	for i, attribute := range attributes {
		itemPath := fmt.Sprintf("%s[%d]", path, i)
		v.required(itemPath, attribute)
		v.unique(itemPath, seen, attribute)
	}
}

func contains(values []string, want string) bool {
	for _, value := range values {
		if value == want {
			return true
		}
	}
	return false
}

// stageIndex is what comparison and drift checks need from one stage.
type stageIndex struct {
	declarations    map[string]*Declaration
	representations map[string]*Representation
	facts           map[string]factRef
	closures        map[string]*Closure
	nodes           map[string]struct{}
}

type factRef struct {
	kind FactKind
	// qualifier is the context dimension or relation predicate that takes
	// part in the fact identity; contributions have none.
	qualifier string
	from, to  string
	emission  string
	closures  map[string]bool
}

// factKey derives the identity a fact of this kind and qualifier carries
// between the given endpoints.
func factKey(kind FactKind, qualifier, from, to string) string {
	switch kind {
	case FactContext:
		return ContextID(qualifier, from, to)
	case FactRelation:
		return RelationID(qualifier, from, to)
	default:
		return ContributionID(from, to)
	}
}

func (index *stageIndex) isExternal(id string) bool {
	representation, ok := index.representations[id]
	return ok && representation.Kind == RepresentationExternal
}

func provenanceClosures(provenance []FactProvenance) map[string]bool {
	out := make(map[string]bool, len(provenance))
	for _, entry := range provenance {
		out[entry.Closure] = true
	}
	return out
}

// externalFact reports whether a closure establishes at least one fact whose
// target is an external endpoint of this stage.
func (index *stageIndex) externalFact(closure *Closure) bool {
	for _, id := range closure.Facts {
		fact, ok := index.facts[id]
		if !ok {
			continue
		}
		if target, ok := index.representations[fact.to]; ok && target.Kind == RepresentationExternal {
			return true
		}
	}
	return false
}

// complete reports whether this side has settled every fact a closure could
// establish. A present closure is complete unless it is indeterminate. A
// missing closure is complete when its representation is absent from this
// side or was interpreted without failure; an indeterminate or failed
// interpretation leaves it unsettled.
func (index *stageIndex) complete(representation, emission string) bool {
	if closure, ok := index.closures[ClosureID(representation, emission)]; ok {
		return closure.Outcome != OutcomeIndeterminate
	}
	target, ok := index.representations[representation]
	if !ok || target.Interpretation == nil {
		return true
	}
	status := target.Interpretation.Status
	return status != InterpretationIndeterminate && status != InterpretationFailed
}

func sortedRepresentationIDs(representations map[string]*Representation) []string {
	keys := make([]string, 0, len(representations))
	for key := range representations {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	return keys
}

func sortedClosureIDs(closures map[string]bool) []string {
	keys := make([]string, 0, len(closures))
	for key := range closures {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	return keys
}

func (v *validator) architecture(path string, a *Architecture, stage Stage, semantics *semanticIndex, referencedDiagnostics map[string]string, externals *externalLedger) *stageIndex {
	index := &stageIndex{
		declarations:    map[string]*Declaration{},
		representations: map[string]*Representation{},
		facts:           map[string]factRef{},
		closures:        map[string]*Closure{},
		nodes:           map[string]struct{}{},
	}
	declarationIDs := map[string]struct{}{}
	for i := range a.Declarations {
		declaration := &a.Declarations[i]
		itemPath := fmt.Sprintf("%s.declarations[%d]", path, i)
		if v.unique(itemPath+".id", declarationIDs, declaration.ID) {
			index.declarations[declaration.ID] = declaration
			index.nodes[declaration.ID] = struct{}{}
		}
		if v.required(itemPath+".address", declaration.Address) && DeclarationID(declaration.Address) != declaration.ID {
			v.add(itemPath+".id", CodeIDInvalid, "declaration identity is not derived from its address")
		}
		v.vocabulary(itemPath+".kind", string(declaration.Kind), string(DeclarationResource), string(DeclarationData))
		v.required(itemPath+".type", declaration.Type)
		v.required(itemPath+".name", declaration.Name)
		v.provider(itemPath+".provider", declaration.Provider)
		v.vocabulary(itemPath+".population.status", string(declaration.Population.Status), string(PopulationObserved), string(PopulationProvenZero), string(PopulationUnverified))
		if declaration.Population.Instances < 0 {
			v.add(itemPath+".population.instances", CodeInconsistent, "count is negative")
		}
		for d, id := range declaration.Diagnostics {
			referencedDiagnostics[id] = fmt.Sprintf("%s.diagnostics[%d]", itemPath, d)
		}
	}

	representationIDs := map[string]struct{}{}
	instancesPerDeclaration := map[string]int{}
	carriedPerDeclaration := map[string]int{}
	holdsCarried := false
	for i := range a.Representations {
		representation := &a.Representations[i]
		itemPath := fmt.Sprintf("%s.representations[%d]", path, i)
		if v.unique(itemPath+".id", representationIDs, representation.ID) {
			index.representations[representation.ID] = representation
			index.nodes[representation.ID] = struct{}{}
		}
		if !v.vocabulary(itemPath+".kind", string(representation.Kind), string(RepresentationManaged), string(RepresentationData), string(RepresentationExternal)) {
			continue
		}
		for d, id := range representation.Diagnostics {
			referencedDiagnostics[id] = fmt.Sprintf("%s.diagnostics[%d]", itemPath, d)
		}
		v.vocabulary(itemPath+".implementation.kind", string(representation.Implementation.Kind), string(ImplementationDirect), string(ImplementationComposition))
		if representation.Rule != "" {
			rule, ok := semantics.rules[representation.Rule]
			if !ok {
				v.add(itemPath+".rule", CodeReferenceMissing, "rule %q is not declared", representation.Rule)
			} else if rule.Concept != "" && representation.Concept != rule.Concept {
				v.add(itemPath+".concept", CodeInconsistent, "concept %q differs from the concept of rule %q", representation.Concept, representation.Rule)
			}
		}
		if representation.Concept != "" {
			if _, ok := semantics.concepts[representation.Concept]; !ok {
				v.add(itemPath+".concept", CodeReferenceMissing, "concept %q is not declared", representation.Concept)
			}
		}
		if representation.Kind == RepresentationExternal {
			if representation.Interpretation != nil {
				v.add(itemPath+".interpretation", CodeFieldForbidden, "an external endpoint is never interpreted")
			}
			v.external(itemPath, representation, externals)
			continue
		}
		if representation.Interpretation == nil {
			v.add(itemPath+".interpretation", CodeFieldRequired, "an instance states its interpretation")
		} else {
			v.interpretation(itemPath+".interpretation", *representation.Interpretation, representation.Rule, semantics)
			for d, id := range representation.Interpretation.Diagnostics {
				referencedDiagnostics[id] = fmt.Sprintf("%s.interpretation.diagnostics[%d]", itemPath, d)
			}
		}
		if representation.Disclosure != "" {
			v.add(itemPath+".disclosure", CodeFieldForbidden, "only an external endpoint states a disclosure tier")
		}
		if v.required(itemPath+".address", representation.Address) && RepresentationID(representation.Address) != representation.ID {
			v.add(itemPath+".id", CodeIDInvalid, "representation identity is not derived from its instance address")
		}
		declaration, ok := index.declarations[representation.Declaration]
		if !ok {
			v.add(itemPath+".declaration", CodeReferenceMissing, "declaration %q is not in this stage", representation.Declaration)
		} else {
			instancesPerDeclaration[representation.Declaration]++
			if representation.Status == StatusCarried {
				carriedPerDeclaration[representation.Declaration]++
				holdsCarried = true
			}
			if (declaration.Kind == DeclarationData) != (representation.Kind == RepresentationData) {
				v.add(itemPath+".kind", CodeInconsistent, "representation kind differs from declaration kind")
			}
			if representation.Name != "" && representation.Name != declaration.Name {
				v.add(itemPath+".name", CodeFieldForbidden, "an instance is named by its declaration only")
			}
			if representation.ModuleInstance == "" && declaration.ModuleDeclaration != "" {
				v.add(itemPath+".module_instance", CodeFieldRequired, "an instance of a module declaration names its module instance")
			}
		}
		if v.vocabulary(itemPath+".index_key.kind", string(representation.IndexKey.Kind), string(IndexNone), string(IndexString), string(IndexNumber)) {
			switch representation.IndexKey.Kind {
			case IndexNone:
				v.forbidden(itemPath+".index_key.value", representation.IndexKey.Value)
			case IndexNumber:
				if _, err := strconv.Atoi(representation.IndexKey.Value); err != nil {
					v.add(itemPath+".index_key.value", CodeInconsistent, "a number index key is an integer")
				}
			}
		}
		if v.vocabulary(itemPath+".status", string(representation.Status), string(StatusPlanned), string(StatusCarried), string(StatusDeferred), string(StatusRecorded)) {
			switch stage {
			case StagePlanned:
				if representation.Status == StatusRecorded {
					v.add(itemPath+".status", CodeStageInvalid, "the planned stage carries planned, carried or deferred instances")
				}
			default:
				if representation.Status != StatusRecorded {
					v.add(itemPath+".status", CodeStageInvalid, "the %s stage carries recorded instances", stage)
				}
			}
		}
		if representation.Status != StatusPlanned {
			if len(representation.Actions) != 0 || representation.ActionReason != "" {
				v.add(itemPath+".actions", CodeFieldForbidden, "only planned instances carry actions")
			}
		}
		for x, action := range representation.Actions {
			v.vocabulary(fmt.Sprintf("%s.actions[%d]", itemPath, x), action, "no-op", "create", "read", "update", "delete", "forget")
		}
		if representation.Provider == nil {
			v.add(itemPath+".provider", CodeFieldRequired, "an instance carries its provider identity")
		} else {
			v.provider(itemPath+".provider", *representation.Provider)
		}
		if representation.Identity != nil {
			v.add(itemPath+".identity", CodeFieldForbidden, "managed and data instances never carry values")
		}
		if representation.Kind == RepresentationData && representation.Implementation.Kind == ImplementationComposition {
			v.add(itemPath+".implementation.kind", CodeInconsistent, "a data instance is never a composition root")
		}
		switch representation.Implementation.Kind {
		case ImplementationDirect:
			if len(representation.Implementation.Members) != 0 || len(representation.Implementation.Unresolved) != 0 {
				v.add(itemPath+".implementation.members", CodeFieldForbidden, "a direct implementation has no members")
			}
		case ImplementationComposition:
			if len(representation.Implementation.Members)+len(representation.Implementation.Unresolved) == 0 {
				v.add(itemPath+".implementation.members", CodeFieldRequired, "a composition lists its resolved and unresolved members")
			}
			if representation.Rule == "" {
				v.add(itemPath+".rule", CodeFieldRequired, "a composition root is interpreted by a rule")
			}
		}
	}
	for i, declaration := range a.Declarations {
		itemPath := fmt.Sprintf("%s.declarations[%d].population", path, i)
		count := instancesPerDeclaration[declaration.ID]
		if declaration.Population.Instances != count {
			v.add(itemPath+".instances", CodeInconsistent, "declared %d instances, stage carries %d", declaration.Population.Instances, count)
		}
		switch declaration.Population.Status {
		case PopulationObserved:
			if count == 0 {
				v.add(itemPath+".status", CodeInconsistent, "an observed population has at least one instance")
			}
		case PopulationProvenZero:
			if count != 0 {
				v.add(itemPath+".status", CodeInconsistent, "a proven-zero population has no instance")
			}
			if holdsCarried {
				v.add(itemPath+".status", CodeInconsistent, "a stage holding a carried instance proves no empty population")
			}
		}
		if carriedPerDeclaration[declaration.ID] != 0 && declaration.Population.Status != PopulationUnverified {
			v.add(itemPath+".status", CodeInconsistent, "a declaration with a carried instance keeps an unverified population")
		}
	}
	// Second pass over representations: member references need the full set.
	for i := range a.Representations {
		representation := &a.Representations[i]
		if representation.Implementation.Kind != ImplementationComposition {
			continue
		}
		itemPath := fmt.Sprintf("%s.representations[%d].implementation", path, i)
		defined := map[string]struct{}{}
		if rule, ok := semantics.rules[representation.Rule]; ok && rule.Composition != nil {
			for _, member := range rule.Composition.Members {
				defined[member.Name] = struct{}{}
			}
		} else if ok {
			v.add(itemPath+".kind", CodeInconsistent, "rule %q declares no composition", representation.Rule)
		}
		named := map[string]struct{}{}
		memberIDs := map[string]struct{}{}
		for m, member := range representation.Implementation.Members {
			memberPath := fmt.Sprintf("%s.members[%d]", itemPath, m)
			if v.required(memberPath+".name", member.Name) {
				if _, ok := defined[member.Name]; !ok {
					v.add(memberPath+".name", CodeReferenceMissing, "member %q is not declared by rule %q", member.Name, representation.Rule)
				}
				if _, dup := named[member.Name]; dup {
					v.add(memberPath+".name", CodeInconsistent, "member %q is listed more than once", member.Name)
				}
				named[member.Name] = struct{}{}
			}
			if MembershipID(representation.ID, member.Name, member.Representation) != member.ID {
				v.add(memberPath+".id", CodeIDInvalid, "membership identity is not derived from root, name and member")
			}
			v.unique(memberPath+".id", memberIDs, member.ID)
			if target, ok := index.representations[member.Representation]; !ok {
				v.add(memberPath+".representation", CodeReferenceMissing, "member representation %q is not in this stage", member.Representation)
			} else if target.Kind == RepresentationExternal {
				v.add(memberPath+".representation", CodeInconsistent, "an external endpoint is never a composition member")
			} else if target.ID == representation.ID {
				v.add(memberPath+".representation", CodeInconsistent, "a composition root is never its own member")
			}
			v.vocabulary(memberPath+".evidence", string(member.Evidence), string(EvidenceValue), string(EvidenceTraversal), string(EvidenceBoth))
		}
		for u, unresolved := range representation.Implementation.Unresolved {
			unresolvedPath := fmt.Sprintf("%s.unresolved[%d]", itemPath, u)
			if v.required(unresolvedPath+".name", unresolved.Name) {
				if _, ok := defined[unresolved.Name]; !ok {
					v.add(unresolvedPath+".name", CodeReferenceMissing, "member %q is not declared by rule %q", unresolved.Name, representation.Rule)
				}
				if _, dup := named[unresolved.Name]; dup {
					v.add(unresolvedPath+".name", CodeInconsistent, "member %q is listed more than once", unresolved.Name)
				}
				named[unresolved.Name] = struct{}{}
			}
			v.vocabulary(unresolvedPath+".reason", string(unresolved.Reason), reasonStrings()...)
		}
		for name := range defined {
			if _, ok := named[name]; !ok {
				v.add(itemPath+".members", CodeClosureIncomplete, "member %q is neither resolved nor unresolved", name)
			}
		}
	}

	factIDs := map[string]struct{}{}
	closureIDs := map[string]struct{}{}
	for i := range a.Closures {
		closure := &a.Closures[i]
		if v.unique(fmt.Sprintf("%s.closures[%d].id", path, i), closureIDs, closure.ID) {
			index.closures[closure.ID] = closure
		}
	}
	for i := range a.Contexts {
		fact := &a.Contexts[i]
		itemPath := fmt.Sprintf("%s.contexts[%d]", path, i)
		v.required(itemPath+".dimension", fact.Dimension)
		if ContextID(fact.Dimension, fact.From, fact.To) != fact.ID {
			v.add(itemPath+".id", CodeIDInvalid, "context identity is not derived from dimension, from and to")
		}
		if v.unique(itemPath+".id", factIDs, fact.ID) {
			index.facts[fact.ID] = factRef{kind: FactContext, qualifier: fact.Dimension, from: fact.From, to: fact.To, emission: firstEmission(fact.Provenance), closures: provenanceClosures(fact.Provenance)}
		}
		v.fact(itemPath, fact.ID, EmissionContext, fact.From, fact.To, fact.Dimension, "", fact.Provenance, index, semantics)
	}
	for i := range a.Contributions {
		fact := &a.Contributions[i]
		itemPath := fmt.Sprintf("%s.contributions[%d]", path, i)
		if ContributionID(fact.From, fact.To) != fact.ID {
			v.add(itemPath+".id", CodeIDInvalid, "contribution identity is not derived from from and to")
		}
		if v.unique(itemPath+".id", factIDs, fact.ID) {
			index.facts[fact.ID] = factRef{kind: FactContribution, from: fact.From, to: fact.To, emission: firstEmission(fact.Provenance), closures: provenanceClosures(fact.Provenance)}
		}
		v.fact(itemPath, fact.ID, EmissionContribution, fact.From, fact.To, "", "", fact.Provenance, index, semantics)
	}
	for i := range a.Relations {
		fact := &a.Relations[i]
		itemPath := fmt.Sprintf("%s.relations[%d]", path, i)
		v.required(itemPath+".predicate", fact.Predicate)
		if RelationID(fact.Predicate, fact.From, fact.To) != fact.ID {
			v.add(itemPath+".id", CodeIDInvalid, "relation identity is not derived from predicate, from and to")
		}
		if v.unique(itemPath+".id", factIDs, fact.ID) {
			index.facts[fact.ID] = factRef{kind: FactRelation, qualifier: fact.Predicate, from: fact.From, to: fact.To, emission: firstEmission(fact.Provenance), closures: provenanceClosures(fact.Provenance)}
		}
		v.fact(itemPath, fact.ID, EmissionRelation, fact.From, fact.To, "", fact.Predicate, fact.Provenance, index, semantics)
	}

	expected := map[string]string{}
	for _, representation := range index.representations {
		if representation.Kind == RepresentationExternal || representation.Rule == "" {
			continue
		}
		rule, ok := semantics.rules[representation.Rule]
		if !ok {
			continue
		}
		for _, emission := range rule.Emissions {
			expected[ClosureID(representation.ID, emission)] = representation.ID
		}
	}
	for i := range a.Closures {
		closure := &a.Closures[i]
		itemPath := fmt.Sprintf("%s.closures[%d]", path, i)
		if ClosureID(closure.Representation, closure.Emission) != closure.ID {
			v.add(itemPath+".id", CodeIDInvalid, "closure identity is not derived from representation and emission")
		}
		if _, ok := expected[closure.ID]; !ok {
			v.add(itemPath, CodeClosureExtra, "closure %q does not belong to an interpreted instance's emission", closure.ID)
		}
		delete(expected, closure.ID)
		if _, ok := index.representations[closure.Representation]; !ok {
			v.add(itemPath+".representation", CodeReferenceMissing, "representation %q is not in this stage", closure.Representation)
		}
		if _, ok := semantics.emissions[closure.Emission]; !ok {
			v.add(itemPath+".emission", CodeReferenceMissing, "emission %q is not declared", closure.Emission)
		}
		if closure.Candidates.KnownEqual < 0 || closure.Candidates.Unknown < 0 || closure.Candidates.Excluded < 0 {
			v.add(itemPath+".candidates", CodeInconsistent, "counts are negative")
		}
		if !v.vocabulary(itemPath+".outcome", string(closure.Outcome), string(OutcomeResolved), string(OutcomeAbsent), string(OutcomeIndeterminate)) {
			continue
		}
		switch closure.Outcome {
		case OutcomeResolved:
			v.forbidden(itemPath+".reason", string(closure.Reason))
			if len(closure.Facts) == 0 {
				v.add(itemPath+".facts", CodeFieldRequired, "a resolved closure establishes at least one fact")
			}
		case OutcomeAbsent:
			v.forbidden(itemPath+".reason", string(closure.Reason))
			if len(closure.Facts) != 0 {
				v.add(itemPath+".facts", CodeFieldForbidden, "an absent closure establishes no fact")
			}
		case OutcomeIndeterminate:
			v.vocabulary(itemPath+".reason", string(closure.Reason), reasonStrings()...)
		}
		closureFacts := map[string]struct{}{}
		for f, id := range closure.Facts {
			factPath := fmt.Sprintf("%s.facts[%d]", itemPath, f)
			v.unique(factPath, closureFacts, id)
			fact, ok := index.facts[id]
			switch {
			case !ok:
				v.add(factPath, CodeReferenceMissing, "fact %q is not in this stage", id)
			case fact.from != closure.Representation:
				v.add(factPath, CodeInconsistent, "fact %q does not originate from representation %q", id, closure.Representation)
			case !fact.closures[closure.ID]:
				v.add(factPath, CodeInconsistent, "the provenance of fact %q does not name closure %q", id, closure.ID)
			}
		}
	}
	for id := range expected {
		v.add(path+".closures", CodeClosureIncomplete, "closure %q is missing", id)
	}

	dependencyIDs := map[string]struct{}{}
	for i, dependency := range a.Dependencies {
		itemPath := fmt.Sprintf("%s.dependencies[%d]", path, i)
		v.unique(itemPath+".id", dependencyIDs, dependency.ID)
		if DependencyID(dependency.From, dependency.To) != dependency.ID {
			v.add(itemPath+".id", CodeIDInvalid, "dependency identity is not derived from from and to")
		}
		for _, end := range []struct{ field, id string }{{"from", dependency.From}, {"to", dependency.To}} {
			if _, ok := index.nodes[end.id]; !ok {
				v.add(itemPath+"."+end.field, CodeReferenceMissing, "%q is neither a representation nor a declaration of this stage", end.id)
			}
		}
		if dependency.From == dependency.To {
			v.add(itemPath, CodeInconsistent, "a dependency never loops on itself")
		}
		if len(dependency.Roles) == 0 {
			v.add(itemPath+".roles", CodeFieldRequired, "a dependency names at least one role")
		}
		roles := map[string]struct{}{}
		for r, role := range dependency.Roles {
			rolePath := fmt.Sprintf("%s.roles[%d]", itemPath, r)
			v.vocabulary(rolePath, string(role), string(DependencyReference), string(DependencyDependsOn), string(DependencyCount), string(DependencyForEach), string(DependencyProvider))
			v.unique(rolePath, roles, string(role))
		}
	}
	deposed := map[string]struct{}{}
	for i, address := range a.Deposed {
		itemPath := fmt.Sprintf("%s.deposed[%d]", path, i)
		v.required(itemPath, address)
		v.unique(itemPath, deposed, address)
	}
	if derived := DeriveAccounting(a); derived != a.Accounting {
		v.add(path+".accounting", CodeAccountingMismatch, "accounting is not derived from the stage collections")
	}
	return index
}

func firstEmission(provenance []FactProvenance) string {
	if len(provenance) == 0 {
		return ""
	}
	return provenance[0].Emission
}

func (v *validator) provider(path string, provider Provider) {
	v.required(path+".address", provider.Address)
	if v.vocabulary(path+".alias_availability", string(provider.AliasAvailability), string(AliasAvailable), string(AliasUnavailable)) {
		if provider.AliasAvailability == AliasUnavailable && provider.Alias != "" {
			v.add(path+".alias", CodeInconsistent, "an unavailable alias carries no value")
		}
	}
}

func (v *validator) interpretation(path string, interpretation Interpretation, rule string, semantics *semanticIndex) {
	if !v.vocabulary(path+".status", string(interpretation.Status), string(InterpretationNone), string(InterpretationApplied), string(InterpretationIndeterminate), string(InterpretationFailed)) {
		return
	}
	switch interpretation.Status {
	case InterpretationApplied:
		if rule == "" {
			v.add(path+".status", CodeInconsistent, "an applied interpretation names the representation rule")
		} else if !contains(interpretation.Candidates, rule) {
			v.add(path+".candidates", CodeInconsistent, "the applied rule %q is not a candidate", rule)
		}
	default:
		if rule != "" {
			v.add(path+".status", CodeInconsistent, "only an applied interpretation names a rule")
		}
	}
	if interpretation.Status == InterpretationIndeterminate {
		v.vocabulary(path+".reason", string(interpretation.Reason), reasonStrings()...)
	} else {
		v.forbidden(path+".reason", string(interpretation.Reason))
	}
	for i, candidate := range interpretation.Candidates {
		if _, ok := semantics.rules[candidate]; !ok {
			v.add(fmt.Sprintf("%s.candidates[%d]", path, i), CodeReferenceMissing, "rule %q is not declared", candidate)
		}
	}
	if interpretation.Status == InterpretationFailed && len(interpretation.Diagnostics) == 0 {
		v.add(path+".diagnostics", CodeFieldRequired, "a failed interpretation names its diagnostics")
	}
}

// externalLedger collects the external endpoints of one input Form across
// every stage. Ordinals are Form-wide: one external
// identity keeps one identifier in every stage, so an identifier seen in two
// stages names the same endpoint and a recorded identity names one
// identifier.
type externalLedger struct {
	ordinals map[string]map[int]struct{}
	byID     map[string]externalSighting
	byKey    map[string]string
}

type externalSighting struct {
	disclosure Disclosure
	identity   string
}

func newExternalLedger() *externalLedger {
	return &externalLedger{ordinals: map[string]map[int]struct{}{}, byID: map[string]externalSighting{}, byKey: map[string]string{}}
}

// externalKey is the comparable identity of an external endpoint: its
// concept and its recorded identity attributes in canonical order.
func externalKey(concept string, identity map[string]string) string {
	keys := make([]string, 0, len(identity))
	for key := range identity {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	parts := []string{concept}
	for _, key := range keys {
		parts = append(parts, key, identity[key])
	}
	return strings.Join(parts, "\x00")
}

func (v *validator) externalOrdinals(path string, ledger *externalLedger) {
	concepts := make([]string, 0, len(ledger.ordinals))
	for concept := range ledger.ordinals {
		concepts = append(concepts, concept)
	}
	sort.Strings(concepts)
	for _, concept := range concepts {
		ordinals := ledger.ordinals[concept]
		for ordinal := range ordinals {
			if ordinal >= len(ordinals) {
				v.add(path, CodeIDInvalid, "external ordinals of concept %q are not contiguous from zero across the stages of the Form", concept)
				break
			}
		}
	}
}

func (v *validator) external(path string, representation *Representation, ledger *externalLedger) {
	v.forbidden(path+".declaration", representation.Declaration)
	v.forbidden(path+".address", representation.Address)
	v.forbidden(path+".module_instance", representation.ModuleInstance)
	v.forbidden(path+".name", representation.Name)
	v.forbidden(path+".rule", representation.Rule)
	v.forbidden(path+".previous_address", representation.PreviousAddress)
	v.forbidden(path+".action_reason", representation.ActionReason)
	if representation.IndexKey.Kind != IndexNone || representation.IndexKey.Value != "" {
		v.add(path+".index_key", CodeFieldForbidden, "an external endpoint has no index key")
	}
	if representation.Status != StatusExternal {
		v.add(path+".status", CodeStageInvalid, "an external endpoint has status %q", StatusExternal)
	}
	if len(representation.Actions) != 0 {
		v.add(path+".actions", CodeFieldForbidden, "an external endpoint has no actions")
	}
	if representation.Provider != nil {
		v.add(path+".provider", CodeFieldForbidden, "an external endpoint has no provider identity")
	}
	if representation.Implementation.Kind != ImplementationDirect || len(representation.Implementation.Members) != 0 {
		v.add(path+".implementation", CodeFieldForbidden, "an external endpoint is direct and has no members")
	}
	if !v.required(path+".concept", representation.Concept) {
		return
	}
	prefix := EncodeID("external", IdentityContract, representation.Concept) + ":"
	if !strings.HasPrefix(representation.ID, prefix) {
		v.add(path+".id", CodeIDInvalid, "external identity is not derived from its concept")
		return
	}
	ordinal, err := strconv.Atoi(strings.TrimPrefix(representation.ID, prefix))
	if err != nil || ordinal < 0 || ExternalID(representation.Concept, ordinal) != representation.ID {
		v.add(path+".id", CodeIDInvalid, "external identity carries no ordinal")
		return
	}
	if ledger.ordinals[representation.Concept] == nil {
		ledger.ordinals[representation.Concept] = map[int]struct{}{}
	}
	ledger.ordinals[representation.Concept][ordinal] = struct{}{}
	if !v.vocabulary(path+".disclosure", string(representation.Disclosure), string(DiscloseNone), string(DiscloseRecord), string(DiscloseReport)) {
		return
	}
	switch {
	case representation.Disclosure == DiscloseNone && len(representation.Identity) != 0:
		v.add(path+".identity", CodeFieldForbidden, "a withheld external identity is never recorded")
		return
	case representation.Disclosure != DiscloseNone && len(representation.Identity) == 0:
		v.add(path+".identity", CodeFieldRequired, "a disclosed external endpoint records its identity")
		return
	}
	for key, value := range representation.Identity {
		if key == "" || value == "" {
			v.add(path+".identity", CodeFieldRequired, "identity attribute names and values are not empty")
			return
		}
	}
	sighting := externalSighting{disclosure: representation.Disclosure}
	if len(representation.Identity) != 0 {
		sighting.identity = externalKey(representation.Concept, representation.Identity)
	}
	if previous, seen := ledger.byID[representation.ID]; seen {
		if previous != sighting {
			v.add(path, CodeInconsistent, "external endpoint %q differs from its occurrence in another stage", representation.ID)
		}
		return
	}
	ledger.byID[representation.ID] = sighting
	if sighting.identity == "" {
		return
	}
	if other, taken := ledger.byKey[sighting.identity]; taken {
		v.add(path+".identity", CodeInconsistent, "external endpoints %q and %q carry the same identity", other, representation.ID)
		return
	}
	ledger.byKey[sighting.identity] = representation.ID
}

func (v *validator) fact(path, id string, kind EmissionKind, from, to, dimension, predicate string, provenance []FactProvenance, index *stageIndex, semantics *semanticIndex) {
	source, ok := index.representations[from]
	if !ok {
		v.add(path+".from", CodeReferenceMissing, "representation %q is not in this stage", from)
	} else if source.Kind == RepresentationExternal {
		v.add(path+".from", CodeInconsistent, "an external endpoint never emits facts")
	}
	target, ok := index.representations[to]
	if !ok {
		v.add(path+".to", CodeReferenceMissing, "representation %q is not in this stage", to)
	}
	if len(provenance) == 0 {
		v.add(path+".provenance", CodeFieldRequired, "a fact records at least one provenance entry")
	}
	seen := map[string]struct{}{}
	for i, entry := range provenance {
		entryPath := fmt.Sprintf("%s.provenance[%d]", path, i)
		v.unique(entryPath+".closure", seen, entry.Closure)
		v.vocabulary(entryPath+".evidence", string(entry.Evidence), string(EvidenceValue), string(EvidenceTraversal), string(EvidenceBoth))
		emission, ok := semantics.emissions[entry.Emission]
		if !ok {
			v.add(entryPath+".emission", CodeReferenceMissing, "emission %q is not declared", entry.Emission)
			continue
		}
		if emission.Rule != entry.Rule {
			v.add(entryPath+".rule", CodeInconsistent, "emission %q belongs to rule %q", entry.Emission, emission.Rule)
		}
		if emission.Kind != kind {
			v.add(entryPath+".emission", CodeInconsistent, "emission %q is a %s emission", entry.Emission, emission.Kind)
		}
		if emission.Dimension != dimension || emission.Predicate != predicate {
			v.add(entryPath+".emission", CodeInconsistent, "emission %q does not carry this fact's dimension or predicate", entry.Emission)
		}
		if source != nil && source.Rule != entry.Rule {
			v.add(entryPath+".rule", CodeInconsistent, "representation %q is interpreted by rule %q", from, source.Rule)
		}
		if target != nil {
			switch emission.To.Kind {
			case TargetConcept:
				if target.Concept != emission.To.ID {
					v.add(path+".to", CodeInconsistent, "target concept %q differs from the emission target %q", target.Concept, emission.To.ID)
				}
			case TargetRule:
				// An external endpoint stands for an object of the target
				// rule's concept outside the represented inventory; it is
				// never interpreted, so it carries that concept and no rule.
				if target.Kind == RepresentationExternal {
					if rule, ok := semantics.rules[emission.To.ID]; ok && target.Concept != rule.Concept {
						v.add(path+".to", CodeInconsistent, "external concept %q differs from the concept of target rule %q", target.Concept, emission.To.ID)
					}
				} else if target.Rule != emission.To.ID {
					v.add(path+".to", CodeInconsistent, "target rule %q differs from the emission target %q", target.Rule, emission.To.ID)
				}
			}
		}
		closure, ok := index.closures[entry.Closure]
		switch {
		case !ok:
			v.add(entryPath+".closure", CodeReferenceMissing, "closure %q is not in this stage", entry.Closure)
		case !contains(closure.Facts, id):
			v.add(entryPath+".closure", CodeInconsistent, "closure %q does not list this fact", entry.Closure)
		case closure.Representation != from || closure.Emission != entry.Emission:
			v.add(entryPath+".closure", CodeInconsistent, "closure %q belongs to another representation or emission", entry.Closure)
		}
	}
}

func (v *validator) comparisons(path string, c *Comparisons, stages map[Stage]*Architecture) {
	index := map[Stage]*stageIndex{}
	for stage, architecture := range stages {
		index[stage] = indexStage(architecture)
	}
	expect := func(name string, comparison *Comparison, before, after Stage) *stageIndex {
		itemPath := path + "." + name
		present := stages[before] != nil && stages[after] != nil
		if comparison == nil {
			if present {
				v.add(itemPath, CodeFieldRequired, "stages %q and %q are present, the %s comparison is required", before, after, name)
			}
			return nil
		}
		if !present {
			v.add(itemPath, CodeFieldForbidden, "the %s comparison requires stages %q and %q", name, before, after)
			return nil
		}
		if comparison.Name != name {
			v.add(itemPath+".name", CodeVocabulary, "comparison is named %q", name)
		}
		if comparison.Before != before || comparison.After != after {
			v.add(itemPath, CodeStageInvalid, "the %s comparison goes from %q to %q", name, before, after)
		}
		return index[after]
	}
	expect(ComparisonDrift, c.Drift, StageRecorded, StageRefreshed)
	expect(ComparisonChanges, c.Changes, StageRefreshed, StagePlanned)
	expect(ComparisonNet, c.Net, StageRecorded, StagePlanned)
	if c.Drift != nil && stages[StageRecorded] != nil && stages[StageRefreshed] != nil {
		v.comparison(path+"."+ComparisonDrift, c.Drift, stages[StageRecorded], stages[StageRefreshed], nil, nil)
	}
	if c.Changes != nil && stages[StageRefreshed] != nil && stages[StagePlanned] != nil {
		v.comparison(path+"."+ComparisonChanges, c.Changes, stages[StageRefreshed], stages[StagePlanned], nil, nil)
	}
	if c.Net != nil && stages[StageRecorded] != nil && stages[StagePlanned] != nil {
		v.comparison(path+"."+ComparisonNet, c.Net, stages[StageRecorded], stages[StagePlanned], c.Drift, c.Changes)
	}
}

func indexStage(a *Architecture) *stageIndex {
	index := &stageIndex{
		declarations:    map[string]*Declaration{},
		representations: map[string]*Representation{},
		facts:           map[string]factRef{},
		closures:        map[string]*Closure{},
		nodes:           map[string]struct{}{},
	}
	if a == nil {
		return index
	}
	for i := range a.Declarations {
		index.declarations[a.Declarations[i].ID] = &a.Declarations[i]
		index.nodes[a.Declarations[i].ID] = struct{}{}
	}
	for i := range a.Representations {
		index.representations[a.Representations[i].ID] = &a.Representations[i]
		index.nodes[a.Representations[i].ID] = struct{}{}
	}
	for i := range a.Contexts {
		index.facts[a.Contexts[i].ID] = factRef{kind: FactContext, qualifier: a.Contexts[i].Dimension, from: a.Contexts[i].From, to: a.Contexts[i].To, emission: firstEmission(a.Contexts[i].Provenance), closures: provenanceClosures(a.Contexts[i].Provenance)}
	}
	for i := range a.Contributions {
		index.facts[a.Contributions[i].ID] = factRef{kind: FactContribution, from: a.Contributions[i].From, to: a.Contributions[i].To, emission: firstEmission(a.Contributions[i].Provenance), closures: provenanceClosures(a.Contributions[i].Provenance)}
	}
	for i := range a.Relations {
		index.facts[a.Relations[i].ID] = factRef{kind: FactRelation, qualifier: a.Relations[i].Predicate, from: a.Relations[i].From, to: a.Relations[i].To, emission: firstEmission(a.Relations[i].Provenance), closures: provenanceClosures(a.Relations[i].Provenance)}
	}
	for i := range a.Closures {
		index.closures[a.Closures[i].ID] = &a.Closures[i]
	}
	return index
}

// comparison validates one closure-level comparison between two stages.
// drift and planned are the sibling comparisons a net comparison cancels
// against; they are nil elsewhere.
func (v *validator) comparison(path string, c *Comparison, beforeStage, afterStage *Architecture, drift, planned *Comparison) {
	before := indexStage(beforeStage)
	after := indexStage(afterStage)
	name := c.Name
	if c.Comparable && len(c.Problems) != 0 {
		v.add(path+".problems", CodeInconsistent, "a comparable comparison reports no problem")
	}
	if !c.Comparable {
		if len(c.Problems) == 0 {
			v.add(path+".problems", CodeFieldRequired, "an incomparable comparison states its problems")
		}
		if len(c.Representations)+len(c.Facts)+len(c.Indeterminate)+len(c.Cancelled) != 0 {
			v.add(path, CodeInconsistent, "an incomparable comparison reports no change")
		}
	}
	for i, problem := range c.Problems {
		itemPath := fmt.Sprintf("%s.problems[%d]", path, i)
		if !diagnosticCodePattern.MatchString(problem.Code) {
			v.add(itemPath+".code", CodeVocabulary, "problem code %q is not an upper-case code", problem.Code)
		}
		v.required(itemPath+".message", problem.Message)
	}
	ids := map[string]struct{}{}
	moved := map[string]bool{}
	for i, change := range c.Representations {
		itemPath := fmt.Sprintf("%s.representations[%d]", path, i)
		v.unique(itemPath+".id", ids, change.ID)
		if RepresentationChangeID(name, change.Change, change.Representation) != change.ID {
			v.add(itemPath+".id", CodeIDInvalid, "change identity is not derived from comparison, change and representation")
		}
		if !v.vocabulary(itemPath+".change", string(change.Change), string(ChangeAdded), string(ChangeRemoved), string(ChangeChanged), string(ChangeMoved), string(ChangeReplaced), string(ChangeRecreated)) {
			continue
		}
		beforeRepresentation, inBefore := before.representations[change.Representation]
		afterRepresentation, inAfter := after.representations[change.Representation]
		external := (inBefore && beforeRepresentation.Kind == RepresentationExternal) || (inAfter && afterRepresentation.Kind == RepresentationExternal)
		switch {
		case external && change.Change != ChangeAdded && change.Change != ChangeRemoved:
			v.add(itemPath+".change", CodeInconsistent, "an external endpoint is only added or removed")
		case external && name == ComparisonCross:
			v.crossExternal(itemPath, change, before, after)
		default:
			switch change.Change {
			case ChangeAdded:
				if !inAfter || inBefore {
					v.add(itemPath+".representation", CodeInconsistent, "an added representation exists after and not before")
				}
			case ChangeRemoved:
				if !inBefore || inAfter {
					v.add(itemPath+".representation", CodeInconsistent, "a removed representation exists before and not after")
				}
			case ChangeMoved:
				moved[change.Representation] = true
				switch {
				case !inAfter:
					v.add(itemPath+".representation", CodeInconsistent, "a moved representation exists after")
				case afterRepresentation.PreviousAddress != change.PreviousAddress:
					v.add(itemPath+".previous_address", CodeInconsistent, "the moved representation does not carry this previous address")
				}
				if !v.required(itemPath+".previous_address", change.PreviousAddress) {
					break
				}
				_, atPrevious := before.representations[RepresentationID(change.PreviousAddress)]
				switch name {
				case ComparisonDrift:
					v.add(itemPath+".change", CodeInconsistent, "a move is a planned action, never drift")
				case ComparisonCross:
					if !atPrevious {
						v.add(itemPath+".previous_address", CodeInconsistent, "the previous address is not on the before side")
					}
				default:
					// Producers apply moves to the previous-run and prior
					// states, so the before side of an intra-plan comparison
					// may already hold the new address.
					if !atPrevious && !inBefore {
						v.add(itemPath+".representation", CodeInconsistent, "a moved representation exists before at its previous or current address")
					}
				}
			default:
				if !inBefore || !inAfter {
					v.add(itemPath+".representation", CodeInconsistent, "a %s representation exists on both sides", change.Change)
				}
			}
		}
		if change.Change != ChangeChanged && len(change.Fields) != 0 {
			v.add(itemPath+".fields", CodeFieldForbidden, "only changed representations list fields")
		}
		if change.Change == ChangeChanged && len(change.Fields) == 0 {
			v.add(itemPath+".fields", CodeFieldRequired, "a changed representation names its changed fields")
		}
		for f, field := range change.Fields {
			v.vocabulary(fmt.Sprintf("%s.fields[%d]", itemPath, f), field, ChangedFields()...)
		}
		if change.Change != ChangeMoved {
			v.forbidden(itemPath+".previous_address", change.PreviousAddress)
		}
		if change.Change != ChangeReplaced && change.Change != ChangeRecreated {
			v.forbidden(itemPath+".reason", change.Reason)
		}
	}
	if c.Comparable && (name == ComparisonChanges || name == ComparisonNet) {
		for _, id := range sortedRepresentationIDs(after.representations) {
			if after.representations[id].PreviousAddress != "" && !moved[id] {
				v.add(path+".representations", CodeInconsistent, "moved representation %q is not listed as moved", id)
			}
		}
	}
	// Moves listed by this comparison translate representation identities
	// between its sides, so completeness is checked on the closure that could
	// establish the same fact.
	toBefore, toAfter := map[string]string{}, map[string]string{}
	for _, change := range c.Representations {
		if change.Change != ChangeMoved || change.PreviousAddress == "" {
			continue
		}
		previous := RepresentationID(change.PreviousAddress)
		if _, ok := before.representations[previous]; ok && previous != change.Representation {
			toBefore[change.Representation] = previous
			toAfter[previous] = change.Representation
		}
	}
	factChangeIDs := map[string]struct{}{}
	for i, change := range c.Facts {
		itemPath := fmt.Sprintf("%s.facts[%d]", path, i)
		v.unique(itemPath+".id", factChangeIDs, change.ID)
		if FactChangeID(name, change.Change, change.Fact) != change.ID {
			v.add(itemPath+".id", CodeIDInvalid, "change identity is not derived from comparison, change and fact")
		}
		v.vocabulary(itemPath+".kind", string(change.Kind), string(FactContext), string(FactContribution), string(FactRelation))
		if !v.vocabulary(itemPath+".change", string(change.Change), string(ChangeAdded), string(ChangeRemoved)) {
			continue
		}
		var fact factRef
		var ok bool
		if change.Change == ChangeAdded {
			fact, ok = after.facts[change.Fact]
		} else {
			fact, ok = before.facts[change.Fact]
		}
		if !ok {
			v.add(itemPath+".fact", CodeReferenceMissing, "fact %q is not on the expected side", change.Fact)
			continue
		}
		if fact.kind != change.Kind || fact.from != change.From || fact.to != change.To {
			v.add(itemPath, CodeInconsistent, "fact change does not mirror fact %q", change.Fact)
		}
		if fact.emission != "" && change.Emission != fact.emission {
			v.add(itemPath+".emission", CodeInconsistent, "emission differs from the provenance of fact %q", change.Fact)
		}
		own, other, translate := after, before, toBefore
		if change.Change == ChangeRemoved {
			own, other, translate = before, after, toAfter
		}
		// A listed fact is absent from the other side once moves are
		// translated. Across inputs an external identifier is a
		// Form-local ordinal, so identity decides there instead.
		if name != ComparisonCross || (!own.isExternal(fact.from) && !own.isExternal(fact.to)) {
			from, to := fact.from, fact.to
			if mapped := translate[from]; mapped != "" {
				from = mapped
			}
			if mapped := translate[to]; mapped != "" {
				to = mapped
			}
			if _, exists := other.facts[factKey(fact.kind, fact.qualifier, from, to)]; exists {
				v.add(itemPath+".fact", CodeInconsistent, "fact %q is %s although the other side establishes it", change.Fact, change.Change)
			}
		}
		for _, closureID := range sortedClosureIDs(fact.closures) {
			closure := own.closures[closureID]
			if closure == nil {
				continue
			}
			counterpart := closure.Representation
			if mapped := translate[counterpart]; mapped != "" {
				counterpart = mapped
			}
			if !other.complete(counterpart, closure.Emission) {
				v.add(itemPath+".fact", CodeInconsistent, "fact %q is %s although closure %q is incomplete on the other side", change.Fact, change.Change, ClosureID(counterpart, closure.Emission))
			}
		}
	}
	indeterminateIDs := map[string]struct{}{}
	for i, entry := range c.Indeterminate {
		itemPath := fmt.Sprintf("%s.indeterminate[%d]", path, i)
		v.unique(itemPath+".id", indeterminateIDs, entry.ID)
		if IndeterminateID(name, entry.Closure, entry.Side) != entry.ID {
			v.add(itemPath+".id", CodeIDInvalid, "indeterminate identity is not derived from comparison, closure and side")
		}
		if ClosureID(entry.Representation, entry.Emission) != entry.Closure {
			v.add(itemPath+".closure", CodeIDInvalid, "closure identity is not derived from representation and emission")
		}
		if !v.vocabulary(itemPath+".side", entry.Side, SideBefore, SideAfter) {
			continue
		}
		side := before
		if entry.Side == SideAfter {
			side = after
		}
		if len(entry.Reasons) == 0 {
			v.add(itemPath+".reasons", CodeFieldRequired, "an indeterminate entry states at least one reason")
			continue
		}
		closure, ok := side.closures[entry.Closure]
		if !ok {
			v.uninterpretedClosure(itemPath, entry, side)
			continue
		}
		reasons := map[Reason]struct{}{}
		for j, reason := range entry.Reasons {
			reasonPath := fmt.Sprintf("%s.reasons[%d]", itemPath, j)
			if _, duplicate := reasons[reason]; duplicate {
				v.add(reasonPath, CodeInconsistent, "reason %q is listed twice", reason)
				continue
			}
			reasons[reason] = struct{}{}
			if reason == ReasonExternalIdentityWithheld {
				switch {
				case name != ComparisonCross:
					v.add(reasonPath, CodeInconsistent, "withheld external identity only limits cross-input comparisons")
				case !side.externalFact(closure):
					v.add(itemPath+".closure", CodeInconsistent, "closure %q establishes no fact to an external endpoint", entry.Closure)
				}
				continue
			}
			if !v.vocabulary(reasonPath, string(reason), reasonStrings()...) {
				continue
			}
			switch {
			case closure.Outcome != OutcomeIndeterminate:
				v.add(itemPath+".closure", CodeInconsistent, "closure %q is determinate", entry.Closure)
			case closure.Reason != reason:
				v.add(reasonPath, CodeInconsistent, "reason differs from closure %q", entry.Closure)
			}
		}
		if closure.Outcome == OutcomeIndeterminate {
			if _, listed := reasons[closure.Reason]; !listed {
				v.add(itemPath+".reasons", CodeInconsistent, "indeterminate closure %q is indeterminate for reason %q", entry.Closure, closure.Reason)
			}
		}
	}
	if name != ComparisonNet && len(c.Cancelled) != 0 {
		v.add(path+".cancelled", CodeFieldForbidden, "only the net comparison lists cancelled facts")
	}
	v.externalMatches(path, c, before, after)
	if name == ComparisonNet {
		driftChanges := factChangeSet(drift)
		plannedChanges := factChangeSet(planned)
		cancelledIDs := map[string]struct{}{}
		for i, entry := range c.Cancelled {
			itemPath := fmt.Sprintf("%s.cancelled[%d]", path, i)
			v.unique(itemPath+".id", cancelledIDs, entry.ID)
			v.required(itemPath+".fact", entry.Fact)
			if CancellationID(entry.Fact) != entry.ID {
				v.add(itemPath+".id", CodeIDInvalid, "cancellation identity is not derived from its fact")
			}
			if _, ok := driftChanges[entry.Drift]; !ok {
				v.add(itemPath+".drift_change", CodeReferenceMissing, "fact change %q is not in the drift comparison", entry.Drift)
			}
			if _, ok := plannedChanges[entry.Planned]; !ok {
				v.add(itemPath+".planned_change", CodeReferenceMissing, "fact change %q is not in the planned comparison", entry.Planned)
			}
			if _, ok := factChangeIDs[FactChangeID(name, ChangeAdded, entry.Fact)]; ok {
				v.add(itemPath+".fact", CodeInconsistent, "a cancelled fact is not a net change")
			}
			if _, ok := factChangeIDs[FactChangeID(name, ChangeRemoved, entry.Fact)]; ok {
				v.add(itemPath+".fact", CodeInconsistent, "a cancelled fact is not a net change")
			}
		}
	}
	if derived := DeriveComparisonCounts(c); derived != c.Counts {
		v.add(path+".counts", CodeAccountingMismatch, "counts are not derived from the comparison collections")
	}
}

// uninterpretedClosure checks an indeterminate entry whose closure is absent
// from its side. Only a representation whose interpretation is indeterminate
// or failed on that side leaves such a closure unsettled; anywhere else an
// absent closure is complete and its fact differences are real changes.
func (v *validator) uninterpretedClosure(path string, entry IndeterminateClosure, side *stageIndex) {
	representation, ok := side.representations[entry.Representation]
	if !ok {
		v.add(path+".representation", CodeReferenceMissing, "representation %q is not on side %q", entry.Representation, entry.Side)
		return
	}
	interpretation := representation.Interpretation
	if interpretation == nil || (interpretation.Status != InterpretationIndeterminate && interpretation.Status != InterpretationFailed) {
		v.add(path+".closure", CodeReferenceMissing, "closure %q is not on side %q", entry.Closure, entry.Side)
		return
	}
	want := ReasonInterpretationFailed
	if interpretation.Status == InterpretationIndeterminate {
		want = interpretation.Reason
	}
	if len(entry.Reasons) != 1 || entry.Reasons[0] != want {
		v.add(path+".reasons", CodeInconsistent, "the closure of an uninterpreted representation is indeterminate only for reason %q", want)
	}
}

// crossExternal validates a cross-input change on an external endpoint.
// Ordinals carry no meaning across Forms, so presence on the
// other side is decided by concept and recorded identity. An
// endpoint whose identity is withheld is never reported as a change, and a
// disclosed endpoint is reported only when the other side withholds no
// identity of the same concept, since a withheld endpoint could be the same
// object.
func (v *validator) crossExternal(path string, change RepresentationChange, before, after *stageIndex) {
	own, other := before, after
	if change.Change == ChangeAdded {
		own, other = after, before
	}
	representation, ok := own.representations[change.Representation]
	if !ok || representation.Kind != RepresentationExternal {
		v.add(path+".representation", CodeInconsistent, "a %s external endpoint exists on its own side", change.Change)
		return
	}
	if len(representation.Identity) == 0 {
		v.add(path+".representation", CodeInconsistent, "an external endpoint whose identity is withheld is never compared across inputs")
		return
	}
	key := externalKey(representation.Concept, representation.Identity)
	equal, withheld := false, false
	for _, candidate := range other.representations {
		if candidate.Kind != RepresentationExternal || candidate.Concept != representation.Concept {
			continue
		}
		if len(candidate.Identity) == 0 {
			withheld = true
		} else if externalKey(candidate.Concept, candidate.Identity) == key {
			equal = true
		}
	}
	switch {
	case equal:
		v.add(path+".representation", CodeInconsistent, "the other side carries an external endpoint of equal identity")
	case withheld:
		v.add(path+".representation", CodeInconsistent, "the other side withholds identities of concept %q, so presence is indeterminate", representation.Concept)
	}
}

// externalMatches checks how a cross comparison pairs external endpoints:
// only a comparable cross comparison pairs them, each endpoint at most once,
// each pair of equal concept and recorded identity, and every such pair is
// listed, so a reader never places a before-side fact through an ordinal.
func (v *validator) externalMatches(path string, c *Comparison, before, after *stageIndex) {
	if c.Name != ComparisonCross || !c.Comparable {
		if len(c.ExternalMatches) != 0 {
			v.add(path+".external_matches", CodeFieldForbidden, "only a comparable cross comparison matches external endpoints")
		}
		return
	}
	listed := map[string]string{}
	seenBefore, seenAfter := map[string]struct{}{}, map[string]struct{}{}
	for i, match := range c.ExternalMatches {
		itemPath := fmt.Sprintf("%s.external_matches[%d]", path, i)
		v.unique(itemPath+".before", seenBefore, match.Before)
		v.unique(itemPath+".after", seenAfter, match.After)
		own, okBefore := before.representations[match.Before]
		other, okAfter := after.representations[match.After]
		if !okBefore || own.Kind != RepresentationExternal {
			v.add(itemPath+".before", CodeReferenceMissing, "%q is not an external endpoint of the before side", match.Before)
			continue
		}
		if !okAfter || other.Kind != RepresentationExternal {
			v.add(itemPath+".after", CodeReferenceMissing, "%q is not an external endpoint of the after side", match.After)
			continue
		}
		listed[match.Before] = match.After
		if len(own.Identity) == 0 || len(other.Identity) == 0 {
			v.add(itemPath, CodeInconsistent, "an external endpoint whose identity is withheld is never matched")
			continue
		}
		if externalKey(own.Concept, own.Identity) != externalKey(other.Concept, other.Identity) {
			v.add(itemPath, CodeInconsistent, "matched external endpoints differ in concept or identity")
		}
	}
	byKey := map[string]string{}
	for _, id := range sortedRepresentationIDs(after.representations) {
		if r := after.representations[id]; r.Kind == RepresentationExternal && len(r.Identity) != 0 {
			byKey[externalKey(r.Concept, r.Identity)] = id
		}
	}
	for _, id := range sortedRepresentationIDs(before.representations) {
		r := before.representations[id]
		if r.Kind != RepresentationExternal || len(r.Identity) == 0 {
			continue
		}
		if match, ok := byKey[externalKey(r.Concept, r.Identity)]; ok && listed[id] != match {
			v.add(path+".external_matches", CodeInconsistent, "external endpoint %q matches %q and is not listed", id, match)
		}
	}
}

func factChangeSet(c *Comparison) map[string]struct{} {
	out := map[string]struct{}{}
	if c == nil {
		return out
	}
	for _, change := range c.Facts {
		out[change.ID] = struct{}{}
	}
	return out
}

func (v *validator) driftReport(path string, report *DriftReport, comparisons *Comparisons, stages map[Stage]*Architecture) {
	driftChanges := map[string]struct{}{}
	if comparisons != nil {
		driftChanges = factChangeSet(comparisons.Drift)
	}
	v.required(path+".summary", report.Summary)
	ids := map[string]struct{}{}
	for i, entry := range report.Entries {
		itemPath := fmt.Sprintf("%s.entries[%d]", path, i)
		v.unique(itemPath+".id", ids, entry.ID)
		if v.required(itemPath+".address", entry.Address) && DriftEntryID(entry.Address) != entry.ID {
			v.add(itemPath+".id", CodeIDInvalid, "drift entry identity is not derived from its address")
		}
		if len(entry.Actions) == 0 {
			v.add(itemPath+".actions", CodeFieldRequired, "a drift entry carries the producer actions")
		}
		for x, action := range entry.Actions {
			v.vocabulary(fmt.Sprintf("%s.actions[%d]", itemPath, x), action, "no-op", "create", "read", "update", "delete", "forget")
		}
		for p, changed := range entry.ChangedPaths {
			v.required(fmt.Sprintf("%s.changed_paths[%d]", itemPath, p), changed)
		}
		if v.vocabulary(itemPath+".consequence", string(entry.Consequence), string(DriftArchitectural), string(DriftNoneUnderDialects), string(DriftIndeterminate), string(DriftUncovered), string(DriftAddressOnly)) {
			switch entry.Consequence {
			case DriftAddressOnly:
				v.required(itemPath+".previous_address", entry.PreviousAddress)
				if len(entry.ChangedPaths) != 0 {
					v.add(itemPath+".changed_paths", CodeInconsistent, "an address-only entry changes no attribute")
				}
			case DriftArchitectural:
				if len(entry.FactChanges) == 0 && entry.Representation == "" {
					v.add(itemPath, CodeInconsistent, "an architectural consequence names fact changes or the representation involved")
				}
			}
			if entry.Consequence != DriftArchitectural && len(entry.FactChanges) != 0 {
				v.add(itemPath+".fact_changes", CodeFieldForbidden, "only architectural consequences reference fact changes")
			}
		}
		for f, id := range entry.FactChanges {
			if _, ok := driftChanges[id]; !ok {
				v.add(fmt.Sprintf("%s.fact_changes[%d]", itemPath, f), CodeReferenceMissing, "fact change %q is not in the drift comparison", id)
			}
		}
		if entry.Representation != "" {
			found := false
			for _, stage := range []Stage{StageRefreshed, StageRecorded} {
				if architecture := stages[stage]; architecture != nil {
					for _, representation := range architecture.Representations {
						if representation.ID == entry.Representation {
							found = true
						}
					}
				}
			}
			if !found {
				v.add(itemPath+".representation", CodeReferenceMissing, "representation %q is not in the refreshed or recorded stage", entry.Representation)
			}
		}
	}
}

func (v *validator) diagnostics(path string, diagnostics []Diagnostic, stages map[Stage]*Architecture, ids map[string]struct{}) {
	seen := map[string]struct{}{}
	for i, diagnostic := range diagnostics {
		itemPath := fmt.Sprintf("%s[%d]", path, i)
		v.unique(itemPath+".id", seen, diagnostic.ID)
		if DiagnosticID(diagnostic) != diagnostic.ID {
			v.add(itemPath+".id", CodeIDInvalid, "diagnostic identity is not derived from its stable fields")
		}
		v.vocabulary(itemPath+".phase", string(diagnostic.Phase), string(PhaseInput), string(PhaseEnrichment), string(PhaseSelection), string(PhaseInterpretation), string(PhaseComposition), string(PhaseResolution), string(PhaseComparison), string(PhaseValidation))
		v.vocabulary(itemPath+".severity", string(diagnostic.Severity), string(SeverityError), string(SeverityWarning), string(SeverityInfo))
		if !diagnosticCodePattern.MatchString(diagnostic.Code) {
			v.add(itemPath+".code", CodeVocabulary, "diagnostic code %q is not an upper-case code", diagnostic.Code)
		}
		v.required(itemPath+".message", diagnostic.Message)
		if diagnostic.Count < 0 {
			v.add(itemPath+".count", CodeInconsistent, "count is negative")
		}
		if stages == nil {
			if diagnostic.Stage != "" || diagnostic.Declaration != "" || diagnostic.Representation != "" {
				v.add(itemPath, CodeFieldForbidden, "a comparison Form diagnostic names no stage subject")
			}
			continue
		}
		candidates := stages
		if diagnostic.Stage != "" {
			if v.vocabulary(itemPath+".stage", string(diagnostic.Stage), stageStrings()...) {
				architecture, ok := stages[diagnostic.Stage]
				if !ok || architecture == nil {
					v.add(itemPath+".stage", CodeStageInvalid, "stage %q is not present", diagnostic.Stage)
					continue
				}
				candidates = map[Stage]*Architecture{diagnostic.Stage: architecture}
			}
		}
		if diagnostic.Declaration != "" && !hasDeclaration(candidates, diagnostic.Declaration) {
			v.add(itemPath+".declaration", CodeReferenceMissing, "declaration %q is not present", diagnostic.Declaration)
		}
		if diagnostic.Representation != "" && !hasRepresentation(candidates, diagnostic.Representation) {
			v.add(itemPath+".representation", CodeReferenceMissing, "representation %q is not present", diagnostic.Representation)
		}
	}
}

func hasDeclaration(stages map[Stage]*Architecture, id string) bool {
	for _, architecture := range stages {
		if architecture == nil {
			continue
		}
		for _, declaration := range architecture.Declarations {
			if declaration.ID == id {
				return true
			}
		}
	}
	return false
}

func hasRepresentation(stages map[Stage]*Architecture, id string) bool {
	for _, architecture := range stages {
		if architecture == nil {
			continue
		}
		for _, representation := range architecture.Representations {
			if representation.ID == id {
				return true
			}
		}
	}
	return false
}
