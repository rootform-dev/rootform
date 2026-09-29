package form

import (
	"bytes"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

const (
	testOwner        = "localtest"
	testConceptFile  = "localtest.concept.file"
	testConceptLink  = "localtest.concept.link"
	testContextDir   = "localtest.context.directory"
	testRelationUses = "localtest.relation.uses"
	testRuleFile     = "localtest.rule.file"
	testRuleLink     = "localtest.rule.link"
	testDigest       = "sha256:0000000000000000000000000000000000000000000000000000000000000000"
)

var (
	addrA = "local_file.a"
	addrB = "local_file.b"
	addrC = "local_file.c"
	repA  = RepresentationID(addrA)
	repB  = RepresentationID(addrB)
	repC  = RepresentationID(addrC)
	declA = DeclarationID(addrA)
	declB = DeclarationID(addrB)
	declC = DeclarationID(addrC)
	extX  = ExternalID(testConceptFile, 0)
)

func testProvider() *Provider {
	return &Provider{Address: "registry.terraform.io/hashicorp/local", AliasAvailability: AliasAvailable}
}

func testEmission() Emission {
	emission := Emission{
		Rule:     testRuleLink,
		Kind:     EmissionContribution,
		To:       TargetRef{Kind: TargetConcept, ID: testConceptFile},
		Via:      "source.target",
		Match:    &EmissionMatch{By: []string{"target.filename"}, Strategy: MatchExact},
		OnNull:   NullAbsent,
		OnEmpty:  NullAbsent,
		External: ExternalAllow,
		Disclose: DiscloseRecord,
	}
	emission.ID = EmissionID(emission)
	return emission
}

func testSemantics() Semantics {
	emission := testEmission()
	units := []ReleaseSetUnit{{Owner: testOwner, Kind: OwnerDialect, Version: "0.1.0", ContentDigest: testDigest, SemanticDigest: testDigest}}
	return Semantics{
		LanguageVersion: "1",
		ReleaseSet:      ReleaseSetIdentity("0.1.0", units),
		Selection:       Selection{ActiveOwners: []string{testOwner}},
		Owners: []SemanticOwner{{
			ID: testOwner, Kind: OwnerDialect, Origin: SemanticLocal, Version: "0.1.0",
			ContentDigest: testDigest, SemanticDigest: testDigest,
			Providers: []SemanticProvider{{Source: "hashicorp/local", Version: "= 2.5.0", Hosts: []string{"registry.terraform.io", "registry.opentofu.org"}}},
		}},
		Concepts:  []ConceptDefinition{{ID: testConceptFile, Owner: testOwner, Name: "file"}, {ID: testConceptLink, Owner: testOwner, Name: "link"}},
		Contexts:  []ContextDefinition{{ID: testContextDir, Owner: testOwner, Name: "directory"}},
		Relations: []RelationDefinition{{ID: testRelationUses, Owner: testOwner, Name: "uses"}},
		Rules: []RuleDefinition{
			{ID: testRuleFile, Owner: testOwner, MatchKind: "resource", MatchType: "local_file", Concept: testConceptFile,
				Identity: &IdentityDefinition{Attributes: []string{"filename"}, Scope: IdentityScopeProvider},
				Endpoint: &EndpointDefinition{Attributes: []string{"id", "filename"}}, Emissions: []string{}},
			{ID: testRuleLink, Owner: testOwner, MatchKind: "resource", MatchType: "local_file", Concept: testConceptLink, Emissions: []string{emission.ID}},
		},
		Emissions: []Emission{emission},
	}
}

func declaration(id, address, name string, instances int) Declaration {
	return Declaration{
		ID: id, Kind: DeclarationResource, Type: "local_file", Name: name, Address: address,
		Provider:   *testProvider(),
		Population: Population{Status: PopulationObserved, Instances: instances},
	}
}

func instance(id, address, rule, concept string, status InstanceStatus, actions []string) Representation {
	return Representation{
		ID: id, Kind: RepresentationManaged, Declaration: DeclarationID(address), Address: address,
		IndexKey: IndexKey{Kind: IndexNone}, Status: status, Actions: actions, Provider: testProvider(),
		Interpretation: &Interpretation{Status: InterpretationApplied, Candidates: []string{testRuleFile, testRuleLink}},
		Rule:           rule, Concept: concept, Implementation: Implementation{Kind: ImplementationDirect},
	}
}

// baseStage holds A (file) and B (link contributing to A).
func baseStage(stage Stage, label string) *Architecture {
	emission := testEmission()
	status := StatusRecorded
	var actions []string
	if stage == StagePlanned {
		status = StatusPlanned
		actions = []string{"no-op"}
	}
	closureB := ClosureID(repB, emission.ID)
	factBA := ContributionID(repB, repA)
	declarationB := declaration(declB, addrB, "b", 1)
	architecture := &Architecture{
		Stage: stage, Label: label,
		Declarations: []Declaration{declaration(declA, addrA, "a", 1), declarationB},
		Representations: []Representation{
			instance(repA, addrA, testRuleFile, testConceptFile, status, actions),
			instance(repB, addrB, testRuleLink, testConceptLink, status, actions),
		},
		Contributions: []Contribution{{ID: factBA, From: repB, To: repA, Provenance: []FactProvenance{{Emission: emission.ID, Rule: testRuleLink, Closure: closureB, Evidence: EvidenceValue}}}},
		Closures:      []Closure{{ID: closureB, Representation: repB, Emission: emission.ID, Outcome: OutcomeResolved, Facts: []string{factBA}, Candidates: Candidates{KnownEqual: 1}}},
		Dependencies:  []Dependency{{ID: DependencyID(repB, repA), From: repB, To: repA, Roles: []DependencyRole{DependencyReference}}},
	}
	if stage == StageRecorded {
		architecture.Reconstruction = &Reconstruction{From: StageRefreshed}
	}
	architecture.Accounting = DeriveAccounting(architecture)
	return architecture
}

// plannedStage adds C, a link created by the plan whose target is external.
func plannedStage() *Architecture {
	emission := testEmission()
	architecture := baseStage(StagePlanned, "Planned")
	declarationC := declaration(declC, addrC, "c", 1)
	architecture.Declarations = append(architecture.Declarations, declarationC)
	representationC := instance(repC, addrC, testRuleLink, testConceptLink, StatusPlanned, []string{"create"})
	external := Representation{ID: extX, Kind: RepresentationExternal, IndexKey: IndexKey{Kind: IndexNone}, Status: StatusExternal, Concept: testConceptFile, Implementation: Implementation{Kind: ImplementationDirect}, Disclosure: DiscloseRecord, Identity: map[string]string{"filename": "/srv/shared.txt"}}
	architecture.Representations = append(architecture.Representations, representationC, external)
	closureC := ClosureID(repC, emission.ID)
	factCX := ContributionID(repC, extX)
	architecture.Contributions = append(architecture.Contributions, Contribution{ID: factCX, From: repC, To: extX, Provenance: []FactProvenance{{Emission: emission.ID, Rule: testRuleLink, Closure: closureC, Evidence: EvidenceValue}}})
	architecture.Closures = append(architecture.Closures, Closure{ID: closureC, Representation: repC, Emission: emission.ID, Outcome: OutcomeResolved, Facts: []string{factCX}, Candidates: Candidates{Excluded: 1}})
	architecture.Accounting = DeriveAccounting(architecture)
	return architecture
}

func plannedComparison(name string, before, after Stage) *Comparison {
	emission := testEmission()
	factCX := ContributionID(repC, extX)
	comparison := &Comparison{
		Name: name, Before: before, After: after, Comparable: true,
		Representations: []RepresentationChange{
			{ID: RepresentationChangeID(name, ChangeAdded, repC), Change: ChangeAdded, Representation: repC},
			{ID: RepresentationChangeID(name, ChangeAdded, extX), Change: ChangeAdded, Representation: extX},
		},
		Facts: []FactChange{{ID: FactChangeID(name, ChangeAdded, factCX), Change: ChangeAdded, Kind: FactContribution, Fact: factCX, From: repC, To: extX, Emission: emission.ID}},
	}
	comparison.Counts = DeriveComparisonCounts(comparison)
	return comparison
}

func emptyComparison(name string, before, after Stage) *Comparison {
	comparison := &Comparison{Name: name, Before: before, After: after, Comparable: true}
	comparison.Counts = DeriveComparisonCounts(comparison)
	return comparison
}

func testDiagnostic() Diagnostic {
	diagnostic := Diagnostic{Phase: PhaseInput, Severity: SeverityInfo, Code: "PRODUCER_UNESTABLISHED", Message: "the export does not name its producer"}
	diagnostic.ID = DiagnosticID(diagnostic)
	return diagnostic
}

func planFixture() *InputForm {
	return &InputForm{
		FormatVersion: FormatVersion, Kind: KindPlan, Generator: Generator{Name: GeneratorName, Version: "0.1.0"},
		Evidence: Evidence{
			Origin: OriginPlan, InputFormatVersion: "1.2",
			Producer:     Producer{Tool: ToolTerraform, ToolSource: ToolSourceAttested, ReportedVersion: "1.12.2", Hints: []string{"registry.terraform.io"}},
			Completeness: Completeness{ProducerComplete: CompleteTrue, AttestedComplete: false},
			Enrichment:   Enrichment{Snapshot: SnapshotEnrichment{Status: SnapshotAbsent}},
			Attestations: []Attestation{{Name: "producer", Value: "terraform"}},
			Scope:        Scope{RefreshScope: RefreshScopeNotExported, DriftRecords: DriftRecordsAbsent},
		},
		Semantics: testSemantics(),
		Stages: map[Stage]*Architecture{
			StagePlanned:   plannedStage(),
			StageRefreshed: baseStage(StageRefreshed, "Refreshed"),
			StageRecorded:  baseStage(StageRecorded, "Recorded (reconstructed)"),
		},
		DefaultStage: StagePlanned,
		Comparisons: &Comparisons{
			Drift:   emptyComparison(ComparisonDrift, StageRecorded, StageRefreshed),
			Changes: plannedComparison(ComparisonChanges, StageRefreshed, StagePlanned),
			Net:     plannedComparison(ComparisonNet, StageRecorded, StagePlanned),
		},
		DriftReport: &DriftReport{Entries: []DriftEntry{}, Summary: "No drift reported in this plan"},
		Diagnostics: []Diagnostic{testDiagnostic()},
	}
}

func snapshotFixture() *InputForm {
	recorded := baseStage(StageRecorded, "Recorded")
	recorded.Reconstruction = nil
	return &InputForm{
		FormatVersion: FormatVersion, Kind: KindState, Generator: Generator{Name: GeneratorName, Version: "0.1.0"},
		Evidence: Evidence{
			Origin: OriginState, InputFormatVersion: "1.0",
			Producer:     Producer{Tool: ToolUnestablished, ReportedVersion: "1.10.7"},
			Completeness: Completeness{ProducerComplete: CompleteUnavailable},
			Enrichment:   Enrichment{Snapshot: SnapshotEnrichment{Status: SnapshotAbsent}},
			Scope:        Scope{RefreshScope: RefreshScopeNotExported, DriftRecords: DriftRecordsNotApplicable},
		},
		Semantics:    testSemantics(),
		Stages:       map[Stage]*Architecture{StageRecorded: recorded},
		DefaultStage: StageRecorded,
	}
}

func mustValid(t *testing.T, name string, err error) {
	t.Helper()
	if err != nil {
		t.Fatalf("%s: unexpected validation failure: %v", name, err)
	}
}

func expectCode(t *testing.T, name string, err error, code string) {
	t.Helper()
	var validation *ValidationError
	if !errors.As(err, &validation) {
		t.Fatalf("%s: expected validation error with %s, got %v", name, code, err)
	}
	if !validation.Has(code) {
		t.Fatalf("%s: expected %s, got %v", name, code, err)
	}
}

// TestCarriedInstanceKeepsPopulationUnverified covers saved Forms: a carried
// instance was not evaluated by the plan, so its declaration stays unverified
// and no population in its stage may be proven empty.
func TestCarriedInstanceKeepsPopulationUnverified(t *testing.T) {
	carry := func(a *InputForm) *Architecture {
		planned := a.Stages[StagePlanned]
		planned.Representations[0].Status = StatusCarried
		planned.Representations[0].Actions = nil
		return planned
	}
	provenZero := func(a *InputForm) {
		planned := a.Stages[StagePlanned]
		empty := declaration(DeclarationID("local_file.none"), "local_file.none", "none", 0)
		empty.Population.Status = PopulationProvenZero
		planned.Declarations = append(planned.Declarations, empty)
		planned.Accounting = DeriveAccounting(planned)
	}

	unverified := planFixture()
	planned := carry(unverified)
	planned.Declarations[0].Population.Status = PopulationUnverified
	planned.Accounting = DeriveAccounting(planned)
	mustValid(t, "carried instance with unverified population", unverified.Validate())

	observed := planFixture()
	planned = carry(observed)
	planned.Accounting = DeriveAccounting(planned)
	expectProblem(t, "carried instance with observed population", observed.Validate(), CodeInconsistent, "a declaration with a carried instance keeps an unverified population")

	zero := planFixture()
	provenZero(zero)
	mustValid(t, "proven zero without carried instance", zero.Validate())

	promoted := planFixture()
	planned = carry(promoted)
	planned.Declarations[0].Population.Status = PopulationUnverified
	provenZero(promoted)
	expectProblem(t, "proven zero beside a carried instance", promoted.Validate(), CodeInconsistent, "a stage holding a carried instance proves no empty population")
}

func TestFixturesValidate(t *testing.T) {
	plan := planFixture()
	if plan.Stages[StageRecorded].Reconstruction == nil {
		t.Fatal("fixture recorded stage must state reconstruction")
	}
	if len(plan.Stages) != 3 || plan.Comparisons.Drift.Name != ComparisonDrift || plan.Comparisons.Changes.Name != ComparisonChanges || plan.Comparisons.Net.Name != ComparisonNet || plan.Comparisons.Drift.Before != StageRecorded || plan.Comparisons.Drift.After != StageRefreshed || plan.Comparisons.Changes.Before != StageRefreshed || plan.Comparisons.Changes.After != StagePlanned || plan.Comparisons.Net.Before != StageRecorded || plan.Comparisons.Net.After != StagePlanned {
		t.Fatal("plan fixture does not carry the expected stages and comparisons")
	}
	mustValid(t, "plan", plan.Validate())
	state := snapshotFixture()
	if state.Kind != KindState || len(state.Stages) != 1 || state.Stages[StageRecorded] == nil || state.Stages[StageRecorded].Label != "Recorded" {
		t.Fatal("state fixture must carry one Recorded stage")
	}
	mustValid(t, "state", state.Validate())
	noPrior := planFixture()
	delete(noPrior.Stages, StageRecorded)
	delete(noPrior.Stages, StageRefreshed)
	noPrior.Comparisons = &Comparisons{}
	if len(noPrior.Stages) != 1 || noPrior.Stages[StagePlanned] == nil {
		t.Fatal("plan without prior state must carry only the Planned stage")
	}
	mustValid(t, "plan without prior state", noPrior.Validate())
}

func TestEncodeIsDeterministic(t *testing.T) {
	first, err := planFixture().Encode()
	if err != nil {
		t.Fatal(err)
	}
	shuffled := planFixture()
	for _, architecture := range shuffled.Stages {
		reverseDeclarations(architecture.Declarations)
		reverseRepresentations(architecture.Representations)
		reverseClosures(architecture.Closures)
		reverseContributions(architecture.Contributions)
		architecture.Accounting = Accounting{}
	}
	shuffled.Diagnostics = append(shuffled.Diagnostics, Diagnostic{})
	shuffled.Diagnostics = shuffled.Diagnostics[:1]
	shuffled.Comparisons.Changes.Representations[0], shuffled.Comparisons.Changes.Representations[1] = shuffled.Comparisons.Changes.Representations[1], shuffled.Comparisons.Changes.Representations[0]
	shuffled.Comparisons.Changes.Counts = ComparisonCounts{}
	second, err := shuffled.Encode()
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(first, second) {
		t.Fatalf("encoding is order dependent:\n%s\n---\n%s", first, second)
	}
	if !bytes.HasSuffix(first, []byte("\n")) {
		t.Fatal("encoding ends with a newline")
	}
	if bytes.Contains(first, []byte(": null")) {
		t.Fatalf("canonical encoding contains null: %s", first)
	}
}

func reverseDeclarations(values []Declaration) {
	for i, j := 0, len(values)-1; i < j; i, j = i+1, j-1 {
		values[i], values[j] = values[j], values[i]
	}
}

func reverseRepresentations(values []Representation) {
	for i, j := 0, len(values)-1; i < j; i, j = i+1, j-1 {
		values[i], values[j] = values[j], values[i]
	}
}

func reverseClosures(values []Closure) {
	for i, j := 0, len(values)-1; i < j; i, j = i+1, j-1 {
		values[i], values[j] = values[j], values[i]
	}
}

func reverseContributions(values []Contribution) {
	for i, j := 0, len(values)-1; i < j; i, j = i+1, j-1 {
		values[i], values[j] = values[j], values[i]
	}
}

func TestDecodeRoundTrip(t *testing.T) {
	encoded, err := planFixture().Encode()
	if err != nil {
		t.Fatal(err)
	}
	decoded, err := Decode(encoded)
	if err != nil {
		t.Fatalf("decode: %v", err)
	}
	if decoded.Kind() != KindPlan || decoded.Input == nil {
		t.Fatalf("decoded kind %q", decoded.Kind())
	}
	again, err := decoded.Input.Encode()
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(encoded, again) {
		t.Fatalf("round trip changed bytes:\n%s\n---\n%s", encoded, again)
	}
	marshalled, err := json.Marshal(planFixture())
	if err != nil {
		t.Fatal(err)
	}
	var compact bytes.Buffer
	if err := json.Compact(&compact, encoded); err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(marshalled, compact.Bytes()) {
		t.Fatal("json.Marshal and Encode disagree")
	}
}

func TestDocumentGoldens(t *testing.T) {
	fixtures := []struct {
		name string
		doc  Form
	}{
		{"state", Form{Input: snapshotFixture()}},
		{"plan", Form{Input: planFixture()}},
		{"comparison", Form{Comparison: crossFixture()}},
	}
	for _, fixture := range fixtures {
		t.Run(fixture.name, func(t *testing.T) {
			var full []byte
			var err error
			if fixture.doc.Input != nil {
				full, err = fixture.doc.Input.Encode()
			} else {
				full, err = fixture.doc.Comparison.Encode()
			}
			if err != nil {
				t.Fatal(err)
			}
			display, err := DisplayJSON(fixture.doc)
			if err != nil {
				t.Fatal(err)
			}
			for _, artifact := range []struct {
				suffix string
				body   []byte
			}{{".json", full}, {".display.json", display}} {
				path := filepath.Join("testdata", fixture.name+artifact.suffix)
				if os.Getenv("UPDATE_GOLDEN") == "1" {
					if err := os.WriteFile(path, artifact.body, 0o644); err != nil {
						t.Fatal(err)
					}
				}
				committed, err := os.ReadFile(path)
				if err != nil {
					t.Fatal(err)
				}
				if !bytes.Equal(committed, artifact.body) {
					t.Fatalf("%s is stale; run UPDATE_GOLDEN=1 go test ./form -run TestDocumentGoldens", path)
				}
			}
		})
	}
}

func TestDecodeRejections(t *testing.T) {
	encoded, err := planFixture().Encode()
	if err != nil {
		t.Fatal(err)
	}
	expectDecode := func(name string, data []byte, code string) {
		t.Helper()
		_, err := Decode(data)
		var decodeErr *DecodeError
		if !errors.As(err, &decodeErr) || decodeErr.Code != code {
			t.Fatalf("%s: expected %s, got %v", name, code, err)
		}
	}
	expectDecode("unknown field", bytes.Replace(encoded, []byte("\"kind\": \"plan\""), []byte("\"kind\": \"plan\", \"extra\": 1"), 1), CodeFieldUnknown)
	expectDecode("trailing content", append(append([]byte{}, encoded...), []byte("{}")...), CodeTrailingContent)
	expectDecode("previous format", bytes.Replace(encoded, []byte("\"format_version\": \"1\""), []byte("\"format_version\": \"0.1.0\""), 1), CodeFormatUnsupported)
	expectDecode("foreign generator", bytes.Replace(encoded, []byte("\"name\": \"rootform\""), []byte("\"name\": \"other\""), 1), CodeGeneratorInvalid)
	expectDecode("unknown kind", bytes.Replace(encoded, []byte("\"kind\": \"plan\""), []byte("\"kind\": \"graph\""), 1), CodeKindInvalid)
	for _, old := range []struct {
		name, from, to, code string
	}{
		{"stage-level form member", `"stages":`, `"for` + `ms":`, CodeFieldUnknown},
		{"comparison planned", `"changes":`, `"planned":`, CodeFieldUnknown},
		{"retired comparison member", `"indeterminate":`, `"un` + `determined":`, CodeFieldUnknown},
	} {
		changed := bytes.Replace(encoded, []byte(old.from), []byte(old.to), 1)
		if bytes.Equal(changed, encoded) {
			t.Fatalf("%s: source member missing", old.name)
		}
		expectDecode(old.name, changed, old.code)
	}
	state, err := snapshotFixture().Encode()
	if err != nil {
		t.Fatal(err)
	}
	oldState := bytes.Replace(state, []byte(`"kind": "state"`), []byte(`"kind": "snapshot"`), 1)
	if bytes.Equal(oldState, state) {
		t.Fatal("state kind missing")
	}
	expectDecode("snapshot kind", oldState, CodeKindInvalid)
	comparison, err := crossFixture().Encode()
	if err != nil {
		t.Fatal(err)
	}
	oldSide := bytes.Replace(comparison, []byte(`"form":`), []byte(`"docu`+`ment":`), 1)
	if bytes.Equal(oldSide, comparison) {
		t.Fatal("comparison side form missing")
	}
	expectDecode("side document member", oldSide, CodeFieldUnknown)
	expectDecode("not json", []byte("format_version: 1"), CodeJSONInvalid)
	expectDecode("terraform plan", []byte("{\"format_version\":\"1.2\",\"terraform_version\":\"1.12.2\",\"planned_values\":{}}"), CodeFormatUnsupported)
	if _, err := DecodeComparison(encoded); err == nil {
		t.Fatal("DecodeComparison accepted an analysis")
	}
	old := bytes.Replace(encoded, []byte("\"format_version\": \"1\""), []byte("\"format_version\": \"0.1.0\""), 1)
	old = bytes.Replace(old, []byte("\"kind\": \"plan\""), []byte("\"kind\": \"plan\", \"extra\": 1"), 1)
	expectDecode("format before unknown field", old, CodeFormatUnsupported)
}

func TestValidateMutations(t *testing.T) {
	emission := testEmission()
	cases := []struct {
		name   string
		mutate func(a *InputForm)
		code   string
	}{
		{"format", func(a *InputForm) { a.FormatVersion = "0.1.0" }, CodeFormatUnsupported},
		{"kind comparison", func(a *InputForm) { a.Kind = KindComparison }, CodeKindInvalid},
		{"generator", func(a *InputForm) { a.Generator.Name = "other" }, CodeGeneratorInvalid},
		{"origin mismatch", func(a *InputForm) { a.Evidence.Origin = OriginState }, CodeInconsistent},
		{"tool vocabulary", func(a *InputForm) { a.Evidence.Producer.Tool = "pulumi" }, CodeVocabulary},
		{"completeness vocabulary", func(a *InputForm) { a.Evidence.Completeness.ProducerComplete = "yes" }, CodeVocabulary},
		{"snapshot verified needs trust", func(a *InputForm) { a.Evidence.Enrichment.Snapshot.Status = SnapshotVerified }, CodeVocabulary},
		{"drift records not applicable on plan", func(a *InputForm) { a.Evidence.Scope.DriftRecords = DriftRecordsNotApplicable }, CodeInconsistent},
		{"scope claims data coverage", func(a *InputForm) { a.Evidence.Scope.DataSourcesCoveredByDrift = true }, CodeInconsistent},
		{"release set identity", func(a *InputForm) { a.Semantics.ReleaseSet.ID = "release-set:deadbeef" }, CodeIDInvalid},
		{"owner vocabulary", func(a *InputForm) { a.Semantics.Owners[0].Origin = "remote" }, CodeVocabulary},
		{"emission identity", func(a *InputForm) { a.Semantics.Emissions[0].Prefix = "gs://" }, CodeIDInvalid},
		{"emission on_null", func(a *InputForm) {
			a.Semantics.Emissions[0].OnNull = ""
			a.Semantics.Emissions[0].ID = EmissionID(a.Semantics.Emissions[0])
			a.Semantics.Rules[1].Emissions[0] = a.Semantics.Emissions[0].ID
		}, CodeVocabulary},
		{"disclose without external", func(a *InputForm) {
			a.Semantics.Emissions[0].External = ExternalDeny
			a.Semantics.Emissions[0].ID = EmissionID(a.Semantics.Emissions[0])
			a.Semantics.Rules[1].Emissions[0] = a.Semantics.Emissions[0].ID
		}, CodeInconsistent},
		{"emission target concept missing", func(a *InputForm) {
			a.Semantics.Emissions[0].To.ID = "localtest.concept.absent"
			a.Semantics.Emissions[0].ID = EmissionID(a.Semantics.Emissions[0])
			a.Semantics.Rules[1].Emissions[0] = a.Semantics.Emissions[0].ID
		}, CodeReferenceMissing},
		{"stage key vocabulary", func(a *InputForm) { a.Stages["future"] = baseStage("future", "future") }, CodeVocabulary},
		{"stage field mismatch", func(a *InputForm) { a.Stages[StageRefreshed].Stage = StagePlanned }, CodeStageInvalid},
		{"default stage missing", func(a *InputForm) { a.DefaultStage = "future" }, CodeStageInvalid},
		{"recorded without refreshed", func(a *InputForm) {
			delete(a.Stages, StageRefreshed)
			a.Comparisons.Drift = nil
			a.Comparisons.Changes = nil
		}, CodeStageInvalid},
		{"recorded without reconstruction", func(a *InputForm) { a.Stages[StageRecorded].Reconstruction = nil }, CodeFieldRequired},
		{"reconstruction on planned", func(a *InputForm) { a.Stages[StagePlanned].Reconstruction = &Reconstruction{From: StageRefreshed} }, CodeFieldForbidden},
		{"declaration identity", func(a *InputForm) { a.Stages[StagePlanned].Declarations[0].ID = "declaration:1:other" }, CodeIDInvalid},
		{"declaration kind", func(a *InputForm) { a.Stages[StagePlanned].Declarations[0].Kind = "module" }, CodeVocabulary},
		{"population count", func(a *InputForm) { a.Stages[StagePlanned].Declarations[0].Population.Instances = 2 }, CodeInconsistent},
		{"population proven zero with instance", func(a *InputForm) { a.Stages[StagePlanned].Declarations[0].Population.Status = PopulationProvenZero }, CodeInconsistent},
		{"interpretation candidate missing", func(a *InputForm) {
			interpretation := a.Stages[StagePlanned].Representations[0].Interpretation
			interpretation.Candidates = append(interpretation.Candidates, "localtest.rule.absent")
		}, CodeReferenceMissing},
		{"interpretation required", func(a *InputForm) { a.Stages[StagePlanned].Representations[0].Interpretation = nil }, CodeFieldRequired},
		{"applied rule is a candidate", func(a *InputForm) {
			a.Stages[StagePlanned].Representations[0].Interpretation.Candidates = []string{testRuleLink}
		}, CodeInconsistent},
		{"indeterminate interpretation reason", func(a *InputForm) {
			representation := &a.Stages[StagePlanned].Representations[0]
			representation.Interpretation.Status = InterpretationIndeterminate
			representation.Rule, representation.Concept = "", ""
		}, CodeVocabulary},
		{"rule without applied interpretation", func(a *InputForm) {
			a.Stages[StagePlanned].Representations[0].Interpretation.Status = InterpretationNone
		}, CodeInconsistent},
		{"failed interpretation diagnostics", func(a *InputForm) {
			representation := &a.Stages[StagePlanned].Representations[0]
			representation.Interpretation.Status = InterpretationFailed
			representation.Rule, representation.Concept = "", ""
		}, CodeFieldRequired},
		{"external interpreted", func(a *InputForm) {
			planned := a.Stages[StagePlanned]
			for i := range planned.Representations {
				if planned.Representations[i].Kind == RepresentationExternal {
					planned.Representations[i].Interpretation = &Interpretation{Status: InterpretationNone}
				}
			}
		}, CodeFieldForbidden},
		{"representation identity", func(a *InputForm) { a.Stages[StagePlanned].Representations[0].ID = "representation:1:other" }, CodeIDInvalid},
		{"representation declaration missing", func(a *InputForm) { a.Stages[StagePlanned].Representations[0].Declaration = "declaration:1:other" }, CodeReferenceMissing},
		{"representation kind", func(a *InputForm) { a.Stages[StagePlanned].Representations[0].Kind = "module" }, CodeVocabulary},
		{"managed identity forbidden", func(a *InputForm) {
			a.Stages[StagePlanned].Representations[0].Identity = map[string]string{"filename": "/tmp/a"}
		}, CodeFieldForbidden},
		{"managed name forbidden", func(a *InputForm) { a.Stages[StagePlanned].Representations[0].Name = "/tmp/a" }, CodeFieldForbidden},
		{"recorded status in planned stage", func(a *InputForm) { a.Stages[StagePlanned].Representations[0].Status = StatusRecorded }, CodeStageInvalid},
		{"planned status in refreshed stage", func(a *InputForm) { a.Stages[StageRefreshed].Representations[0].Status = StatusPlanned }, CodeStageInvalid},
		{"actions on recorded instance", func(a *InputForm) { a.Stages[StageRefreshed].Representations[0].Actions = []string{"update"} }, CodeFieldForbidden},
		{"action vocabulary", func(a *InputForm) { a.Stages[StagePlanned].Representations[0].Actions = []string{"destroy"} }, CodeVocabulary},
		{"index key number", func(a *InputForm) {
			a.Stages[StagePlanned].Representations[0].IndexKey = IndexKey{Kind: IndexNumber, Value: "x"}
		}, CodeInconsistent},
		{"provider required", func(a *InputForm) { a.Stages[StagePlanned].Representations[0].Provider = nil }, CodeFieldRequired},
		{"provider alias unavailable with value", func(a *InputForm) {
			a.Stages[StagePlanned].Representations[0].Provider = &Provider{Address: "registry.terraform.io/hashicorp/local", Alias: "eu", AliasAvailability: AliasUnavailable}
		}, CodeInconsistent},
		{"external ordinal not contiguous", func(a *InputForm) {
			planned := a.Stages[StagePlanned]
			for i := range planned.Representations {
				if planned.Representations[i].Kind == RepresentationExternal {
					planned.Representations[i].ID = ExternalID(testConceptFile, 1)
				}
			}
			for i := range planned.Contributions {
				if planned.Contributions[i].To == extX {
					planned.Contributions[i].To = ExternalID(testConceptFile, 1)
					planned.Contributions[i].ID = ContributionID(repC, ExternalID(testConceptFile, 1))
				}
			}
			for i := range planned.Closures {
				if planned.Closures[i].Representation == repC {
					planned.Closures[i].Facts = []string{ContributionID(repC, ExternalID(testConceptFile, 1))}
				}
			}
			a.Comparisons.Changes = emptyComparison(ComparisonChanges, StageRefreshed, StagePlanned)
			a.Comparisons.Net = emptyComparison(ComparisonNet, StageRecorded, StagePlanned)
		}, CodeIDInvalid},
		{"external with provider", func(a *InputForm) {
			planned := a.Stages[StagePlanned]
			for i := range planned.Representations {
				if planned.Representations[i].Kind == RepresentationExternal {
					planned.Representations[i].Provider = testProvider()
				}
			}
		}, CodeFieldForbidden},
		{"closure missing", func(a *InputForm) {
			a.Stages[StageRefreshed].Closures = nil
			a.Stages[StageRefreshed].Contributions = nil
			a.Stages[StageRefreshed].Accounting = DeriveAccounting(a.Stages[StageRefreshed])
		}, CodeClosureIncomplete},
		{"closure extra", func(a *InputForm) {
			refreshed := a.Stages[StageRefreshed]
			refreshed.Closures = append(refreshed.Closures, Closure{ID: ClosureID(repA, emission.ID), Representation: repA, Emission: emission.ID, Outcome: OutcomeAbsent})
			refreshed.Accounting = DeriveAccounting(refreshed)
		}, CodeClosureExtra},
		{"closure identity", func(a *InputForm) { a.Stages[StageRefreshed].Closures[0].ID = "closure:x" }, CodeIDInvalid},
		{"closure outcome vocabulary", func(a *InputForm) { a.Stages[StageRefreshed].Closures[0].Outcome = "unresolved" }, CodeVocabulary},
		{"resolved closure without fact", func(a *InputForm) { a.Stages[StageRefreshed].Closures[0].Facts = nil }, CodeFieldRequired},
		{"indeterminate closure reason", func(a *InputForm) {
			a.Stages[StageRefreshed].Closures[0] = Closure{ID: ClosureID(repB, emission.ID), Representation: repB, Emission: emission.ID, Outcome: OutcomeIndeterminate, Reason: "maybe"}
			a.Stages[StageRefreshed].Contributions = nil
			a.Stages[StageRefreshed].Accounting = DeriveAccounting(a.Stages[StageRefreshed])
		}, CodeVocabulary},
		{"absent closure with fact", func(a *InputForm) {
			a.Stages[StageRefreshed].Closures[0].Outcome = OutcomeAbsent
			a.Stages[StageRefreshed].Accounting = DeriveAccounting(a.Stages[StageRefreshed])
		}, CodeFieldForbidden},
		{"fact identity", func(a *InputForm) { a.Stages[StageRefreshed].Contributions[0].ID = "contribution:x" }, CodeIDInvalid},
		{"fact from external", func(a *InputForm) {
			planned := a.Stages[StagePlanned]
			planned.Contributions[0].From = extX
			planned.Contributions[0].ID = ContributionID(extX, repA)
			planned.Closures[0].Facts = []string{planned.Contributions[0].ID}
		}, CodeInconsistent},
		{"fact provenance closure mismatch", func(a *InputForm) { a.Stages[StageRefreshed].Contributions[0].Provenance[0].Closure = "closure:other" }, CodeReferenceMissing},
		{"fact target concept mismatch", func(a *InputForm) {
			refreshed := a.Stages[StageRefreshed]
			refreshed.Representations[0].Concept = testConceptLink
			refreshed.Representations[0].Rule = testRuleLink
			refreshed.Closures = append(refreshed.Closures, Closure{ID: ClosureID(repA, emission.ID), Representation: repA, Emission: emission.ID, Outcome: OutcomeAbsent})
			refreshed.Accounting = DeriveAccounting(refreshed)
		}, CodeInconsistent},
		{"dependency identity", func(a *InputForm) { a.Stages[StageRefreshed].Dependencies[0].ID = "dependency:x" }, CodeIDInvalid},
		{"dependency role vocabulary", func(a *InputForm) { a.Stages[StageRefreshed].Dependencies[0].Roles = []DependencyRole{"implicit"} }, CodeVocabulary},
		{"dependency target missing", func(a *InputForm) { a.Stages[StageRefreshed].Dependencies[0].To = "representation:1:none" }, CodeReferenceMissing},
		{"accounting mismatch", func(a *InputForm) { a.Stages[StageRefreshed].Accounting.Facts = 9 }, CodeAccountingMismatch},
		{"comparison missing", func(a *InputForm) { a.Comparisons.Drift = nil }, CodeFieldRequired},
		{"comparison stage mismatch", func(a *InputForm) { a.Comparisons.Drift.Before = StagePlanned }, CodeStageInvalid},
		{"comparison counts", func(a *InputForm) { a.Comparisons.Changes.Counts.FactsAdded = 5 }, CodeAccountingMismatch},
		{"comparison change identity", func(a *InputForm) { a.Comparisons.Changes.Representations[0].ID = "change:x" }, CodeIDInvalid},
		{"comparison added exists before", func(a *InputForm) {
			a.Comparisons.Changes.Representations[0] = RepresentationChange{ID: RepresentationChangeID(ComparisonChanges, ChangeAdded, repA), Change: ChangeAdded, Representation: repA}
		}, CodeInconsistent},
		{"comparison incomparable with changes", func(a *InputForm) {
			a.Comparisons.Changes.Comparable = false
			a.Comparisons.Changes.Problems = []ComparisonProblem{{Code: "RELEASE_SET_MISMATCH", Message: "release sets differ"}}
		}, CodeInconsistent},
		{"comparison fact change side", func(a *InputForm) {
			change := &a.Comparisons.Changes.Facts[0]
			change.Change = ChangeRemoved
			change.ID = FactChangeID(ComparisonChanges, ChangeRemoved, change.Fact)
			a.Comparisons.Changes.Counts = DeriveComparisonCounts(a.Comparisons.Changes)
		}, CodeReferenceMissing},
		{"indeterminate on determinate closure", func(a *InputForm) {
			closure := ClosureID(repB, emission.ID)
			a.Comparisons.Changes.Indeterminate = []IndeterminateClosure{{ID: IndeterminateID(ComparisonChanges, closure, SideAfter), Closure: closure, Representation: repB, Emission: emission.ID, Side: SideAfter, Reasons: []Reason{ReasonUnknownUntilApply}}}
			a.Comparisons.Changes.Counts = DeriveComparisonCounts(a.Comparisons.Changes)
		}, CodeInconsistent},
		{"indeterminate without reason", func(a *InputForm) {
			closure := ClosureID(repB, emission.ID)
			a.Comparisons.Changes.Indeterminate = []IndeterminateClosure{{ID: IndeterminateID(ComparisonChanges, closure, SideAfter), Closure: closure, Representation: repB, Emission: emission.ID, Side: SideAfter, Reasons: nil}}
			a.Comparisons.Changes.Counts = DeriveComparisonCounts(a.Comparisons.Changes)
		}, CodeFieldRequired},
		{"indeterminate reason listed twice", func(a *InputForm) {
			closure := ClosureID(repB, emission.ID)
			a.Comparisons.Changes.Indeterminate = []IndeterminateClosure{{ID: IndeterminateID(ComparisonChanges, closure, SideAfter), Closure: closure, Representation: repB, Emission: emission.ID, Side: SideAfter, Reasons: []Reason{ReasonUnknownUntilApply, ReasonUnknownUntilApply}}}
			a.Comparisons.Changes.Counts = DeriveComparisonCounts(a.Comparisons.Changes)
		}, CodeInconsistent},
		{"withheld identity outside cross comparison", func(a *InputForm) {
			closure := ClosureID(repB, emission.ID)
			a.Comparisons.Changes.Indeterminate = []IndeterminateClosure{{ID: IndeterminateID(ComparisonChanges, closure, SideAfter), Closure: closure, Representation: repB, Emission: emission.ID, Side: SideAfter, Reasons: []Reason{ReasonExternalIdentityWithheld}}}
			a.Comparisons.Changes.Counts = DeriveComparisonCounts(a.Comparisons.Changes)
		}, CodeInconsistent},
		{"indeterminate reason vocabulary", func(a *InputForm) {
			closure := ClosureID(repB, emission.ID)
			a.Comparisons.Changes.Indeterminate = []IndeterminateClosure{{ID: IndeterminateID(ComparisonChanges, closure, SideAfter), Closure: closure, Representation: repB, Emission: emission.ID, Side: SideAfter, Reasons: []Reason{"because"}}}
			a.Comparisons.Changes.Counts = DeriveComparisonCounts(a.Comparisons.Changes)
		}, CodeVocabulary},
		{"indeterminate closure identity", func(a *InputForm) {
			closure := ClosureID(repB, emission.ID)
			a.Comparisons.Changes.Indeterminate = []IndeterminateClosure{{ID: IndeterminateID(ComparisonChanges, closure, SideAfter), Closure: closure, Representation: repA, Emission: emission.ID, Side: SideAfter, Reasons: []Reason{ReasonUnknownUntilApply}}}
			a.Comparisons.Changes.Counts = DeriveComparisonCounts(a.Comparisons.Changes)
		}, CodeIDInvalid},
		{"indeterminate absent closure under applied interpretation", func(a *InputForm) {
			closure := ClosureID(repB, "emission:other")
			a.Comparisons.Changes.Indeterminate = []IndeterminateClosure{{ID: IndeterminateID(ComparisonChanges, closure, SideAfter), Closure: closure, Representation: repB, Emission: "emission:other", Side: SideAfter, Reasons: []Reason{ReasonUnknownUntilApply}}}
			a.Comparisons.Changes.Counts = DeriveComparisonCounts(a.Comparisons.Changes)
		}, CodeReferenceMissing},
		{"cancelled outside net", func(a *InputForm) {
			a.Comparisons.Changes.Cancelled = []Cancellation{{ID: CancellationID("f"), Fact: "f", Drift: "d", Planned: "p"}}
			a.Comparisons.Changes.Counts = DeriveComparisonCounts(a.Comparisons.Changes)
		}, CodeFieldForbidden},
		{"cancelled references", func(a *InputForm) {
			a.Comparisons.Net.Cancelled = []Cancellation{{ID: CancellationID("f"), Fact: "f", Drift: "d", Planned: "p"}}
			a.Comparisons.Net.Counts = DeriveComparisonCounts(a.Comparisons.Net)
		}, CodeReferenceMissing},
		{"drift report missing", func(a *InputForm) { a.DriftReport = nil }, CodeFieldRequired},
		{"drift entry identity", func(a *InputForm) {
			a.DriftReport.Entries = []DriftEntry{{ID: "drift:x", Address: addrA, Actions: []string{"update"}, ChangedPaths: []string{"content"}, Consequence: DriftUncovered}}
		}, CodeIDInvalid},
		{"drift entry consequence", func(a *InputForm) {
			a.DriftReport.Entries = []DriftEntry{{ID: DriftEntryID(addrA), Address: addrA, Actions: []string{"update"}, ChangedPaths: []string{"content"}, Consequence: "changed"}}
		}, CodeVocabulary},
		{"drift entry address only with paths", func(a *InputForm) {
			a.DriftReport.Entries = []DriftEntry{{ID: DriftEntryID(addrA), Address: addrA, Actions: []string{"no-op"}, ChangedPaths: []string{"content"}, PreviousAddress: "local_file.old", Consequence: DriftAddressOnly}}
		}, CodeInconsistent},
		{"drift entry fact change missing", func(a *InputForm) {
			a.DriftReport.Entries = []DriftEntry{{ID: DriftEntryID(addrA), Address: addrA, Actions: []string{"update"}, ChangedPaths: []string{"content"}, Consequence: DriftArchitectural, FactChanges: []string{"change:x"}}}
		}, CodeReferenceMissing},
		{"diagnostic identity", func(a *InputForm) { a.Diagnostics[0].ID = "diagnostic:x" }, CodeIDInvalid},
		{"diagnostic code", func(a *InputForm) {
			a.Diagnostics[0].Code = "lower"
			a.Diagnostics[0].ID = DiagnosticID(a.Diagnostics[0])
		}, CodeVocabulary},
		{"diagnostic stage missing", func(a *InputForm) {
			a.Diagnostics[0].Stage = "future"
			a.Diagnostics[0].ID = DiagnosticID(a.Diagnostics[0])
		}, CodeVocabulary},
		{"diagnostic representation missing", func(a *InputForm) {
			a.Diagnostics[0].Representation = "representation:1:none"
			a.Diagnostics[0].ID = DiagnosticID(a.Diagnostics[0])
		}, CodeReferenceMissing},
		{"declared diagnostic reference missing", func(a *InputForm) { a.Stages[StagePlanned].Declarations[0].Diagnostics = []string{"diagnostic:none"} }, CodeReferenceMissing},
		{"snapshot with comparisons", func(a *InputForm) {
			*a = *snapshotFixture()
			a.Comparisons = &Comparisons{}
		}, CodeFieldForbidden},
		{"snapshot with two stages", func(a *InputForm) {
			*a = *snapshotFixture()
			a.Stages[StageRefreshed] = baseStage(StageRefreshed, "refreshed")
		}, CodeStageInvalid},
		{"snapshot drift records", func(a *InputForm) {
			*a = *snapshotFixture()
			a.Evidence.Scope.DriftRecords = DriftRecordsAbsent
		}, CodeInconsistent},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			analysis := planFixture()
			tc.mutate(analysis)
			expectCode(t, tc.name, analysis.Validate(), tc.code)
		})
	}
}

func TestValidationErrorReportsPath(t *testing.T) {
	analysis := planFixture()
	analysis.Stages[StagePlanned].Representations[0].Kind = "module"
	err := analysis.Validate()
	if err == nil || !strings.Contains(err.Error(), "stages.planned.representations[0].kind") {
		t.Fatalf("expected a located problem, got %v", err)
	}
}

func crossFixture() *ComparisonForm {
	before := snapshotFixture()
	after := planFixture()
	emission := testEmission()
	factCX := ContributionID(repC, extX)
	comparison := Comparison{
		Name: ComparisonCross, Before: StageRecorded, After: StagePlanned, Comparable: true,
		Representations: []RepresentationChange{
			{ID: RepresentationChangeID(ComparisonCross, ChangeAdded, repC), Change: ChangeAdded, Representation: repC},
			{ID: RepresentationChangeID(ComparisonCross, ChangeAdded, extX), Change: ChangeAdded, Representation: extX},
		},
		Facts: []FactChange{{ID: FactChangeID(ComparisonCross, ChangeAdded, factCX), Change: ChangeAdded, Kind: FactContribution, Fact: factCX, From: repC, To: extX, Emission: emission.ID}},
	}
	comparison.Counts = DeriveComparisonCounts(&comparison)
	return &ComparisonForm{
		FormatVersion: FormatVersion, Kind: KindComparison, Generator: Generator{Name: GeneratorName, Version: "0.1.0"},
		Before:     Side{Form: *before, Stage: StageRecorded, SelectedFrom: SelectedFromInput},
		After:      Side{Form: *after, Stage: StagePlanned, SelectedFrom: SelectedFromAfter},
		Comparison: comparison,
	}
}

func TestComparisonDocument(t *testing.T) {
	cross := crossFixture()
	if cross.Comparison.Name != ComparisonCross {
		t.Fatal("input comparison must be named cross")
	}
	mustValid(t, "cross", cross.Validate())
	encoded, err := cross.Encode()
	if err != nil {
		t.Fatal(err)
	}
	decoded, err := Decode(encoded)
	if err != nil {
		t.Fatalf("decode: %v", err)
	}
	if decoded.Kind() != KindComparison || decoded.Comparison == nil {
		t.Fatalf("decoded kind %q", decoded.Kind())
	}
	again, err := decoded.Comparison.Encode()
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(encoded, again) {
		t.Fatal("comparison round trip changed bytes")
	}
	if _, err := DecodeInputForm(encoded); err == nil {
		t.Fatal("DecodeAnalysis accepted a comparison document")
	}

	nested := crossFixture()
	nested.Before.Form.Kind = KindComparison
	expectCode(t, "nested comparison", nested.Validate(), CodeKindInvalid)

	missingStage := crossFixture()
	missingStage.Before.Stage = StagePlanned
	expectCode(t, "missing side stage", missingStage.Validate(), CodeStageInvalid)

	selection := crossFixture()
	selection.After.SelectedFrom = "elsewhere"
	expectCode(t, "selected_from vocabulary", selection.Validate(), CodeVocabulary)

	releaseSets := crossFixture()
	releaseSets.After.Form.Semantics.ReleaseSet = ReleaseSetIdentity("0.2.0", releaseSets.After.Form.Semantics.ReleaseSet.Units)
	expectCode(t, "release set mismatch while comparable", releaseSets.Validate(), CodeInconsistent)

	selections := crossFixture()
	selections.After.Form.Semantics.Selection.Replacements = []OwnerReplacement{{Owner: testOwner, Origin: SemanticLocal, Digest: testDigest}}
	expectProblem(t, "semantic selection mismatch while comparable", selections.Validate(), CodeInconsistent, "comparable sides must share one semantic selection")
	incomparable := crossFixture()
	incomparable.After.Form.Semantics.Selection.Replacements = []OwnerReplacement{{Owner: testOwner, Origin: SemanticLocal, Digest: testDigest}}
	incomparable.Comparison = Comparison{Name: ComparisonCross, Before: incomparable.Before.Stage, After: incomparable.After.Stage, Problems: []ComparisonProblem{{Code: "SELECTION_MISMATCH", Message: "Inputs use different semantic selections"}}}
	incomparable.Comparison.Counts = DeriveComparisonCounts(&incomparable.Comparison)
	mustValid(t, "semantic selection mismatch reported as incomparable", incomparable.Validate())

	named := crossFixture()
	named.Comparison.Name = ComparisonNet
	expectCode(t, "cross name", named.Validate(), CodeVocabulary)

	subject := crossFixture()
	diagnostic := Diagnostic{Phase: PhaseComparison, Severity: SeverityWarning, Code: "COMPARISON_STAGE_DEFAULTED", Message: "the after side selected its default stage", Stage: StagePlanned}
	diagnostic.ID = DiagnosticID(diagnostic)
	subject.Diagnostics = []Diagnostic{diagnostic}
	expectCode(t, "comparison diagnostic subject", subject.Validate(), CodeFieldForbidden)
}

// retarget points B's link in a base stage at an external endpoint instead
// of A.
func retarget(stage *Architecture, ordinal int, disclosure Disclosure, identity map[string]string) {
	emission := testEmission()
	external := ExternalID(testConceptFile, ordinal)
	closure := ClosureID(repB, emission.ID)
	fact := ContributionID(repB, external)
	stage.Representations = append(stage.Representations, Representation{ID: external, Kind: RepresentationExternal, IndexKey: IndexKey{Kind: IndexNone}, Status: StatusExternal, Concept: testConceptFile, Implementation: Implementation{Kind: ImplementationDirect}, Disclosure: disclosure, Identity: identity})
	stage.Contributions = []Contribution{{ID: fact, From: repB, To: external, Provenance: []FactProvenance{{Emission: emission.ID, Rule: testRuleLink, Closure: closure, Evidence: EvidenceValue}}}}
	for i := range stage.Closures {
		if stage.Closures[i].ID == closure {
			stage.Closures[i].Facts = []string{fact}
			stage.Closures[i].Candidates = Candidates{Excluded: 1}
		}
	}
	stage.Accounting = DeriveAccounting(stage)
}

func expectProblem(t *testing.T, name string, err error, code, fragment string) {
	t.Helper()
	var validation *ValidationError
	if !errors.As(err, &validation) {
		t.Fatalf("%s: expected %s (%q), got %v", name, code, fragment, err)
	}
	for _, problem := range validation.Problems {
		if problem.Code == code && strings.Contains(problem.Message, fragment) {
			return
		}
	}
	t.Fatalf("%s: expected %s (%q), got %v", name, code, fragment, err)
}

func TestExternalOrdinalsAreDocumentWide(t *testing.T) {
	shared := map[string]string{"filename": "/srv/shared.txt"}
	zeta := map[string]string{"filename": "/srv/zeta.txt"}

	spread := planFixture()
	retarget(spread.Stages[StageRefreshed], 1, DiscloseRecord, zeta)
	mustValid(t, "ordinal 1 only in refreshed, ordinal 0 only in planned", spread.Validate())

	gap := planFixture()
	retarget(gap.Stages[StageRefreshed], 2, DiscloseRecord, zeta)
	expectProblem(t, "gap across stages", gap.Validate(), CodeIDInvalid, "not contiguous")

	drifting := planFixture()
	retarget(drifting.Stages[StageRefreshed], 0, DiscloseRecord, zeta)
	expectProblem(t, "one identifier, two identities", drifting.Validate(), CodeInconsistent, "differs from its occurrence in another stage")

	tiers := planFixture()
	retarget(tiers.Stages[StageRefreshed], 0, DiscloseReport, shared)
	expectProblem(t, "one identifier, two disclosure tiers", tiers.Validate(), CodeInconsistent, "differs from its occurrence in another stage")

	twice := planFixture()
	retarget(twice.Stages[StageRefreshed], 1, DiscloseRecord, shared)
	expectProblem(t, "one identity, two identifiers", twice.Validate(), CodeInconsistent, "carry the same identity")

	same := planFixture()
	retarget(same.Stages[StageRefreshed], 0, DiscloseRecord, shared)
	same.Comparisons.Changes.Representations = same.Comparisons.Changes.Representations[:1]
	same.Comparisons.Changes.Counts = DeriveComparisonCounts(same.Comparisons.Changes)
	mustValid(t, "one endpoint in two stages", same.Validate())

	withheld := planFixture()
	retarget(withheld.Stages[StageRefreshed], 1, DiscloseNone, shared)
	expectProblem(t, "withheld identity recorded", withheld.Validate(), CodeFieldForbidden, "never recorded")

	undisclosed := planFixture()
	retarget(undisclosed.Stages[StageRefreshed], 1, DiscloseRecord, nil)
	expectProblem(t, "disclosed identity missing", undisclosed.Validate(), CodeFieldRequired, "records its identity")

	tierless := planFixture()
	retarget(tierless.Stages[StageRefreshed], 1, "", zeta)
	expectCode(t, "disclosure required", tierless.Validate(), CodeVocabulary)

	managed := planFixture()
	managed.Stages[StagePlanned].Representations[0].Disclosure = DiscloseRecord
	expectProblem(t, "managed disclosure", managed.Validate(), CodeFieldForbidden, "only an external endpoint")

	changed := planFixture()
	for i := range changed.Comparisons.Changes.Representations {
		change := &changed.Comparisons.Changes.Representations[i]
		if change.Representation == extX {
			change.Change = ChangeChanged
			change.Fields = []string{FieldConcept}
			change.ID = RepresentationChangeID(ComparisonChanges, ChangeChanged, extX)
		}
	}
	changed.Comparisons.Changes.Counts = DeriveComparisonCounts(changed.Comparisons.Changes)
	expectProblem(t, "external changed", changed.Validate(), CodeInconsistent, "only added or removed")
}

func TestCrossExternalMatchesByIdentity(t *testing.T) {
	emission := testEmission()
	factBX := ContributionID(repB, extX)
	factBA := ContributionID(repB, repA)
	factCX := ContributionID(repC, extX)

	differ := crossFixture()
	retarget(differ.Before.Form.Stages[StageRecorded], 0, DiscloseRecord, map[string]string{"filename": "/srv/old.txt"})
	differ.Comparison.Representations = []RepresentationChange{
		{ID: RepresentationChangeID(ComparisonCross, ChangeAdded, repC), Change: ChangeAdded, Representation: repC},
		{ID: RepresentationChangeID(ComparisonCross, ChangeAdded, extX), Change: ChangeAdded, Representation: extX},
		{ID: RepresentationChangeID(ComparisonCross, ChangeRemoved, extX), Change: ChangeRemoved, Representation: extX},
	}
	differ.Comparison.Facts = []FactChange{
		{ID: FactChangeID(ComparisonCross, ChangeAdded, factCX), Change: ChangeAdded, Kind: FactContribution, Fact: factCX, From: repC, To: extX, Emission: emission.ID},
		{ID: FactChangeID(ComparisonCross, ChangeAdded, factBA), Change: ChangeAdded, Kind: FactContribution, Fact: factBA, From: repB, To: repA, Emission: emission.ID},
		{ID: FactChangeID(ComparisonCross, ChangeRemoved, factBX), Change: ChangeRemoved, Kind: FactContribution, Fact: factBX, From: repB, To: extX, Emission: emission.ID},
	}
	differ.Comparison.Counts = DeriveComparisonCounts(&differ.Comparison)
	mustValid(t, "one ordinal, two identities across inputs", differ.Validate())

	equal := crossFixture()
	retarget(equal.Before.Form.Stages[StageRecorded], 0, DiscloseRecord, map[string]string{"filename": "/srv/shared.txt"})
	expectProblem(t, "equal identity reported added", equal.Validate(), CodeInconsistent, "equal identity")

	hidden := crossFixture()
	retarget(hidden.Before.Form.Stages[StageRecorded], 0, DiscloseNone, nil)
	expectProblem(t, "other side withholds", hidden.Validate(), CodeInconsistent, "withholds identities")

	removed := crossFixture()
	retarget(removed.Before.Form.Stages[StageRecorded], 0, DiscloseNone, nil)
	removed.Comparison.Representations = append(removed.Comparison.Representations, RepresentationChange{ID: RepresentationChangeID(ComparisonCross, ChangeRemoved, extX), Change: ChangeRemoved, Representation: extX})
	removed.Comparison.Counts = DeriveComparisonCounts(&removed.Comparison)
	expectProblem(t, "withheld endpoint reported removed", removed.Validate(), CodeInconsistent, "never compared across inputs")
}

func TestClosureCarriesSeveralFacts(t *testing.T) {
	emission := testEmission()
	closureB := ClosureID(repB, emission.ID)
	factBA := ContributionID(repB, repA)
	factBX := ContributionID(repB, extX)
	fanout := func() *InputForm {
		a := planFixture()
		planned := a.Stages[StagePlanned]
		planned.Contributions = append(planned.Contributions, Contribution{ID: factBX, From: repB, To: extX, Provenance: []FactProvenance{{Emission: emission.ID, Rule: testRuleLink, Closure: closureB, Evidence: EvidenceTraversal}}})
		for i := range planned.Closures {
			if planned.Closures[i].ID == closureB {
				planned.Closures[i].Facts = []string{factBX, factBA}
			}
		}
		planned.Accounting = DeriveAccounting(planned)
		return a
	}
	mustValid(t, "list via resolving to a managed and an external endpoint", fanout().Validate())

	partial := fanout()
	for i := range partial.Stages[StagePlanned].Closures {
		closure := &partial.Stages[StagePlanned].Closures[i]
		if closure.ID == closureB {
			closure.Outcome, closure.Reason = OutcomeIndeterminate, ReasonUnknownUntilApply
		}
	}
	partial.Stages[StagePlanned].Accounting = DeriveAccounting(partial.Stages[StagePlanned])
	mustValid(t, "indeterminate closure keeps proven facts", partial.Validate())

	unlisted := fanout()
	for i := range unlisted.Stages[StagePlanned].Closures {
		if unlisted.Stages[StagePlanned].Closures[i].ID == closureB {
			unlisted.Stages[StagePlanned].Closures[i].Facts = []string{factBA}
		}
	}
	expectProblem(t, "provenance names a closure that does not list the fact", unlisted.Validate(), CodeInconsistent, "does not list this fact")

	unnamed := planFixture()
	refreshed := unnamed.Stages[StageRefreshed]
	refreshed.Contributions[0].Provenance[0].Closure = ClosureID(repA, emission.ID)
	expectProblem(t, "closure lists a fact whose provenance does not name it", unnamed.Validate(), CodeInconsistent, "does not name closure")

	duplicate := fanout()
	for i := range duplicate.Stages[StagePlanned].Closures {
		if duplicate.Stages[StagePlanned].Closures[i].ID == closureB {
			duplicate.Stages[StagePlanned].Closures[i].Facts = []string{factBA, factBA, factBX}
		}
	}
	expectCode(t, "duplicate closure fact", duplicate.Validate(), CodeIDDuplicate)

	absent := planFixture()
	absent.Stages[StageRefreshed].Closures[0].Outcome = OutcomeAbsent
	expectProblem(t, "absent closure with facts", absent.Validate(), CodeFieldForbidden, "establishes no fact")
}

const testRuleBundle = "localtest.rule.bundle"

// withComposition interprets A in the refreshed stage by a composition rule
// whose single member "part" is resolved to B, or left unresolved.
func withComposition(members []CompositionMember, unresolved []UnresolvedMember) *InputForm {
	a := planFixture()
	a.Semantics.Rules = append(a.Semantics.Rules, RuleDefinition{
		ID: testRuleBundle, Owner: testOwner, MatchKind: "resource", MatchType: "local_file", Concept: testConceptFile, Emissions: []string{},
		Composition: &CompositionDefinition{Members: []CompositionMemberDefinition{{Name: "part", Via: "source.part", MatchKind: "resource", MatchType: "local_file"}}},
	})
	refreshed := a.Stages[StageRefreshed]
	for i := range refreshed.Representations {
		if refreshed.Representations[i].ID == repA {
			refreshed.Representations[i].Rule = testRuleBundle
			refreshed.Representations[i].Interpretation = &Interpretation{Status: InterpretationApplied, Candidates: []string{testRuleBundle, testRuleFile, testRuleLink}}
			refreshed.Representations[i].Implementation = Implementation{Kind: ImplementationComposition, Members: members, Unresolved: unresolved}
		}
	}
	refreshed.Accounting = DeriveAccounting(refreshed)
	return a
}

func TestCompositionMembers(t *testing.T) {
	resolved := []CompositionMember{{ID: MembershipID(repA, "part", repB), Name: "part", Representation: repB, Evidence: EvidenceValue}}
	mustValid(t, "resolved member", withComposition(resolved, nil).Validate())
	mustValid(t, "unresolved member", withComposition(nil, []UnresolvedMember{{Name: "part", Reason: ReasonUnknownUntilApply}}).Validate())

	expectProblem(t, "member neither resolved nor unresolved", withComposition(nil, nil).Validate(), CodeFieldRequired, "resolved and unresolved members")
	expectProblem(t, "member listed twice", withComposition(resolved, []UnresolvedMember{{Name: "part", Reason: ReasonUnavailable}}).Validate(), CodeInconsistent, "listed more than once")

	undeclared := []CompositionMember{{ID: MembershipID(repA, "other", repB), Name: "other", Representation: repB, Evidence: EvidenceValue}}
	expectProblem(t, "undeclared member", withComposition(undeclared, nil).Validate(), CodeReferenceMissing, "is not declared by rule")
	expectProblem(t, "declared member missing", withComposition(undeclared, nil).Validate(), CodeClosureIncomplete, "neither resolved nor unresolved")

	evidenceless := []CompositionMember{{ID: MembershipID(repA, "part", repB), Name: "part", Representation: repB}}
	expectCode(t, "member evidence required", withComposition(evidenceless, nil).Validate(), CodeVocabulary)

	self := []CompositionMember{{ID: MembershipID(repA, "part", repA), Name: "part", Representation: repA, Evidence: EvidenceValue}}
	expectProblem(t, "root as its own member", withComposition(self, nil).Validate(), CodeInconsistent, "never its own member")

	reason := withComposition(nil, []UnresolvedMember{{Name: "part", Reason: "lost"}})
	expectCode(t, "unresolved reason vocabulary", reason.Validate(), CodeVocabulary)

	direct := withComposition(resolved, nil)
	for i := range direct.Stages[StageRefreshed].Representations {
		if direct.Stages[StageRefreshed].Representations[i].ID == repA {
			direct.Stages[StageRefreshed].Representations[i].Rule = testRuleFile
		}
	}
	expectProblem(t, "composition under a rule without composition", direct.Validate(), CodeInconsistent, "declares no composition")
}

func TestCanonicalizeIsIdempotentAndCopies(t *testing.T) {
	original := planFixture()
	first := original.Canonicalize()
	second := first.Canonicalize()
	a, _ := first.Encode()
	b, _ := second.Encode()
	if !bytes.Equal(a, b) {
		t.Fatal("canonicalize is not idempotent")
	}
	first.Stages[StagePlanned].Representations[0].Diagnostics = append(first.Stages[StagePlanned].Representations[0].Diagnostics, "diagnostic:x")
	if len(original.Stages[StagePlanned].Representations[0].Diagnostics) != 0 {
		t.Fatal("canonicalize shares representation slices with its input")
	}
}

// TestUninterpretedSideIsIndeterminate covers a representation whose
// interpretation becomes indeterminate: it has no closure on that side, so
// the other side's facts are listed as indeterminate, never as removed.
func TestUninterpretedSideIsIndeterminate(t *testing.T) {
	emission := testEmission()
	closureB := ClosureID(repB, emission.ID)
	factBA := ContributionID(repB, repA)
	build := func(status InterpretationStatus, reasons []Reason) *InputForm {
		a := planFixture()
		planned := a.Stages[StagePlanned]
		for i := range planned.Representations {
			if planned.Representations[i].ID == repB {
				planned.Representations[i].Interpretation = &Interpretation{Status: status, Reason: ReasonUnknownUntilApply, Candidates: []string{testRuleFile, testRuleLink}}
				planned.Representations[i].Rule, planned.Representations[i].Concept = "", ""
			}
		}
		var contributions []Contribution
		for _, fact := range planned.Contributions {
			if fact.ID != factBA {
				contributions = append(contributions, fact)
			}
		}
		planned.Contributions = contributions
		var closures []Closure
		for _, closure := range planned.Closures {
			if closure.ID != closureB {
				closures = append(closures, closure)
			}
		}
		planned.Closures = closures
		planned.Accounting = DeriveAccounting(planned)
		for _, c := range []*Comparison{a.Comparisons.Changes, a.Comparisons.Net} {
			c.Representations = append(c.Representations, RepresentationChange{ID: RepresentationChangeID(c.Name, ChangeChanged, repB), Change: ChangeChanged, Representation: repB, Fields: []string{FieldConcept, FieldRule}})
			c.Indeterminate = []IndeterminateClosure{{ID: IndeterminateID(c.Name, closureB, SideAfter), Closure: closureB, Representation: repB, Emission: emission.ID, Side: SideAfter, Reasons: reasons}}
			c.Counts = DeriveComparisonCounts(c)
		}
		return a
	}
	mustValid(t, "indeterminate interpretation", build(InterpretationIndeterminate, []Reason{ReasonUnknownUntilApply}).Validate())
	expectProblem(t, "reason differs from the interpretation", build(InterpretationIndeterminate, []Reason{ReasonSensitive}).Validate(), CodeInconsistent, "indeterminate only for reason")
	expectProblem(t, "extra reason", build(InterpretationIndeterminate, []Reason{ReasonExternalIdentityWithheld, ReasonUnknownUntilApply}).Validate(), CodeInconsistent, "indeterminate only for reason")
	expectProblem(t, "determinate interpretation", build(InterpretationNone, []Reason{ReasonUnknownUntilApply}).Validate(), CodeReferenceMissing, "is not on side")
}
