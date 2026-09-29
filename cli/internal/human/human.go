// Package human provides small, plain-text rendering primitives for CLI
// reports. Every primitive degrades to plain text: color emphasizes a
// hierarchy the words already carry, and never carries meaning alone.
package human

import (
	"fmt"
	"io"
	"strings"
	"unicode/utf8"
)

// Result states the outcome of one command in its own words.
func Result(w io.Writer, text string) { Verdict(w, text, Neutral) }

// Verdict states the outcome of one command and classifies it, so a terminal
// can reinforce a word the reader can read without color.
func Verdict(w io.Writer, text string, status Status) {
	fmt.Fprintln(w, Emphasis(w, text, status))
}

// Section opens a named block of related lines.
func Section(w io.Writer, title string) {
	fmt.Fprintf(w, "\n%s\n", Accent(w, title))
}

func Empty(w io.Writer, subject string) { fmt.Fprintf(w, "No %s.\n", subject) }

// Summary aligns present values without exposing empty implementation fields.
func Summary(w io.Writer, rows ...[2]string) {
	width := 0
	for _, row := range rows {
		if row[1] != "" && utf8.RuneCountInString(row[0]) > width {
			width = utf8.RuneCountInString(row[0])
		}
	}
	for _, row := range rows {
		if row[1] == "" {
			continue
		}
		lines := strings.Split(row[1], "\n")
		gap := strings.Repeat(" ", width-utf8.RuneCountInString(row[0])+2)
		fmt.Fprintf(w, "%s%s%s\n", Dim(w, row[0]), gap, lines[0])
		for _, line := range lines[1:] {
			fmt.Fprintf(w, "%s%s\n", strings.Repeat(" ", width+2), line)
		}
	}
}

// Items lists indented values under the line that names them.
func Items(w io.Writer, items ...string) {
	for _, item := range items {
		fmt.Fprintf(w, "  %s\n", item)
	}
}

// Failure states an operational error that stopped a command before it could
// produce its result. The cause comes first on its own line; structured detail
// follows it, so a reader never has to unpack a chain of colons.
func Failure(w io.Writer, cause string, detail ...string) {
	lines := strings.Split(cause, "\n")
	fmt.Fprintln(w, Tint(w, "rootform: ", Bad)+lines[0])
	for _, line := range lines[1:] {
		fmt.Fprintln(w, line)
	}
	if len(detail) == 0 {
		return
	}
	fmt.Fprintln(w)
	for _, line := range detail {
		fmt.Fprintln(w, line)
	}
}
