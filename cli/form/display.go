package form

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
)

// DisplayJSON returns the canonical bytes that leave Rootform for display: the
// loopback server payload and the copy embedded in a standalone HTML
// report. A record-tier external identity stays in the saved Form only, so
// the display copy removes it and keeps the endpoint's disclosure tier: a
// reader sees that an identity was recorded without seeing its value.
// Report-tier identities stay.
//
// The display copy also narrows the semantic snapshot to the definitions the
// Form reaches. The complete snapshot stays in the saved Form, which
// alone reopens without installed Dialects; a reader of the display
// copy needs only the concepts, contexts, relations, rules and emissions that
// explain what it shows. Owners, the release set and the selection stay whole.
//
// The input must be a validated Form and is never modified. The result is
// presentation data; it is not accepted back as a Form.
func DisplayJSON(d Form) ([]byte, error) {
	switch {
	case d.Input != nil:
		input := d.Input.Canonicalize()
		withholdRecordIdentities(input)
		if err := narrowSemantics(input); err != nil {
			return nil, err
		}
		return input.Encode()
	case d.Comparison != nil:
		comparison := d.Comparison.Canonicalize()
		for _, side := range []*InputForm{&comparison.Before.Form, &comparison.After.Form} {
			withholdRecordIdentities(side)
			if err := narrowSemantics(side); err != nil {
				return nil, err
			}
		}
		return comparison.Encode()
	}
	return nil, errors.New("the Form is empty")
}

// withholdRecordIdentities clears record-tier identities on a canonical copy.
// Canonicalize copies every stage and representation slice, so assigning the
// field never reaches the caller's document.
func withholdRecordIdentities(a *InputForm) {
	for _, architecture := range a.Stages {
		if architecture == nil {
			continue
		}
		for i := range architecture.Representations {
			if architecture.Representations[i].Disclosure == DiscloseRecord {
				architecture.Representations[i].Identity = nil
			}
		}
	}
}

// narrowSemantics keeps the semantic definitions reached from the analysis
// outside its semantic snapshot, closed over the references definitions make
// to one another: a kept rule keeps its concept and emissions, a kept emission
// keeps its rule, target, dimension and predicate. Every identifier the
// analysis carries is a candidate reference, so a definition is never dropped
// while something shown still names it. The kept definitions stay in canonical
// order and the replaced slices are new, so the caller's snapshot is intact.
func narrowSemantics(a *InputForm) error {
	probe := *a
	probe.Semantics = Semantics{}
	encoded, err := json.Marshal(probe)
	if err != nil {
		return err
	}
	reached, err := jsonStrings(encoded)
	if err != nil {
		return err
	}
	s := a.Semantics
	definitions := map[string]any{}
	for _, v := range s.Concepts {
		definitions[v.ID] = v
	}
	for _, v := range s.Contexts {
		definitions[v.ID] = v
	}
	for _, v := range s.Relations {
		definitions[v.ID] = v
	}
	for _, v := range s.Rules {
		definitions[v.ID] = v
	}
	for _, v := range s.Emissions {
		definitions[v.ID] = v
	}
	kept := map[string]bool{}
	var pending []string
	visit := func(ids []string) {
		for _, id := range ids {
			if _, ok := definitions[id]; ok && !kept[id] {
				kept[id] = true
				pending = append(pending, id)
			}
		}
	}
	visit(reached)
	for len(pending) > 0 {
		id := pending[len(pending)-1]
		pending = pending[:len(pending)-1]
		encoded, err := json.Marshal(definitions[id])
		if err != nil {
			return err
		}
		references, err := jsonStrings(encoded)
		if err != nil {
			return err
		}
		visit(references)
	}
	a.Semantics.Concepts = keepDefinitions(s.Concepts, kept, func(v ConceptDefinition) string { return v.ID })
	a.Semantics.Contexts = keepDefinitions(s.Contexts, kept, func(v ContextDefinition) string { return v.ID })
	a.Semantics.Relations = keepDefinitions(s.Relations, kept, func(v RelationDefinition) string { return v.ID })
	a.Semantics.Rules = keepDefinitions(s.Rules, kept, func(v RuleDefinition) string { return v.ID })
	a.Semantics.Emissions = keepDefinitions(s.Emissions, kept, func(v Emission) string { return v.ID })
	return nil
}

func keepDefinitions[T any](values []T, kept map[string]bool, id func(T) string) []T {
	out := make([]T, 0, len(values))
	for _, v := range values {
		if kept[id(v)] {
			out = append(out, v)
		}
	}
	return out
}

// jsonStrings returns every string token of an encoded JSON value, keys
// included; a key never names a semantic definition, so it only costs a lookup.
func jsonStrings(encoded []byte) ([]string, error) {
	decoder := json.NewDecoder(bytes.NewReader(encoded))
	decoder.UseNumber()
	var out []string
	for {
		token, err := decoder.Token()
		if errors.Is(err, io.EOF) {
			return out, nil
		}
		if err != nil {
			return nil, err
		}
		if value, ok := token.(string); ok {
			out = append(out, value)
		}
	}
}
