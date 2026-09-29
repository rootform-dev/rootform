package schema

import (
	"bytes"
	"encoding/json"
	"os"
	"path/filepath"
	"runtime"
	"slices"
	"testing"
)

func TestCommittedSchemaIsGeneratedAndDeterministic(t *testing.T) {
	first, err := Generate()
	if err != nil {
		t.Fatal(err)
	}
	second, err := Generate()
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(first, second) {
		t.Fatal("schema generation is nondeterministic")
	}
	_, file, _, _ := runtime.Caller(0)
	committed, err := os.ReadFile(filepath.Join(filepath.Dir(file), "..", "..", "..", "..", Output))
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(committed, first) {
		t.Fatal("committed schema is stale; run go run ./internal/architecture/document/schema/cmd -write")
	}
}

func TestSchemaClosesEveryObject(t *testing.T) {
	data, err := Generate()
	if err != nil {
		t.Fatal(err)
	}
	var root struct {
		Defs map[string]map[string]any `json:"$defs"`
	}
	if err := json.Unmarshal(data, &root); err != nil {
		t.Fatal(err)
	}
	for _, name := range []string{"InputForm", "ComparisonForm", "Architecture", "Representation", "Closure", "Emission", "DriftEntry"} {
		definition, ok := root.Defs[name]
		if !ok {
			t.Fatalf("definition %s is missing", name)
		}
		if definition["additionalProperties"] != false {
			t.Fatalf("definition %s admits unknown properties", name)
		}
	}
}

func TestSchemaAdmitsEveryEmittedStatusAndReason(t *testing.T) {
	data, err := Generate()
	if err != nil {
		t.Fatal(err)
	}
	var root struct {
		Defs map[string]struct {
			Properties map[string]struct {
				Enum  []string `json:"enum"`
				Items struct {
					Enum []string `json:"enum"`
				} `json:"items"`
			} `json:"properties"`
		} `json:"$defs"`
	}
	if err := json.Unmarshal(data, &root); err != nil {
		t.Fatal(err)
	}
	statuses := root.Defs["Interpretation"].Properties["status"].Enum
	for _, want := range []string{"none", "applied", "indeterminate", "failed"} {
		if !slices.Contains(statuses, want) {
			t.Fatalf("Interpretation.status admits %v, missing %q", statuses, want)
		}
	}
	reasons := root.Defs["IndeterminateClosure"].Properties["reasons"].Items.Enum
	for _, want := range []string{"unknown_until_apply", "interpretation_failed", "external_identity_withheld"} {
		if !slices.Contains(reasons, want) {
			t.Fatalf("IndeterminateClosure.reasons admits %v, missing %q", reasons, want)
		}
	}
}
