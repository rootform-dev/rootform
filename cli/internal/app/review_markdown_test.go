package app

import (
	"fmt"
	"strings"
	"testing"

	"github.com/rootform-dev/rootform/cli/form"
)

// outsideCode keeps the parts of a Markdown line outside its code spans, with
// their backslash escapes.
func outsideCode(line string) string {
	var b strings.Builder
	for i := 0; i < len(line); {
		switch {
		case line[i] == '\\' && i+1 < len(line):
			b.WriteString(line[i : i+2])
			i += 2
		case line[i] == '`':
			n := 0
			for i+n < len(line) && line[i+n] == '`' {
				n++
			}
			end := strings.Index(line[i+n:], strings.Repeat("`", n))
			if end < 0 {
				b.WriteString(line[i:])
				return b.String()
			}
			i += n + end + n
		default:
			b.WriteByte(line[i])
			i++
		}
	}
	return b.String()
}

// assertInertReview checks that a review document's structure is Rootform's
// alone: folds balance, no line starts with markup taken from data, no
// unescaped angle bracket or control character survives outside a code span,
// and every row of a table has as many cells as its header.
func assertInertReview(t *testing.T, doc string, folds int) {
	t.Helper()
	if strings.ContainsRune(doc, 0x1b) || strings.ContainsRune(doc, 0x202e) || strings.ContainsRune(doc, '\r') {
		t.Fatalf("control character in review: %q", doc)
	}
	cells, opened, closed, summaries := -1, 0, 0, 0
	for _, line := range strings.Split(doc, "\n") {
		trimmed := strings.TrimLeft(line, " ")
		switch {
		case line == "<details>":
			opened++
			continue
		case line == "</details>":
			closed++
			if closed > opened {
				t.Fatalf("fold closed before it opened:\n%s", doc)
			}
			continue
		case strings.HasPrefix(line, "<summary>"):
			summaries++
			if !strings.HasSuffix(line, "</summary>") || strings.ContainsAny(strings.TrimSuffix(strings.TrimPrefix(line, "<summary>"), "</summary>"), "<>&`*") {
				t.Fatalf("summary holds markup: %q", line)
			}
			continue
		case strings.HasPrefix(trimmed, "- <"), strings.HasPrefix(trimmed, "<"):
			t.Fatalf("line starts with markup: %q", line)
		}
		rest := strings.ReplaceAll(outsideCode(line), "\\<", "")
		if strings.Contains(rest, "<") {
			t.Fatalf("unescaped markup outside code: %q", line)
		}
		if !strings.HasPrefix(line, "|") {
			cells = -1
			continue
		}
		if n := unescapedPipes(line); cells < 0 {
			cells = n
		} else if n != cells {
			t.Fatalf("row splits into %d cells, header %d: %q", n-1, cells-1, line)
		}
	}
	if opened != folds || closed != folds || summaries != folds {
		t.Fatalf("%d folds opened, %d closed, %d summaries, want %d:\n%s", opened, closed, summaries, folds, doc)
	}
}

func plannedChanges(added, removed int) *form.Comparison {
	c := &form.Comparison{Name: form.ComparisonChanges, Before: form.StageRefreshed, After: form.StagePlanned, Comparable: true}
	for i := range added {
		c.Representations = append(c.Representations, form.RepresentationChange{Change: form.ChangeAdded, Representation: fmt.Sprintf("object.added.%02d", i)})
	}
	for i := range removed {
		c.Representations = append(c.Representations, form.RepresentationChange{Change: form.ChangeRemoved, Representation: fmt.Sprintf("object.removed.%02d", i)})
	}
	c.Counts.RepresentationsAdded, c.Counts.RepresentationsRemoved = added, removed
	return c
}

func withFacts(c *form.Comparison, kind form.FactKind, change form.ChangeKind, ids ...string) *form.Comparison {
	for _, id := range ids {
		c.Facts = append(c.Facts, form.FactChange{Change: change, Kind: kind, Fact: id})
	}
	return c
}

// The conclusion counts each kind apart: it never adds instances, Relations,
// Contexts and Contributions into one number of changes.
func TestReviewConclusionCountsEachKindApart(t *testing.T) {
	for _, tc := range []struct {
		c     *form.Comparison
		cross bool
		want  string
	}{
		{withFacts(plannedChanges(3, 0), form.FactContext, form.ChangeAdded, "context:rf.context.network:a:b", "context:rf.context.network:b:c"), false, "3 resource instances and 2 Contexts added."},
		{withFacts(plannedChanges(0, 0), form.FactContribution, form.ChangeAdded, "contribution:a:b"), false, "1 Contribution added."},
		{withFacts(withFacts(plannedChanges(0, 0), form.FactContribution, form.ChangeAdded, "contribution:a:b"), form.FactContribution, form.ChangeRemoved, "contribution:a:c"), false, "1 Contribution added, 1 removed."},
		{withFacts(plannedChanges(2, 0), form.FactRelation, form.ChangeRemoved, "relation:rf.relation.routes-to:a:b"), false, "Changes to 2 resource instances and 1 Relation."},
		{withFacts(plannedChanges(2, 0), form.FactRelation, form.ChangeRemoved, "relation:rf.relation.routes-to:a:b"), true, "Differences in 2 resource instances and 1 Relation."},
		{plannedChanges(0, 0), false, "No architectural difference determined under the selected Dialects."},
	} {
		if got := changeWords(tc.c, tc.cross); got != tc.want {
			t.Errorf("got %q, want %q", got, tc.want)
		}
	}
}

// A list of at most ten entries is written whole and unfolded; a longer one is
// folded under a summary naming its counts and how many entries it shows, and
// its preview keeps every status visible. --details lists every entry.
func TestReviewFoldsOnlyListsLongerThanThePreview(t *testing.T) {
	for _, tc := range []struct {
		added, removed int
		title          string
	}{
		{10, 0, "**Resource instances: 10 added**\n"},
		{11, 0, "<summary>Resource instances: 11 added (10 of 11 shown)</summary>\n"},
		{11, 1, "<summary>Resource instances: 11 added, 1 removed (10 of 12 shown)</summary>\n"},
	} {
		rep := runReport{verdict: "Plan analyzed", blocks: []reportBlock{comparisonBlock("Planned changes", plannedChanges(tc.added, tc.removed), nil, nil, false, true)}}
		md := string(rep.markdown())
		folded := tc.added+tc.removed > reportTextLimit
		if !strings.Contains(md, tc.title) || strings.Contains(md, reviewPreview) != folded {
			t.Fatalf("%d added, %d removed:\n%s", tc.added, tc.removed, md)
		}
		assertInertReview(t, md, map[bool]int{false: 0, true: 1}[folded])
		if tc.removed > 0 && (!strings.Contains(md, "- Removed\n  - `object.removed.00`\n") || !strings.Contains(md, "- Added \\(9 of 11 shown\\)\n")) {
			t.Fatalf("preview hides a status:\n%s", md)
		}
		rep.details = true
		full := string(rep.markdown())
		last := fmt.Sprintf("object.added.%02d", tc.added-1)
		if !strings.Contains(full, last) || strings.Contains(full, "shown") || strings.Contains(full, reviewPreview) {
			t.Fatalf("--details review:\n%s", full)
		}
	}
}

// A preview keeps one entry of every status a list holds, however rare: an
// instance changed or planned for replacement among many added ones, and a
// drift entry whose architectural effect is indeterminate among architectural
// ones. Each status keeps its exact count, and --details lists every entry.
func TestReviewPreviewKeepsRareStatuses(t *testing.T) {
	c := plannedChanges(12, 0)
	c.Representations = append(c.Representations,
		form.RepresentationChange{Change: form.ChangeReplaced, Representation: "object.replaced.00"},
		form.RepresentationChange{Change: form.ChangeChanged, Representation: "object.changed.00", Fields: []string{form.FieldConcept}})
	c.Counts = form.DeriveComparisonCounts(c)
	changes := runReport{verdict: "Plan analyzed", blocks: []reportBlock{comparisonBlock("Planned changes", c, nil, nil, false, true)}}

	inputForm := &form.InputForm{Kind: form.KindPlan, DriftReport: &form.DriftReport{}}
	for i := range 12 {
		inputForm.DriftReport.Entries = append(inputForm.DriftReport.Entries, form.DriftEntry{Address: fmt.Sprintf("object.drifted.%02d", i), Actions: []string{"update"}, Consequence: form.DriftArchitectural, FactChanges: []string{fmt.Sprintf("drift:%02d", i)}})
	}
	inputForm.DriftReport.Entries = append(inputForm.DriftReport.Entries, form.DriftEntry{Address: "object.undecided", Actions: []string{"update"}, Consequence: form.DriftIndeterminate})
	drift := runReport{verdict: "Plan analyzed", blocks: []reportBlock{driftBlock(inputForm, nil)}}

	for _, tc := range []struct {
		rep     runReport
		preview []string
		last    string
	}{
		{changes, []string{"<summary>Resource instances: 12 added, 1 changed, 1 planned for replacement (10 of 14 shown)</summary>\n\n", "- Added \\(8 of 12 shown\\)\n", "- Changed\n  - `object.changed.00`: concept\n", "- Planned for replacement\n  - `object.replaced.00`\n", "</details>\n"}, "object.added.11"},
		{drift, []string{"**13 drift entries reported: 12 architectural, 1 indeterminate.**\n", "<summary>Drift entries: 13 (10 of 13 shown)</summary>\n\n", "- `object.drifted.08`: changes the architecture; 1 fact change\n", "- `object.undecided`: architectural effect indeterminate\n", "</details>\n"}, "object.drifted.11"},
	} {
		md := string(tc.rep.markdown())
		assertInertReview(t, md, 1)
		inOrder(t, md, append(tc.preview, reviewPreview)...)
		if strings.Contains(md, tc.last) {
			t.Fatalf("the preview shows more than ten entries:\n%s", md)
		}
		tc.rep.details = true
		full := string(tc.rep.markdown())
		assertInertReview(t, full, 1)
		if !strings.Contains(full, tc.last) || strings.Contains(full, "shown") || strings.Contains(full, reviewPreview) {
			t.Fatalf("--details review:\n%s", full)
		}
	}
}

// Untrusted addresses, types and input names stay data in a run review: they
// never close a fold, open markup, split a table cell or start a line.
func TestRunReviewKeepsDataInert(t *testing.T) {
	evil := "`|`</details><script>alert(1)</script>\u202e\n# title"
	c := plannedChanges(11, 0)
	c.Representations[3].Representation = "object." + evil
	c = withFacts(c, form.FactRelation, form.ChangeAdded, "relation:rf.relation.routes-to:gate"+evil+":object.added.00")
	limited := reportBlock{title: "Limited interpretation", role: roleLimited, lead: []string{"None of the instances matched a Rule."}, table: &reportTable{header: []string{"Resource type", "Instances"}, rows: [][]string{{"type" + evil, "1"}}, literal: true, numeric: true}}
	rep := runReport{verdict: "Plan analyzed", literal: map[string]bool{"Input": true}, head: [][2]string{{"Input", "plan" + evil + ".json"}}, blocks: []reportBlock{limited, comparisonBlock("Planned changes", c, nil, nil, false, true)}}
	for _, details := range []bool{false, true} {
		rep.details = details
		md := string(rep.markdown())
		assertInertReview(t, md, 1)
		if !strings.Contains(md, "`` object.`|`</details><script>alert(1)</script>\\u202e\\u000a# title ``") {
			t.Fatalf("address is not kept whole:\n%s", md)
		}
	}
}
