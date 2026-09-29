package detect

import (
	"bytes"
	"encoding/json"
	"strconv"
	"strings"
)

type Kind string

const (
	KindPlan     Kind = "plan"
	KindState    Kind = "state"
	KindDocument Kind = "document"
)

type Info struct {
	FormatVersion   string
	ReportedVersion string
	DocumentKind    string
}

type Error struct{ Code, Shape string }

func (e *Error) Error() string { return e.Code + ": " + e.Shape }

// Shapes of refused inputs that are Terraform or OpenTofu files other than the
// JSON exports run accepts; callers name the export each one needed.
const (
	ShapeZipArchive  = "zip archive, such as a saved plan"
	ShapeRawState    = "raw terraform.tfstate"
	ShapeEventStream = "Terraform plan event stream"
	ShapeNotJSON     = "not JSON"
	ShapeUnknownJSON = "JSON that is not a plan JSON, state JSON or saved Form"
	ShapeEmptyState  = "state JSON without recorded state: the working directory that exported it has no state"
)

func refused(shape string) error { return &Error{Code: "INPUT_UNRECOGNIZED", Shape: shape} }

// Detect examines only top-level producer fields and the document generator.
func Detect(data []byte) (Kind, Info, error) {
	var info Info
	if len(bytes.TrimSpace(data)) == 0 {
		return "", info, refused("empty input")
	}
	if bytes.HasPrefix(data, []byte("PK\x03\x04")) {
		return "", info, refused(ShapeZipArchive)
	}
	if !json.Valid(data) {
		trimmed := bytes.TrimSpace(data)
		if len(trimmed) > 0 && trimmed[0] == '{' && bytes.Contains(trimmed, []byte("\n{")) {
			return "", info, refused(ShapeEventStream)
		}
		if len(trimmed) > 0 && trimmed[0] != '{' && trimmed[0] != '[' {
			return "", info, refused(ShapeNotJSON)
		}
		return "", info, refused("malformed JSON or trailing garbage")
	}
	fields, ok := topFields(data)
	if !ok {
		return "", info, refused(ShapeUnknownJSON)
	}
	stringField := func(key string) string { var v string; _ = json.Unmarshal(fields[key], &v); return v }
	info.FormatVersion = stringField("format_version")
	info.ReportedVersion = stringField("terraform_version")
	if len(fields) == 1 && version1(info.FormatVersion) {
		if _, onlyFormat := fields["format_version"]; onlyFormat {
			return "", info, refused(ShapeEmptyState)
		}
	}
	if _, sarif := fields["runs"]; sarif {
		return "", info, refused("SARIF log")
	}
	if _, serial := fields["serial"]; serial {
		return "", info, refused(ShapeRawState)
	}
	if _, lineage := fields["lineage"]; lineage {
		return "", info, refused(ShapeRawState)
	}
	if _, event := fields["@level"]; event {
		return "", info, refused(ShapeEventStream)
	}
	if _, event := fields["type"]; event && stringField("type") == "planned_change" {
		return "", info, refused(ShapeEventStream)
	}
	generator, gok := topFields(fields["generator"])
	var name string
	if gok {
		_ = json.Unmarshal(generator["name"], &name)
	}
	info.DocumentKind = stringField("kind")
	if name == "rootform" {
		return KindDocument, info, nil
	}
	if version1(info.FormatVersion) && info.ReportedVersion != "" {
		_, planned := fields["planned_values"]
		_, config := fields["configuration"]
		_, values := fields["values"]
		_, changes := fields["resource_changes"]
		if planned && config {
			return KindPlan, info, nil
		}
		if values && !planned && !config && !changes {
			return KindState, info, nil
		}
	}
	return "", info, refused(ShapeUnknownJSON)
}

func version1(value string) bool {
	major, minor, ok := strings.Cut(value, ".")
	if !ok || major != "1" || minor == "" {
		return false
	}
	for _, digit := range minor {
		if digit < '0' || digit > '9' {
			return false
		}
	}
	return true
}

// topFields scans validated JSON, copying only key names and small scalar fields.
func topFields(data []byte) (map[string]json.RawMessage, bool) {
	i := 0
	skipSpace := func() {
		for i < len(data) && (data[i] == ' ' || data[i] == '\n' || data[i] == '\r' || data[i] == '\t') {
			i++
		}
	}
	skipSpace()
	if i >= len(data) || data[i] != '{' {
		return nil, false
	}
	i++
	fields := map[string]json.RawMessage{}
	for {
		skipSpace()
		if i >= len(data) {
			return nil, false
		}
		if data[i] == '}' {
			return fields, true
		}
		if data[i] != '"' || len(fields) >= 256 {
			return nil, false
		}
		start := i
		i = endString(data, i)
		if i < 0 || i-start > 1024 {
			return nil, false
		}
		key, err := strconv.Unquote(string(data[start:i]))
		if err != nil {
			return nil, false
		}
		if _, duplicate := fields[key]; duplicate {
			return nil, false
		}
		skipSpace()
		if i >= len(data) || data[i] != ':' {
			return nil, false
		}
		i++
		skipSpace()
		start = i
		i = endValue(data, i)
		if i < 0 {
			return nil, false
		}
		if key == "format_version" || key == "terraform_version" || key == "kind" || key == "type" || key == "generator" || key == "name" {
			if key != "generator" && i-start > 4096 {
				return nil, false
			}
			fields[key] = data[start:i]
		} else {
			fields[key] = nil
		}
		skipSpace()
		if i >= len(data) {
			return nil, false
		}
		if data[i] == '}' {
			return fields, true
		}
		if data[i] != ',' {
			return nil, false
		}
		i++
	}
}

func endString(data []byte, i int) int {
	i++
	for i < len(data) {
		if data[i] == '\\' {
			i += 2
			continue
		}
		if data[i] == '"' {
			return i + 1
		}
		i++
	}
	return -1
}

func endValue(data []byte, i int) int {
	if i >= len(data) {
		return -1
	}
	if data[i] == '"' {
		return endString(data, i)
	}
	if data[i] != '{' && data[i] != '[' {
		for i < len(data) && data[i] != ',' && data[i] != '}' && data[i] != ']' && data[i] != ' ' && data[i] != '\n' && data[i] != '\r' && data[i] != '\t' {
			i++
		}
		return i
	}
	depth := 0
	for i < len(data) {
		switch data[i] {
		case '"':
			i = endString(data, i)
			if i < 0 {
				return -1
			}
			continue
		case '{', '[':
			depth++
		case '}', ']':
			depth--
			if depth == 0 {
				return i + 1
			}
		}
		i++
	}
	return -1
}

func (k Kind) String() string { return string(k) }
