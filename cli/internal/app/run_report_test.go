package app

import (
	"bytes"
	"fmt"
	"reflect"
	"strings"
	"testing"
	"unicode/utf8"

	"github.com/rootform-dev/rootform/cli/form"
)

// A plan JSON without resource_drift reports no drift; it does not prove that
// drift was assessed, and it never proves the absence of drift.
func TestDriftBlockStatesWhatAbsentRecordsProve(t *testing.T) {
	limits := "Plan JSON does not record whether refresh was limited (-refresh=false, -target); an unrefreshed object reports no drift; data sources and deposed objects are outside drift records."
	scope := "The export does not establish the refresh scope."
	absent := &form.InputForm{
		Evidence:    form.Evidence{Scope: form.Scope{DriftRecords: form.DriftRecordsAbsent}},
		DriftReport: &form.DriftReport{Entries: []form.DriftEntry{}, Summary: "No drift reported in this plan"},
	}
	want := []string{"No drift reported in this plan.", scope}
	if got := driftBlock(absent, nil); !reflect.DeepEqual(got.lines, want) || !reflect.DeepEqual(got.notes, []string{driftRecordsAbsent, limits}) || len(got.lead) != 0 || len(got.tail) != 0 {
		t.Fatalf("absent drift records: got %q / %q, want %q", got.lines, got.notes, want)
	}
	present := &form.InputForm{
		Evidence: form.Evidence{Scope: form.Scope{DriftRecords: form.DriftRecordsPresent}},
		DriftReport: &form.DriftReport{Entries: []form.DriftEntry{{
			ID: "drift:local_file.a", Address: "local_file.a", Actions: []string{"delete"}, Consequence: form.DriftArchitectural,
		}}},
	}
	block := driftBlock(present, nil)
	if !reflect.DeepEqual(block.lead, []string{"Recorded -> Refreshed", scope}) || !reflect.DeepEqual(block.notes, []string{limits}) || len(block.groups) != 1 || len(block.groups[0].items) != 1 {
		t.Fatalf("present drift records: lead %q, notes %q, groups %v", block.lead, block.notes, block.groups)
	}
}

func reportText(rep runReport) string {
	var b bytes.Buffer
	rep.writeText(&b)
	return b.String()
}

// A preview spreads its budget over every kind and status a comparison holds,
// so removals and small fact kinds stay visible beside many additions, and
// each list states how many of each status it shows.
func TestComparisonPreviewSpreadsKindsAndStatuses(t *testing.T) {
	c := &form.Comparison{Before: form.StageRefreshed, After: form.StagePlanned, Comparable: true}
	for i := range 12 {
		c.Representations = append(c.Representations, form.RepresentationChange{Change: form.ChangeAdded, Representation: fmt.Sprintf("object.added.%02d", i)})
	}
	for i := range 7 {
		c.Representations = append(c.Representations, form.RepresentationChange{Change: form.ChangeRemoved, Representation: fmt.Sprintf("object.removed.%02d", i)})
	}
	for i := range 7 {
		c.Facts = append(c.Facts, form.FactChange{Change: form.ChangeAdded, Kind: form.FactContribution, Fact: fmt.Sprintf("contribution:part.%02d:whole", i)})
	}
	c.Facts = append(c.Facts, form.FactChange{Change: form.ChangeRemoved, Kind: form.FactRelation, Fact: "relation:rf.relation.routes-to:gateway:object.removed.00"})
	c.Counts.RepresentationsAdded, c.Counts.RepresentationsRemoved, c.Counts.FactsAdded, c.Counts.FactsRemoved = 12, 7, 7, 1
	block := comparisonBlock("Planned changes", c, nil, nil, false, true)
	rep := runReport{verdict: "Plan analyzed", blocks: []reportBlock{block}}
	text := reportText(rep)
	for _, want := range []string{
		"Instances               12 added, 7 removed\n",
		"10 of 19 instance changes shown: 5 of 12 added, 5 of 7 removed.\n",
		"- object.removed.04",
		"- gateway  routes-to -> object.removed.00  removed\n",
		"+ part.00  contribution -> whole  added\n",
		"4 of 7 Contribution changes shown.\n",
	} {
		if !strings.Contains(text, want) {
			t.Fatalf("preview lacks %q:\n%s", want, text)
		}
	}
	if strings.Count(text, displayAll) != 1 || strings.Contains(text, "object.added.05") || strings.Contains(text, "object.removed.05") || strings.Contains(text, "part.04") {
		t.Fatalf("preview budget:\n%s", text)
	}
	shown := 0
	for _, group := range block.preview(false) {
		shown += len(group)
	}
	if shown != reportPreviewLimit {
		t.Fatalf("preview shows %d entries, want %d", shown, reportPreviewLimit)
	}
	rep.complete = true
	complete := reportText(rep)
	if !strings.Contains(complete, "object.added.11") || !strings.Contains(complete, "object.removed.06") || !strings.Contains(complete, "part.06") || strings.Contains(complete, "--details") || strings.Contains(complete, " shown") {
		t.Fatalf("complete text report:\n%s", complete)
	}
	md := string(rep.markdown())
	for _, want := range []string{
		"**Changes to 19 instances, 1 Relation, and 7 Contributions.**\n",
		"<summary>Instances: 12 added, 7 removed (10 of 19 shown)</summary>\n",
		"- Added \\(5 of 12 shown\\)\n",
		"- Removed \\(5 of 7 shown\\)\n",
		"**Relations: 1 removed**\n",
		"**Contributions: 7 added**\n",
		reviewPreview,
	} {
		if !strings.Contains(md, want) {
			t.Fatalf("Markdown preview lacks %q:\n%s", want, md)
		}
	}
	if strings.Contains(md, "object.added.05") || strings.Contains(md, "object.removed.05") || !strings.Contains(md, "part.06") {
		t.Fatalf("Markdown preview budget:\n%s", md)
	}
	rep.complete = false
	rep.details = true
	full := reportText(rep)
	if !strings.Contains(full, "object.added.11") || !strings.Contains(full, "part.06") || strings.Contains(full, "--details") || strings.Contains(full, " shown") {
		t.Fatalf("expanded details:\n%s", full)
	}
	md = string(rep.markdown())
	if !strings.Contains(md, "**Relations: 1 removed**\n\n- **routes-to** from `gateway` to `object.removed.00`\n") || !strings.Contains(md, "<summary>Instances: 12 added, 7 removed</summary>\n") || !strings.Contains(md, "object.added.11") || strings.Contains(md, "shown") {
		t.Fatalf("Markdown fact entry:\n%s", md)
	}
}

// A fact keeps its link and target beside its source when the whole list fits
// the line, and continues on an indented line otherwise; identifiers are
// never cut.
func TestFactEntriesKeepIdentifiersWhole(t *testing.T) {
	long := "azurerm_eventgrid_system_topic_event_subscription.order_notifications"
	c := &form.Comparison{Before: form.StageRefreshed, After: form.StagePlanned, Comparable: true, Facts: []form.FactChange{
		{Change: form.ChangeAdded, Kind: form.FactContext, Fact: "context:azure.context.ownership:" + long + ":azurerm_resource_group.prod"},
	}}
	c.Counts.FactsAdded = 1
	text := reportText(runReport{verdict: "Plan analyzed", blocks: []reportBlock{comparisonBlock("Planned changes", c, nil, nil, false, true)}})
	if !strings.Contains(text, "    + "+long+"\n        ownership -> azurerm_resource_group.prod  added\n") {
		t.Fatalf("stacked fact:\n%s", text)
	}
	for _, line := range strings.Split(text, "\n") {
		if utf8.RuneCountInString(line) > reportLineWidth {
			t.Fatalf("line wider than %d columns: %q", reportLineWidth, line)
		}
	}
	short := "azurerm_eventgrid_system_topic.service_bus"
	c.Facts[0].Fact = "context:azure.context.ownership:" + short + ":azurerm_resource_group.prod"
	text = reportText(runReport{verdict: "Plan analyzed", blocks: []reportBlock{comparisonBlock("Planned changes", c, nil, nil, false, true)}})
	if !strings.Contains(text, "    + "+short+"  added\n        ownership -> azurerm_resource_group.prod\n") {
		t.Fatalf("fact whose status fits its first line:\n%s", text)
	}
	c.Facts[0].Fact = "context:rf.context.network:aws_subnet.a:aws_vpc.main"
	text = reportText(runReport{verdict: "Plan analyzed", blocks: []reportBlock{comparisonBlock("Planned changes", c, nil, nil, false, true)}})
	if !strings.Contains(text, "    + aws_subnet.a  network -> aws_vpc.main  added\n") {
		t.Fatalf("one-line fact:\n%s", text)
	}
}

// Uncertainty is a table of closures per stage or side, with the reasons
// indented under the count; the unit stays the closure.
func TestUncertaintyTablesCountClosures(t *testing.T) {
	entries := []form.IndeterminateClosure{
		{Side: form.SideBefore, Reasons: []form.Reason{form.ReasonUnknownUntilApply}},
		{Side: form.SideAfter, Reasons: []form.Reason{form.ReasonUnknownUntilApply, form.ReasonExternalIdentityWithheld}},
		{Side: form.SideAfter, Reasons: []form.Reason{form.ReasonIdentityIncomplete}},
	}
	c := &form.Comparison{Comparable: true, Indeterminate: entries}
	block, ok := comparisonUncertaintyBlock(c)
	if !ok {
		t.Fatal("no uncertainty block")
	}
	want := [][]string{
		{"Indeterminate closures", "1", "2"},
		{"  Unknown until apply", "1", "1"},
		{"  External identity withheld", "0", "1"},
		{"  Incomplete identity", "0", "1"},
	}
	if !reflect.DeepEqual(block.table.header, []string{"", "Before", "After"}) || !reflect.DeepEqual(block.table.rows, want) {
		t.Fatalf("table %q / %q", block.table.header, block.table.rows)
	}
	if !reflect.DeepEqual(block.lines, []string{severalReasons, unknownUntilApply}) {
		t.Fatalf("lines %q", block.lines)
	}
	text := reportText(runReport{verdict: "Inputs compared", blocks: []reportBlock{block}})
	if !strings.Contains(text, "Before   After\n  Indeterminate closures             1       2\n    Unknown until apply              1       1\n") {
		t.Fatalf("text table:\n%s", text)
	}
	md := string(runReport{verdict: "Inputs compared", blocks: []reportBlock{block}}.markdown())
	if !strings.Contains(md, "| *Unknown until apply* | 1 | 1 |") {
		t.Fatalf("Markdown table:\n%s", md)
	}
}

func TestEnrichmentWordsReportThePairing(t *testing.T) {
	got := enrichmentWords(form.SnapshotEnrichment{Status: form.SnapshotVerified, Modules: 2})
	want := []string{"Saved plan paired with this plan JSON (2 modules)"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("enrichment %q", got)
	}
	rep := runReport{verdict: "Plan analyzed", literal: map[string]bool{"Input": true}}
	rep.head = [][2]string{{"Input", "a b c d e f g h i j k l m n o p q r s t u v w x y z a b c d e f g h i j k l m.json"}, {"Enrichment", want[0]}}
	text := reportText(rep)
	if !strings.Contains(text, "Input       a b c d e f g h i j k l m n o p q r s t u v w x y z a b c d e f g h i j k l m.json\n") || !strings.Contains(text, "Enrichment  Saved plan paired with this plan JSON (2 modules)\n") {
		t.Fatalf("head:\n%s", text)
	}
	if md := string(rep.markdown()); !strings.Contains(md, "- **Enrichment:** Saved plan paired with this plan JSON \\(2 modules\\)\n") {
		t.Fatalf("Markdown head:\n%s", md)
	}
}

func TestWrapWordsKeepsWordsWhole(t *testing.T) {
	if got := wrapWords("aaa bbb ccc", 7); !reflect.DeepEqual(got, []string{"aaa bbb", "ccc"}) {
		t.Fatalf("wrap %q", got)
	}
	if got := wrapWords("a module.network.aws_subnet.private b", 10); !reflect.DeepEqual(got, []string{"a", "module.network.aws_subnet.private", "b"}) {
		t.Fatalf("long word %q", got)
	}
}

func TestComparisonEventsAndNotComparable(t *testing.T) {
	c := &form.Comparison{Before: form.StageRefreshed, After: form.StagePlanned, Comparable: true}
	for _, tc := range []struct {
		kind        form.ChangeKind
		mark, words string
	}{
		{form.ChangeMoved, "~", "moved from old"},
		{form.ChangeReplaced, "~", "replaced"},
		{form.ChangeRecreated, "~", "recreated"},
	} {
		entry := form.RepresentationChange{Change: tc.kind, Representation: "object", PreviousAddress: "old"}
		item := representationChangeItem(entry, nil, false)
		if item.mark != tc.mark || item.text != tc.words || strings.Contains(item.text, "changed") {
			t.Errorf("%s: %#v", tc.kind, item)
		}
		c.Representations = append(c.Representations, entry)
	}
	c.Counts.Moved, c.Counts.Replaced, c.Counts.Recreated = 1, 1, 1
	text := reportText(runReport{verdict: "Inputs compared", blocks: []reportBlock{comparisonBlock("Differences", c, nil, nil, true, true)}})
	if !strings.Contains(text, "1 moved, 1 replaced, 1 recreated") || strings.Contains(text, "changed") {
		t.Fatal(text)
	}
	c.Name = form.ComparisonNet
	text = reportText(runReport{verdict: "Plan analyzed", blocks: []reportBlock{comparisonBlock("Net change", c, nil, nil, false, true)}})
	if !strings.Contains(text, "1 moved, 1 planned for replacement, 1 planned for\n") || !strings.Contains(text, "~ object  planned for recreation\n") || strings.Contains(text, "recreated") || strings.Contains(text, "replaced") {
		t.Fatal(text)
	}
	c.Name = ""
	c.Comparable = false
	c.Problems = []form.ComparisonProblem{{Code: "INCOMPATIBLE", Message: "different semantics"}}
	text = reportText(runReport{verdict: "Inputs compared", blocks: []reportBlock{comparisonBlock("Differences", c, nil, nil, true, true)}})
	if !strings.Contains(text, "Not comparable: different semantics") || strings.Contains(text, "No architectural difference") || strings.Contains(text, "Instances") {
		t.Fatal(text)
	}
}

func TestRunReportMakesUntrustedAddressesInert(t *testing.T) {
	address := "object.\x1b[31m\u202e*`[x](bad)"
	c := &form.Comparison{Before: form.StageRefreshed, After: form.StagePlanned, Comparable: true,
		Representations: []form.RepresentationChange{{Change: form.ChangeAdded, Representation: address}},
	}
	c.Counts.RepresentationsAdded = 1
	rep := runReport{verdict: "Plan analyzed", blocks: []reportBlock{comparisonBlock("Planned changes", c, nil, nil, false, true)}}
	plain, md := reportText(rep), string(rep.markdown())
	if strings.ContainsRune(plain, 0x1b) || strings.ContainsRune(plain, 0x202e) || !strings.Contains(plain, `\u001b`) || !strings.Contains(plain, `\u202e`) {
		t.Fatalf("unsafe text: %q", plain)
	}
	if strings.ContainsRune(md, 0x1b) || strings.ContainsRune(md, 0x202e) || !strings.Contains(md, "`` ") || !strings.Contains(md, "[x](bad)") {
		t.Fatalf("unsafe Markdown: %q", md)
	}
}

func TestStageWordsAndPopulation(t *testing.T) {
	a := &form.InputForm{DefaultStage: form.StagePlanned, Stages: map[form.Stage]*form.Architecture{
		form.StagePlanned:   {Stage: form.StagePlanned},
		form.StageRefreshed: {Stage: form.StageRefreshed},
		form.StageRecorded:  {Stage: form.StageRecorded, Reconstruction: &form.Reconstruction{From: form.StageRefreshed, ReversedDriftEntries: 1}},
	}}
	if got := stagesWords(a, true); got != "Recorded (reconstructed from Refreshed by reversing 1 drift entry), Refreshed, Planned" {
		t.Fatal(got)
	}
	stage := a.Stages[form.StagePlanned]
	stage.Accounting.Instances = 1
	stage.Representations = []form.Representation{{ID: "object"}}
	stage.Declarations = []form.Declaration{{Population: form.Population{Status: form.PopulationUnverified}}, {Population: form.Population{Status: form.PopulationObserved}}}
	text := reportText(runReport{verdict: "Plan analyzed", blocks: []reportBlock{architectureBlock(stageView{stage: form.StagePlanned, form: a}, false)}})
	if !strings.Contains(text, "1 of 2 declarations have an unverified instance count") {
		t.Fatal(text)
	}
}

func TestNetCollapseUsesFormEntries(t *testing.T) {
	a := &form.InputForm{Comparisons: &form.Comparisons{
		Changes: &form.Comparison{Comparable: true, Representations: []form.RepresentationChange{{ID: "change:changes:added:object", Change: form.ChangeAdded, Representation: "object"}}},
		Net:     &form.Comparison{Comparable: true, Representations: []form.RepresentationChange{{ID: "change:net:added:object", Change: form.ChangeAdded, Representation: "object"}}, Facts: []form.FactChange{}},
	}}
	if got := reportText(runReport{verdict: "Plan analyzed", blocks: []reportBlock{netBlock(a, nil, true)}}); !strings.Contains(got, "Same determined changes as Planned changes.") || strings.Contains(got, "Instances") {
		t.Fatal(got)
	}
	a.DriftReport = &form.DriftReport{Entries: []form.DriftEntry{{ID: "drift"}}}
	if got := reportText(runReport{verdict: "Plan analyzed", blocks: []reportBlock{netBlock(a, nil, true)}}); !strings.Contains(got, "Same determined changes as Planned changes.") {
		t.Fatal(got)
	}
	a.Comparisons.Changes = &form.Comparison{Before: form.StageRefreshed, After: form.StagePlanned, Comparable: true}
	a.Comparisons.Net = &form.Comparison{Before: form.StageRecorded, After: form.StagePlanned, Comparable: true}
	if got := reportText(runReport{verdict: "Plan analyzed", blocks: []reportBlock{netBlock(a, nil, true)}}); !strings.Contains(got, "No architectural difference determined under the selected Dialects.") || strings.Contains(got, "Same determined") {
		t.Fatal(got)
	}
	a.Comparisons.Net.Indeterminate = []form.IndeterminateClosure{{Side: form.SideAfter}}
	a.Comparisons.Net.Cancelled = []form.Cancellation{{Fact: "fact"}}
	a.Comparisons.Net.Counts.Indeterminate, a.Comparisons.Net.Counts.Cancelled = 1, 1
	if got := reportText(runReport{verdict: "Plan analyzed", blocks: []reportBlock{netBlock(a, nil, true)}}); strings.Contains(got, "No net architectural difference") || !strings.Contains(got, "Indeterminate") || !strings.Contains(got, "Cancelled") {
		t.Fatal(got)
	}
}

func TestDriftEffectAndDiagnosticsDetails(t *testing.T) {
	c := &form.Comparison{Comparable: true}
	rows, lines, table := driftEffect(c)
	if !reflect.DeepEqual(rows, [][2]string{{"Effect", "No architectural difference determined under the selected Dialects"}}) || len(lines) != 0 || table != nil {
		t.Fatalf("empty effect: %v %v", rows, lines)
	}
	effect := &form.Comparison{Before: form.StageRecorded, After: form.StageRefreshed, Comparable: true,
		Indeterminate: []form.IndeterminateClosure{{Side: form.SideBefore, Reasons: []form.Reason{form.ReasonExternalDenied}}, {Side: form.SideAfter, Reasons: []form.Reason{form.ReasonExternalDenied}}},
	}
	effect.Counts.RepresentationsChanged, effect.Counts.FactsRemoved, effect.Counts.Indeterminate = 1, 2, 2
	rows, _, table = driftEffect(effect)
	if want := [][2]string{{"Effect", "1 instance changed; 2 facts removed"}}; !reflect.DeepEqual(rows, want) {
		t.Fatalf("effect rows: %q, want %q", rows, want)
	}
	if want := [][]string{{"Indeterminate closures", "1", "1"}, {"  External endpoint denied", "1", "1"}}; table == nil || !reflect.DeepEqual(table.header, []string{"", "Recorded", "Refreshed"}) || !reflect.DeepEqual(table.rows, want) {
		t.Fatalf("effect table: %#v", table)
	}
	c.Comparable = false
	c.Problems = []form.ComparisonProblem{{Code: "DIFFERENT", Message: "different semantics"}}
	rows, lines, _ = driftEffect(c)
	if len(rows) != 0 || !reflect.DeepEqual(lines, []string{"Not comparable: different semantics"}) {
		t.Fatalf("not comparable effect: %v %v", rows, lines)
	}
	block, ok := diagnosticsBlock([]form.Diagnostic{{Severity: form.SeverityWarning, Code: "UNSET", Message: "unknown"}}, false)
	if !ok || block.title != "Diagnostics" || len(block.groups) != 1 {
		t.Fatalf("diagnostic details: %#v", block)
	}
}

func TestChangeReasonWordsNameTerraformAndOpenTofu(t *testing.T) {
	for reason, want := range map[string]string{
		"deleted_outside_producer": "deleted outside Terraform or OpenTofu",
		"replace_because_tainted":  "replace because tainted",
	} {
		if got := changeReasonWords(reason); got != want {
			t.Fatalf("changeReasonWords(%q) = %q, want %q", reason, got, want)
		}
	}
}

func TestRunReportNamesTerraformAndOpenTofu(t *testing.T) {
	for value, want := range map[form.CompletenessValue]string{
		"":                       "Not reported in the plan",
		form.CompleteUnavailable: "Not reported in the plan",
		form.CompleteTrue:        "Complete, as reported in the plan",
		form.CompleteFalse:       "Incomplete, as reported in the plan",
	} {
		if got := completenessWords(form.Completeness{ProducerComplete: value}); got != want {
			t.Fatalf("completeness %q = %q, want %q", value, got, want)
		}
	}
	if got := driftRecordsAbsent; got != "Terraform and OpenTofu omit drift records both when refresh finds no drift and when refresh does not run." {
		t.Fatalf("drift = %q", got)
	}
}
