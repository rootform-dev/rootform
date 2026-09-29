package document

import (
	"bytes"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func write(t *testing.T, size int) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), "document.json")
	if err := os.WriteFile(path, bytes.Repeat([]byte("a"), size), 0o644); err != nil {
		t.Fatal(err)
	}
	return path
}

func TestReadBounded(t *testing.T) {
	t.Run("a document at the ceiling is accepted", func(t *testing.T) {
		data, err := readBounded(bytes.NewReader(bytes.Repeat([]byte("a"), 8)), 8)
		if err != nil {
			t.Fatalf("a document of exactly the ceiling was refused: %v", err)
		}
		if len(data) != 8 {
			t.Fatalf("read %d bytes, want 8", len(data))
		}
	})

	t.Run("one byte past the ceiling is refused", func(t *testing.T) {
		_, err := readBounded(bytes.NewReader(bytes.Repeat([]byte("a"), 9)), 8)
		if !errors.Is(err, errOversized) {
			t.Fatalf("error = %v, want oversized", err)
		}
	})

	t.Run("an oversized document names the limit and the subject", func(t *testing.T) {
		_, err := describe("the plan", nil, errOversized)
		if err == nil || !strings.Contains(err.Error(), Limit()) {
			t.Fatalf("the diagnostic does not name the limit: %v", err)
		}
		if !strings.Contains(err.Error(), "the plan") {
			t.Fatalf("the diagnostic does not name the subject: %v", err)
		}
		if !errors.Is(err, ErrTooLarge) {
			t.Fatalf("an oversized document does not match ErrTooLarge: %v", err)
		}
	})

	t.Run("an unreadable document is not a size refusal", func(t *testing.T) {
		_, err := ReadFile("the plan", filepath.Join(t.TempDir(), "absent.json"))
		if err == nil || errors.Is(err, ErrTooLarge) {
			t.Fatalf("error = %v, want an unreadable document", err)
		}
	})

	t.Run("an oversized file is refused before it is read", func(t *testing.T) {
		path := write(t, 16)
		data, err := readBoundedFile("the plan", path, 8)
		if err == nil || !strings.Contains(err.Error(), Limit()) {
			t.Fatalf("an oversized file was accepted or unnamed: %v (%d bytes)", err, len(data))
		}
	})

	t.Run("a readable file is returned whole", func(t *testing.T) {
		data, err := ReadFile("the plan", write(t, 32))
		if err != nil {
			t.Fatal(err)
		}
		if len(data) != 32 {
			t.Fatalf("read %d bytes, want 32", len(data))
		}
	})

	t.Run("a missing file names the subject and not the path", func(t *testing.T) {
		missing := filepath.Join(t.TempDir(), "absent.json")
		_, err := ReadFile("the plan", missing)
		if err == nil || !strings.Contains(err.Error(), "the plan could not be read") {
			t.Fatalf("error = %v, want a named unreadable plan", err)
		}
		if strings.Contains(err.Error(), missing) {
			t.Fatalf("the diagnostic leaked the absolute path: %v", err)
		}
	})

	t.Run("the stream input needs a stream", func(t *testing.T) {
		_, err := Read("the plan", StreamPath, nil)
		if err == nil || !strings.Contains(err.Error(), "no standard input") {
			t.Fatalf("error = %v, want a missing stream", err)
		}
	})

	t.Run("the stream path reads the caller's stream", func(t *testing.T) {
		data, err := Read("the plan", StreamPath, strings.NewReader("{}"))
		if err != nil {
			t.Fatal(err)
		}
		if string(data) != "{}" {
			t.Fatalf("read %q, want %q", data, "{}")
		}
	})
}
