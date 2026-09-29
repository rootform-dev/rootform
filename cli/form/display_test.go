package form

import (
	"bytes"
	"encoding/json"
	"testing"
)

func TestDisplayWithholdsRecordIdentities(t *testing.T) {
	plan := planFixture()
	retarget(plan.Stages[StageRefreshed], 1, DiscloseReport, map[string]string{"filename": "/srv/zeta.txt"})
	mustValid(t, "display input", plan.Validate())
	first, err := DisplayJSON(Form{Input: plan})
	if err != nil {
		t.Fatal(err)
	}
	if bytes.Contains(first, []byte("/srv/shared.txt")) {
		t.Fatal("record-tier identity reached the display copy")
	}
	if !bytes.Contains(first, []byte("/srv/zeta.txt")) {
		t.Fatal("report-tier identity missing from the display copy")
	}
	if !bytes.Contains(first, []byte(`"disclosure": "record"`)) {
		t.Fatal("display copy lost the record disclosure tier")
	}
	second, err := DisplayJSON(Form{Input: plan})
	if err != nil || !bytes.Equal(first, second) {
		t.Fatal("display copy is not deterministic")
	}
	encoded, err := plan.Encode()
	if err != nil || !bytes.Contains(encoded, []byte("/srv/shared.txt")) {
		t.Fatal("display copy modified the source document")
	}
	if _, err := Decode(first); err == nil {
		t.Fatal("a display copy without its record identity must not load as a document")
	}

	cross := crossFixture()
	mustValid(t, "cross display input", cross.Validate())
	shown, err := DisplayJSON(Form{Comparison: cross})
	if err != nil {
		t.Fatal(err)
	}
	if bytes.Contains(shown, []byte("/srv/shared.txt")) {
		t.Fatal("record-tier identity reached the comparison display copy")
	}
	if _, err := DisplayJSON(Form{}); err == nil {
		t.Fatal("empty document accepted")
	}
}

func TestDisplayNarrowsSemanticsToReachedDefinitions(t *testing.T) {
	plan := planFixture()
	plan.Semantics.Concepts = append(plan.Semantics.Concepts, ConceptDefinition{ID: "localtest.concept.unreached", Owner: testOwner, Name: "unreached"})
	plan.Semantics.Relations = append(plan.Semantics.Relations, RelationDefinition{ID: "localtest.relation.unreached", Owner: testOwner, Name: "unreached"})
	mustValid(t, "narrowing input", plan.Validate())
	shown, err := DisplayJSON(Form{Input: plan})
	if err != nil {
		t.Fatal(err)
	}
	var display InputForm
	if err := json.Unmarshal(shown, &display); err != nil {
		t.Fatal(err)
	}
	ids := map[string]bool{}
	for _, v := range display.Semantics.Concepts {
		ids[v.ID] = true
	}
	for _, v := range display.Semantics.Relations {
		ids[v.ID] = true
	}
	for _, v := range display.Semantics.Rules {
		ids[v.ID] = true
	}
	for _, v := range display.Semantics.Emissions {
		ids[v.ID] = true
	}
	for _, id := range []string{"localtest.concept.unreached", "localtest.relation.unreached", testRelationUses} {
		if ids[id] {
			t.Fatalf("unreached definition %s reached the display copy", id)
		}
	}
	for _, id := range []string{testConceptFile, testConceptLink, testRuleFile, testRuleLink, testEmission().ID} {
		if !ids[id] {
			t.Fatalf("reached definition %s missing from the display copy", id)
		}
	}
	if len(display.Semantics.Owners) != len(plan.Semantics.Owners) || display.Semantics.ReleaseSet.ID != plan.Semantics.ReleaseSet.ID {
		t.Fatal("display copy changed the owners or the release set")
	}
	encoded, err := plan.Encode()
	if err != nil || !bytes.Contains(encoded, []byte("localtest.concept.unreached")) {
		t.Fatal("narrowing modified the source document")
	}
}
