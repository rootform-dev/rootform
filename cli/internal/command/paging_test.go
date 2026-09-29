package command

import (
	"bytes"
	"io"
	"strings"
	"testing"
)

// TestNoPagerIsReadBeforeTheCommandRuns pins that only --no-pager before "--"
// turns paging off, wherever it stands among the options.
func TestNoPagerIsReadBeforeTheCommandRuns(t *testing.T) {
	for _, test := range []struct {
		args []string
		want bool
	}{
		{args: []string{"check", "plan.json"}, want: true},
		{args: []string{"--no-pager", "check", "plan.json"}, want: false},
		{args: []string{"check", "plan.json", "--no-pager"}, want: false},
		{args: []string{"check", "plan.json", "--no-pager=true"}, want: false},
		{args: []string{"check", "plan.json", "--no-pager=false"}, want: true},
		{args: []string{"run", "--", "--no-pager"}, want: true},
	} {
		if got := requestedPaging(test.args); got != test.want {
			t.Fatalf("requestedPaging(%q) = %v, want %v", test.args, got, test.want)
		}
	}
}

// TestHelpGoesThroughThePager pins that help is a human report written
// through the Page seam, that --no-pager reaches the paging decision, and
// that every command offers --no-pager among its global options.
func TestHelpGoesThroughThePager(t *testing.T) {
	for _, args := range [][]string{{"check", "--help", "--no-pager"}, {"help", "list"}, {"--help"}} {
		var out, errb bytes.Buffer
		requested := []bool{}
		reports := 0
		env := &Env{Stdout: &out, Stderr: &errb, Args: args,
			Paging: func(on bool) { requested = append(requested, on) },
			Page: func(w, _ io.Writer, report []byte) error {
				reports++
				_, err := w.Write(report)
				return err
			}}
		if code := Run(env); code != ExitOK || reports != 1 || errb.Len() != 0 || !strings.Contains(out.String(), "--no-pager") {
			t.Fatalf("%q: exit %d, %d reports, stderr %q\n%s", args, code, reports, errb.String(), out.String())
		}
		wantOn := args[len(args)-1] != "--no-pager"
		if len(requested) == 0 || requested[len(requested)-1] != wantOn {
			t.Fatalf("%q: paging requested %v, want %v", args, requested, wantOn)
		}
	}
}
