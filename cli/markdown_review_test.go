package cli_test

import (
	"bytes"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/rootform-dev/rootform/cli"
	"github.com/rootform-dev/rootform/cli/backend/backendtest"
)

func TestMarkdownReviewReopensFormsWithoutChangingMachineOutput(t *testing.T) {
	for _, name := range []string{"plan", "state", "comparison"} {
		t.Run(name, func(t *testing.T) {
			original := fixture(t, name+".json")
			saved := write(t, name+".json", original)
			report := filepath.Join(t.TempDir(), "report.md")
			machine := filepath.Join(t.TempDir(), "form.json")
			fake := &backendtest.Fake{}
			code, _, stderr := invoke(t, cli.Env{Backend: fake}, "run", saved, "--no-serve", "-o", report, "-o", machine)
			if code != 0 {
				t.Fatalf("exit %d: %s", code, stderr)
			}
			markdown, err := os.ReadFile(report)
			if err != nil {
				t.Fatal(err)
			}
			if !strings.HasPrefix(string(markdown), "## Rootform architecture\n") {
				t.Fatal(string(markdown))
			}
			if name != "state" && !strings.Contains(string(markdown), "| Change | Instances |") {
				t.Fatal(string(markdown))
			}
			if name == "comparison" && !strings.Contains(string(markdown), "| Side | Instances |") {
				t.Fatal(string(markdown))
			}
			output, err := os.ReadFile(machine)
			if err != nil {
				t.Fatal(err)
			}
			if !bytes.Equal(output, original) {
				t.Fatal("Markdown rendering changed saved Form bytes")
			}
			if len(fake.Exports()) != 0 {
				t.Fatal("Markdown rendering recompiled a saved Form")
			}
		})
	}
}
