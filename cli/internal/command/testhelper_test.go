package command

import (
	"bytes"
	"path/filepath"
	"strings"
	"testing"
)

const runtimeDiagnostic = "rootform: the command stopped before it could finish\n\nTry:\n  rootform help\n"

type recorderService struct{ got Options }

func (r *recorderService) Run(o Options) error { r.got = o; return nil }

type checkRecorder struct {
	got    CheckOptions
	called bool
}

func (r *checkRecorder) Check(o CheckOptions) error { r.got, r.called = o, true; return nil }

func newTestEnv(args []string, service AppService) (*Env, *bytes.Buffer, *bytes.Buffer) {
	out, errb := &bytes.Buffer{}, &bytes.Buffer{}
	return &Env{Stdout: out, Stderr: errb, Args: args, Getwd: func() (string, error) { return "/work/proj", nil }, Service: service, Check: &checkRecorder{}}, out, errb
}

// fixtureInput is an input operand the recording services never read.
func fixtureInput() string { return filepath.Join("inputs", "plan.json") }
func assertUsageDiagnostic(t *testing.T, stderr string) {
	t.Helper()
	if !strings.Contains(stderr, "rootform:") || (!strings.Contains(stderr, "Try:") && !strings.Contains(stderr, "Usage:")) {
		t.Fatalf("non-actionable usage diagnostic: %q", stderr)
	}
}
