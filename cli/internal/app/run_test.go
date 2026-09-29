package app

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/rootform-dev/rootform/cli/backend"
	"github.com/rootform-dev/rootform/cli/backend/backendtest"
	cli "github.com/rootform-dev/rootform/cli/command"
	"github.com/rootform-dev/rootform/cli/form"
)

func TestRunProgressKeepsTheComparisonDirectionWithinTheReportWidth(t *testing.T) {
	var short bytes.Buffer
	progressDirection(&short, "Comparing", "Before Recorded (state.json)", "-> After Planned (plan.json)")
	if want := "Comparing  Before Recorded (state.json) -> After Planned (plan.json)\n"; short.String() != want {
		t.Fatalf("short = %q, want %q", short.String(), want)
	}
	var long bytes.Buffer
	progressDirection(&long, "Comparing", "Before Planned (commerce/base.json)", "-> After Planned (commerce/head.json)")
	want := "Comparing  Before Planned (commerce/base.json)\n           -> After Planned (commerce/head.json)\n"
	if long.String() != want {
		t.Fatalf("long = %q, want %q", long.String(), want)
	}
	for _, line := range strings.Split(strings.TrimSuffix(long.String(), "\n"), "\n") {
		if len(line) > reportLineWidth {
			t.Fatalf("%q passes %d columns", line, reportLineWidth)
		}
	}
}

type runBrowserProbe struct{ opened chan string }

func (p runBrowserProbe) Open(url string) error {
	select {
	case p.opened <- url:
	default:
	}
	return nil
}

// The explorer serves the display copy and the presentation catalog on
// loopback only, refuses retired endpoints, and stops cleanly when cancelled.
func TestRunServesOnLoopbackUntilCancelled(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	state, err := os.ReadFile(filepath.Join("..", "..", "form", "testdata", "state.json"))
	if err != nil {
		t.Fatal(err)
	}
	input := filepath.Join(t.TempDir(), "form.json")
	if err := os.WriteFile(input, state, 0o600); err != nil {
		t.Fatal(err)
	}
	var out, errb bytes.Buffer
	browser := runBrowserProbe{opened: make(chan string, 1)}
	fake := &backendtest.Fake{PresentationFunc: func(context.Context, backend.Selection, *form.InputForm) backend.Presentation {
		return backend.Presentation{Catalog: []byte("{}")}
	}}
	service := runService{stdout: &out, stderr: &errb, browser: browser, backend: fake, version: "0.1.0"}
	completed := make(chan error, 1)
	go func() { completed <- service.run(ctx, cli.Options{Input: input, Port: 0}) }()
	var url string
	select {
	case url = <-browser.opened:
	case err := <-completed:
		t.Fatalf("server ended early: %v", err)
	case <-time.After(10 * time.Second):
		t.Fatal("browser did not open")
	}
	if !strings.HasPrefix(url, "http://127.0.0.1:") {
		t.Fatalf("non-loopback URL %q", url)
	}
	for path, want := range map[string]int{"api/v1/document": 200, "api/v1/presentation": 200, "api/v1/architecture": 404, "api/v1/events": 404} {
		response, err := http.Get(url + path)
		if err != nil {
			t.Fatal(err)
		}
		body, err := io.ReadAll(response.Body)
		response.Body.Close()
		if err != nil {
			t.Fatal(err)
		}
		if response.StatusCode != want || (want == 200 && !json.Valid(body)) {
			t.Fatalf("%s status=%d", path, response.StatusCode)
		}
	}
	cancel()
	select {
	case err := <-completed:
		if err != nil {
			t.Fatal(err)
		}
	case <-time.After(10 * time.Second):
		t.Fatal("server did not stop")
	}
	if !strings.Contains(errb.String(), "Explorer\n  "+url) {
		t.Fatalf("URL missing from standard error: %s", errb.String())
	}
	if strings.Contains(out.String(), url) {
		t.Fatal("the server address reached standard output")
	}
}
