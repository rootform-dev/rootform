package form

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"strings"
)

// Decode problem codes.
const (
	CodeJSONInvalid     = "DOCUMENT_JSON_INVALID"
	CodeFieldUnknown    = "DOCUMENT_FIELD_UNKNOWN"
	CodeTrailingContent = "DOCUMENT_TRAILING_CONTENT"
)

// DecodeError is a structural decoding failure that precedes validation.
type DecodeError struct {
	Code    string
	Message string
}

func (e *DecodeError) Error() string { return e.Code + ": " + e.Message }

// Header is the self-description every Form starts with.
type Header struct {
	FormatVersion string    `json:"format_version"`
	Kind          Kind      `json:"kind"`
	Generator     Generator `json:"generator"`
}

// PeekHeader reads the self-describing fields leniently, so that a document
// of another format is refused by its format rather than by its first
// unknown field. Only the first JSON value is read; trailing content is
// refused later by strict decoding.
func PeekHeader(data []byte) (Header, error) {
	var header Header
	if err := json.NewDecoder(bytes.NewReader(data)).Decode(&header); err != nil {
		return header, &DecodeError{Code: CodeJSONInvalid, Message: "input is not a JSON object: " + err.Error()}
	}
	return header, nil
}

// Form is a decoded Rootform Form of any kind: exactly one of Input and
// Comparison is set.
type Form struct {
	Input      *InputForm
	Comparison *ComparisonForm
}

// Kind reports the Form kind.
func (d Form) Kind() Kind {
	switch {
	case d.Input != nil:
		return d.Input.Kind
	case d.Comparison != nil:
		return KindComparison
	}
	return ""
}

// Decode strictly decodes and validates a Form of any kind.
func Decode(data []byte) (Form, error) {
	header, err := PeekHeader(data)
	if err != nil {
		return Form{}, err
	}
	if err := checkHeader(header); err != nil {
		return Form{}, err
	}
	switch header.Kind {
	case KindState, KindPlan:
		analysis, err := DecodeInputForm(data)
		if err != nil {
			return Form{}, err
		}
		return Form{Input: analysis}, nil
	case KindComparison:
		comparison, err := DecodeComparison(data)
		if err != nil {
			return Form{}, err
		}
		return Form{Comparison: comparison}, nil
	}
	return Form{}, &DecodeError{Code: CodeKindInvalid, Message: "Form kind " + string(header.Kind) + " is not state, plan or comparison"}
}

// DecodeInputForm strictly decodes and validates a state or plan Form.
func DecodeInputForm(data []byte) (*InputForm, error) {
	header, err := PeekHeader(data)
	if err != nil {
		return nil, err
	}
	if err := checkHeader(header); err != nil {
		return nil, err
	}
	if header.Kind != KindState && header.Kind != KindPlan {
		return nil, &DecodeError{Code: CodeKindInvalid, Message: "Form kind " + string(header.Kind) + " is not state or plan"}
	}
	var analysis InputForm
	if err := strictDecode(data, &analysis); err != nil {
		return nil, err
	}
	if err := analysis.Validate(); err != nil {
		return nil, err
	}
	return &analysis, nil
}

// DecodeComparison strictly decodes and validates a comparison Form.
func DecodeComparison(data []byte) (*ComparisonForm, error) {
	header, err := PeekHeader(data)
	if err != nil {
		return nil, err
	}
	if err := checkHeader(header); err != nil {
		return nil, err
	}
	if header.Kind != KindComparison {
		return nil, &DecodeError{Code: CodeKindInvalid, Message: "Form kind " + string(header.Kind) + " is not comparison"}
	}
	var comparison ComparisonForm
	if err := strictDecode(data, &comparison); err != nil {
		return nil, err
	}
	if err := comparison.Validate(); err != nil {
		return nil, err
	}
	return &comparison, nil
}

func checkHeader(header Header) error {
	if header.FormatVersion != FormatVersion {
		return &DecodeError{Code: CodeFormatUnsupported, Message: "document format " + quoteOrEmpty(header.FormatVersion) + " is not supported; this build reads format " + FormatVersion}
	}
	if header.Generator.Name != GeneratorName {
		return &DecodeError{Code: CodeGeneratorInvalid, Message: "document generator " + quoteOrEmpty(header.Generator.Name) + " is not " + GeneratorName}
	}
	return nil
}

func quoteOrEmpty(value string) string {
	if value == "" {
		return "(absent)"
	}
	return "\"" + value + "\""
}

// strictDecode rejects unknown fields and trailing content. Unknown fields
// are the first line of defense against documents of another shape being
// silently reinterpreted.
func strictDecode(data []byte, target any) error {
	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(target); err != nil {
		if strings.Contains(err.Error(), "unknown field") {
			return &DecodeError{Code: CodeFieldUnknown, Message: err.Error()}
		}
		return &DecodeError{Code: CodeJSONInvalid, Message: err.Error()}
	}
	var trailing json.RawMessage
	err := decoder.Decode(&trailing)
	switch {
	case errors.Is(err, io.EOF):
		return nil
	case err == nil:
		return &DecodeError{Code: CodeTrailingContent, Message: "content follows the document"}
	default:
		return &DecodeError{Code: CodeTrailingContent, Message: err.Error()}
	}
}
