package app

import (
	"bytes"
	"io"

	"github.com/rootform-dev/rootform/cli/human"
)

// paged renders a finished human report, styled for out, then writes it
// through human.Page. It reports only a failed direct write.
func paged(out, stderr io.Writer, write func(io.Writer)) error {
	var report bytes.Buffer
	write(human.Redirect(out, &report))
	return human.Page(out, stderr, report.Bytes())
}
