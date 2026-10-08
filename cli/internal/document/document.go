// Package document reads one Rootform input document — a plan in JSON format
// or an architecture file — from a path or from the caller's stream, under one
// explicit ceiling shared by every command. It decodes nothing: what a
// document means stays with the consumer that understands it.
package document

import (
	"errors"
	"fmt"
	"io"
	"os"
)

// MaxBytes bounds one document so a file or a pipe a user does not control
// cannot make a command allocate without limit. It is generous enough for a
// plan describing a large estate and small enough to stay a refusal rather
// than an exhausted machine.
const MaxBytes = 128 * 1024 * 1024

// StreamPath is the path a user writes to mean the caller's input stream.
const StreamPath = "-"

var (
	errUnreadable = errors.New("unreadable")
	errOversized  = errors.New("oversized")
)

// ErrTooLarge matches a document refused for exceeding MaxBytes, so a caller
// tells a refusal apart from a document that could not be read.
var ErrTooLarge = errors.New("document exceeds the ceiling")

// Limit renders the ceiling the way a diagnostic states it.
func Limit() string { return fmt.Sprintf("%d MiB", MaxBytes/(1024*1024)) }

// Read returns the document at path, or the one arriving on stream for "-".
// The subject names what the caller asked for, so a diagnostic reads as the
// user's own request rather than as a generic file error.
func Read(subject, path string, stream io.Reader) ([]byte, error) {
	if path == StreamPath {
		return ReadStream(stream)
	}
	return ReadFile(subject, path)
}

// ReadFile returns the document at path.
func ReadFile(subject, path string) ([]byte, error) {
	return readBoundedFile(subject, path, MaxBytes)
}

func readBoundedFile(subject, path string, max int64) ([]byte, error) {
	file, err := os.Open(path)
	if err != nil {
		return nil, fmt.Errorf("%s could not be read", subject)
	}
	defer file.Close()
	// A regular file states its size, so an oversized one is refused before
	// anything is allocated for it.
	if info, err := file.Stat(); err == nil && info.Mode().IsRegular() &&
		info.Size() > max {
		return nil, oversized(subject)
	}
	data, err := readBounded(file, max)
	return describe(subject, data, err)
}

// ReadStream returns the document arriving on stream.
func ReadStream(stream io.Reader) ([]byte, error) {
	if stream == nil {
		return nil, errors.New("no standard input is available to read")
	}
	data, err := readBounded(stream, MaxBytes)
	return describe("standard input", data, err)
}

// readBounded reads at most max bytes and reports anything beyond it as
// oversized. Reading one byte past the ceiling is what distinguishes a
// document that exactly fills it from one that exceeds it.
func readBounded(reader io.Reader, max int64) ([]byte, error) {
	data, err := io.ReadAll(io.LimitReader(reader, max+1))
	if err != nil {
		return nil, errUnreadable
	}
	if int64(len(data)) > max {
		return nil, errOversized
	}
	return data, nil
}

func describe(subject string, data []byte, err error) ([]byte, error) {
	switch {
	case errors.Is(err, errOversized):
		return nil, oversized(subject)
	case err != nil:
		return nil, fmt.Errorf("%s could not be read", subject)
	default:
		return data, nil
	}
}

func oversized(subject string) error {
	return oversizedError{subject: subject}
}

type oversizedError struct{ subject string }

func (e oversizedError) Error() string {
	return fmt.Sprintf("%s exceeds the %s a document may occupy", e.subject, Limit())
}

func (oversizedError) Is(target error) bool { return target == ErrTooLarge }
