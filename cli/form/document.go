// Package form defines the Form, format 1: the self-describing,
// instance-level, stage-aware model Rootform compiles from state and plan
// evidence, in its state, plan and comparison kinds. No value field exists
// except external endpoint identity under the Dialect disclosure contract.
package form

const (
	FormatVersion    = "1"
	GeneratorName    = "rootform"
	IdentityContract = "1"
)

type Kind string

const (
	KindState      Kind = "state"
	KindPlan       Kind = "plan"
	KindComparison Kind = "comparison"
)

type Origin string

const (
	OriginPlan  Origin = "plan"
	OriginState Origin = "state"
)

type Stage string

const (
	StagePlanned   Stage = "planned"
	StageRefreshed Stage = "refreshed"
	StageRecorded  Stage = "recorded"
)

func Stages() []Stage { return []Stage{StagePlanned, StageRefreshed, StageRecorded} }

type Generator struct {
	Name    string `json:"name"`
	Version string `json:"version"`
}

type ToolIdentity string

const (
	ToolUnestablished ToolIdentity = "unestablished"
	ToolTerraform     ToolIdentity = "terraform"
	ToolOpenTofu      ToolIdentity = "opentofu"
)

type Producer struct {
	Tool            ToolIdentity `json:"tool"`
	ToolSource      string       `json:"tool_source,omitempty"`
	ReportedVersion string       `json:"reported_version"`
	Hints           []string     `json:"hints"`
}

type CompletenessValue string

const (
	CompleteTrue        CompletenessValue = "true"
	CompleteFalse       CompletenessValue = "false"
	CompleteUnavailable CompletenessValue = "unavailable"
)

type Completeness struct {
	ProducerComplete CompletenessValue `json:"producer_complete"`
	AttestedComplete bool              `json:"attested_complete"`
}

type SnapshotStatus string

const (
	SnapshotVerified SnapshotStatus = "verified"
	SnapshotRefused  SnapshotStatus = "refused"
	SnapshotAbsent   SnapshotStatus = "absent"
)

type SnapshotEnrichment struct {
	Status     SnapshotStatus `json:"status"`
	Trust      string         `json:"trust,omitempty"`
	Diagnostic string         `json:"diagnostic,omitempty"`
	Modules    int            `json:"modules"`
}

type Enrichment struct {
	Snapshot SnapshotEnrichment `json:"snapshot"`
}

type Attestation struct {
	Name  string `json:"name"`
	Value string `json:"value"`
}

type DriftRecords string

const (
	DriftRecordsPresent       DriftRecords = "present"
	DriftRecordsAbsent        DriftRecords = "absent"
	DriftRecordsNotApplicable DriftRecords = "not_applicable"
)

type Scope struct {
	RefreshScope              string       `json:"refresh_scope"`
	DriftRecords              DriftRecords `json:"drift_records"`
	DataSourcesCoveredByDrift bool         `json:"data_sources_covered_by_drift"`
	DeposedCoveredByDrift     bool         `json:"deposed_covered_by_drift"`
}

type Evidence struct {
	Origin             Origin        `json:"origin"`
	InputFormatVersion string        `json:"input_format_version"`
	Producer           Producer      `json:"producer"`
	Completeness       Completeness  `json:"completeness"`
	Enrichment         Enrichment    `json:"enrichment"`
	Attestations       []Attestation `json:"attestations"`
	Scope              Scope         `json:"scope"`
}

type SemanticOwnerKind string

const (
	OwnerVocabulary SemanticOwnerKind = "vocabulary"
	OwnerDialect    SemanticOwnerKind = "dialect"
)

type SemanticOrigin string

const (
	SemanticSupplied SemanticOrigin = "supplied"
	SemanticLocal    SemanticOrigin = "local"
	SemanticOCI      SemanticOrigin = "oci"
)

type SemanticProvider struct {
	Source  string   `json:"source"`
	Version string   `json:"version"`
	Hosts   []string `json:"hosts"`
}

type SemanticOwner struct {
	ID             string             `json:"id"`
	Kind           SemanticOwnerKind  `json:"kind"`
	Origin         SemanticOrigin     `json:"origin"`
	Version        string             `json:"version"`
	ContentDigest  string             `json:"content_digest"`
	SemanticDigest string             `json:"semantic_digest"`
	Providers      []SemanticProvider `json:"providers"`
	Dependencies   []string           `json:"dependencies"`
}

type ReleaseSetUnit struct {
	Owner          string            `json:"owner"`
	Kind           SemanticOwnerKind `json:"kind"`
	Version        string            `json:"version"`
	ContentDigest  string            `json:"content_digest"`
	SemanticDigest string            `json:"semantic_digest"`
}

type ReleaseSet struct {
	ID             string           `json:"id"`
	Version        string           `json:"version"`
	ManifestDigest string           `json:"manifest_digest"`
	Units          []ReleaseSetUnit `json:"units"`
}

type OwnerReplacement struct {
	Owner  string         `json:"owner"`
	Origin SemanticOrigin `json:"origin"`
	Digest string         `json:"digest"`
}

type Selection struct {
	ActiveOwners   []string           `json:"active_owners"`
	ExcludedOwners []string           `json:"excluded_owners"`
	Replacements   []OwnerReplacement `json:"replacements"`
	ProviderMap    []Attestation      `json:"provider_map"`
}

type ConceptDefinition struct {
	ID          string `json:"id"`
	Owner       string `json:"owner"`
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
}

type ContextDefinition struct {
	ID          string `json:"id"`
	Owner       string `json:"owner"`
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
}

type RelationDefinition struct {
	ID          string `json:"id"`
	Owner       string `json:"owner"`
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
}

type IdentityScope string

const (
	IdentityScopeProvider IdentityScope = "provider"
	IdentityScopeGlobal   IdentityScope = "global"
)

type IdentityDefinition struct {
	Attributes []string      `json:"attributes"`
	Scope      IdentityScope `json:"scope"`
}

type EndpointDefinition struct {
	Attributes []string `json:"attributes"`
}

type CompositionMemberDefinition struct {
	Name      string `json:"name"`
	Via       string `json:"via"`
	MatchKind string `json:"match_kind"`
	MatchType string `json:"match_type"`
}

type CompositionDefinition struct {
	Members []CompositionMemberDefinition `json:"members"`
}

type RuleDefinition struct {
	ID          string                 `json:"id"`
	Owner       string                 `json:"owner"`
	MatchKind   string                 `json:"match_kind"`
	MatchType   string                 `json:"match_type"`
	Concept     string                 `json:"concept,omitempty"`
	Identity    *IdentityDefinition    `json:"identity,omitempty"`
	Endpoint    *EndpointDefinition    `json:"endpoint,omitempty"`
	Emissions   []string               `json:"emissions"`
	Composition *CompositionDefinition `json:"composition,omitempty"`
}

type TargetKind string

const (
	TargetConcept TargetKind = "concept"
	TargetRule    TargetKind = "rule"
)

type TargetRef struct {
	Kind TargetKind `json:"kind"`
	ID   string     `json:"id"`
}

type EmissionKind string

const (
	EmissionContext      EmissionKind = "context"
	EmissionContribution EmissionKind = "contribution"
	EmissionRelation     EmissionKind = "relation"
)

type MatchStrategy string

const (
	MatchExact       MatchStrategy = "exact"
	MatchDotAncestor MatchStrategy = "dot-ancestor"
	MatchLastSegment MatchStrategy = "last-segment"
)

type EmissionMatch struct {
	// By lists the target attributes, in author order, whose value can
	// equal the emission value. The first names an external endpoint.
	By       []string      `json:"by"`
	Strategy MatchStrategy `json:"strategy"`
}

type NullSemantics string

const (
	NullAbsent        NullSemantics = "absent"
	NullIndeterminate NullSemantics = "indeterminate"
)

type ExternalPolicy string

const (
	ExternalAllow ExternalPolicy = "allow"
	ExternalDeny  ExternalPolicy = "deny"
)

type Disclosure string

const (
	DiscloseNone   Disclosure = "none"
	DiscloseRecord Disclosure = "record"
	DiscloseReport Disclosure = "report"
)

type Emission struct {
	ID        string         `json:"id"`
	Rule      string         `json:"rule"`
	Kind      EmissionKind   `json:"kind"`
	To        TargetRef      `json:"to"`
	Dimension string         `json:"dimension,omitempty"`
	Predicate string         `json:"predicate,omitempty"`
	Via       string         `json:"via"`
	Match     *EmissionMatch `json:"match,omitempty"`
	OnNull    NullSemantics  `json:"on_null"`
	OnEmpty   NullSemantics  `json:"on_empty"`
	External  ExternalPolicy `json:"external"`
	Disclose  Disclosure     `json:"disclose"`
	Prefix    string         `json:"prefix,omitempty"`
}

type Semantics struct {
	LanguageVersion string               `json:"language_version"`
	ReleaseSet      ReleaseSet           `json:"release_set"`
	Selection       Selection            `json:"selection"`
	Owners          []SemanticOwner      `json:"owners"`
	Concepts        []ConceptDefinition  `json:"concepts"`
	Contexts        []ContextDefinition  `json:"contexts"`
	Relations       []RelationDefinition `json:"relations"`
	Rules           []RuleDefinition     `json:"rules"`
	Emissions       []Emission           `json:"emissions"`
}

type DeclarationKind string

const (
	DeclarationResource DeclarationKind = "resource"
	DeclarationData     DeclarationKind = "data"
)

type PopulationStatus string

const (
	PopulationObserved   PopulationStatus = "observed"
	PopulationProvenZero PopulationStatus = "proven_zero"
	PopulationUnverified PopulationStatus = "unverified"
)

type Population struct {
	Status    PopulationStatus `json:"status"`
	Instances int              `json:"instances"`
}

type AliasAvailability string

const (
	AliasAvailable   AliasAvailability = "available"
	AliasUnavailable AliasAvailability = "unavailable"
)

type Provider struct {
	Address           string            `json:"address"`
	Alias             string            `json:"alias"`
	AliasAvailability AliasAvailability `json:"alias_availability"`
	Module            string            `json:"module,omitempty"`
	Binding           string            `json:"binding,omitempty"`
}

type InterpretationStatus string

const (
	InterpretationNone          InterpretationStatus = "none"
	InterpretationApplied       InterpretationStatus = "applied"
	InterpretationIndeterminate InterpretationStatus = "indeterminate"
	InterpretationFailed        InterpretationStatus = "failed"
)

// Interpretation is the rule decision for one managed or data instance.
// Candidates are the rules whose kind, type and provider binding fit the
// instance; a rule's where predicate then decides per instance, so instances
// of one declaration may be interpreted differently. The applied rule and its
// concept are the representation's rule and concept.
type Interpretation struct {
	Status      InterpretationStatus `json:"status"`
	Reason      Reason               `json:"reason,omitempty"`
	Candidates  []string             `json:"candidates"`
	Diagnostics []string             `json:"diagnostics"`
}

type Declaration struct {
	ID                string          `json:"id"`
	Kind              DeclarationKind `json:"kind"`
	Type              string          `json:"type"`
	Name              string          `json:"name"`
	Address           string          `json:"address"`
	ModuleDeclaration string          `json:"module_declaration,omitempty"`
	Provider          Provider        `json:"provider"`
	Population        Population      `json:"population"`
	Diagnostics       []string        `json:"diagnostics"`
}

type RepresentationKind string

const (
	RepresentationManaged  RepresentationKind = "managed"
	RepresentationData     RepresentationKind = "data"
	RepresentationExternal RepresentationKind = "external"
)

type InstanceStatus string

const (
	StatusPlanned  InstanceStatus = "planned"
	StatusCarried  InstanceStatus = "carried"
	StatusDeferred InstanceStatus = "deferred"
	StatusRecorded InstanceStatus = "recorded"
	StatusExternal InstanceStatus = "external"
)

type IndexKeyKind string

const (
	IndexNone   IndexKeyKind = "none"
	IndexString IndexKeyKind = "string"
	IndexNumber IndexKeyKind = "number"
)

type IndexKey struct {
	Kind  IndexKeyKind `json:"kind"`
	Value string       `json:"value,omitempty"`
}

type ImplementationKind string

const (
	ImplementationDirect      ImplementationKind = "direct"
	ImplementationComposition ImplementationKind = "composition"
)

// CompositionMember is one resolved member of a composition root. Evidence
// states whether the member was found by evaluated value matching, by a
// saved-plan identity traversal, or by both in agreement.
type CompositionMember struct {
	ID             string       `json:"id"`
	Name           string       `json:"name"`
	Representation string       `json:"representation"`
	Evidence       EvidenceKind `json:"evidence"`
}

// UnresolvedMember is a composition member that the evidence could not
// establish, with the closure reason that explains why. Unknown members stay
// visible instead of silently shrinking the composition.
type UnresolvedMember struct {
	Name   string `json:"name"`
	Reason Reason `json:"reason"`
}

type Implementation struct {
	Kind       ImplementationKind  `json:"kind"`
	Members    []CompositionMember `json:"members,omitempty"`
	Unresolved []UnresolvedMember  `json:"unresolved,omitempty"`
}

type Representation struct {
	ID              string             `json:"id"`
	Kind            RepresentationKind `json:"kind"`
	Declaration     string             `json:"declaration,omitempty"`
	Address         string             `json:"address,omitempty"`
	ModuleInstance  string             `json:"module_instance,omitempty"`
	IndexKey        IndexKey           `json:"index_key"`
	Status          InstanceStatus     `json:"status"`
	Actions         []string           `json:"actions"`
	ActionReason    string             `json:"action_reason,omitempty"`
	PreviousAddress string             `json:"previous_address,omitempty"`
	Provider        *Provider          `json:"provider,omitempty"`
	Name            string             `json:"name,omitempty"`
	Interpretation  *Interpretation    `json:"interpretation,omitempty"`
	Rule            string             `json:"rule,omitempty"`
	Concept         string             `json:"concept,omitempty"`
	Implementation  Implementation     `json:"implementation"`
	Disclosure      Disclosure         `json:"disclosure,omitempty"`
	Identity        map[string]string  `json:"identity,omitempty"`
	Diagnostics     []string           `json:"diagnostics"`
}

type EvidenceKind string

const (
	EvidenceValue     EvidenceKind = "value"
	EvidenceTraversal EvidenceKind = "traversal"
	EvidenceBoth      EvidenceKind = "both"
)

type FactProvenance struct {
	Emission string       `json:"emission"`
	Rule     string       `json:"rule"`
	Closure  string       `json:"closure"`
	Evidence EvidenceKind `json:"evidence"`
}

type Context struct {
	ID         string           `json:"id"`
	From       string           `json:"from"`
	To         string           `json:"to"`
	Dimension  string           `json:"dimension"`
	Provenance []FactProvenance `json:"provenance"`
}

type Contribution struct {
	ID         string           `json:"id"`
	From       string           `json:"from"`
	To         string           `json:"to"`
	Provenance []FactProvenance `json:"provenance"`
}

type Relation struct {
	ID         string           `json:"id"`
	From       string           `json:"from"`
	To         string           `json:"to"`
	Predicate  string           `json:"predicate"`
	Provenance []FactProvenance `json:"provenance"`
}

type Outcome string

const (
	OutcomeResolved      Outcome = "resolved"
	OutcomeAbsent        Outcome = "absent"
	OutcomeIndeterminate Outcome = "indeterminate"
)

type Reason string

const (
	ReasonUnknownUntilApply Reason = "unknown_until_apply"
	ReasonSensitive         Reason = "sensitive"
	ReasonAmbiguousUnknown  Reason = "ambiguous_unknown"
	// ReasonUncomparableCandidate marks a closure whose value matches no
	// comparable candidate while a candidate whose type lacks the match
	// attribute could still be the endpoint.
	ReasonUncomparableCandidate Reason = "uncomparable_candidate"
	ReasonReferenceAmbiguous    Reason = "reference_ambiguous"
	ReasonIdentityIncomplete    Reason = "identity_incomplete"
	ReasonUnavailable           Reason = "unavailable"
	ReasonExternalDenied        Reason = "external_denied"
	ReasonDuplicateIdentity     Reason = "duplicate_identity"
)

func Reasons() []Reason {
	return []Reason{
		ReasonUnknownUntilApply, ReasonSensitive, ReasonAmbiguousUnknown, ReasonUncomparableCandidate,
		ReasonReferenceAmbiguous, ReasonIdentityIncomplete, ReasonUnavailable,
		ReasonExternalDenied, ReasonDuplicateIdentity,
	}
}

// ReasonExternalIdentityWithheld marks a cross-input comparison entry whose
// closures resolve to external endpoints on both sides while at least one
// side withholds the endpoint identity (disclosure tier none), so the two
// endpoints cannot be proven equal or different. It is never a closure
// reason.
const ReasonExternalIdentityWithheld Reason = "external_identity_withheld"

// ReasonInterpretationFailed marks an indeterminate closure side whose
// representation has a failed interpretation there: no rule applies, so the
// closure's facts are not compared.
const ReasonInterpretationFailed Reason = "interpretation_failed"

// IndeterminateReasons lists the reasons a comparison entry may carry.
func IndeterminateReasons() []Reason {
	return append(Reasons(), ReasonExternalIdentityWithheld, ReasonInterpretationFailed)
}

// Representation fields a "changed" comparison entry may name.
const (
	FieldProvider       = "provider"
	FieldRule           = "rule"
	FieldConcept        = "concept"
	FieldImplementation = "implementation"
)

// ChangedFields lists the closed vocabulary of changed representation fields.
func ChangedFields() []string {
	return []string{FieldProvider, FieldRule, FieldConcept, FieldImplementation}
}

type Candidates struct {
	KnownEqual int `json:"known_equal"`
	Unknown    int `json:"unknown"`
	Excluded   int `json:"excluded"`
}

// Closure is the outcome of one emission for one interpreted instance. A via
// value may be a list, so a closure may establish several facts: resolved
// means the fact set is complete and non-empty, absent means it is complete
// and empty, indeterminate means it is incomplete (facts proven by resolved
// elements are still listed). The endpoint kind of a fact is the kind of its
// target representation; its evidence is on the fact provenance.
type Closure struct {
	ID             string     `json:"id"`
	Representation string     `json:"representation"`
	Emission       string     `json:"emission"`
	Outcome        Outcome    `json:"outcome"`
	Reason         Reason     `json:"reason,omitempty"`
	Facts          []string   `json:"facts"`
	Candidates     Candidates `json:"candidates"`
}

type DependencyRole string

const (
	DependencyReference DependencyRole = "reference"
	DependencyDependsOn DependencyRole = "depends_on"
	DependencyCount     DependencyRole = "count"
	DependencyForEach   DependencyRole = "for_each"
	DependencyProvider  DependencyRole = "provider"
)

type Dependency struct {
	ID    string           `json:"id"`
	From  string           `json:"from"`
	To    string           `json:"to"`
	Roles []DependencyRole `json:"roles"`
}

type Accounting struct {
	Declarations                 int `json:"declarations"`
	Resources                    int `json:"resources"`
	DataSources                  int `json:"data_sources"`
	Instances                    int `json:"instances"`
	ManagedInstances             int `json:"managed_instances"`
	DataInstances                int `json:"data_instances"`
	ExternalEndpoints            int `json:"external_endpoints"`
	Carried                      int `json:"carried"`
	Deferred                     int `json:"deferred"`
	AppliedInterpretations       int `json:"applied_interpretations"`
	IndeterminateInterpretations int `json:"indeterminate_interpretations"`
	FailedInterpretations        int `json:"failed_interpretations"`
	UninterpretedInstances       int `json:"uninterpreted_instances"`
	Facts                        int `json:"facts"`
	Closures                     int `json:"closures"`
	Resolved                     int `json:"resolved"`
	Absent                       int `json:"absent"`
	Indeterminate                int `json:"indeterminate"`
	Dependencies                 int `json:"dependencies"`
	Deposed                      int `json:"deposed"`
}

type Reconstruction struct {
	From                 Stage `json:"from"`
	ReversedDriftEntries int   `json:"reversed_drift_entries"`
}

// Architecture is the content of one stage of an input Form, serialized as one
// entry of its stages map. A stage is never a Form.
type Architecture struct {
	Stage           Stage            `json:"stage"`
	Label           string           `json:"label"`
	Reconstruction  *Reconstruction  `json:"reconstruction,omitempty"`
	Declarations    []Declaration    `json:"declarations"`
	Representations []Representation `json:"representations"`
	Contexts        []Context        `json:"contexts"`
	Contributions   []Contribution   `json:"contributions"`
	Relations       []Relation       `json:"relations"`
	Closures        []Closure        `json:"closures"`
	Dependencies    []Dependency     `json:"dependencies"`
	Deposed         []string         `json:"deposed"`
	Accounting      Accounting       `json:"accounting"`
}

type ChangeKind string

const (
	ChangeAdded     ChangeKind = "added"
	ChangeRemoved   ChangeKind = "removed"
	ChangeChanged   ChangeKind = "changed"
	ChangeMoved     ChangeKind = "moved"
	ChangeReplaced  ChangeKind = "replaced"
	ChangeRecreated ChangeKind = "recreated"
)

type FactKind string

const (
	FactContext      FactKind = "context"
	FactContribution FactKind = "contribution"
	FactRelation     FactKind = "relation"
)

type RepresentationChange struct {
	ID              string     `json:"id"`
	Change          ChangeKind `json:"change"`
	Representation  string     `json:"representation"`
	PreviousAddress string     `json:"previous_address,omitempty"`
	Reason          string     `json:"reason,omitempty"`
	Fields          []string   `json:"fields,omitempty"`
}

type FactChange struct {
	ID       string     `json:"id"`
	Change   ChangeKind `json:"change"`
	Kind     FactKind   `json:"kind"`
	Fact     string     `json:"fact"`
	From     string     `json:"from"`
	To       string     `json:"to"`
	Emission string     `json:"emission"`
}

// IndeterminateClosure records one closure side whose facts a comparison cannot
// settle. The closure is named with its representation and emission because
// it may be absent from that side: a representation without a determinate
// interpretation there has no closure. Reasons lists every cause, sorted: the
// closure's own indeterminate reason, external_identity_withheld in
// cross-input comparisons, or the interpretation's reason
// (interpretation_failed for a failed interpretation) when the closure is
// absent.
type IndeterminateClosure struct {
	ID             string   `json:"id"`
	Closure        string   `json:"closure"`
	Representation string   `json:"representation"`
	Emission       string   `json:"emission"`
	Side           string   `json:"side"`
	Reasons        []Reason `json:"reasons"`
}

type ComparisonProblem struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

type ComparisonCounts struct {
	RepresentationsAdded   int `json:"representations_added"`
	RepresentationsRemoved int `json:"representations_removed"`
	RepresentationsChanged int `json:"representations_changed"`
	Moved                  int `json:"moved"`
	Replaced               int `json:"replaced"`
	Recreated              int `json:"recreated"`
	FactsAdded             int `json:"facts_added"`
	FactsRemoved           int `json:"facts_removed"`
	Indeterminate          int `json:"indeterminate"`
	Cancelled              int `json:"cancelled"`
}

type Cancellation struct {
	ID      string `json:"id"`
	Fact    string `json:"fact"`
	Drift   string `json:"drift_change"`
	Planned string `json:"planned_change"`
}

type Comparison struct {
	Name            string                 `json:"name"`
	Before          Stage                  `json:"before"`
	After           Stage                  `json:"after"`
	Comparable      bool                   `json:"comparable"`
	Problems        []ComparisonProblem    `json:"problems"`
	Representations []RepresentationChange `json:"representations"`
	Facts           []FactChange           `json:"facts"`
	Indeterminate   []IndeterminateClosure `json:"indeterminate"`
	Cancelled       []Cancellation         `json:"cancelled"`
	// ExternalMatches pairs, in a cross comparison only, every before-side
	// external endpoint with the after-side endpoint of equal concept and
	// recorded identity, equal identifiers included.
	ExternalMatches []ExternalMatch  `json:"external_matches,omitempty"`
	Counts          ComparisonCounts `json:"counts"`
}

// ExternalMatch names the same external endpoint on both sides of a cross
// comparison. External identifiers are document-local ordinals and a display
// copy withholds record-tier identities, so a reader places a before-side fact
// on the after side through this pair, never through the identifier or the
// identity.
type ExternalMatch struct {
	Before string `json:"before"`
	After  string `json:"after"`
}

type Comparisons struct {
	Drift   *Comparison `json:"drift,omitempty"`
	Changes *Comparison `json:"changes,omitempty"`
	Net     *Comparison `json:"net,omitempty"`
}

type DriftConsequence string

const (
	DriftArchitectural     DriftConsequence = "architectural"
	DriftNoneUnderDialects DriftConsequence = "none_under_dialects"
	DriftIndeterminate     DriftConsequence = "indeterminate"
	DriftUncovered         DriftConsequence = "uncovered"
	DriftAddressOnly       DriftConsequence = "address_only"
)

type DriftEntry struct {
	ID              string           `json:"id"`
	Address         string           `json:"address"`
	Actions         []string         `json:"actions"`
	ChangedPaths    []string         `json:"changed_paths"`
	PreviousAddress string           `json:"previous_address,omitempty"`
	Consequence     DriftConsequence `json:"consequence"`
	FactChanges     []string         `json:"fact_changes"`
	Representation  string           `json:"representation,omitempty"`
}

type DriftReport struct {
	Entries []DriftEntry `json:"entries"`
	Summary string       `json:"summary"`
}

type DiagnosticPhase string

const (
	PhaseInput          DiagnosticPhase = "input"
	PhaseEnrichment     DiagnosticPhase = "enrichment"
	PhaseSelection      DiagnosticPhase = "selection"
	PhaseInterpretation DiagnosticPhase = "interpretation"
	PhaseComposition    DiagnosticPhase = "composition"
	PhaseResolution     DiagnosticPhase = "resolution"
	PhaseComparison     DiagnosticPhase = "comparison"
	PhaseValidation     DiagnosticPhase = "validation"
)

type DiagnosticSeverity string

const (
	SeverityError   DiagnosticSeverity = "error"
	SeverityWarning DiagnosticSeverity = "warning"
	SeverityInfo    DiagnosticSeverity = "info"
)

type Diagnostic struct {
	ID             string             `json:"id"`
	Phase          DiagnosticPhase    `json:"phase"`
	Severity       DiagnosticSeverity `json:"severity"`
	Code           string             `json:"code"`
	Message        string             `json:"message"`
	Stage          Stage              `json:"stage,omitempty"`
	Declaration    string             `json:"declaration,omitempty"`
	Representation string             `json:"representation,omitempty"`
	Path           string             `json:"path,omitempty"`
	Owner          string             `json:"owner,omitempty"`
	Rule           string             `json:"rule,omitempty"`
	Emission       string             `json:"emission,omitempty"`
	Count          int                `json:"count,omitempty"`
}

// InputForm is a Form compiled from one state or plan export: the
// architecture of every stage its evidence supports, keyed by stage, with
// the comparisons and drift report those stages allow.
type InputForm struct {
	FormatVersion string                  `json:"format_version"`
	Kind          Kind                    `json:"kind"`
	Generator     Generator               `json:"generator"`
	Evidence      Evidence                `json:"evidence"`
	Semantics     Semantics               `json:"semantics"`
	Stages        map[Stage]*Architecture `json:"stages"`
	DefaultStage  Stage                   `json:"default_stage"`
	Comparisons   *Comparisons            `json:"comparisons,omitempty"`
	DriftReport   *DriftReport            `json:"drift_report,omitempty"`
	Diagnostics   []Diagnostic            `json:"diagnostics"`
}

// Side is one operand of a comparison Form: the complete state or plan Form
// it embeds and the stage selected from it.
type Side struct {
	Form         InputForm `json:"form"`
	Stage        Stage     `json:"stage"`
	SelectedFrom string    `json:"selected_from"`
}

// ComparisonForm embeds its two input Forms, each a state or plan Form, and
// never another comparison Form.
type ComparisonForm struct {
	FormatVersion string       `json:"format_version"`
	Kind          Kind         `json:"kind"`
	Generator     Generator    `json:"generator"`
	Before        Side         `json:"before"`
	After         Side         `json:"after"`
	Comparison    Comparison   `json:"comparison"`
	Diagnostics   []Diagnostic `json:"diagnostics"`
}
