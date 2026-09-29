package app

import (
	"bytes"
	"io"
	"strings"
	"testing"

	"github.com/rootform-dev/rootform/cli/internal/human"
)

// TestPagedWritesThroughWhenTheStreamIsNotATerminal pins the rule a consumer
// depends on: a redirected or piped stream receives exactly what was written,
// even while paging is requested, so paging never reaches a file or a pipe.
func TestPagedWritesThroughWhenTheStreamIsNotATerminal(t *testing.T) {
	human.SetPaging(true, func(name string) (string, bool) {
		if name == "TERM" {
			return "xterm-256color", true
		}
		return "", false
	})
	t.Cleanup(func() { human.SetPaging(false, nil) })
	var out bytes.Buffer
	report := strings.Repeat("line\n", 500)
	if err := paged(&out, io.Discard, func(writer io.Writer) { io.WriteString(writer, report) }); err != nil {
		t.Fatalf("paged failed: %v", err)
	}
	if out.String() != report {
		t.Fatalf("a redirected report was not written through: %d bytes", out.Len())
	}
}

// TestPagedReportsAFailedWrite pins that a report that cannot reach standard
// output is an error the command turns into its output failure.
func TestPagedReportsAFailedWrite(t *testing.T) {
	err := paged(failingWriter{}, io.Discard, func(writer io.Writer) { io.WriteString(writer, "report\n") })
	if err == nil {
		t.Fatal("a failed write was not reported")
	}
}

type failingWriter struct{}

func (failingWriter) Write([]byte) (int, error) { return 0, io.ErrClosedPipe }
