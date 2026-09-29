package schema

import (
	"bytes"
	"encoding/json"
	"fmt"
	"math/big"
	"os"
	"reflect"
	"regexp"
	"strings"
	"testing"
	"unicode/utf8"

	"github.com/rootform-dev/rootform/cli/form"
	"github.com/rootform-dev/rootform/cli/policyresult"
)

func tree(t *testing.T, data []byte) map[string]any {
	t.Helper()
	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.UseNumber()
	var result map[string]any
	if err := decoder.Decode(&result); err != nil {
		t.Fatal(err)
	}
	return result
}

func generated(t *testing.T) map[string]any {
	t.Helper()
	data, err := Generate()
	if err != nil {
		t.Fatal(err)
	}
	return tree(t, data)
}

func TestCommittedSchemaIsGeneratedAndDeterministic(t *testing.T) {
	committed, err := os.ReadFile("../../../" + Output)
	if err != nil {
		t.Fatal(err)
	}
	for range 3 {
		data, err := Generate()
		if err != nil {
			t.Fatal(err)
		}
		if !bytes.Equal(committed, data) || !bytes.HasSuffix(data, []byte("\n")) {
			t.Fatal("schema stale or nondeterministic; run go run ./internal/policy/schema/cmd -write")
		}
	}
}

func TestSchemaClosesEveryObject(t *testing.T) {
	root := generated(t)
	defs := root["$defs"].(map[string]any)
	var walk func(any)
	walk = func(value any) {
		switch v := value.(type) {
		case map[string]any:
			if v["type"] == "object" && v["additionalProperties"] != false {
				t.Fatal("open object")
			}
			if r, ok := v["$ref"].(string); ok && defs[strings.TrimPrefix(r, "#/$defs/")] == nil {
				t.Fatalf("dangling ref %s", r)
			}
			for _, child := range v {
				walk(child)
			}
		case []any:
			for _, child := range v {
				walk(child)
			}
		}
	}
	walk(root)
}

const digest = "sha256:0000000000000000000000000000000000000000000000000000000000000000"

func architecture(side string, status policyresult.Status) policyresult.Architecture {
	a := policyresult.ArchitectureUnavailable(1, "POLICY_STAGE_MISSING", "the selected stage is unavailable")
	a.Side, a.Kind, a.Stage, a.Digest = side, "state", form.StageRecorded, digest
	if status == policyresult.StatusFailed {
		return a
	}
	a.Status = policyresult.StatusNoDecision
	a.Diagnostics = []policyresult.Diagnostic{}
	a.SemanticOwners = []policyresult.SemanticOwner{{ID: "localtest", Kind: form.OwnerDialect, Version: "0.1.0", SemanticDigest: digest}}
	a.PolicyPacks = []policyresult.PolicyPack{{ID: "governance", Version: "0.1.0", ContentDigest: digest, Linked: true, LinkedDigest: digest, Pins: []policyresult.SemanticPin{{Owner: "localtest", Kind: "dialect", Version: "0.1.0", SemanticDigest: digest}}}}
	outcome, evaluation := policyresult.PolicyPassed, policyresult.OutcomePassed
	if status == policyresult.StatusViolated {
		outcome, evaluation = policyresult.PolicyViolated, policyresult.OutcomeViolated
		a.Violations = []policyresult.Violation{{ID: "violation:a", Policy: "governance.policy.required", Target: "representation:a", Address: "local_file.a", Message: "Files carry an owner.", InspectedFacts: []string{}, InspectedClosures: []string{"closure:a"}}}
	}
	a.Policies = []policyresult.PolicyResult{{ID: "governance.policy.required", Message: "Files carry an owner.", Target: policyresult.TargetDefinition{Concept: "localtest.concept.file", Rules: []string{}, Dialects: []string{}}, Targets: 1, Complete: true, Reasons: []string{}, Outcome: outcome}}
	a.Evaluations = []policyresult.Evaluation{{ID: "evaluation:a", Policy: "governance.policy.required", Message: "Files carry an owner.", Target: "representation:a", Address: "local_file.a", Rule: "localtest.rule.file", Concept: "localtest.concept.file", Stage: form.StageRecorded, Outcome: evaluation, Reasons: []string{}, InspectedFacts: []string{}, InspectedClosures: []string{"closure:a"}}}
	return a
}

func invocation(kind string, scope policyresult.Scope, architectures ...policyresult.Architecture) policyresult.Result {
	r := policyresult.NewResult()
	r.Generator = form.Generator{Name: form.GeneratorName, Version: "0.1.0"}
	r.Form = &policyresult.FormIdentity{Kind: kind, Origin: "saved", Digest: digest, Generator: r.Generator}
	r.Scope = scope
	r.Selection = policyresult.Selection{Selectors: []string{"governance/*"}, Policies: []string{"governance.policy.required"}}
	r.Architectures = architectures
	return r.Finalized()
}

func TestResultsValidateAgainstSchema(t *testing.T) {
	root := generated(t)
	unavailable := policyresult.Unavailable("POLICY_UNAVAILABLE", "no Policy Pack is selected")
	unavailable.Generator = form.Generator{Name: form.GeneratorName, Version: "0.1.0"}
	for name, result := range map[string]policyresult.Result{
		"single":      invocation("state", policyresult.ScopeInput, architecture("", policyresult.StatusPassed)),
		"comparison":  invocation("comparison", policyresult.ScopeBoth, architecture(form.SideAfter, policyresult.StatusPassed), architecture(form.SideBefore, policyresult.StatusViolated)),
		"failed side": invocation("comparison", policyresult.ScopeBoth, architecture(form.SideBefore, policyresult.StatusFailed), architecture(form.SideAfter, policyresult.StatusPassed)),
		"unavailable": unavailable,
	} {
		t.Run(name, func(t *testing.T) {
			data, err := policyresult.Serialize(result)
			if err != nil {
				t.Fatal(err)
			}
			if err := validate(root, tree(t, data), root); err != nil {
				t.Fatalf("%s: %v\n%s", name, err, data)
			}
			if _, err := policyresult.Decode(data); err != nil {
				t.Fatal(err)
			}
		})
	}
	bad := invocation("state", policyresult.ScopeInput, architecture("", policyresult.StatusPassed))
	data, _ := policyresult.Serialize(bad)
	for label, mutated := range map[string][]byte{
		"unknown field": bytes.Replace(data, []byte("\"architectures\""), []byte("\"evaluated\": {},\n  \"architectures\""), 1),
		"unknown side":  bytes.Replace(data, []byte("\"kind\": \"state\",\n      \"stage\""), []byte("\"side\": \"middle\",\n      \"kind\": \"state\",\n      \"stage\""), 1),
		"format":        bytes.Replace(data, []byte("\"format_version\": \"1\""), []byte("\"format_version\": \"2\""), 1),
	} {
		if bytes.Equal(mutated, data) {
			t.Fatalf("%s: mutation did not apply", label)
		}
		if validate(root, tree(t, mutated), root) == nil {
			t.Fatalf("%s: schema accepted", label)
		}
	}
}

// This test-only evaluator supports exactly the generated schema vocabulary.
// UseNumber and Rat preserve the int64 boundary fixtures without float rounding.
func validate(s map[string]any, value any, root map[string]any) error {
	if reference, ok := s["$ref"].(string); ok {
		name := strings.TrimPrefix(reference, "#/$defs/")
		definition, ok := root["$defs"].(map[string]any)[name].(map[string]any)
		if !ok {
			return fmt.Errorf("missing reference %s", reference)
		}
		return validate(definition, value, root)
	}
	for key := range s {
		switch key {
		case "$schema", "$id", "$comment", "$defs", "title", "description", "type", "properties", "required", "additionalProperties", "items", "minLength", "maxLength", "minItems", "maxItems", "uniqueItems", "minimum", "maximum", "pattern", "const", "enum", "oneOf", "anyOf", "allOf":
		default:
			return fmt.Errorf("unsupported test schema keyword %s", key)
		}
	}
	for _, keyword := range []string{"oneOf", "anyOf", "allOf"} {
		if variants, ok := s[keyword].([]any); ok {
			matches := 0
			for _, candidate := range variants {
				if validate(candidate.(map[string]any), value, root) == nil {
					matches++
				}
			}
			if keyword == "oneOf" && matches != 1 || keyword == "anyOf" && matches == 0 || keyword == "allOf" && matches != len(variants) {
				return fmt.Errorf("%s matched %d variants", keyword, matches)
			}
		}
	}
	if expected, ok := s["const"]; ok && !reflect.DeepEqual(expected, value) {
		return fmt.Errorf("const mismatch")
	}
	if values, ok := s["enum"].([]any); ok {
		found := false
		for _, candidate := range values {
			found = found || reflect.DeepEqual(candidate, value)
		}
		if !found {
			return fmt.Errorf("enum mismatch")
		}
	}
	if required, ok := s["required"].([]any); ok {
		if object, isObject := value.(map[string]any); isObject {
			for _, key := range required {
				if _, exists := object[key.(string)]; !exists {
					return fmt.Errorf("missing %s", key)
				}
			}
		}
	}
	switch s["type"] {
	case "object":
		object, ok := value.(map[string]any)
		if !ok {
			return fmt.Errorf("expected object")
		}
		properties := s["properties"].(map[string]any)
		for _, key := range s["required"].([]any) {
			if _, ok := object[key.(string)]; !ok {
				return fmt.Errorf("missing %s", key)
			}
		}
		for key, child := range object {
			property, ok := properties[key].(map[string]any)
			if !ok {
				return fmt.Errorf("unexpected %s", key)
			}
			if err := validate(property, child, root); err != nil {
				return fmt.Errorf("%s: %w", key, err)
			}
		}
	case "array":
		array, ok := value.([]any)
		if !ok {
			return fmt.Errorf("expected array")
		}
		if min, ok := s["minItems"].(json.Number); ok && len(array) < integer(min) {
			return fmt.Errorf("array too short")
		}
		if max, ok := s["maxItems"].(json.Number); ok && len(array) > integer(max) {
			return fmt.Errorf("array too long")
		}
		seen := map[string]bool{}
		for _, child := range array {
			if s["uniqueItems"] == true {
				encoded, _ := json.Marshal(child)
				if seen[string(encoded)] {
					return fmt.Errorf("duplicate item")
				}
				seen[string(encoded)] = true
			}
			if err := validate(s["items"].(map[string]any), child, root); err != nil {
				return err
			}
		}
	case "string":
		if _, ok := value.(string); !ok {
			return fmt.Errorf("expected string")
		}
	case "integer":
		number, ok := value.(json.Number)
		if !ok {
			return fmt.Errorf("expected integer")
		}
		rational, ok := new(big.Rat).SetString(string(number))
		if !ok || !rational.IsInt() {
			return fmt.Errorf("expected integer")
		}
		for _, bound := range []string{"minimum", "maximum"} {
			if limit, ok := s[bound].(json.Number); ok {
				other, _ := new(big.Rat).SetString(string(limit))
				comparison := rational.Cmp(other)
				if bound == "minimum" && comparison < 0 || bound == "maximum" && comparison > 0 {
					return fmt.Errorf("integer exceeds %s", bound)
				}
			}
		}
	case "boolean":
		if _, ok := value.(bool); !ok {
			return fmt.Errorf("expected boolean")
		}
	case nil:
	default:
		return fmt.Errorf("unsupported schema type %v", s["type"])
	}
	if text, ok := value.(string); ok {
		if pattern, ok := s["pattern"].(string); ok && !regexp.MustCompile(strings.ReplaceAll(pattern, `(?![\s\S])`, `\z`)).MatchString(text) {
			return fmt.Errorf("pattern mismatch")
		}
		length := utf8.RuneCountInString(text)
		if min, ok := s["minLength"].(json.Number); ok && length < integer(min) {
			return fmt.Errorf("string too short")
		}
		if max, ok := s["maxLength"].(json.Number); ok && length > integer(max) {
			return fmt.Errorf("string too long")
		}
	}
	return nil
}

func integer(value json.Number) int {
	number, _ := value.Int64()
	return int(number)
}
