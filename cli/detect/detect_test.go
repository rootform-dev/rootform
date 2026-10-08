package detect

import (
	"bytes"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestDetect(t *testing.T) {
	cases := []struct {
		name  string
		kind  Kind
		shape string
	}{
		{"plan.json", KindPlan, ""}, {"state.json", KindState, ""}, {"document.json", KindDocument, ""},
		{"sarif.json", "", "SARIF log"}, {"events.jsonl", "", "Terraform plan event stream"},
		{"tfstate.json", "", "raw terraform.tfstate"}, {"archive.zip", "", ShapeZipArchive},
		{"binary.bin", "", ShapeNotJSON}, {"unknown.json", "", ShapeUnknownJSON},
		{"trailing.txt", "", "trailing garbage"}, {"empty.txt", "", "empty input"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			data, err := os.ReadFile(filepath.Join("testdata", tc.name))
			if err != nil {
				t.Fatal(err)
			}
			kind, info, err := Detect(data)
			if tc.shape == "" {
				if err != nil || kind != tc.kind {
					t.Fatalf("kind=%q info=%+v err=%v", kind, info, err)
				}
				return
			}
			if err == nil || !strings.Contains(err.Error(), "INPUT_UNRECOGNIZED") || !strings.Contains(err.Error(), tc.shape) {
				t.Fatalf("kind=%q err=%v", kind, err)
			}
		})
	}
}

func TestDetectDocumentEnvelopeBeforeCheckingVersion(t *testing.T) {
	data, err := os.ReadFile(filepath.Join("testdata", "document.json"))
	if err != nil {
		t.Fatal(err)
	}
	changed := bytes.Replace(data, []byte(`"format_version":"1"`), []byte(`"format_version":"9"`), 1)
	if bytes.Equal(changed, data) {
		t.Fatal("fixture has no format_version")
	}
	if kind, info, err := Detect(changed); err != nil || kind != KindDocument || info.FormatVersion != "9" {
		t.Fatalf("kind = %q, info = %+v, err = %v", kind, info, err)
	}
}

func TestDetectEmptyStateExportOnly(t *testing.T) {
	for _, test := range []struct {
		body, want string
	}{
		{`{"format_version":"1.0"}`, ShapeEmptyState},
		{`{"format_version":"1.0","values":{}}`, ShapeUnknownJSON},
		{`{"format_version":"9"}`, ShapeUnknownJSON},
	} {
		_, _, err := Detect([]byte(test.body))
		if err == nil || !strings.Contains(err.Error(), test.want) {
			t.Fatalf("body = %s, err = %v, want %q", test.body, err, test.want)
		}
	}
}

func TestTopLevelOnly(t *testing.T) {
	data := []byte(`{"format_version":"1.2","terraform_version":"1.12.2","planned_values":{"values":{"nested":"secret"}},"configuration":{}}`)
	k, _, err := Detect(data)
	if err != nil || k != KindPlan {
		t.Fatalf("kind=%q err=%v", k, err)
	}
}

func TestRejectNonNumericFormat(t *testing.T) {
	data := []byte(`{"format_version":"1.bad","terraform_version":"1.12.2","planned_values":{},"configuration":{}}`)
	if _, _, err := Detect(data); err == nil || !strings.Contains(err.Error(), "INPUT_UNRECOGNIZED") {
		t.Fatalf("format accepted: %v", err)
	}
}
