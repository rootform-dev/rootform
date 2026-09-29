package command

import (
	"errors"
	"strings"
	"testing"
)

type recordingLanguageServer struct {
	called bool
	err    error
}

func (s *recordingLanguageServer) Run() error {
	s.called = true
	return s.err
}

func TestLSPCommand(t *testing.T) {
	service := &recordingLanguageServer{}
	env, stdout, stderr := newTestEnv([]string{"lsp"}, &recorderService{})
	env.LSP = service
	if code := Run(env); code != ExitOK {
		t.Fatalf("Run() = %d, stderr = %q", code, stderr.String())
	}
	if !service.called || stdout.Len() != 0 || stderr.Len() != 0 {
		t.Fatalf("called = %v, stdout = %q, stderr = %q", service.called, stdout, stderr)
	}
}

func TestLSPCommandRejectsArguments(t *testing.T) {
	service := &recordingLanguageServer{}
	env, _, stderr := newTestEnv([]string{"lsp", "tcp"}, &recorderService{})
	env.LSP = service
	if code := Run(env); code != ExitUsage {
		t.Fatalf("Run() = %d, want %d", code, ExitUsage)
	}
	if service.called || stderr.Len() == 0 {
		t.Fatalf("called = %v, stderr = %q", service.called, stderr)
	}
}

func TestLSPCommandHidesInternalFailure(t *testing.T) {
	service := &recordingLanguageServer{err: errors.New("private protocol frame")}
	env, _, stderr := newTestEnv([]string{"lsp"}, &recorderService{})
	env.LSP = service
	if code := Run(env); code != ExitFailure {
		t.Fatalf("Run() = %d, want %d", code, ExitFailure)
	}
	if text := stderr.String(); text == "" || strings.Contains(text, "private protocol frame") {
		t.Fatalf("stderr = %q", text)
	}
}
