package human

import (
	"bytes"
	"fmt"
	"io"
	"os"
	"os/exec"
	"os/signal"
	"strings"
	"sync/atomic"
	"syscall"
)

// pager is the program a long report opens in. configured marks one named by
// ROOTFORM_PAGER, whose absence is worth a warning; the default less is
// optional.
type pager struct {
	name       string
	args       []string
	configured bool
}

// pagerPolicy is the resolved process-wide paging decision. Its zero value
// keeps every report direct until a command line asks otherwise.
var pagerPolicy atomic.Pointer[pager]

// SetPaging resolves once, before any command writes, whether a long human
// report may open in a pager. --no-pager, a continuous integration run and a
// terminal that cannot drive a pager (TERM unset or dumb) keep every report
// direct. ROOTFORM_PAGER names another pager, or disables paging when empty.
// PAGER is not consulted: it often names a bare less that would wait for a
// key after a short report.
func SetPaging(requested bool, lookup func(string) (string, bool)) {
	if lookup == nil {
		lookup = func(string) (string, bool) { return "", false }
	}
	value := func(name string) string {
		v, _ := lookup(name)
		return v
	}
	terminal := value("TERM")
	if !requested || continuousIntegration(value("CI")) || terminal == "" || terminal == "dumb" {
		pagerPolicy.Store(nil)
		return
	}
	name, args, configured := pagerCommand(lookup)
	if name == "" {
		pagerPolicy.Store(nil)
		return
	}
	pagerPolicy.Store(&pager{name: name, args: args, configured: configured})
}

func continuousIntegration(value string) bool {
	return value != "" && value != "0" && !strings.EqualFold(value, "false")
}

// pagerCommand names the pager. The default less -F exits at once when the
// report fits on one screen, -R passes only the color sequences the report
// carries, and -X leaves the last page on screen; options on its command line
// outrank the reader's LESS variable.
func pagerCommand(lookup func(string) (string, bool)) (string, []string, bool) {
	if value, declared := lookup("ROOTFORM_PAGER"); declared {
		fields := strings.Fields(value)
		if len(fields) == 0 {
			return "", nil, true
		}
		return fields[0], fields[1:], true
	}
	return "less", []string{"-F", "-R", "-X"}, false
}

// Page writes a finished human report to out. When out is an interactive
// terminal and the controlling terminal can supply keys, the report opens in
// the pager, which reads the report from a pipe and its keys from the
// terminal, never from standard input. Anything else writes the whole report
// directly: paging off, a pipe or file, no controlling terminal, and a pager
// that is missing or cannot start. Callers page only after every requested
// file is written, so quitting early never cuts a result short; it is not an
// error, and only a failed direct write is.
func Page(out, errOut io.Writer, report []byte) error {
	if len(report) == 0 || out == nil {
		return nil
	}
	selected := pagerPolicy.Load()
	terminal, ok := pagerTerminal(out)
	if selected == nil || !ok || !controllingTerminal() {
		return writeAll(out, report)
	}
	path, err := exec.LookPath(selected.name)
	if err != nil {
		if selected.configured {
			warnPager(errOut, fmt.Sprintf("the pager %q was not found; the report follows in full", selected.name))
		}
		return writeAll(out, report)
	}
	started, err := runPager(path, selected.args, terminal, report)
	if !started {
		warnPager(errOut, fmt.Sprintf("the pager %q could not start; the report follows in full", selected.name))
		return writeAll(out, report)
	}
	if err != nil {
		return writeAll(out, report)
	}
	return nil
}

// pagerTerminal returns the terminal behind a stream that writes to one, so
// the pager draws on the terminal itself rather than through a pipe.
func pagerTerminal(w io.Writer) (*os.File, bool) {
	if s, ok := w.(stream); ok {
		if !s.terminal {
			return nil, false
		}
		w = s.Writer
	}
	file, ok := w.(*os.File)
	return file, ok && isTerminal(file)
}

// controllingTerminal reports whether this process has a terminal the pager
// can read keys from.
func controllingTerminal() bool {
	tty, err := os.OpenFile("/dev/tty", os.O_RDWR, 0)
	if err != nil {
		return false
	}
	_ = tty.Close()
	return true
}

// runPager shows report and waits until the reader quits. While it runs, an
// interrupt typed at the terminal reaches the pager and leaves rootform
// waiting, and a termination request sent to rootform is passed on, so the
// pager never outlives rootform and restores the terminal itself. A pager
// that exits because it was asked to reports no failure.
func runPager(path string, args []string, terminal *os.File, report []byte) (bool, error) {
	command := exec.Command(path, args...)
	command.Stdin = bytes.NewReader(report)
	command.Stdout = terminal
	command.Stderr = os.Stderr
	command.Env = pagerEnvironment(os.Environ())
	signals := make(chan os.Signal, 1)
	signal.Notify(signals, os.Interrupt, syscall.SIGQUIT, syscall.SIGTERM, syscall.SIGHUP)
	defer signal.Stop(signals)
	if err := command.Start(); err != nil {
		return false, err
	}
	done := make(chan error, 1)
	go func() { done <- command.Wait() }()
	terminated := false
	for {
		select {
		case err := <-done:
			if terminated {
				return true, nil
			}
			return true, err
		case received := <-signals:
			if received == syscall.SIGTERM || received == syscall.SIGHUP {
				terminated = true
				_ = command.Process.Signal(received)
			}
		}
	}
}

// pagerEnvironment gives a pager named by ROOTFORM_PAGER as a bare less the
// same behavior as the default when the reader has not set LESS.
func pagerEnvironment(environment []string) []string {
	for _, entry := range environment {
		if strings.HasPrefix(entry, "LESS=") {
			return environment
		}
	}
	return append(environment, "LESS=FRX")
}

func writeAll(out io.Writer, report []byte) error {
	n, err := out.Write(report)
	if err == nil && n != len(report) {
		err = io.ErrShortWrite
	}
	return err
}

func warnPager(w io.Writer, message string) {
	if w == nil {
		return
	}
	fmt.Fprintln(w, Tint(w, "warning", Warn)+" "+message)
}
