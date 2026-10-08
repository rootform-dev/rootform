package server

import (
	"io"
	"io/fs"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"testing/fstest"

	"github.com/rootform-dev/rootform/cli/form"
)

// servedDisplay is the display copy of a saved state Form.
func servedDisplay(t *testing.T) []byte {
	t.Helper()
	fixture, err := os.ReadFile(filepath.Join("..", "..", "form", "testdata", "state.json"))
	if err != nil {
		t.Fatal(err)
	}
	decoded, err := form.Decode(fixture)
	if err != nil {
		t.Fatal(err)
	}
	display, err := form.DisplayJSON(decoded)
	if err != nil {
		t.Fatal(err)
	}
	return display
}

func get(t *testing.T, url string) (int, http.Header, string) {
	t.Helper()
	response, err := http.Get(url)
	if err != nil {
		t.Fatal(err)
	}
	body, err := io.ReadAll(response.Body)
	response.Body.Close()
	if err != nil {
		t.Fatal(err)
	}
	return response.StatusCode, response.Header, string(body)
}

func startServer(t *testing.T, display, presentation []byte, assets fstest.MapFS) string {
	t.Helper()
	var files fs.FS
	if assets != nil {
		files = assets
	}
	server, err := NewDocument(display, presentation, files, 0)
	if err != nil {
		t.Fatal(err)
	}
	addr, err := server.Listen()
	if err != nil {
		t.Fatal(err)
	}
	done := make(chan error, 1)
	go func() { done <- server.Serve() }()
	t.Cleanup(func() { _ = server.Shutdown(); <-done })
	return "http://" + addr.String()
}

func TestDocumentServerServesTheResultAndNothingElse(t *testing.T) {
	display := servedDisplay(t)
	presentation := []byte(`{"format_version":"1","dialects":[]}`)
	assets := fstest.MapFS{
		"index.html":              {Data: []byte("<!doctype html><title>Rootform</title>")},
		"assets/app.js":           {Data: []byte("console.log(1)")},
		"rootform-mark.svg":       {Data: []byte("<svg></svg>")},
		"asset-manifest.json":     {Data: []byte("NOT_SERVED")},
		"THIRD_PARTY_NOTICES.txt": {Data: []byte("NOT_SERVED")},
		"secret.txt":              {Data: []byte("SENTINEL_NOT_SERVED")},
	}
	base := startServer(t, display, presentation, assets)

	status, header, body := get(t, base+"/api/v1/document")
	if status != 200 || body != string(display) || header.Get("Content-Type") != "application/json" {
		t.Fatalf("document endpoint: %d %q", status, header.Get("Content-Type"))
	}
	if header.Get("Content-Security-Policy") != ContentSecurityPolicy || header.Get("X-Content-Type-Options") != "nosniff" || header.Get("Cache-Control") != "no-store" {
		t.Fatalf("security headers missing: %v", header)
	}
	if status, _, body = get(t, base+"/api/v1/presentation"); status != 200 || body != string(presentation) {
		t.Fatalf("presentation endpoint: %d", status)
	}
	if status, _, body = get(t, base+"/"); status != 200 || !strings.Contains(body, "Rootform") {
		t.Fatalf("index: %d", status)
	}
	if status, _, _ = get(t, base+"/assets/app.js"); status != 200 {
		t.Fatalf("asset: %d", status)
	}
	if status, header, body = get(t, base+"/rootform-mark.svg"); status != 200 || header.Get("Content-Type") != "image/svg+xml" || body != "<svg></svg>" {
		t.Fatalf("mark: %d %q %q", status, header.Get("Content-Type"), body)
	}
	for _, path := range []string{"/api/v1/architecture", "/api/v1/events", "/api/v1/raw", "/secret.txt", "/asset-manifest.json", "/THIRD_PARTY_NOTICES.txt", "/assets/../secret.txt", "/inputs/plan.json", "/archives/saved.tfplan"} {
		if status, _, body = get(t, base+path); status != 404 || strings.Contains(body, "SENTINEL") {
			t.Errorf("%s status=%d", path, status)
		}
	}

	request, err := http.NewRequest(http.MethodPost, base+"/api/v1/document", strings.NewReader("x"))
	if err != nil {
		t.Fatal(err)
	}
	response, err := http.DefaultClient.Do(request)
	if err != nil {
		t.Fatal(err)
	}
	response.Body.Close()
	if response.StatusCode != 405 {
		t.Fatalf("POST status=%d", response.StatusCode)
	}

	request, err = http.NewRequest(http.MethodGet, base+"/api/v1/document", nil)
	if err != nil {
		t.Fatal(err)
	}
	request.Host = "rebinding.example:80"
	response, err = http.DefaultClient.Do(request)
	if err != nil {
		t.Fatal(err)
	}
	response.Body.Close()
	if response.StatusCode != 400 {
		t.Fatalf("foreign host status=%d", response.StatusCode)
	}
}

func TestDocumentServerWithoutAssetsAnswersOnlyTheAPI(t *testing.T) {
	display := servedDisplay(t)
	base := startServer(t, display, []byte("{}"), nil)
	if status, _, _ := get(t, base+"/"); status != 404 {
		t.Fatalf("index without assets: %d", status)
	}
	if status, _, _ := get(t, base+"/api/v1/document"); status != 200 {
		t.Fatalf("document without assets: %d", status)
	}
}

func TestDocumentServerRefusesPayloadsThatAreNotJSON(t *testing.T) {
	for _, payload := range [][2][]byte{{nil, []byte("{}")}, {[]byte("{"), []byte("{}")}, {[]byte("{}"), nil}, {[]byte("{}"), []byte("<html>")}} {
		if _, err := NewDocument(payload[0], payload[1], nil, 0); err == nil {
			t.Fatalf("accepted %q / %q", payload[0], payload[1])
		}
	}
	if _, err := NewDocument([]byte("{}"), []byte("{}"), nil, 70000); err == nil {
		t.Fatal("port outside range accepted")
	}
}
