package human

import (
	"errors"
	"io"
	"os"
	"sync/atomic"
)

// Color modes accepted by the global --color option.
const (
	ModeAuto   = "auto"
	ModeAlways = "always"
	ModeNever  = "never"
)

// Status classifies a reported outcome so color reinforces a word the reader
// can already read. Color never carries meaning on its own.
type Status int

const (
	// Neutral is a statement that reports no outcome.
	Neutral Status = iota
	// Good is a confirmed positive outcome.
	Good
	// Bad is a confirmed negative outcome.
	Bad
	// Warn is a modified or partial outcome.
	Warn
	// Unknown is an outcome that could not be determined.
	Unknown
)

const (
	reset     = "\x1b[0m"
	boldSeq   = "\x1b[1m"
	dimSeq    = "\x1b[2m"
	emberSeq  = "\x1b[38;5;208m"
	greenSeq  = "\x1b[32m"
	redSeq    = "\x1b[31m"
	yellowSeq = "\x1b[33m"
)

const (
	colorOff int32 = iota
	colorTerminal
	colorAlways
)

// colorPolicy is the resolved process-wide color decision. Its zero value
// keeps every embedded caller plain until a command line asks otherwise.
var colorPolicy atomic.Int32

// SetColorMode resolves the process-wide color decision once, before any
// command writes. NO_COLOR and TERM=dumb state that the terminal cannot render
// color, so they disable it for the default mode; an explicit --color always
// remains the escape hatch that overrides them.
func SetColorMode(mode string, getenv func(string) string) error {
	if getenv == nil {
		getenv = func(string) string { return "" }
	}
	switch mode {
	case ModeNever:
		colorPolicy.Store(colorOff)
		return nil
	case ModeAlways:
		colorPolicy.Store(colorAlways)
		return nil
	case ModeAuto, "":
		if getenv("NO_COLOR") != "" || getenv("TERM") == "dumb" {
			colorPolicy.Store(colorOff)
			return nil
		}
		colorPolicy.Store(colorTerminal)
		return nil
	default:
		colorPolicy.Store(colorOff)
		return errors.New(mode + " is not a color mode")
	}
}

// Stream attaches human styling to one output stream. The color decision is
// taken per write against the resolved mode, so a stream opened before the
// command line is parsed still honors it.
func Stream(w io.Writer) io.Writer {
	if w == nil {
		return nil
	}
	return stream{Writer: w, terminal: isTerminal(w)}
}

type stream struct {
	io.Writer
	terminal bool
}

func (s stream) colored() bool {
	switch colorPolicy.Load() {
	case colorAlways:
		return true
	case colorTerminal:
		return s.terminal
	default:
		return false
	}
}

// Redirect sends text to target while styling it exactly as model would, so
// output held back from a terminal keeps the color a reader would have seen.
func Redirect(model, target io.Writer) io.Writer {
	if target == nil {
		return nil
	}
	return stream{Writer: target, terminal: Terminal(model)}
}

// Terminal reports whether a stream writes to an interactive terminal.
func Terminal(w io.Writer) bool {
	if s, ok := w.(stream); ok {
		return s.terminal
	}
	return isTerminal(w)
}

func isTerminal(w io.Writer) bool {
	file, ok := w.(*os.File)
	if !ok {
		return false
	}
	info, err := file.Stat()
	return err == nil && info.Mode()&os.ModeCharDevice != 0
}

// Colored reports whether a stream currently carries color.
func Colored(w io.Writer) bool {
	s, ok := w.(stream)
	return ok && s.colored()
}

func colored(w io.Writer) bool { return Colored(w) }

func paint(w io.Writer, code, text string) string {
	if text == "" || code == "" || !colored(w) {
		return text
	}
	return code + text + reset
}

func statusColor(status Status) string {
	switch status {
	case Good:
		return greenSeq
	case Bad:
		return redSeq
	case Warn:
		return yellowSeq
	default:
		return ""
	}
}

// Accent renders the product accent used for structure and headings.
func Accent(w io.Writer, text string) string { return paint(w, boldSeq+emberSeq, text) }

// Dim renders secondary metadata that must not compete with the result.
func Dim(w io.Writer, text string) string { return paint(w, dimSeq, text) }

// Emphasis renders a word that carries the outcome of a command.
func Emphasis(w io.Writer, text string, status Status) string {
	return paint(w, boldSeq+statusColor(status), text)
}

// Tint colors a word by outcome without emphasizing it.
func Tint(w io.Writer, text string, status Status) string {
	return paint(w, statusColor(status), text)
}
