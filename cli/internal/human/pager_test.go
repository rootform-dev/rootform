package human

import (
	"bytes"
	"io"
	"os"
	"strings"
	"testing"
)

func lookupFrom(environment map[string]string) func(string) (string, bool) {
	return func(name string) (string, bool) {
		value, declared := environment[name]
		return value, declared
	}
}

// TestPagerCommandDefaultsToLessAndHonorsRootformPager pins the one pager
// setting: less -F -R -X by default, ROOTFORM_PAGER to replace or disable it,
// and PAGER left alone because it often names a bare less that waits for a
// key after a short report.
func TestPagerCommandDefaultsToLessAndHonorsRootformPager(t *testing.T) {
	for _, test := range []struct {
		name        string
		environment map[string]string
		want        string
		args        []string
		configured  bool
	}{
		{name: "the default exits on a short report, keeps color and leaves the page", want: "less",
			args: []string{"-F", "-R", "-X"}},
		{name: "PAGER is not consulted", environment: map[string]string{"PAGER": "more"}, want: "less",
			args: []string{"-F", "-R", "-X"}},
		{name: "ROOTFORM_PAGER replaces the pager",
			environment: map[string]string{"ROOTFORM_PAGER": "most -s", "PAGER": "more"},
			want:        "most", args: []string{"-s"}, configured: true},
		{name: "an empty ROOTFORM_PAGER disables paging",
			environment: map[string]string{"ROOTFORM_PAGER": " "}, want: "", configured: true},
	} {
		t.Run(test.name, func(t *testing.T) {
			name, args, configured := pagerCommand(lookupFrom(test.environment))
			if name != test.want || strings.Join(args, " ") != strings.Join(test.args, " ") || configured != test.configured {
				t.Fatalf("pagerCommand = %q %q %v, want %q %q %v", name, args, configured, test.want, test.args, test.configured)
			}
		})
	}
}

// TestSetPagingKeepsReportsDirectWhereNoOneReads pins every condition that
// turns paging off before a stream is even consulted.
func TestSetPagingKeepsReportsDirectWhereNoOneReads(t *testing.T) {
	t.Cleanup(func() { SetPaging(false, nil) })
	terminal := map[string]string{"TERM": "xterm-256color"}
	for _, test := range []struct {
		name        string
		requested   bool
		environment map[string]string
		paged       bool
	}{
		{name: "an interactive terminal pages", requested: true, environment: terminal, paged: true},
		{name: "--no-pager", requested: false, environment: terminal},
		{name: "a CI run", requested: true, environment: map[string]string{"TERM": "xterm", "CI": "true"}},
		{name: "CI=false still pages", requested: true, environment: map[string]string{"TERM": "xterm", "CI": "false"}, paged: true},
		{name: "a dumb terminal", requested: true, environment: map[string]string{"TERM": "dumb"}},
		{name: "no TERM", requested: true, environment: map[string]string{}},
		{name: "an empty ROOTFORM_PAGER", requested: true, environment: map[string]string{"TERM": "xterm", "ROOTFORM_PAGER": ""}},
	} {
		t.Run(test.name, func(t *testing.T) {
			SetPaging(test.requested, lookupFrom(test.environment))
			if got := pagerPolicy.Load() != nil; got != test.paged {
				t.Fatalf("paging = %v, want %v", got, test.paged)
			}
		})
	}
}

// TestPageWritesTheWholeReportWhenItCannotPage pins that a pipe, a file and a
// failed write are each handled without a pager: the first two receive the
// complete report, unchanged, and the last is reported.
func TestPageWritesTheWholeReportWhenItCannotPage(t *testing.T) {
	t.Cleanup(func() { SetPaging(false, nil) })
	report := []byte(strings.Repeat("entry\n", 400))
	SetPaging(true, lookupFrom(map[string]string{"TERM": "xterm", "ROOTFORM_PAGER": "rootform-no-such-pager"}))
	var out, errOut bytes.Buffer
	if err := Page(Stream(&out), &errOut, report); err != nil {
		t.Fatalf("Page failed: %v", err)
	}
	if !bytes.Equal(out.Bytes(), report) || errOut.Len() != 0 {
		t.Fatalf("a redirected report changed: %d bytes, stderr %q", out.Len(), errOut.String())
	}
	file, err := os.CreateTemp(t.TempDir(), "report")
	if err != nil {
		t.Fatal(err)
	}
	defer file.Close()
	if err := Page(Stream(file), &errOut, report); err != nil {
		t.Fatalf("Page to a file failed: %v", err)
	}
	written, err := os.ReadFile(file.Name())
	if err != nil || !bytes.Equal(written, report) {
		t.Fatalf("a file received %d bytes, want %d", len(written), len(report))
	}
	if err := Page(Stream(failing{}), io.Discard, report); err == nil {
		t.Fatal("a failed direct write was not reported")
	}
}

// TestPagerEnvironmentKeepsTheReadersLess pins that a bare less named by
// ROOTFORM_PAGER behaves as the default only when the reader set no LESS.
func TestPagerEnvironmentKeepsTheReadersLess(t *testing.T) {
	if got := pagerEnvironment([]string{"HOME=/x"}); strings.Join(got, " ") != "HOME=/x LESS=FRX" {
		t.Fatalf("pagerEnvironment without LESS = %q", got)
	}
	if got := pagerEnvironment([]string{"LESS=-S"}); strings.Join(got, " ") != "LESS=-S" {
		t.Fatalf("pagerEnvironment with LESS = %q", got)
	}
}

// TestRedirectKeepsTheColorOfTheModelStream pins that output held back from a
// terminal is styled as the terminal would have shown it, so a pager receives
// the same report a reader would have seen directly.
func TestRedirectKeepsTheColorOfTheModelStream(t *testing.T) {
	var held bytes.Buffer
	if Terminal(Redirect(&held, &held)) {
		t.Fatal("a redirected plain stream claims to be a terminal")
	}
	if Redirect(&held, nil) != nil {
		t.Fatal("redirecting to no target produced a writer")
	}
	if _, ok := pagerTerminal(Redirect(&held, &held)); ok {
		t.Fatal("a buffer was taken for a terminal the pager could draw on")
	}
}

type failing struct{}

func (failing) Write([]byte) (int, error) { return 0, io.ErrClosedPipe }
