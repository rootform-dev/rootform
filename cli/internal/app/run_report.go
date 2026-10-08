package app

import (
	"fmt"
	"io"
	"reflect"
	"sort"
	"strings"
	"unicode"
	"unicode/utf8"

	"github.com/rootform-dev/rootform/cli/form"
	cli "github.com/rootform-dev/rootform/cli/internal/command"
	"github.com/rootform-dev/rootform/cli/internal/human"
)

// A complete text report, as --no-serve and a .txt file write it, lists every
// entry. The summary beside the explorer previews at most reportTextLimit
// entries of a list, and reportPreviewLimit entries of a comparison spread
// over its kinds and statuses; a Markdown review previews at most
// reportTextLimit entries of each list, spread over its statuses. --details
// lists every entry. The literal text of entries is aligned up to
// reportCodeWidth columns. A fact keeps its target on the same line only when
// every listed fact of its list fits reportLineWidth columns; the layout never
// depends on the terminal, so a saved text report reads as the terminal did.
const (
	reportTextLimit    = 10
	reportPreviewLimit = 15
	reportFactLimit    = 5
	reportCodeWidth    = 48
	reportLineWidth    = 80
)

// reportItem is one listed entry. Code is untrusted input text (an address, a
// type) shown literally; text is Rootform wording. A fact entry also names
// the link that relates code to its target: a predicate, a dimension or a
// contribution, and its kind. bucket is the status a preview spreads its
// entries over. count is how many changes the entry stands for when several
// read alike. detail, previous and reason restate parts of text apart for a
// review document: the words that follow the status, a previous address and
// the recorded reason of a change.
type reportItem struct {
	mark     string
	status   human.Status
	code     string
	text     string
	kind     string
	link     string
	target   string
	bucket   string
	count    int
	detail   string
	previous string
	reason   string
}

// weight is how many changes an entry stands for.
func (item reportItem) weight() int {
	return max(item.count, 1)
}

// words is the entry's status, preceded by the number of changes the entry
// stands for when several read alike.
func (item reportItem) words() string {
	if item.count > 1 && item.text != "" {
		return fmt.Sprintf("%d %s", item.count, item.text)
	}
	return item.text
}

// collapseAlike merges the entries of a list that would read alike into the
// first of them, counting them. External endpoints withhold their identity,
// so distinct endpoints, and facts that reach them, can read the same.
func collapseAlike(items []reportItem) []reportItem {
	index := map[reportItem]int{}
	var out []reportItem
	for _, item := range items {
		if i, found := index[item]; found {
			out[i].count = out[i].weight() + 1
			continue
		}
		index[item] = len(out)
		out = append(out, item)
	}
	return out
}

// reportGroup is one list of entries under an optional title; noun names
// them in the line that says how many are shown.
type reportGroup struct {
	title string
	items []reportItem
	noun  string
}

// reportTable compares values in columns. numeric right-aligns the values;
// literal marks a first column of untrusted names, such as resource types.
type reportTable struct {
	header  []string
	rows    [][]string
	numeric bool
	literal bool
}

// reportBlock is one part of the summary. Text and Markdown render the same
// blocks, so both formats state the same facts; a review document orders
// them by role. lead holds the direction and the limits that qualify the rest
// of the block; notes explain further and appear with --details. budget is
// how many entries of its groups a summary previews. comparison is the
// comparison a block states.
type reportBlock struct {
	title      string
	role       blockRole
	lead       []string
	rows       [][2]string
	table      *reportTable
	lines      []string
	groups     []reportGroup
	budget     int
	tail       []string
	notes      []string
	comparison *form.Comparison
}

// blockRole names what a block states, so a review document can order the
// blocks by what a reader needs first. Every block a summary builds has a
// role; the zero role marks none.
type blockRole int

const (
	roleNone blockRole = iota
	roleLimited
	roleArchitecture
	roleUncertainty
	roleChanges
	roleDrift
	roleNet
	roleDifferences
	roleDiagnostics
)

type runReport struct {
	verdict string
	head    [][2]string
	// literal names the head rows whose value is text the user typed.
	literal map[string]bool
	sides   *reportTable
	blocks  []reportBlock
	details bool
	// complete lists every entry of each group; details, independently, adds
	// what explains the entries further.
	complete bool
	// views are the architectures the summary describes: the evaluated stage
	// of a single input, or the two sides of a comparison.
	views []stageView
}

// stageView is one stage of one input Form; side names it within a
// comparison and stays empty for a single input.
type stageView struct {
	side  string
	stage form.Stage
	form  *form.InputForm
}

func (v stageView) architecture() *form.Architecture {
	if v.form == nil {
		return nil
	}
	return v.form.Stages[v.stage]
}

// buildRunReport designs the human summary of one run result. It reads only
// the validated Form; it never recompiles, and it never prints an external
// endpoint identity.
func buildRunReport(r runResult, options cli.Options) runReport {
	rep := runReport{literal: map[string]bool{}, details: options.Details}
	names := representationNames(r.decoded)
	loaded := len(r.operands) > 0 && !r.operands[0].compiled
	switch {
	case r.decoded.Comparison != nil && len(r.operands) == 2:
		rep.verdict = "Inputs compared"
	case r.decoded.Comparison != nil:
		rep.verdict = "Comparison Form loaded"
	case loaded:
		rep.verdict = "Form loaded"
	case r.decoded.Input.Kind == form.KindPlan:
		rep.verdict = "Plan analyzed"
	default:
		rep.verdict = "State analyzed"
	}
	if c := r.decoded.Comparison; c != nil {
		if len(r.operands) == 2 {
			rep.typed("Before", r.operands[0].name)
			rep.typed("After", r.operands[1].name)
		} else {
			rep.typed("Input", r.operands[0].name)
			rep.head = append(rep.head, [2]string{"Form", "Comparison, saved by " + generatorWords(c.Generator)})
		}
		views := []stageView{{side: "Before", stage: c.Before.Stage, form: &c.Before.Form}, {side: "After", stage: c.After.Stage, form: &c.After.Form}}
		rep.views = views
		rep.sides = sidesTable(views, options.Details)
		if block, ok := limitedBlock(views); ok {
			rep.blocks = append(rep.blocks, block)
		}
		uncertain := false
		if block, ok := comparisonUncertaintyBlock(&c.Comparison); ok {
			rep.blocks = append(rep.blocks, block)
			uncertain = true
		}
		rep.blocks = append(rep.blocks, differencesBlock(c, names, !uncertain))
	} else {
		a := r.decoded.Input
		rep.typed("Input", r.operands[0].name)
		if loaded {
			rep.head = append(rep.head, [2]string{"Form", titleWord(string(a.Kind)) + ", saved by " + generatorWords(a.Generator)})
		}
		if producer := producerWords(*a); producer != "" {
			rep.head = append(rep.head, [2]string{"Producer", producer})
		}
		if a.Kind == form.KindPlan {
			rep.head = append(rep.head, [2]string{"Plan completeness", completenessWords(a.Evidence.Completeness)})
		}
		for i, words := range enrichmentWords(a.Evidence.Enrichment.Snapshot) {
			label := ""
			if i == 0 {
				label = "Enrichment"
			}
			rep.head = append(rep.head, [2]string{label, words})
		}
		rep.head = append(rep.head, [2]string{"Stage", stageWords(r.focusStage)})
		if len(availableStages(a)) > 1 {
			rep.head = append(rep.head, [2]string{"Stages", stagesWords(a, options.Details)})
		}
		if options.Details {
			rep.head = append(rep.head, [2]string{"Semantics", semanticsWords(a.Semantics)})
		}
		view := stageView{stage: r.focusStage, form: a}
		rep.views = []stageView{view}
		uncovered := uninterpreted(view.architecture())
		if uncovered {
			rep.head = append(rep.head, [2]string{"Instances", instancesWords(view.architecture().Accounting)})
		}
		if block, ok := limitedBlock([]stageView{view}); ok {
			rep.blocks = append(rep.blocks, block)
		}
		if !uncovered {
			rep.blocks = append(rep.blocks, architectureBlock(view, options.Details))
		}
		uncertain := false
		if block, ok := uncertaintyBlock(view, options.Details); ok {
			rep.blocks = append(rep.blocks, block)
			uncertain = true
		}
		if a.Kind == form.KindPlan {
			rep.blocks = append(rep.blocks, planBlocks(a, names, uncertain)...)
		}
	}
	if block, ok := diagnosticsBlock(runDiagnosticList(r.decoded), options.Details); ok {
		rep.blocks = append(rep.blocks, block)
	}
	return rep
}

func (rep *runReport) typed(label, value string) {
	rep.head = append(rep.head, [2]string{label, value})
	rep.literal[label] = true
}

func generatorWords(g form.Generator) string {
	if g.Version == "" {
		return g.Name
	}
	return g.Name + " " + g.Version
}

// producerWords names the tool that exported the evidence, as the evidence
// records it.
func producerWords(a form.InputForm) string {
	switch a.Evidence.Producer.Tool {
	case form.ToolTerraform:
		return "Terraform"
	case form.ToolOpenTofu:
		return "OpenTofu"
	}
	return ""
}

func hasProducer(views []stageView) bool {
	for _, view := range views {
		if view.form != nil && producerWords(*view.form) != "" {
			return true
		}
	}
	return false
}

func completenessWords(c form.Completeness) string {
	words := "Not reported in the plan"
	switch c.ProducerComplete {
	case form.CompleteTrue:
		words = "Complete, as reported in the plan"
	case form.CompleteFalse:
		words = "Incomplete, as reported in the plan"
	}
	if c.AttestedComplete {
		words += "; attested complete by the operator"
	}
	return words
}

// enrichmentWords states whether a saved plan paired with its plan JSON. It
// never claims the plan is valid or that both come from one planning
// operation; the documentation names the few properties the pairing compares.
func enrichmentWords(s form.SnapshotEnrichment) []string {
	switch s.Status {
	case form.SnapshotVerified:
		return []string{fmt.Sprintf("Saved plan paired with this plan JSON (%s)", countWithNoun(s.Modules, "module", "modules"))}
	case form.SnapshotRefused:
		return []string{"Saved plan refused (" + s.Diagnostic + "); the plan JSON was analyzed alone"}
	}
	return nil
}

// stagesWords lists the stages a Form holds in the order they happened.
func stagesWords(a *form.InputForm, details bool) string {
	names := []string{}
	for _, stage := range []form.Stage{form.StageRecorded, form.StageRefreshed, form.StagePlanned} {
		architecture := a.Stages[stage]
		if architecture == nil {
			continue
		}
		label := stageWords(stage)
		if reconstruction := architecture.Reconstruction; reconstruction != nil {
			note := "reconstructed"
			if details {
				from := stageWords(reconstruction.From)
				if reconstruction.ReversedDriftEntries == 0 {
					note = "reconstructed from " + from + "; no drift entry to reverse"
				} else {
					note = "reconstructed from " + from + " by reversing " + countWithNoun(reconstruction.ReversedDriftEntries, "drift entry", "drift entries")
				}
			}
			label += " (" + note + ")"
		}
		names = append(names, label)
	}
	return strings.Join(names, ", ")
}

func stageWords(stage form.Stage) string {
	value := string(stage)
	if value == "" {
		return value
	}
	return strings.ToUpper(value[:1]) + value[1:]
}

func semanticsWords(s form.Semantics) string {
	dialects, vocabularies := 0, 0
	for _, owner := range s.Owners {
		if owner.Kind == form.OwnerDialect {
			dialects++
		} else {
			vocabularies++
		}
	}
	return fmt.Sprintf("%s, %s", countWithNoun(dialects, "Dialect", "Dialects"), countWithNoun(vocabularies, "RF Vocabulary", "RF Vocabularies"))
}

// instancesWords counts the instances of a stage whose interpretation the
// summary cannot describe further.
func instancesWords(n form.Accounting) string {
	words := countWithNoun(n.ManagedInstances, "managed resource", "managed resources")
	if n.DataInstances > 0 {
		words += ", " + countWithNoun(n.DataInstances, "data source", "data sources")
	}
	return words
}

// carriedPlanNote qualifies a plan comparison that includes carried
// instances: their values come from the prior state, not from this plan.
func carriedPlanNote(carried int) string {
	if carried == 1 {
		return "1 carried instance keeps its prior-state values; this plan did not evaluate it."
	}
	return fmt.Sprintf("%d carried instances keep their prior-state values; this plan did not evaluate them.", carried)
}

// uncoveredTypes counts, by resource type, the instances of one stage that no
// Rule of the selected Dialects can interpret.
func uncoveredTypes(a *form.Architecture) map[string]int {
	counts := map[string]int{}
	if a == nil {
		return counts
	}
	types := map[string]string{}
	for _, d := range a.Declarations {
		name := d.Type
		if d.Kind == "data" {
			name = "data." + d.Type
		}
		types[d.ID] = name
	}
	for _, r := range a.Representations {
		if r.Interpretation == nil || r.Interpretation.Status != form.InterpretationNone || len(r.Interpretation.Candidates) > 0 {
			continue
		}
		name := types[r.Declaration]
		if name == "" {
			name = "unknown type"
		}
		counts[name]++
	}
	return counts
}

func total(counts map[string]int) int {
	sum := 0
	for _, n := range counts {
		sum += n
	}
	return sum
}

// uninterpreted reports a stage whose every instance lacks a Rule: its
// architecture holds an inventory and nothing interpreted.
func uninterpreted(a *form.Architecture) bool {
	return a != nil && a.Accounting.Instances > 0 && total(uncoveredTypes(a)) == a.Accounting.Instances
}

// limitedBlock reports the instances no selected Dialect interprets, by
// resource type, before any conclusion they could make misleading.
func limitedBlock(views []stageView) (reportBlock, bool) {
	block := reportBlock{title: "Limited interpretation", role: roleLimited}
	counts := make([]map[string]int, len(views))
	found, every := false, true
	for i, v := range views {
		a := v.architecture()
		counts[i] = uncoveredTypes(a)
		missing := total(counts[i])
		if missing == 0 {
			if a != nil && a.Accounting.Instances > 0 {
				every = false
			}
			continue
		}
		found = true
		instances := a.Accounting.Instances
		line := fmt.Sprintf("%d of %d instances matched no Rule in the selected Dialects.", missing, instances)
		switch {
		case missing == instances && instances == 1:
			line = "The only instance matched no Rule in the selected Dialects."
		case missing == instances:
			line = fmt.Sprintf("None of the %d instances matched a Rule in the selected Dialects.", instances)
		default:
			every = false
		}
		if v.side != "" {
			line = v.side + ": " + strings.ToLower(line[:1]) + line[1:]
		}
		block.lead = append(block.lead, line)
	}
	if !found {
		return reportBlock{}, false
	}
	table := &reportTable{numeric: true, literal: true, header: []string{"Resource type"}}
	sums := map[string]int{}
	for i, v := range views {
		if len(views) == 1 {
			table.header = append(table.header, "Instances")
		} else {
			table.header = append(table.header, v.side)
		}
		for name, n := range counts[i] {
			sums[name] += n
		}
	}
	for _, name := range sortedByCount(sums) {
		row := []string{name}
		for i := range views {
			row = append(row, fmt.Sprint(counts[i][name]))
		}
		table.rows = append(table.rows, row)
	}
	block.table = table
	if every {
		block.tail = []string{"The resource inventory is available.", "Architectural links were not interpreted."}
	} else {
		block.tail = []string{"These instances appear without architectural links."}
	}
	return block, true
}

// architectureBlock sizes one stage architecture with honest denominators.
func architectureBlock(v stageView, details bool) reportBlock {
	block := reportBlock{title: "Architecture", role: roleArchitecture}
	a := v.architecture()
	if a == nil {
		block.lines = append(block.lines, "This Form has no "+stageWords(v.stage)+" stage.")
		return block
	}
	n := a.Accounting
	if n.Instances == 0 && len(a.Representations) == 0 {
		block.lines = append(block.lines, "The "+stageWords(v.stage)+" stage holds no instance. An empty stage is a valid result.")
		return block
	}
	instances := fmt.Sprint(n.Instances)
	if n.DataInstances > 0 {
		instances += fmt.Sprintf(" (%d managed, %d data)", n.ManagedInstances, n.DataInstances)
	}
	block.rows = append(block.rows, [2]string{"Instances", instances})
	if n.Carried > 0 {
		block.rows = append(block.rows, [2]string{"Carried", countWithNoun(n.Carried, "instance", "instances") + " from the prior state, not evaluated by this plan"})
	}
	if n.Deferred > 0 {
		block.rows = append(block.rows, [2]string{"Deferred", countWithNoun(n.Deferred, "instance", "instances")})
	}
	if n.Deposed > 0 {
		block.rows = append(block.rows, [2]string{"Deposed", countWithNoun(n.Deposed, "object", "objects")})
	}
	unverified := 0
	for _, declaration := range a.Declarations {
		if declaration.Population.Status == form.PopulationUnverified {
			unverified++
		}
	}
	if unverified > 0 {
		block.rows = append(block.rows, [2]string{"Populations", fmt.Sprintf("%d of %s have an unverified instance count", unverified, countWithNoun(len(a.Declarations), "declaration", "declarations"))})
	}
	excluded := 0
	for _, r := range a.Representations {
		if r.Interpretation != nil && r.Interpretation.Status == form.InterpretationNone && len(r.Interpretation.Candidates) > 0 {
			excluded++
		}
	}
	block.rows = append(block.rows, [2]string{"Interpreted", fmt.Sprint(n.AppliedInterpretations)})
	var gaps []string
	if excluded > 0 {
		gaps = append(gaps, fmt.Sprintf("%d outside every Rule condition", excluded))
	}
	if n.IndeterminateInterpretations > 0 {
		gaps = append(gaps, fmt.Sprintf("%d indeterminate", n.IndeterminateInterpretations))
	}
	if n.FailedInterpretations > 0 {
		gaps = append(gaps, fmt.Sprintf("%d failed", n.FailedInterpretations))
	}
	if len(gaps) > 0 {
		block.rows = append(block.rows, [2]string{"", "Not interpreted: " + strings.Join(gaps, ", ")})
	}
	block.rows = append(block.rows, factRows(a)...)
	if n.ExternalEndpoints > 0 {
		block.rows = append(block.rows, [2]string{"External endpoints", fmt.Sprint(n.ExternalEndpoints)})
	}
	if details {
		block.rows = append(block.rows, [2]string{"Closures", fmt.Sprintf("%d (%d resolved, %d absent, %d indeterminate)", n.Closures, n.Resolved, n.Absent, n.Indeterminate)})
	}
	block.notes = append(block.notes, "Interpreted counts the instances a Rule matched; Relations, Contexts, and Contributions count determined facts; Uncertainty counts what the evidence could not settle.")
	return block
}

// factRows counts the facts of each kind a stage holds.
func factRows(a *form.Architecture) [][2]string {
	var rows [][2]string
	for _, kind := range []struct {
		label string
		count int
	}{{"Relations", len(a.Relations)}, {"Contexts", len(a.Contexts)}, {"Contributions", len(a.Contributions)}} {
		if kind.count > 0 {
			rows = append(rows, [2]string{kind.label, fmt.Sprint(kind.count)})
		}
	}
	if len(rows) == 0 {
		rows = append(rows, [2]string{"Facts", "none determined"})
	}
	return rows
}

// sidesTable compares the two architectures of a comparison Form.
func sidesTable(views []stageView, details bool) *reportTable {
	table := &reportTable{header: []string{""}}
	for _, v := range views {
		table.header = append(table.header, v.side)
	}
	add := func(label string, value func(stageView, *form.Architecture) string) {
		row := []string{label}
		for _, v := range views {
			a := v.architecture()
			if a == nil {
				row = append(row, "-")
				continue
			}
			row = append(row, value(v, a))
		}
		table.rows = append(table.rows, row)
	}
	add("Origin", func(v stageView, _ *form.Architecture) string { return titleWord(string(v.form.Kind)) })
	if details && hasProducer(views) {
		add("Producer", func(v stageView, _ *form.Architecture) string { return producerWords(*v.form) })
	}
	add("Stage", func(v stageView, _ *form.Architecture) string { return stageWords(v.stage) })
	add("Instances", func(_ stageView, a *form.Architecture) string { return fmt.Sprint(a.Accounting.Instances) })
	add("Interpreted", func(_ stageView, a *form.Architecture) string {
		return fmt.Sprint(a.Accounting.AppliedInterpretations)
	})
	for _, kind := range []struct {
		label string
		count func(*form.Architecture) int
	}{
		{"Relations", func(a *form.Architecture) int { return len(a.Relations) }},
		{"Contexts", func(a *form.Architecture) int { return len(a.Contexts) }},
		{"Contributions", func(a *form.Architecture) int { return len(a.Contributions) }},
	} {
		present := false
		for _, v := range views {
			if a := v.architecture(); a != nil && kind.count(a) > 0 {
				present = true
			}
		}
		if present {
			count := kind.count
			add(kind.label, func(_ stageView, a *form.Architecture) string { return fmt.Sprint(count(a)) })
		}
	}
	if details {
		add("Closures", func(_ stageView, a *form.Architecture) string { return fmt.Sprint(a.Accounting.Closures) })
		add("Semantics", func(v stageView, _ *form.Architecture) string { return semanticsWords(v.form.Semantics) })
	}
	return table
}

// reasonLabels names the reasons a closure, an interpretation or an
// evaluation stays undecided, in the words a summary shows. The Form and the
// Policy result keep the codes.
var reasonLabels = map[string]string{
	string(form.ReasonUnknownUntilApply):        "Unknown until apply",
	string(form.ReasonUnavailable):              "Unavailable",
	string(form.ReasonIdentityIncomplete):       "Incomplete identity",
	string(form.ReasonSensitive):                "Sensitive",
	string(form.ReasonAmbiguousUnknown):         "Ambiguous unknown",
	string(form.ReasonUncomparableCandidate):    "Uncomparable candidate",
	string(form.ReasonReferenceAmbiguous):       "Ambiguous reference",
	string(form.ReasonExternalDenied):           "External endpoint denied",
	string(form.ReasonDuplicateIdentity):        "Duplicate identity",
	string(form.ReasonExternalIdentityWithheld): "External identity withheld",
	string(form.ReasonInterpretationFailed):     "Interpretation failed",
	"population_unverified":                     "Population unverified",
}

func reasonLabel(code string) string {
	if label, ok := reasonLabels[code]; ok {
		return label
	}
	if code == "" {
		return "Unstated"
	}
	return titleWord(strings.ReplaceAll(code, "_", " "))
}

// undecided counts one kind of undecided item per column of an uncertainty
// table and, per column, the reasons they carry.
type undecided struct {
	label   string
	totals  []int
	reasons []map[string]int
	// silent keeps the reasons out of the table.
	silent bool
}

func newUndecided(label string, columns int) *undecided {
	u := &undecided{label: label, totals: make([]int, columns), reasons: make([]map[string]int, columns)}
	for i := range u.reasons {
		u.reasons[i] = map[string]int{}
	}
	return u
}

func (u *undecided) add(column int, reasons ...string) {
	u.totals[column]++
	for _, reason := range reasons {
		u.reasons[column][reason]++
	}
}

// uncertaintyTable lays counts out with one column per stage or side and the
// reasons indented under each count. It reports whether an item carries more
// than one reason, since the reasons then add up to more than the count.
func uncertaintyTable(header []string, counts ...*undecided) (*reportTable, bool) {
	table := &reportTable{header: append([]string{""}, header...), numeric: true}
	several := false
	for _, u := range counts {
		if total := sum(u.totals); total == 0 {
			continue
		}
		row := []string{u.label}
		for _, n := range u.totals {
			row = append(row, fmt.Sprint(n))
		}
		table.rows = append(table.rows, row)
		if u.silent {
			continue
		}
		merged := map[string]int{}
		for column, reasons := range u.reasons {
			given := 0
			for reason, n := range reasons {
				merged[reason] += n
				given += n
			}
			several = several || given > u.totals[column]
		}
		for _, reason := range sortedByCount(merged) {
			row := []string{"  " + reasonLabel(reason)}
			for _, reasons := range u.reasons {
				row = append(row, fmt.Sprint(reasons[reason]))
			}
			table.rows = append(table.rows, row)
		}
	}
	if len(table.rows) == 0 {
		return nil, false
	}
	return table, several
}

func sum(values []int) int {
	total := 0
	for _, v := range values {
		total += v
	}
	return total
}

// severalReasons qualifies an uncertainty table whose items carry more than
// one reason.
const severalReasons = "A closure can have more than one reason, so its reasons can add up to more than the count."

// uncertaintyBlock separates what the evidence could not settle from what the
// Dialects do not cover. It counts the closures and interpretations of one
// stage, in a table headed by that stage.
func uncertaintyBlock(v stageView, details bool) (reportBlock, bool) {
	architecture := v.architecture()
	if architecture == nil {
		return reportBlock{}, false
	}
	closures := newUndecided("Indeterminate closures", 1)
	for _, c := range architecture.Closures {
		if c.Outcome == form.OutcomeIndeterminate {
			closures.add(0, string(c.Reason))
		}
	}
	interpretations := newUndecided("Indeterminate interpretations", 1)
	failed := newUndecided("Failed interpretations", 1)
	failed.silent = !details
	codes := map[string]string{}
	for _, d := range v.form.Diagnostics {
		codes[d.ID] = d.Code
	}
	for _, r := range architecture.Representations {
		if r.Interpretation == nil {
			continue
		}
		switch r.Interpretation.Status {
		case form.InterpretationIndeterminate:
			interpretations.add(0, string(r.Interpretation.Reason))
		case form.InterpretationFailed:
			cause := "failed"
			if len(r.Interpretation.Diagnostics) > 0 && codes[r.Interpretation.Diagnostics[0]] != "" {
				cause = codes[r.Interpretation.Diagnostics[0]]
			}
			failed.add(0, cause)
		}
	}
	table, several := uncertaintyTable([]string{stageWords(v.stage)}, closures, interpretations, failed)
	if table == nil {
		return reportBlock{}, false
	}
	block := reportBlock{title: "Uncertainty", role: roleUncertainty, table: table}
	if several {
		block.lines = append(block.lines, severalReasons)
	}
	return block, true
}

// indeterminateTable counts the unsettled closures of a comparison on each
// side apart. The two sides are separate architectures, so a closure unsettled
// on both is counted once on each side and never summed into one misleading
// total.
func indeterminateTable(entries []form.IndeterminateClosure, before, after string) (*reportTable, bool) {
	closures := newUndecided("Indeterminate closures", 2)
	for _, entry := range entries {
		column := 0
		if entry.Side == form.SideAfter {
			column = 1
		}
		reasons := make([]string, 0, len(entry.Reasons))
		for _, reason := range entry.Reasons {
			reasons = append(reasons, string(reason))
		}
		closures.add(column, reasons...)
	}
	return uncertaintyTable([]string{before, after}, closures)
}

// comparisonUncertaintyBlock states side by side the closures a comparison of
// two inputs could not settle, and why.
func comparisonUncertaintyBlock(c *form.Comparison) (reportBlock, bool) {
	if !c.Comparable || len(c.Indeterminate) == 0 {
		return reportBlock{}, false
	}
	table, several := indeterminateTable(c.Indeterminate, "Before", "After")
	block := reportBlock{title: "Uncertainty", role: roleUncertainty, table: table}
	if several {
		block.lines = append(block.lines, severalReasons)
	}
	return block, true
}

// planBlocks states the changes a plan records: its planned changes, the
// drift it reports and their net effect.
func planBlocks(a *form.InputForm, names map[string]string, uncertain bool) []reportBlock {
	var blocks []reportBlock
	carried := ""
	if planned := a.Stages[form.StagePlanned]; planned != nil && planned.Accounting.Carried > 0 {
		carried = carriedPlanNote(planned.Accounting.Carried)
	}
	if a.Comparisons != nil && a.Comparisons.Changes != nil {
		block := comparisonBlock("Planned changes", a.Comparisons.Changes, nil, names, false, !uncertain)
		if carried != "" {
			block.lead = append(block.lead, carried)
		}
		blocks = append(blocks, block)
	}
	blocks = append(blocks, driftBlock(a, names))
	if a.Comparisons != nil && a.Comparisons.Net != nil {
		block := netBlock(a, names, !uncertain)
		if carried != "" && len(block.lead) > 0 {
			block.lead = append(block.lead, carried)
		}
		blocks = append(blocks, block)
	}
	return blocks
}

// driftRecordsAbsent states what a plan without resource_drift proves. Both
// producers omit the field when refresh finds no drift and when refresh does
// not run (observed on the baseline and no_refresh corpus scenarios), so its
// absence reports no drift without proving that drift was assessed.
const driftRecordsAbsent = "Terraform and OpenTofu omit drift records both when refresh finds no drift and when refresh does not run."

// driftBlock reports what the producer recorded as drift, by consequence, and
// always states the scope the plan cannot prove.
func driftBlock(a *form.InputForm, names map[string]string) reportBlock {
	block := reportBlock{title: "Reported drift", role: roleDrift}
	if a.Comparisons != nil {
		block.comparison = a.Comparisons.Drift
	}
	scope := a.Evidence.Scope
	entries := []form.DriftEntry{}
	if a.DriftReport != nil {
		entries = a.DriftReport.Entries
	}
	limits := []string{"The export does not establish the refresh scope."}
	if len(entries) == 0 {
		block.lines = append(block.lines, "No drift reported in this plan.")
		block.lines = append(block.lines, limits...)
		if scope.DriftRecords != form.DriftRecordsPresent {
			block.notes = append(block.notes, driftRecordsAbsent)
		}
		block.notes = append(block.notes, driftScopeWords(scope))
		return block
	}
	block.lead = append(block.lead, "Recorded -> Refreshed")
	block.lead = append(block.lead, limits...)
	counts := map[form.DriftConsequence]int{}
	for _, entry := range entries {
		counts[entry.Consequence]++
	}
	var parts []string
	for _, consequence := range driftOrder {
		if counts[consequence] > 0 {
			parts = append(parts, fmt.Sprintf("%d %s", counts[consequence], strings.ToLower(driftTitles[consequence])))
		}
	}
	block.rows = append(block.rows, [2]string{"Drift entries", fmt.Sprintf("%d (%s)", len(entries), strings.Join(parts, ", "))})
	if a.Comparisons != nil && a.Comparisons.Drift != nil {
		rows, lines, table := driftEffect(a.Comparisons.Drift)
		block.rows, block.lines, block.table = append(block.rows, rows...), append(block.lines, lines...), table
	}
	sorted := append([]form.DriftEntry{}, entries...)
	sort.SliceStable(sorted, func(i, j int) bool {
		if driftRank[sorted[i].Consequence] != driftRank[sorted[j].Consequence] {
			return driftRank[sorted[i].Consequence] < driftRank[sorted[j].Consequence]
		}
		return sorted[i].Address < sorted[j].Address
	})
	items := []reportItem{}
	for _, entry := range sorted {
		detail := driftWords[entry.Consequence]
		if len(entry.FactChanges) > 0 {
			detail += "; " + countWithNoun(len(entry.FactChanges), "fact change", "fact changes")
		}
		text := detail
		if entry.PreviousAddress != "" {
			text += "; previously " + entry.PreviousAddress
		}
		items = append(items, reportItem{mark: driftMark(entry.Actions), status: human.Warn, code: entry.Address, text: text, bucket: strings.ToLower(driftTitles[entry.Consequence]), detail: detail, previous: entry.PreviousAddress})
	}
	block.groups = append(block.groups, reportGroup{items: items, noun: "drift entries"})
	block.budget = reportTextLimit
	block.notes = append(block.notes, driftScopeWords(scope))
	_ = names
	return block
}

// driftScopeWords names what drift records never cover. The summary shows
// it with --details.
func driftScopeWords(scope form.Scope) string {
	words := "Plan JSON does not record whether refresh was limited (-refresh=false, -target); an unrefreshed object reports no drift"
	var outside []string
	if !scope.DataSourcesCoveredByDrift {
		outside = append(outside, "data sources")
	}
	if !scope.DeposedCoveredByDrift {
		outside = append(outside, "deposed objects")
	}
	if len(outside) > 0 {
		words += "; " + strings.Join(outside, " and ") + " are outside drift records"
	}
	return words + "."
}

// driftEffect counts the architectural effect of the reported drift from the
// Reported drift comparison, and tables the closures it could not settle.
func driftEffect(c *form.Comparison) ([][2]string, []string, *reportTable) {
	var rows [][2]string
	var lines []string
	if !c.Comparable {
		for _, problem := range c.Problems {
			lines = append(lines, "Not comparable: "+problem.Message)
		}
		return rows, lines, nil
	}
	n := c.Counts
	var parts []string
	if words := countedWords("instance", "instances", []int{n.RepresentationsAdded, n.RepresentationsRemoved, n.RepresentationsChanged, n.Moved, n.Replaced, n.Recreated}, instanceVerbs(false)); words != "" {
		parts = append(parts, words)
	}
	if words := countedWords("fact", "facts", []int{n.FactsAdded, n.FactsRemoved}, []string{"added", "removed"}); words != "" {
		parts = append(parts, words)
	}
	effect := "No architectural difference determined under the selected Dialects"
	if len(parts) > 0 {
		effect = strings.Join(parts, "; ")
	}
	rows = append(rows, [2]string{"Effect", effect})
	if len(c.Indeterminate) == 0 {
		return rows, lines, nil
	}
	table, several := indeterminateTable(c.Indeterminate, stageWords(c.Before), stageWords(c.After))
	if several {
		lines = append(lines, severalReasons)
	}
	return rows, lines, table
}

// countedWords joins the non-zero counts and names the noun once, as in
// "1 instance added, 2 changed".
func countedWords(singular, plural string, counts []int, verbs []string) string {
	var parts []string
	for i, count := range counts {
		switch {
		case count == 0:
		case len(parts) == 0:
			parts = append(parts, countWithNoun(count, singular, plural)+" "+verbs[i])
		default:
			parts = append(parts, fmt.Sprintf("%d %s", count, verbs[i]))
		}
	}
	return strings.Join(parts, ", ")
}

// joinedCounts joins the non-zero counts with their verbs, as in
// "3 added, 1 removed".
func joinedCounts(counts []int, verbs []string) string {
	var parts []string
	for i, count := range counts {
		if count > 0 {
			parts = append(parts, fmt.Sprintf("%d %s", count, verbs[i]))
		}
	}
	return strings.Join(parts, ", ")
}

var driftOrder = []form.DriftConsequence{form.DriftArchitectural, form.DriftIndeterminate, form.DriftUncovered, form.DriftNoneUnderDialects, form.DriftAddressOnly}

var driftRank = map[form.DriftConsequence]int{form.DriftArchitectural: 0, form.DriftIndeterminate: 1, form.DriftUncovered: 2, form.DriftNoneUnderDialects: 3, form.DriftAddressOnly: 4}

var driftTitles = map[form.DriftConsequence]string{
	form.DriftArchitectural:     "Architectural",
	form.DriftIndeterminate:     "Indeterminate",
	form.DriftUncovered:         "Not covered",
	form.DriftNoneUnderDialects: "No architectural effect",
	form.DriftAddressOnly:       "Address only",
}

var driftWords = map[form.DriftConsequence]string{
	form.DriftArchitectural:     "changes the architecture",
	form.DriftIndeterminate:     "architectural effect indeterminate",
	form.DriftUncovered:         "no Rule interprets this instance",
	form.DriftNoneUnderDialects: "no architectural effect under the selected Dialects",
	form.DriftAddressOnly:       "address change only",
}

func driftMark(actions []string) string {
	for _, action := range actions {
		if action == "delete" {
			return "-"
		}
	}
	return "~"
}

// instanceVerbs names the instance changes of a comparison in the order the
// counts list them. In the planned comparisons a replacement or a recreation
// is an action the plan proposes, not one that happened.
func instanceVerbs(planned bool) []string {
	if planned {
		return []string{"added", "removed", "changed", "moved", "planned for replacement", "planned for recreation"}
	}
	return []string{"added", "removed", "changed", "moved", "replaced", "recreated"}
}

// plannedComparison reports a comparison whose After side is the plan's
// proposal: the Planned changes and the Net change of a plan.
func plannedComparison(c *form.Comparison) bool {
	return c.Name == form.ComparisonChanges || c.Name == form.ComparisonNet
}

// comparisonRoles names the role of each comparison a block states.
var comparisonRoles = map[string]blockRole{"Planned changes": roleChanges, "Net change": roleNet, "Differences": roleDifferences}

// comparisonBlock states one comparison: its direction, representation and
// fact changes, indeterminate closures and cancelled drift, which drift, when
// given, qualifies. reasons tables the causes of indeterminate closures when
// no Uncertainty block states them.
func comparisonBlock(title string, c, drift *form.Comparison, names map[string]string, cross, reasons bool) reportBlock {
	before, after := stageWords(c.Before), stageWords(c.After)
	if cross {
		before, after = "Before "+before, "After "+after
	}
	block := reportBlock{title: title, role: comparisonRoles[title], budget: reportPreviewLimit, comparison: c}
	if !cross {
		block.lead = []string{before + " -> " + after}
	}
	if !c.Comparable {
		for _, problem := range c.Problems {
			block.lines = append(block.lines, "Not comparable: "+problem.Message)
		}
		return block
	}
	if len(c.Representations)+len(c.Facts)+len(c.Indeterminate)+len(c.Cancelled) == 0 {
		block.lines = append(block.lines, "No architectural difference determined under the selected Dialects.")
		return block
	}
	tabled := reasons && len(c.Indeterminate) > 0
	block.rows = changeRows(c, before, after, !tabled, cross)
	if tabled {
		table, several := indeterminateTable(c.Indeterminate, before, after)
		block.table = table
		if several {
			block.lines = append(block.lines, severalReasons)
		}
	}
	block.groups = changeGroups(c, drift, names)
	return block
}

// factKinds lists the fact kinds of a comparison in the order a summary
// states them.
var factKinds = []struct {
	kind  form.FactKind
	title string
	noun  string
}{
	{form.FactRelation, "Relations", "Relation changes"},
	{form.FactContext, "Contexts", "Context changes"},
	{form.FactContribution, "Contributions", "Contribution changes"},
}

// changeGroups lists the entries of a comparison by kind, each kind by status
// in the order the counts state them, keeping the comparison's order within a
// status.
func changeGroups(c, drift *form.Comparison, names map[string]string) []reportGroup {
	planned := plannedComparison(c)
	var instances, externals []reportItem
	for _, change := range c.Representations {
		item := representationChangeItem(change, names, planned)
		if externalRepresentation(change.Representation) {
			externals = append(externals, item)
			continue
		}
		instances = append(instances, item)
	}
	groups := []reportGroup{
		{title: "Instances", items: byBucket(instances, instanceVerbs(planned)), noun: "instance changes"},
		{title: "External endpoints", items: collapseAlike(byBucket(externals, instanceVerbs(planned))), noun: "external endpoint changes"},
	}
	for _, kind := range factKinds {
		var facts []reportItem
		for _, change := range c.Facts {
			if change.Kind == kind.kind {
				facts = append(facts, factChangeItem(change, names))
			}
		}
		groups = append(groups, reportGroup{title: kind.title, items: collapseAlike(byBucket(facts, []string{"added", "removed", "changed"})), noun: kind.noun})
	}
	return append(groups, reportGroup{title: "Cancelled", items: collapseAlike(cancelledItems(c.Cancelled, drift, names)), noun: "cancelled fact changes"})
}

// externalRepresentation reports a representation that is an external
// endpoint, not a resource instance; its identity says so.
func externalRepresentation(id string) bool {
	return strings.HasPrefix(id, "external:")
}

// representationCounts counts the representation changes of a comparison by
// change, in the order instanceVerbs names them, for resource instances or
// for external endpoints.
func representationCounts(c *form.Comparison, external bool) []int {
	order := map[form.ChangeKind]int{form.ChangeAdded: 0, form.ChangeRemoved: 1, form.ChangeChanged: 2, form.ChangeMoved: 3, form.ChangeReplaced: 4, form.ChangeRecreated: 5}
	counts := make([]int, 6)
	for _, change := range c.Representations {
		if externalRepresentation(change.Representation) == external {
			counts[order[change.Change]]++
		}
	}
	return counts
}

// byBucket orders entries by the rank of their status, stable within one.
func byBucket(items []reportItem, order []string) []reportItem {
	rank := map[string]int{}
	for i, bucket := range order {
		rank[bucket] = i
	}
	sort.SliceStable(items, func(i, j int) bool { return rank[items[i].bucket] < rank[items[j].bucket] })
	return items
}

// changeRows counts a comparison with units: instances, each fact kind, and,
// unless a table states them, the closures it could not settle.
func changeRows(c *form.Comparison, before, after string, indeterminate, cross bool) [][2]string {
	n := c.Counts
	var rows [][2]string
	verbs := instanceVerbs(plannedComparison(c))
	if words := joinedCounts(representationCounts(c, false), verbs); words != "" {
		rows = append(rows, [2]string{"Instances", words})
	}
	if words := joinedCounts(representationCounts(c, true), verbs); words != "" {
		rows = append(rows, [2]string{"External endpoints", words})
	}
	for _, kind := range factKinds {
		counts := map[form.ChangeKind]int{}
		for _, f := range c.Facts {
			if f.Kind == kind.kind {
				counts[f.Change]++
			}
		}
		if words := joinedCounts([]int{counts[form.ChangeAdded], counts[form.ChangeRemoved], counts[form.ChangeChanged]}, []string{"added", "removed", "changed"}); words != "" {
			rows = append(rows, [2]string{kind.title, words})
		}
	}
	if indeterminate {
		rows = append(rows, [2]string{"Indeterminate closures", indeterminateWords(c.Indeterminate, before, after, cross)})
	}
	if n.Cancelled > 0 {
		rows = append(rows, [2]string{"Cancelled", countWithNoun(n.Cancelled, "drift fact change", "drift fact changes") + ", restoration planned"})
	}
	return rows
}

func differencesBlock(c *form.ComparisonForm, names map[string]string, reasons bool) reportBlock {
	return comparisonBlock("Differences", &c.Comparison, nil, names, true, reasons)
}

// netBlock states the net change of a plan. It reads as the planned changes
// only when both comparisons hold the same entries.
func netBlock(a *form.InputForm, names map[string]string, reasons bool) reportBlock {
	net := a.Comparisons.Net
	changes := a.Comparisons.Changes
	entries := len(net.Representations) + len(net.Facts) + len(net.Indeterminate)
	if net.Comparable && entries > 0 && changes != nil && changes.Comparable && len(net.Cancelled) == 0 && sameEntries(net, changes) {
		return reportBlock{title: "Net change", role: roleNet, lines: []string{"Same determined changes as Planned changes."}}
	}
	if net.Comparable && entries == 0 && len(net.Cancelled) > 0 {
		block := reportBlock{title: "Net change", role: roleNet, lead: []string{stageWords(net.Before) + " -> " + stageWords(net.After)}, budget: reportPreviewLimit, comparison: net}
		block.lines = append(block.lines, "No net architectural difference: the plan proposes to restore "+countWithNoun(len(net.Cancelled), "drift fact change", "drift fact changes")+".")
		block.groups = []reportGroup{{title: "Cancelled", items: collapseAlike(cancelledItems(net.Cancelled, a.Comparisons.Drift, names)), noun: "cancelled fact changes"}}
		return block
	}
	return comparisonBlock("Net change", net, a.Comparisons.Drift, names, false, reasons)
}

// cancelledItems lists the drift fact changes the plan proposes to undo,
// each with what drift did to the fact when the drift comparison records it.
func cancelledItems(cancelled []form.Cancellation, drift *form.Comparison, names map[string]string) []reportItem {
	byID := map[string]form.ChangeKind{}
	if drift != nil {
		for _, change := range drift.Facts {
			byID[change.ID] = change.Change
		}
	}
	items := make([]reportItem, 0, len(cancelled))
	for _, c := range cancelled {
		item := factItem(c.Fact, "", "", names)
		item.mark, item.status = "=", human.Neutral
		switch byID[c.Drift] {
		case form.ChangeAdded:
			item.text = "added by drift, planned for removal"
		case form.ChangeRemoved:
			item.text = "removed by drift, planned for restoration"
		default:
			item.text = "changed by drift, planned for restoration"
		}
		item.bucket = item.text
		items = append(items, item)
	}
	return items
}

// sameEntries reports that two comparisons hold the same entries. An entry
// identifier names its comparison, so it is left out of the comparison.
func sameEntries(a, b *form.Comparison) bool {
	return equalWithoutIDs(a.Representations, b.Representations, func(e form.RepresentationChange) form.RepresentationChange { e.ID = ""; return e }) &&
		equalWithoutIDs(a.Facts, b.Facts, func(e form.FactChange) form.FactChange { e.ID = ""; return e }) &&
		equalWithoutIDs(a.Indeterminate, b.Indeterminate, func(e form.IndeterminateClosure) form.IndeterminateClosure { e.ID = ""; return e })
}

func equalWithoutIDs[T any](a, b []T, withoutID func(T) T) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if !reflect.DeepEqual(withoutID(a[i]), withoutID(b[i])) {
			return false
		}
	}
	return true
}

// representationChangeItem states one instance change. In a planned
// comparison a replacement or a recreation is worded as the plan's proposal.
func representationChangeItem(change form.RepresentationChange, names map[string]string, planned bool) reportItem {
	verbs := instanceVerbs(planned)
	item := reportItem{code: nameOf(change.Representation, names), mark: "~", status: human.Warn}
	switch change.Change {
	case form.ChangeAdded:
		item.mark, item.status, item.text = "+", human.Good, verbs[0]
	case form.ChangeRemoved:
		item.mark, item.status, item.text = "-", human.Bad, verbs[1]
	case form.ChangeMoved:
		item.text, item.bucket, item.previous = "moved from "+change.PreviousAddress, verbs[3], change.PreviousAddress
	case form.ChangeReplaced:
		item.text = verbs[4]
	case form.ChangeRecreated:
		item.text = verbs[5]
	default:
		item.text, item.bucket, item.detail = "changed: "+strings.Join(change.Fields, ", "), verbs[2], strings.Join(change.Fields, ", ")
	}
	if item.bucket == "" {
		item.bucket = item.text
	}
	if change.Reason != "" {
		item.reason = changeReasonWords(change.Reason)
		item.text += " (" + item.reason + ")"
	}
	return item
}

// changeReasonWords turns a comparison reason code into report words. The
// document keeps the code; the report names the tools that recorded it.
func changeReasonWords(reason string) string {
	if reason == "deleted_outside_producer" {
		return "deleted outside Terraform or OpenTofu"
	}
	return strings.ReplaceAll(reason, "_", " ")
}

// factChangeItem states one fact change: its source, the link that names the
// fact, its target and its status. The fact kind titles its list.
func factChangeItem(change form.FactChange, names map[string]string) reportItem {
	item := factItem(change.Fact, change.From, change.To, names)
	item.text, item.bucket = string(change.Change), string(change.Change)
	switch change.Change {
	case form.ChangeAdded:
		item.mark, item.status = "+", human.Good
	case form.ChangeRemoved:
		item.mark, item.status = "-", human.Bad
	default:
		item.mark, item.status = "~", human.Warn
	}
	return item
}

// factItem names a fact by its endpoints and the predicate, dimension or
// contribution that links them. from and to, when given, are the endpoints a
// comparison records; the identity gives them otherwise.
func factItem(id, from, to string, names map[string]string) reportItem {
	kind, link, idFrom, idTo := factParts(id)
	if kind == "" {
		return reportItem{code: id}
	}
	if from == "" || to == "" {
		from, to = idFrom, idTo
	}
	return reportItem{code: nameOf(from, names), kind: kind, link: link, target: nameOf(to, names)}
}

// factParts reads a fact identity: its kind, the short name of its predicate
// or dimension ("contribution" for a contribution) and its two endpoints.
// Fact identities join escaped components with ':'.
func factParts(id string) (kind, link, from, to string) {
	parts := strings.Split(id, ":")
	for i := range parts {
		parts[i] = unescapeComponent(parts[i])
	}
	switch {
	case len(parts) == 4 && (parts[0] == "relation" || parts[0] == "context"):
		return parts[0], shortName(parts[1]), parts[2], parts[3]
	case len(parts) == 3 && parts[0] == "contribution":
		return parts[0], "contribution", parts[1], parts[2]
	}
	return "", "", "", ""
}

func unescapeComponent(value string) string {
	return strings.ReplaceAll(strings.ReplaceAll(value, "%3A", ":"), "%25", "%")
}

// shortName keeps the last segment of a qualified semantic identifier.
func shortName(id string) string {
	for _, kind := range []string{".relation.", ".context.", ".concept.", ".rule.", ".policy."} {
		if _, name, found := strings.Cut(id, kind); found {
			return name
		}
	}
	return id
}

// representationNames maps representation identities to what a reader
// recognizes: the instance address, or the concept of an external endpoint.
func representationNames(d form.Form) map[string]string {
	names := map[string]string{}
	add := func(a *form.InputForm) {
		if a == nil {
			return
		}
		for _, stage := range form.Stages() {
			architecture := a.Stages[stage]
			if architecture == nil {
				continue
			}
			for _, r := range architecture.Representations {
				if r.Address != "" {
					names[r.ID] = r.Address
				} else if r.Kind == form.RepresentationExternal {
					names[r.ID] = "external " + shortName(r.Concept)
				}
			}
		}
	}
	add(d.Input)
	if d.Comparison != nil {
		add(&d.Comparison.Before.Form)
		add(&d.Comparison.After.Form)
	}
	return names
}

func nameOf(id string, names map[string]string) string {
	if name := names[id]; name != "" {
		return name
	}
	return id
}

// diagnosticsBlock groups document diagnostics by code, so hundreds of
// instances with one cause read as one line with a count. Informational
// diagnostics and codes appear with --details.
func diagnosticsBlock(diagnostics []form.Diagnostic, details bool) (reportBlock, bool) {
	type group struct {
		severity form.DiagnosticSeverity
		code     string
		message  string
		count    int
	}
	groups := map[string]*group{}
	for _, d := range diagnostics {
		if d.Severity == form.SeverityInfo && !details {
			continue
		}
		key := string(d.Severity) + "\x00" + d.Code
		g := groups[key]
		if g == nil {
			g = &group{severity: d.Severity, code: d.Code, message: d.Message}
			groups[key] = g
		}
		if d.Count > 0 {
			g.count += d.Count
		} else {
			g.count++
		}
	}
	if len(groups) == 0 {
		return reportBlock{}, false
	}
	ordered := make([]*group, 0, len(groups))
	for _, g := range groups {
		ordered = append(ordered, g)
	}
	rank := map[form.DiagnosticSeverity]int{form.SeverityError: 0, form.SeverityWarning: 1, form.SeverityInfo: 2}
	sort.Slice(ordered, func(i, j int) bool {
		if rank[ordered[i].severity] != rank[ordered[j].severity] {
			return rank[ordered[i].severity] < rank[ordered[j].severity]
		}
		return ordered[i].code < ordered[j].code
	})
	items := []reportItem{}
	for _, g := range ordered {
		status := human.Neutral
		switch g.severity {
		case form.SeverityError:
			status = human.Bad
		case form.SeverityWarning:
			status = human.Warn
		}
		text := g.message
		if g.count > 1 {
			text += fmt.Sprintf(" (%d occurrences)", g.count)
		}
		item := reportItem{mark: titleWord(string(g.severity)), status: status, text: text}
		if details {
			item.code = g.code
		}
		items = append(items, item)
	}
	return reportBlock{title: "Diagnostics", role: roleDiagnostics, groups: []reportGroup{{items: items, noun: "diagnostics"}}, budget: reportTextLimit}, true
}

func runDiagnosticList(decoded form.Form) []form.Diagnostic {
	if decoded.Input != nil {
		return decoded.Input.Diagnostics
	}
	if decoded.Comparison != nil {
		all := append([]form.Diagnostic{}, decoded.Comparison.Before.Form.Diagnostics...)
		all = append(all, decoded.Comparison.After.Form.Diagnostics...)
		return append(all, decoded.Comparison.Diagnostics...)
	}
	return nil
}

// indeterminateWords counts the unsettled closures of each side apart, as
// indeterminateTable does, without their reasons.
func indeterminateWords(entries []form.IndeterminateClosure, before, after string, compact bool) string {
	if len(entries) == 0 {
		return "0"
	}
	totals := map[string]int{}
	for _, entry := range entries {
		totals[entry.Side]++
	}
	parts := []string{}
	for _, side := range []string{form.SideBefore, form.SideAfter} {
		if totals[side] == 0 {
			continue
		}
		if compact {
			parts = append(parts, fmt.Sprintf("%d %s", totals[side], side))
			continue
		}
		stage := before
		if side == form.SideAfter {
			stage = after
		}
		parts = append(parts, fmt.Sprintf("%d in %s", totals[side], stage))
	}
	return strings.Join(parts, ", ")
}

func sortedByCount(counts map[string]int) []string {
	names := make([]string, 0, len(counts))
	for name := range counts {
		names = append(names, name)
	}
	sort.Slice(names, func(i, j int) bool {
		if counts[names[i]] != counts[names[j]] {
			return counts[names[i]] > counts[names[j]]
		}
		return names[i] < names[j]
	})
	return names
}

// preview chooses the entries of a block a summary shows: every entry with
// --details; otherwise one entry of each group and status in turn, in listed
// order, until the block's budget is spent, so no kind or status present
// disappears behind a larger one. Each group keeps its listed order.
func (b reportBlock) preview(details bool) [][]reportItem {
	shown := make([][]reportItem, len(b.groups))
	if details {
		for i, g := range b.groups {
			shown[i] = g.items
		}
		return shown
	}
	budget := b.budget
	if budget == 0 {
		budget = reportTextLimit
	}
	type bucket struct {
		group   int
		entries []int
	}
	var buckets []bucket
	chosen := make([]map[int]bool, len(b.groups))
	for i, g := range b.groups {
		chosen[i] = map[int]bool{}
		index := map[string]int{}
		for j, item := range g.items {
			k, found := index[item.bucket]
			if !found {
				k = len(buckets)
				index[item.bucket] = k
				buckets = append(buckets, bucket{group: i})
			}
			buckets[k].entries = append(buckets[k].entries, j)
		}
	}
	for round := 0; budget > 0; round++ {
		taken := false
		for _, bk := range buckets {
			if budget == 0 || round >= len(bk.entries) {
				continue
			}
			chosen[bk.group][bk.entries[round]] = true
			taken = true
			budget--
		}
		if !taken {
			break
		}
	}
	for i, g := range b.groups {
		for j, item := range g.items {
			if chosen[i][j] {
				shown[i] = append(shown[i], item)
			}
		}
	}
	return shown
}

// moreWords says how many entries of a group a summary shows and, when the
// group holds several statuses, how many of each. An entry counts the
// changes it stands for.
func moreWords(g reportGroup, shown []reportItem) string {
	var order []string
	totals, counts, all, seen := map[string]int{}, map[string]int{}, 0, 0
	for _, item := range g.items {
		if totals[item.bucket] == 0 {
			order = append(order, item.bucket)
		}
		totals[item.bucket] += item.weight()
		all += item.weight()
	}
	for _, item := range shown {
		counts[item.bucket] += item.weight()
		seen += item.weight()
	}
	if seen >= all {
		return ""
	}
	line := fmt.Sprintf("%d of %d %s shown", seen, all, g.noun)
	if len(order) > 1 {
		parts := make([]string, 0, len(order))
		for _, bucket := range order {
			parts = append(parts, fmt.Sprintf("%d of %d %s", counts[bucket], totals[bucket], bucket))
		}
		line += ": " + strings.Join(parts, ", ")
	}
	return line + "."
}

// displayAll ends a block whose preview left entries out.
const displayAll = "Use --details to display all."

// writeText renders the summary for a terminal or a .txt file. Color follows
// the writer; every word stands without it.
func (rep runReport) writeText(w io.Writer) {
	human.Verdict(w, safeText(rep.verdict), human.Neutral)
	width := labelWidth(rep.head)
	if rep.sides != nil {
		for _, row := range rep.sides.rows {
			width = max(width, utf8.RuneCountInString(row[0]))
		}
	}
	if len(rep.head) > 0 {
		fmt.Fprintln(w)
		writeWrapped(w, "", rep.head, width, rep.literal)
	}
	if rep.sides != nil {
		fmt.Fprintln(w)
		writeReportTable(w, "", rep.sides, width)
	}
	for _, block := range rep.blocks {
		human.Section(w, safeText(block.title))
		parts := 0
		part := func() {
			if parts > 0 {
				fmt.Fprintln(w)
			}
			parts++
		}
		writeLines := func(lines []string) {
			if len(lines) == 0 {
				return
			}
			part()
			for _, line := range lines {
				for _, wrapped := range wrapWords(safeText(line), reportLineWidth-2) {
					fmt.Fprintf(w, "  %s\n", wrapped)
				}
			}
		}
		writeLines(block.lead)
		if len(block.rows) > 0 {
			part()
			writeWrapped(w, "  ", block.rows, labelWidth(block.rows), nil)
		}
		if block.table != nil {
			part()
			writeReportTable(w, "  ", block.table, 0)
		}
		writeLines(block.lines)
		previews := block.preview(rep.details || rep.complete)
		truncated := false
		for i, group := range block.groups {
			if len(group.items) == 0 {
				continue
			}
			part()
			indent := "  "
			if group.title != "" {
				fmt.Fprintf(w, "  %s\n", human.Emphasis(w, safeText(group.title), human.Neutral))
				indent = "    "
			}
			writeItems(w, indent, previews[i])
			if more := moreWords(group, previews[i]); more != "" {
				truncated = true
				for _, line := range wrapWords(more, reportLineWidth-len(indent)) {
					fmt.Fprintf(w, "%s%s\n", indent, human.Dim(w, line))
				}
			}
		}
		if truncated {
			part()
			fmt.Fprintf(w, "  %s\n", human.Dim(w, displayAll))
		}
		writeLines(block.tail)
		if rep.details {
			writeLines(block.notes)
		}
	}
}

// writeItems writes the previewed entries of a group. Facts keep their link
// and target on the entry's line when every fact fits reportLineWidth
// columns, and continue on an indented line otherwise. An entry whose name
// leaves no room for its status continues with the status; identifiers are
// never cut.
func writeItems(w io.Writer, indent string, items []reportItem) {
	width := codeWidth(items)
	from, link, words, facts := 0, 0, 0, false
	for _, item := range items {
		if item.target == "" {
			continue
		}
		facts = true
		from = max(from, utf8.RuneCountInString(safeText(item.code)))
		link = max(link, utf8.RuneCountInString(safeText(item.linkWords())))
		words = max(words, utf8.RuneCountInString(safeText(item.words())))
	}
	inline := facts && len(indent)+2+from+2+link+2+words <= reportLineWidth
	next := indent + "    "
	for _, item := range items {
		if item.target != "" && inline {
			fmt.Fprintf(w, "%s%s\n", indent, item.factLine(w, from, link))
			continue
		}
		if item.text == "" || len(indent)+item.headWidth(width) <= reportLineWidth {
			fmt.Fprintf(w, "%s%s\n", indent, item.terminal(w, width))
			if item.target != "" {
				fmt.Fprintf(w, "%s%s\n", next, item.linkTerminal(w))
			}
			continue
		}
		status := safeText(item.words())
		if item.code == "" {
			hang := 0
			if item.mark != "" {
				hang = utf8.RuneCountInString(item.mark) + 1
			}
			for i, line := range wrapWords(status, reportLineWidth-len(indent)-hang) {
				lead := strings.Repeat(" ", hang)
				if i == 0 && item.mark != "" {
					lead = human.Tint(w, item.mark, item.status) + " "
				}
				fmt.Fprintf(w, "%s%s%s\n", indent, lead, human.Dim(w, line))
			}
			continue
		}
		bare := item
		bare.text, bare.count = "", 0
		fmt.Fprintf(w, "%s%s\n", indent, bare.terminal(w, 0))
		if item.target != "" {
			if len(next)+utf8.RuneCountInString(safeText(item.linkWords()))+2+utf8.RuneCountInString(status) <= reportLineWidth {
				fmt.Fprintf(w, "%s%s  %s\n", next, item.linkTerminal(w), human.Dim(w, status))
				continue
			}
			fmt.Fprintf(w, "%s%s\n", next, item.linkTerminal(w))
		}
		for _, line := range wrapWords(status, reportLineWidth-len(next)) {
			fmt.Fprintf(w, "%s%s\n", next, human.Dim(w, line))
		}
	}
}

// headWidth is the visible width of an entry's first line: its mark, its
// name padded to width and its status.
func (item reportItem) headWidth(width int) int {
	n := 0
	if item.mark != "" {
		n += utf8.RuneCountInString(item.mark) + 1
	}
	code := utf8.RuneCountInString(safeText(item.code))
	n += code
	if words := item.words(); words != "" {
		if item.code != "" {
			n += max(width-code, 0) + 2
		}
		n += utf8.RuneCountInString(safeText(words))
	}
	return n
}

// linkWords names a fact's link and target, as in "network -> aws_vpc.main".
func (item reportItem) linkWords() string {
	return item.link + " -> " + item.target
}

func (item reportItem) linkTerminal(w io.Writer) string {
	return human.Dim(w, safeText(item.link)+" ->") + " " + safeText(item.target)
}

// factLine writes a fact on one line, its source and its link padded to the
// widest of its list so the statuses align.
func (item reportItem) factLine(w io.Writer, from, link int) string {
	code, words := safeText(item.code), safeText(item.linkWords())
	var b strings.Builder
	b.WriteString(human.Tint(w, item.mark, item.status) + " ")
	b.WriteString(code + strings.Repeat(" ", from-utf8.RuneCountInString(code)+2))
	b.WriteString(item.linkTerminal(w))
	if item.text != "" {
		b.WriteString(strings.Repeat(" ", link-utf8.RuneCountInString(words)+2) + human.Dim(w, safeText(item.words())))
	}
	return b.String()
}

// wrapWords breaks Rootform wording at spaces so each line fits width
// columns. A word longer than width, such as an address, stays whole, and the
// spaces of the original line are kept.
func wrapWords(text string, width int) []string {
	if utf8.RuneCountInString(text) <= width {
		return []string{text}
	}
	var lines []string
	line := ""
	for _, word := range strings.Split(text, " ") {
		switch {
		case line == "":
			line = word
		case utf8.RuneCountInString(line)+1+utf8.RuneCountInString(word) > width:
			lines = append(lines, line)
			line = word
		default:
			line += " " + word
		}
	}
	return append(lines, line)
}

// codeWidth aligns the entry text of a list, up to reportCodeWidth columns.
func codeWidth(items []reportItem) int {
	width := 0
	for _, item := range items {
		if n := utf8.RuneCountInString(safeText(item.code)); n <= reportCodeWidth && n > width {
			width = n
		}
	}
	return width
}

func (item reportItem) terminal(w io.Writer, width int) string {
	var b strings.Builder
	if item.mark != "" {
		b.WriteString(human.Tint(w, item.mark, item.status))
		b.WriteString(" ")
	}
	if item.code != "" {
		code := safeText(item.code)
		b.WriteString(code)
		if item.text != "" {
			b.WriteString(strings.Repeat(" ", max(width-utf8.RuneCountInString(code), 0)+2))
		}
	}
	if item.text != "" {
		b.WriteString(human.Dim(w, safeText(item.words())))
	}
	return b.String()
}

// writeRows aligns label and value rows.
func writeRows(w io.Writer, indent string, rows [][2]string) {
	writeAligned(w, indent, rows, labelWidth(rows))
}

// writeWrapped writes label and value rows as writeAligned does, breaking a
// long value of Rootform wording at spaces under its first line. Literal rows
// carry text the user typed and stay whole.
func writeWrapped(w io.Writer, indent string, rows [][2]string, width int, literal map[string]bool) {
	for _, row := range rows {
		lines := []string{safeText(row[1])}
		if !literal[row[0]] {
			lines = wrapWords(lines[0], max(reportLineWidth-len(indent)-width-2, 24))
		}
		for i, line := range lines {
			label := row[0]
			if i > 0 {
				label = ""
			}
			gap := strings.Repeat(" ", width-utf8.RuneCountInString(label)+2)
			fmt.Fprintf(w, "%s%s%s%s\n", indent, human.Dim(w, safeText(label)), gap, line)
		}
	}
}

// writeReportTable renders a table whose first column is at least width wide.
// Numeric columns align right; labels and headers are dimmed.
func writeReportTable(w io.Writer, indent string, t *reportTable, width int) {
	widths := make([]int, len(t.header))
	for i, cell := range t.header {
		widths[i] = utf8.RuneCountInString(safeText(cell))
	}
	for _, row := range t.rows {
		for i, cell := range row {
			widths[i] = max(widths[i], utf8.RuneCountInString(safeText(cell)))
		}
	}
	widths[0] = max(widths[0], width)
	line := func(cells []string, header bool) {
		var b strings.Builder
		b.WriteString(indent)
		for i, cell := range cells {
			text := safeText(cell)
			shown := text
			if header || (i == 0 && !t.literal) {
				shown = human.Dim(w, text)
			}
			gap := strings.Repeat(" ", widths[i]-utf8.RuneCountInString(text))
			switch {
			case i > 0 && t.numeric:
				b.WriteString(gap + shown)
			case i < len(cells)-1:
				b.WriteString(shown + gap)
			default:
				b.WriteString(shown)
			}
			if i == 0 {
				b.WriteString("  ")
			} else if i < len(cells)-1 {
				b.WriteString("   ")
			}
		}
		fmt.Fprintln(w, strings.TrimRight(b.String(), " "))
	}
	line(t.header, true)
	for _, row := range t.rows {
		line(row, false)
	}
}

// singleBlankLines keeps one blank line between Markdown blocks and ends the
// report with one newline.
func singleBlankLines(text string) string {
	for strings.Contains(text, "\n\n\n") {
		text = strings.ReplaceAll(text, "\n\n\n", "\n\n")
	}
	return strings.TrimRight(text, "\n") + "\n"
}

// safeText makes untrusted text inert on a terminal: control characters,
// escape sequences and bidirectional overrides are shown as escapes instead
// of being interpreted.
func safeText(value string) string {
	var b strings.Builder
	for _, r := range value {
		if r == utf8.RuneError || unicode.IsControl(r) || bidiControl(r) {
			fmt.Fprintf(&b, "\\u%04x", r)
			continue
		}
		b.WriteRune(r)
	}
	return b.String()
}

func bidiControl(r rune) bool {
	return (r >= 0x202A && r <= 0x202E) || (r >= 0x2066 && r <= 0x2069) || r == 0x200E || r == 0x200F || r == 0x061C
}

// mdText escapes Markdown and HTML syntax so untrusted text renders as the
// characters it contains.
func mdText(value string) string {
	value = safeText(value)
	var b strings.Builder
	for _, r := range value {
		switch r {
		case '\\', '\x60', '*', '_', '{', '}', '[', ']', '(', ')', '#', '+', '!', '|', '~', '>', '<', '&':
			b.WriteRune('\\')
		}
		b.WriteRune(r)
	}
	return b.String()
}

// mdCode renders untrusted text as a code span that no backtick run inside the
// value can close.
func mdCode(value string) string {
	value = safeText(value)
	longest, run := 0, 0
	for _, r := range value {
		if r == '\x60' {
			run++
			if run > longest {
				longest = run
			}
		} else {
			run = 0
		}
	}
	fence := strings.Repeat("\x60", longest+1)
	if longest > 0 {
		return fence + " " + value + " " + fence
	}
	return fence + value + fence
}

// shellQuote quotes a path for a command a reader may copy.
func shellQuote(value string) string {
	safe := value != ""
	for _, r := range value {
		if !(unicode.IsLetter(r) || unicode.IsDigit(r) || strings.ContainsRune("-_./=:@+,", r)) {
			safe = false
			break
		}
	}
	if safe {
		return value
	}
	return "'" + strings.ReplaceAll(value, "'", "'\"'\"'") + "'"
}
