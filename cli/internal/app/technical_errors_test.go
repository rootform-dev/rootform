package app

import (
	"bytes"
	"errors"
	"strings"
	"testing"

	cli "github.com/rootform-dev/rootform/cli/internal/command"
	"github.com/rootform-dev/rootform/cli/policyresult"
)

func TestUnavailableResultSideKeepsHumanCauseAndCode(t *testing.T) {
	result := policyresult.Result{Architectures: []policyresult.Architecture{{Side: "before"}}}
	_, err := resultArchitectures(result, "after", "result.json")
	var failure cli.RunError
	if !errors.As(err, &failure) || failure.Code != cli.ExitNoAnswer || failure.DiagnosticCode != "SIDE_UNAVAILABLE" {
		t.Fatalf("result side error = %#v", err)
	}
	var stderr bytes.Buffer
	cli.WriteTechnicalError(&stderr, failure.Headline, failure.Body, failure.DiagnosticCode)
	if !strings.HasPrefix(stderr.String(), "Error: result.json records no After side; it records only the Before side\n") ||
		!strings.HasSuffix(stderr.String(), "\nCode: SIDE_UNAVAILABLE\n") || strings.Contains(stderr.String(), "rootform: SIDE_UNAVAILABLE:") {
		t.Fatalf("stderr = %q", stderr.String())
	}
}
