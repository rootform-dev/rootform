package export

import (
	"bytes"
	"encoding/json"
	"errors"
	"strings"
	"testing"
)

const shell = `<!doctype html><html><head><meta charset="utf-8"></head><body>` +
	Placeholder + PresentationPlaceholder + `<script type="module">start()</script></body></html>`

const emptyPresentation = `{"format_version":"1","resources":{},"rules":{},"concepts":{},"resource_labels":{},"rule_labels":{},"concept_labels":{}}`

func TestExportIsSelfContained(t *testing.T) {
	rendered, err := Render([]byte(shell), []byte(`{"format_version":"1"}`), []byte(emptyPresentation))
	if err != nil {
		t.Fatal(err)
	}
	page := string(rendered)
	for _, remote := range []string{"http://", "https://", "//cdn", "integrity="} {
		if strings.Contains(page, remote) {
			t.Fatalf("the artifact references a remote origin %q: %s", remote, page)
		}
	}
	if strings.Count(page, documentOpenMarker) != 1 || strings.Count(page, presentationOpenMarker) != 1 {
		t.Fatalf("the artifact does not carry exactly one document element: %s", page)
	}
	if strings.Contains(page, Placeholder) || strings.Contains(page, PresentationPlaceholder) {
		t.Fatalf("the placeholder survived substitution: %s", page)
	}
}

func TestEmbeddedDocumentCannotEscape(t *testing.T) {
	hostile := map[string]string{
		"name": "</script><script>alert(1)</script>",
		"note": "a & b <tag> \u2028 \u2029",
	}
	canonical, err := json.Marshal(hostile)
	if err != nil {
		t.Fatal(err)
	}
	rendered, err := Render([]byte(shell), canonical, []byte(emptyPresentation))
	if err != nil {
		t.Fatal(err)
	}
	page := string(rendered)

	// Exactly three script elements remain: document, presentation, module.
	if got := strings.Count(page, "<script"); got != 3 {
		t.Fatalf("script element count = %d, want 3: %s", got, page)
	}
	if strings.Contains(page, "alert(1)") && !strings.Contains(page, `\u003c`) {
		t.Fatalf("the payload was embedded unescaped: %s", page)
	}
	for _, forbidden := range []string{"</script><script>", "\u2028", "\u2029"} {
		if strings.Contains(payload(t, page, documentOpenMarker), forbidden) {
			t.Fatalf("the embedded payload carries %q verbatim", forbidden)
		}
	}

	var decoded map[string]string
	if err := json.Unmarshal([]byte(payload(t, page, documentOpenMarker)), &decoded); err != nil {
		t.Fatalf("the embedded payload is not valid JSON: %v", err)
	}
	for key, want := range hostile {
		if decoded[key] != want {
			t.Fatalf("%s decoded as %q, want %q", key, decoded[key], want)
		}
	}
}

func TestExportIsDeterministic(t *testing.T) {
	canonical := []byte(`{"format_version":"1","name":"a & b"}`)
	first, err := Render([]byte(shell), canonical, []byte(emptyPresentation))
	if err != nil {
		t.Fatal(err)
	}
	second, err := Render([]byte(shell), canonical, []byte(emptyPresentation))
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(first, second) {
		t.Fatal("two exports of one document are not byte-identical")
	}
}

func TestPresentationChangesHTMLWithoutChangingArchitectureInput(t *testing.T) {
	canonical := []byte(`{"format_version":"1","kind":"state"}`)
	firstPresentation := []byte(`{"format_version":"1","rules":{},"concepts":{},"rule_labels":{"google.rule.gke":"GKE cluster"},"concept_labels":{}}`)
	secondPresentation := []byte(`{"format_version":"1","rules":{},"concepts":{},"rule_labels":{"google.rule.gke":"Google Kubernetes Engine cluster"},"concept_labels":{}}`)
	first, err := Render([]byte(shell), canonical, firstPresentation)
	if err != nil {
		t.Fatal(err)
	}
	second, err := Render([]byte(shell), canonical, secondPresentation)
	if err != nil {
		t.Fatal(err)
	}
	if bytes.Equal(first, second) {
		t.Fatal("presentation change did not change HTML bytes")
	}
	if got := payload(t, string(first), documentOpenMarker); got != string(canonical) {
		t.Fatalf("embedded document changed: %s", got)
	}
	if got := payload(t, string(second), documentOpenMarker); got != string(canonical) {
		t.Fatalf("embedded document changed: %s", got)
	}
	if got := payload(t, string(first), presentationOpenMarker); got != string(firstPresentation) {
		t.Fatalf("embedded presentation = %s", got)
	}
}

func TestRenderRefusesAnUnusableShell(t *testing.T) {
	if _, err := Render(nil, []byte("{}"), []byte(emptyPresentation)); !errors.Is(err, ErrNoShell) {
		t.Fatalf("error = %v, want ErrNoShell", err)
	}
	if _, err := Render([]byte("<html></html>"), []byte("{}"), []byte(emptyPresentation)); !errors.Is(err, ErrShellUnusable) {
		t.Fatalf("error = %v, want ErrShellUnusable", err)
	}
	if _, err := Render([]byte(Placeholder), []byte("{}"), []byte(emptyPresentation)); !errors.Is(err, ErrShellUnusable) {
		t.Fatalf("missing presentation error = %v, want ErrShellUnusable", err)
	}
	duplicate := []byte(Placeholder + Placeholder + PresentationPlaceholder)
	if _, err := Render(duplicate, []byte("{}"), []byte(emptyPresentation)); !errors.Is(err, ErrShellUnusable) {
		t.Fatalf("duplicate placeholder error = %v, want ErrShellUnusable", err)
	}
}

// payload returns the text the document element carries.
func payload(t *testing.T, page, openMarker string) string {
	t.Helper()
	start := strings.Index(page, openMarker)
	if start < 0 {
		t.Fatalf("the artifact carries no document element: %s", page)
	}
	start += len(openMarker)
	end := strings.Index(page[start:], closeMarker)
	if end < 0 {
		t.Fatalf("the document element is unterminated: %s", page)
	}
	return page[start : start+end]
}
