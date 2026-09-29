package form

import (
	"bytes"
	"encoding/json"
)

type inputFormJSON InputForm

type comparisonJSON ComparisonForm

// MarshalJSON serializes the canonical form of the input Form: sorted
// collections, empty slices instead of null, derived accounting.
func (a InputForm) MarshalJSON() ([]byte, error) {
	return marshalNoEscape((*inputFormJSON)(a.Canonicalize()))
}

// MarshalJSON serializes the canonical form of the comparison Form.
func (c ComparisonForm) MarshalJSON() ([]byte, error) {
	return marshalNoEscape((*comparisonJSON)(c.Canonicalize()))
}

// Encode returns the canonical, indented JSON bytes of an input Form with a
// trailing newline. Equal Forms encode to identical bytes. The digest of
// these bytes identifies the serialized Form, not architectural equivalence:
// Forms that differ in bytes can carry no determined architectural change.
func (a *InputForm) Encode() ([]byte, error) {
	return encodeIndented((*inputFormJSON)(a.Canonicalize()))
}

// Encode returns the canonical, indented JSON bytes of a comparison Form.
func (c *ComparisonForm) Encode() ([]byte, error) {
	return encodeIndented((*comparisonJSON)(c.Canonicalize()))
}

func marshalNoEscape(value any) ([]byte, error) {
	var buffer bytes.Buffer
	encoder := json.NewEncoder(&buffer)
	encoder.SetEscapeHTML(false)
	if err := encoder.Encode(value); err != nil {
		return nil, err
	}
	return bytes.TrimRight(buffer.Bytes(), "\n"), nil
}

func encodeIndented(value any) ([]byte, error) {
	var buffer bytes.Buffer
	encoder := json.NewEncoder(&buffer)
	encoder.SetEscapeHTML(false)
	encoder.SetIndent("", "  ")
	if err := encoder.Encode(value); err != nil {
		return nil, err
	}
	return buffer.Bytes(), nil
}
