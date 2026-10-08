package app

import (
	"fmt"
	"html"
	"strings"

	"github.com/rootform-dev/rootform/cli/form"
)

// A review document is the Markdown a pull or merge request shows. The run
// report and the check report use one identity, major blocks and subsections.
// Integrations retain that hierarchy when composing the reports. Rootform
// wording and counts alone build the structure: headings, labels, table
// headers and the summary of a folded list. Every recorded value, such as an
// address, a reference or a message, is escaped with mdText or set in a code
// span, so it renders as the characters it contains.

// review writes one review document.
type review struct {
	b strings.Builder
	// truncated records that a list shows a preview, so the document ends by
	// saying which report lists every entry.
	truncated bool
}

func (v *review) heading(level int, words string) {
	if level == 4 {
		words = reviewSectionTitle(words)
	}
	fmt.Fprintf(&v.b, "%s %s\n\n", strings.Repeat("#", level), words)
}

// reviewSectionTitle gives architectural readings stable, typographic cues.
// It changes presentation only; stages, statuses and evidence stay unchanged.
func reviewSectionTitle(words string) string {
	switch words {
	case "Uncertainty":
		return "? " + words
	case "Planned changes":
		return "± " + words
	case "Reported drift":
		return "↺ " + words
	case "Net change":
		return "Δ " + words
	case "Planned architecture":
		return "▦ " + words
	default:
		return words
	}
}

// paragraph writes Markdown whose values are already escaped.
func (v *review) separator() {
	v.b.WriteString("---\n\n")
}

func (v *review) alert(kind, markdown string) {
	fmt.Fprintf(&v.b, "> [!%s]\n> %s\n\n", kind, markdown)
}

func (v *review) paragraph(markdown string) {
	if markdown != "" {
		v.b.WriteString(markdown + "\n\n")
	}
}

// item writes one list item at a nesting depth; endList ends the list.
func (v *review) item(depth int, markdown string) {
	v.b.WriteString(strings.Repeat("  ", depth) + "- " + markdown + "\n")
}

func (v *review) endList() {
	v.b.WriteString("\n")
}

// fold opens a collapsible section. Its summary holds Rootform wording and
// counts only, escaped as HTML all the same; the blank lines around the
// content let it render as Markdown.
func (v *review) fold(summary string) {
	v.b.WriteString("<details>\n<summary>" + html.EscapeString(summary) + "</summary>\n\n")
}

func (v *review) unfold() {
	v.b.WriteString("</details>\n\n")
}

// grid writes escaped cells, centering numeric dimensions while labels stay
// left-aligned. Mixed tables can name their numeric columns explicitly.
func (v *review) grid(header []string, numeric bool, rows [][]string, numericColumns ...int) {
	align := make([]string, len(header))
	for i := range header {
		align[i] = "---"
		if i > 0 && numeric {
			align[i] = ":---:"
		}
		for _, column := range numericColumns {
			if i == column {
				align[i] = ":---:"
			}
		}
	}
	v.b.WriteString("| " + strings.Join(header, " | ") + " |\n")
	v.b.WriteString("| " + strings.Join(align, " | ") + " |\n")
	for _, row := range rows {
		v.b.WriteString("| " + strings.Join(row, " | ") + " |\n")
	}
	v.b.WriteString("\n")
}

// table writes a report table. A literal first column holds untrusted names
// and renders as code; an indented first cell details the row above it and
// renders in emphasis.
func (v *review) table(t *reportTable) {
	if t == nil {
		return
	}
	header := make([]string, len(t.header))
	for i, cell := range t.header {
		header[i] = mdText(cell)
	}
	rows := make([][]string, len(t.rows))
	for i, row := range t.rows {
		cells := make([]string, len(row))
		for j, cell := range row {
			cells[j] = mdText(cell)
			switch {
			case j == 0 && t.literal:
				cells[j] = mdCellCode(cell)
			case j == 0 && strings.HasPrefix(cell, "  "):
				cells[j] = "*" + mdText(strings.TrimLeft(cell, " ")) + "*"
			}
		}
		rows[i] = cells
	}
	v.grid(header, t.numeric, rows)
}

// transpose changes only presentation; the shared table remains available to
// the terminal renderer with its original grouping and values.
func transpose(t *reportTable, label string) *reportTable {
	out := &reportTable{header: []string{label}, numeric: t.numeric}
	for _, row := range t.rows {
		out.header = append(out.header, strings.TrimSpace(row[0]))
	}
	for column, name := range t.header[1:] {
		row := []string{name}
		for _, values := range t.rows {
			row = append(row, values[column+1])
		}
		out.rows = append(out.rows, row)
	}
	return out
}

// A short set of causes compares naturally across stages or sides. Several
// kinds need their parent/child grouping; many causes read better as rows.
func (v *review) uncertainty(t *reportTable) {
	if t == nil {
		return
	}
	kinds := 0
	for _, row := range t.rows {
		if !strings.HasPrefix(row[0], "  ") {
			kinds++
		}
	}
	if kinds != 1 || len(t.rows) > 5 {
		v.table(t)
		return
	}
	label := "Stage"
	if len(t.header) > 1 && t.header[1] == "Before" {
		label = "Side"
	}
	v.table(transpose(t, label))
}

// rows writes label and value rows as a list. A literal row holds text the
// user typed, set in a code span; a row without a label details the row above
// it.
func (v *review) rows(rows [][2]string, literal map[string]bool) {
	for _, row := range rows {
		value := mdText(row[1])
		if literal[row[0]] {
			value = mdCode(row[1])
		}
		if row[0] == "" {
			v.item(1, value)
			continue
		}
		v.item(0, "**"+mdText(row[0])+":** "+value)
	}
	if len(rows) > 0 {
		v.endList()
	}
}

func (v *review) bytes() []byte {
	return []byte(singleBlankLines(v.b.String()))
}

// strong sets Rootform wording in bold.
func strong(words string) string {
	return "**" + mdText(words) + "**"
}

// labelled leads a limit with its name in bold.
func labelled(label string, lines []string) string {
	label = reviewSectionTitle(label)
	if len(lines) == 0 {
		return strong(label)
	}
	return "**" + mdText(label) + ":** " + mdText(strings.Join(lines, " "))
}

// joinWords joins words as a sentence lists them: "a and b", "a, b, and c".
func joinWords(words []string) string {
	switch len(words) {
	case 0:
		return ""
	case 1:
		return words[0]
	case 2:
		return words[0] + " and " + words[1]
	}
	return strings.Join(words[:len(words)-1], ", ") + ", and " + words[len(words)-1]
}

// reviewPreview ends a run review whose lists show a preview.
const reviewPreview = "Each list above shows at most 10 entries. A report written with `--details` lists every entry."

// markdown renders the run summary as a review document: the conclusion and
// its scope, the limits that qualify it, the counts, the drift and net
// change of a plan, the entries, the architecture measures and diagnostics,
// then the provenance.
func (rep runReport) markdown() []byte {
	v := &review{}
	v.heading(2, "Rootform")
	v.heading(3, "Architecture")
	lead := rep.block(roleChanges)
	if lead == nil {
		lead = rep.block(roleDifferences)
	}
	switch {
	case lead != nil && lead.comparison != nil:
		v.paragraph(strong(comparisonConclusion(lead)))
		v.paragraph(rep.scope(lead))
		for _, problem := range lead.comparison.Problems {
			v.paragraph(mdText("Not comparable: " + problem.Message))
		}
	case len(rep.views) == 1:
		v.paragraph(strong(architectureConclusion(rep.views[0])))
		v.paragraph(mdText(rep.verdict + "."))
	default:
		v.paragraph(strong(rep.verdict + "."))
	}
	rep.writeLimits(v, lead)
	if lead != nil {
		v.heading(4, mdText(lead.title))
		rep.writeCounts(v, lead)
		if holdsEntries(lead.groups) {
			rep.writeChanges(v, lead.groups)
		}
	}
	if b := rep.block(roleDrift); b != nil {
		rep.writeDrift(v, *b)
	}
	if b := rep.block(roleNet); b != nil {
		rep.writeNet(v, *b)
	}
	if b := rep.block(roleArchitecture); b != nil {
		rep.writeArchitecture(v, *b)
	}
	if b := rep.block(roleDiagnostics); b != nil {
		rep.writeDiagnostics(v, *b)
	}
	if len(rep.views) == 2 && rep.sides != nil {
		rep.writeSideCounts(v)
	}
	rep.writeProvenance(v)
	return v.bytes()
}

// block is the first block of a role, or nil.
func (rep runReport) block(role blockRole) *reportBlock {
	for i := range rep.blocks {
		if rep.blocks[i].role == role {
			return &rep.blocks[i]
		}
	}
	return nil
}

func holdsEntries(groups []reportGroup) bool {
	for _, g := range groups {
		if len(g.items) > 0 {
			return true
		}
	}
	return false
}

// kindChanges counts the changes of one kind of a comparison by status, in
// the order instanceVerbs names them.
type kindChanges struct {
	title, singular, plural string
	counts                  []int
}

func (k kindChanges) total() int {
	return sum(k.counts)
}

// changeKinds counts each kind a comparison changes, each kind apart.
func changeKinds(c *form.Comparison) []kindChanges {
	var kinds []kindChanges
	add := func(title, singular, plural string, counts []int) {
		if sum(counts) > 0 {
			kinds = append(kinds, kindChanges{title: title, singular: singular, plural: plural, counts: counts})
		}
	}
	add("Instances", "instance", "instances", representationCounts(c, false))
	add("External endpoints", "external endpoint", "external endpoints", representationCounts(c, true))
	for _, kind := range factKinds {
		counts := make([]int, 6)
		for _, f := range c.Facts {
			if f.Kind != kind.kind {
				continue
			}
			switch f.Change {
			case form.ChangeAdded:
				counts[0]++
			case form.ChangeRemoved:
				counts[1]++
			case form.ChangeChanged:
				counts[2]++
			}
		}
		add(kind.title, strings.TrimSuffix(kind.title, "s"), kind.title, counts)
	}
	return kinds
}

// changeWords sums a comparison up by kind, never across kinds: "3 instances
// and 2 Contexts added" when every kind changes one way, the
// statuses of a single kind, else the kinds that change. cross words the
// differences of two inputs.
func changeWords(c *form.Comparison, cross bool) string {
	kinds := changeKinds(c)
	if len(kinds) == 0 {
		return "No architectural difference determined under the selected Dialects."
	}
	verbs := instanceVerbs(plannedComparison(c))
	verb, uniform := "", true
	for _, k := range kinds {
		status := -1
		for i, n := range k.counts {
			if n == 0 {
				continue
			}
			if status >= 0 {
				uniform = false
			}
			status = i
		}
		if verb != "" && verb != verbs[status] {
			uniform = false
		}
		verb = verbs[status]
	}
	parts := make([]string, len(kinds))
	for i, k := range kinds {
		parts[i] = countWithNoun(k.total(), k.singular, k.plural)
	}
	switch {
	case uniform:
		return joinWords(parts) + " " + verb + "."
	case len(kinds) == 1:
		return countedWords(kinds[0].singular, kinds[0].plural, kinds[0].counts, verbs) + "."
	case cross:
		return "Differences in " + joinWords(parts) + "."
	}
	return "Changes to " + joinWords(parts) + "."
}

// comparisonConclusion is the first line of a review: what the main
// comparison determined, or that it could not compare.
func comparisonConclusion(b *reportBlock) string {
	c := b.comparison
	if !c.Comparable {
		if b.role == roleDifferences {
			return "The two inputs are not comparable."
		}
		return b.title + " are not comparable."
	}
	return changeWords(c, b.role == roleDifferences)
}

// architectureConclusion measures a stage when no comparison concludes: its
// instances and determined facts, each kind apart.
func architectureConclusion(v stageView) string {
	a := v.architecture()
	stage := stageWords(v.stage)
	if a == nil {
		return "This Form has no " + stage + " stage."
	}
	n := a.Accounting
	if n.Instances == 0 && len(a.Representations) == 0 {
		return stage + " architecture: no instance."
	}
	instances := countWithNoun(n.Instances, "instance", "instances")
	if n.DataInstances > 0 {
		instances += fmt.Sprintf(" (%d managed, %d data)", n.ManagedInstances, n.DataInstances)
	}
	parts := []string{instances}
	for _, kind := range []struct {
		count            int
		singular, plural string
	}{{len(a.Relations), "Relation", "Relations"}, {len(a.Contexts), "Context", "Contexts"}, {len(a.Contributions), "Contribution", "Contributions"}} {
		if kind.count > 0 {
			parts = append(parts, countWithNoun(kind.count, kind.singular, kind.plural))
		}
	}
	if len(parts) == 1 {
		return stage + " architecture: " + instances + "; no fact determined."
	}
	return stage + " architecture: " + joinWords(parts) + "."
}

// scope states what the review compares: the verdict and the stages, and for
// two inputs that their differences are not drift.
func (rep runReport) scope(b *reportBlock) string {
	c := b.comparison
	before, after := strong(stageWords(c.Before)), strong(stageWords(c.After))
	if b.role == roleDifferences {
		return mdText(rep.verdict) + ". Differences compare the " + before + " stage of **Before** with the " + after + " stage of **After**."
	}
	return mdText(rep.verdict) + ". " + mdText(b.title) + " compare " + before + " with " + after + "."
}

// writeLimits states, unfolded and before any count, what qualifies the
// conclusion: instances no Rule interprets, an incomplete plan, a refused
// saved plan, carried instances and what the evidence could not settle.
func (rep runReport) writeLimits(v *review, lead *reportBlock) {
	if b := rep.block(roleLimited); b != nil {
		v.paragraph(labelled("Limited interpretation", b.lead))
		v.table(b.table)
		v.paragraph(mdText(strings.Join(b.tail, " ")))
	}
	for _, view := range rep.views {
		if view.form == nil {
			continue
		}
		suffix := ""
		if view.side != "" {
			suffix = " (" + view.side + ")"
		}
		evidence := view.form.Evidence
		if view.form.Kind == form.KindPlan && evidence.Completeness.ProducerComplete == form.CompleteFalse {
			v.paragraph(labelled("Plan completeness"+suffix, []string{completenessWords(evidence.Completeness) + "."}))
		}
		if evidence.Enrichment.Snapshot.Status == form.SnapshotRefused {
			v.paragraph(labelled("Enrichment"+suffix, []string{enrichmentWords(evidence.Enrichment.Snapshot)[0] + "."}))
		}
	}
	if len(rep.views) == 1 && rep.views[0].form != nil && rep.views[0].form.Kind == form.KindPlan {
		if planned := rep.views[0].form.Stages[form.StagePlanned]; planned != nil && planned.Accounting.Carried > 0 {
			v.paragraph(labelled("Carried instances", []string{carriedPlanNote(planned.Accounting.Carried)}))
		}
	}
	if b := rep.block(roleUncertainty); b != nil {
		v.paragraph(labelled("Uncertainty", b.lines))
		v.uncertainty(b.table)
	}
	if lead != nil && lead.table != nil {
		v.paragraph(labelled("Uncertainty", lead.lines))
		v.uncertainty(lead.table)
	}
}

// writeCounts tables the changes of a comparison by kind and status. Added
// and Removed always appear; another status appears when a kind holds it.
func (rep runReport) writeCounts(v *review, b *reportBlock) {
	c := b.comparison
	if c == nil || !c.Comparable {
		return
	}
	kinds := changeKinds(c)
	if len(kinds) > 0 {
		verbs := instanceVerbs(plannedComparison(c))
		used := []bool{true, true, false, false, false, false}
		for _, k := range kinds {
			for i, n := range k.counts {
				used[i] = used[i] || n > 0
			}
		}
		header := []string{"Change"}
		for _, k := range kinds {
			header = append(header, mdText(k.title))
		}
		var rows [][]string
		for i, verb := range verbs {
			if !used[i] {
				continue
			}
			row := []string{changeLabel(verb)}
			for _, k := range kinds {
				row = append(row, fmt.Sprint(k.counts[i]))
			}
			rows = append(rows, row)
		}
		v.grid(header, true, rows)
	}
	if b.table == nil && len(c.Indeterminate) > 0 && b.role != roleDifferences {
		if rep.uncertaintyShown(c) {
			return
		}
		v.paragraph(mdText("Indeterminate closures: " + indeterminateWords(c.Indeterminate, stageWords(c.Before), stageWords(c.After), false) + "."))
	}
}

func changeLabel(verb string) string {
	mark := map[string]string{"added": "+ ", "removed": "− ", "changed": "~ "}[verb]
	return mark + mdText(titleWord(verb))
}

// Suppress only the exact selected-stage count already shown above. A count
// on the other stage, or a different count, still carries distinct evidence.
func (rep runReport) uncertaintyShown(c *form.Comparison) bool {
	b := rep.block(roleUncertainty)
	if b == nil || b.table == nil || len(rep.views) != 1 || rep.views[0].stage != c.After {
		return false
	}
	for _, entry := range c.Indeterminate {
		if entry.Side != form.SideAfter {
			return false
		}
	}
	for _, row := range b.table.rows {
		if len(row) == 2 && row[0] == "Indeterminate closures" && row[1] == fmt.Sprint(len(c.Indeterminate)) {
			return true
		}
	}
	return false
}

// entryWords states an entry for a review list: a fact by its kind, an
// instance by its address, then words that follow its status, a previous
// address, a recorded reason and how many entries read alike.
func (item reportItem) entryWords(words string) string {
	var line string
	switch item.kind {
	case "relation":
		line = strong(item.link) + " from " + mdCode(item.code) + " to " + mdCode(item.target)
	case "context":
		line = strong(item.link) + ": " + mdCode(item.code) + " within " + mdCode(item.target)
	case "contribution":
		line = mdCode(item.code) + " contributes to " + mdCode(item.target)
	default:
		line = mdCode(item.code)
	}
	if words != "" {
		line += ": " + mdText(words)
	}
	if item.previous != "" {
		line += " (previously " + mdCode(item.previous) + ")"
	}
	if item.reason != "" {
		line += " (" + mdText(item.reason) + ")"
	}
	if item.count > 1 {
		line += fmt.Sprintf(" (%d entries)", item.count)
	}
	return line
}

// reviewList is one list of a review and how its entries read.
type reviewList struct {
	// title names the list and its counts; it heads the list unless quiet
	// asks for it only when the list is folded.
	title string
	quiet bool
	items []reportItem
	// nested lists the entries under their status; words otherwise states
	// each entry's status beside it.
	nested bool
	words  func(reportItem) string
}

func weight(items []reportItem) int {
	total := 0
	for _, item := range items {
		total += item.weight()
	}
	return total
}

// previewItems keeps at most limit entries of one list, one entry of each
// status in turn, so every status present stays visible; the list keeps its
// order.
func previewItems(items []reportItem, limit int) []reportItem {
	block := reportBlock{groups: []reportGroup{{items: items}}, budget: limit}
	return block.preview(false)[0]
}

// buckets names the statuses of a list in the order they first appear.
func buckets(items []reportItem) []string {
	var order []string
	seen := map[string]bool{}
	for _, item := range items {
		if !seen[item.bucket] {
			seen[item.bucket] = true
			order = append(order, item.bucket)
		}
	}
	return order
}

func inBucket(items []reportItem, bucket string) []reportItem {
	var out []reportItem
	for _, item := range items {
		if item.bucket == bucket {
			out = append(out, item)
		}
	}
	return out
}

// shownWords says how many entries a preview shows.
func shownWords(shown, total int) string {
	return fmt.Sprintf("%d of %d shown", shown, total)
}

// writeList writes one list: every entry with --details, a preview otherwise.
// A list longer than reportTextLimit entries is folded under a summary that
// names it with its counts and says how many entries the preview shows.
func (rep runReport) writeList(v *review, l reviewList) {
	if len(l.items) == 0 {
		return
	}
	shown := l.items
	if !rep.details {
		shown = previewItems(l.items, reportTextLimit)
	}
	total, seen := weight(l.items), weight(shown)
	title := l.title
	if seen < total {
		v.truncated = true
		title += " (" + shownWords(seen, total) + ")"
	}
	fold := len(l.items) > reportTextLimit
	switch {
	case fold:
		v.fold(title)
	case !l.quiet:
		v.paragraph(strong(title))
	}
	statuses := buckets(l.items)
	if l.nested && len(statuses) > 1 {
		for _, bucket := range statuses {
			all, listed := inBucket(l.items, bucket), inBucket(shown, bucket)
			words := titleWord(bucket)
			if weight(listed) < weight(all) {
				words += " (" + shownWords(weight(listed), weight(all)) + ")"
			}
			v.item(0, mdText(words))
			for _, item := range listed {
				v.item(1, item.entryWords(l.words(item)))
			}
		}
	} else {
		for _, item := range shown {
			v.item(0, item.entryWords(l.words(item)))
		}
	}
	v.endList()
	if fold {
		v.unfold()
	}
}

// statusCounts names the statuses of a list with their counts, as in
// "16 added, 7 removed".
func statusCounts(items []reportItem) string {
	var parts []string
	for _, bucket := range buckets(items) {
		parts = append(parts, fmt.Sprintf("%d %s", weight(inBucket(items, bucket)), bucket))
	}
	return strings.Join(parts, ", ")
}

// writeChanges lists the entries of a comparison, one list per kind with its
// statuses nested, then the drift fact changes the plan proposes to restore.
func (rep runReport) writeChanges(v *review, groups []reportGroup) {
	for _, g := range groups {
		if g.title == "Cancelled" {
			rep.writeList(v, cancelledList(g.items, false))
			continue
		}
		rep.writeList(v, reviewList{title: g.title + ": " + statusCounts(g.items), items: g.items, nested: true, words: func(item reportItem) string { return item.detail }})
	}
}

// cancelledList lists drift fact changes a plan proposes to undo, each with
// what drift did to it. quiet leaves the title to a folded list, when a
// sentence already introduces the list.
func cancelledList(items []reportItem, quiet bool) reviewList {
	title := "Drift fact changes the plan proposes to restore: " + fmt.Sprint(weight(items))
	return reviewList{title: title, quiet: quiet, items: items, words: func(item reportItem) string { return item.text }}
}

// writeDrift states what the plan reports as drift, the limit of that report,
// the architectural effect of the drift and each drift entry.
func (rep runReport) writeDrift(v *review, b reportBlock) {
	v.heading(4, mdText(b.title))
	if !holdsEntries(b.groups) {
		v.paragraph(mdText(strings.Join(b.lines, " ")))
		rep.writeNotes(v, b)
		return
	}
	items := b.groups[0].items
	v.paragraph(strong(countWithNoun(weight(items), "drift entry", "drift entries") + " reported: " + statusCounts(items) + "."))
	before, after := "Recorded", "Refreshed"
	if c := b.comparison; c != nil {
		before, after = stageWords(c.Before), stageWords(c.After)
	}
	limits := ""
	if len(b.lead) > 1 {
		limits = " " + mdText(strings.Join(b.lead[1:], " "))
	}
	v.paragraph("Drift compares " + strong(before) + " with " + strong(after) + "." + limits)
	if c := b.comparison; c != nil {
		if c.Comparable {
			v.paragraph(mdText("Architectural effect: " + strings.ToLower(changeWords(c, false)[:1]) + changeWords(c, false)[1:]))
		}
		for _, line := range b.lines {
			v.paragraph(mdText(line))
		}
		v.uncertainty(b.table)
	}
	rep.writeList(v, reviewList{title: "Drift entries: " + fmt.Sprint(weight(items)), quiet: true, items: items, words: func(item reportItem) string {
		if item.mark == "-" {
			return "deleted, " + item.detail
		}
		return item.detail
	}})
	rep.writeNotes(v, b)
}

// writeNet states the net change of a plan: the planned changes again, the
// drift the plan proposes to restore, or its own comparison.
func (rep runReport) writeNet(v *review, b reportBlock) {
	v.heading(4, mdText(b.title))
	c := b.comparison
	if c == nil {
		v.paragraph(mdText(strings.Join(b.lines, " ")))
		return
	}
	scope := mdText(b.title) + " compares " + strong(stageWords(c.Before)) + " with " + strong(stageWords(c.After)) + "."
	if c.Comparable && len(c.Representations)+len(c.Facts)+len(c.Indeterminate) == 0 && len(c.Cancelled) > 0 {
		v.paragraph(strong(strings.Join(b.lines, " ")))
		v.paragraph(scope)
		for _, g := range b.groups {
			rep.writeList(v, cancelledList(g.items, true))
		}
		return
	}
	v.paragraph(strong(comparisonConclusion(&b)))
	v.paragraph(scope)
	for _, problem := range c.Problems {
		v.paragraph(mdText("Not comparable: " + problem.Message))
	}
	if b.table != nil {
		v.paragraph(labelled("Uncertainty", b.lines))
		v.uncertainty(b.table)
	}
	rep.writeCounts(v, &b)
	if n := len(c.Cancelled); n > 0 {
		v.paragraph(mdText("The plan proposes to restore " + countWithNoun(n, "drift fact change", "drift fact changes") + "."))
	}
	rep.writeChanges(v, b.groups)
}

// writeArchitecture measures the evaluated stage, or each side's stage.
func (rep runReport) writeArchitecture(v *review, b reportBlock) {
	title := b.title
	if len(rep.views) == 1 {
		title = stageWords(rep.views[0].stage) + " architecture"
	}
	v.heading(4, mdText(title))
	v.rows(b.rows, nil)
	for _, line := range b.lines {
		v.paragraph(mdText(line))
	}
	v.paragraph(mdText(strings.Join(b.tail, " ")))
	rep.writeNotes(v, b)
}

// writeDiagnostics lists the grouped diagnostics by severity; --details adds
// their codes and the informational ones.
func (rep runReport) writeDiagnostics(v *review, b reportBlock) {
	v.heading(4, mdText(b.title))
	items := b.groups[0].items
	shown := items
	if !rep.details && len(items) > reportTextLimit {
		shown = items[:reportTextLimit]
		v.truncated = true
	}
	for _, item := range shown {
		line := "**" + mdText(item.mark) + ":** " + mdText(item.words())
		if item.code != "" {
			line += " (" + mdCode(item.code) + ")"
		}
		v.item(0, line)
	}
	v.endList()
	if len(shown) < len(items) {
		v.paragraph(mdText(shownWords(len(shown), len(items)) + "."))
	}
}

func (rep runReport) writeNotes(v *review, b reportBlock) {
	if rep.details {
		for _, line := range b.notes {
			v.paragraph(mdText(line))
		}
	}
}

// writeProvenance names what the review was computed from: the inputs as
// typed, a saved Form, the producer, the plan completeness, the enrichment of
// each side and the stages. A plan analyzed without its saved plan says so.
// A limit already stated above is not repeated.
func (rep runReport) writeProvenance(v *review) {
	if len(rep.head) == 0 && len(rep.views) == 0 && !v.truncated {
		return
	}
	v.separator()
	v.heading(3, "Details")
	v.fold("Provenance")
	alone := len(rep.views) == 1 && rep.views[0].form.Kind == form.KindPlan && enrichmentWords(rep.views[0].form.Evidence.Enrichment.Snapshot) == nil
	var rows [][2]string
	for i := 0; i < len(rep.head); i++ {
		row := rep.head[i]
		switch row[0] {
		case "", "Instances", "Before", "After":
			continue
		case "Stage":
			if alone {
				rows = append(rows, [2]string{"Enrichment", "None; the plan JSON was analyzed alone"})
			}
		case "Plan completeness":
			if len(rep.views) == 1 && rep.views[0].form.Evidence.Completeness.ProducerComplete == form.CompleteFalse {
				continue
			}
		case "Enrichment":
			if len(rep.views) == 1 && rep.views[0].form.Evidence.Enrichment.Snapshot.Status == form.SnapshotRefused {
				continue
			}
			for i+1 < len(rep.head) && rep.head[i+1][0] == "" {
				i++
				row[1] += "; " + strings.ToLower(rep.head[i][1][:1]) + rep.head[i][1][1:]
			}
		}
		rows = append(rows, row)
	}
	v.rows(rows, rep.literal)
	if len(rep.views) == 2 {
		rep.writeSides(v)
	}
	if v.truncated {
		v.paragraph(reviewPreview)
	}
	v.unfold()
}

// writeSides compares the provenance of the two sides of a
// comparison, with the input each side was read from when it was typed.
func (rep runReport) writeSides(v *review) {
	header := []string{"Field"}
	for _, view := range rep.views {
		header = append(header, mdText(view.side))
	}
	var rows [][]string
	typed := []string{}
	for _, row := range rep.head {
		if row[0] == "Before" || row[0] == "After" {
			typed = append(typed, mdCellCode(row[1]))
		}
	}
	if len(typed) == len(rep.views) {
		rows = append(rows, append([]string{"Input"}, typed...))
	}
	add := func(label string, value func(stageView, *form.Architecture) string) {
		row := []string{mdText(label)}
		for _, view := range rep.views {
			a := view.architecture()
			if a == nil {
				row = append(row, "-")
				continue
			}
			row = append(row, mdText(value(view, a)))
		}
		rows = append(rows, row)
	}
	add("Origin", func(view stageView, _ *form.Architecture) string { return titleWord(string(view.form.Kind)) })
	if hasProducer(rep.views) {
		add("Producer", func(view stageView, _ *form.Architecture) string { return producerWords(*view.form) })
	}
	add("Enrichment", func(view stageView, _ *form.Architecture) string {
		if view.form.Kind != form.KindPlan {
			return "Not applicable"
		}
		s := view.form.Evidence.Enrichment.Snapshot
		switch s.Status {
		case form.SnapshotVerified:
			return "Saved plan paired (" + countWithNoun(s.Modules, "module", "modules") + ")"
		case form.SnapshotRefused:
			return "Saved plan refused"
		}
		return "None"
	})
	for _, row := range rep.sides.rows {
		if row[0] == "Origin" || row[0] == "Producer" || sideMeasure(row[0]) {
			continue
		}
		cells := []string{mdText(row[0])}
		for _, cell := range row[1:] {
			cells = append(cells, mdText(cell))
		}
		rows = append(rows, cells)
	}
	v.grid(header, false, rows)
}

func sideMeasure(label string) bool {
	switch label {
	case "Instances", "Interpreted", "Relations", "Contexts", "Contributions", "Closures":
		return true
	}
	return false
}

// Numeric architecture dimensions belong in the review; long input and
// provenance values remain a field table below it rather than a wide grid.
func (rep runReport) writeSideCounts(v *review) {
	t := &reportTable{header: rep.sides.header, numeric: true}
	for _, row := range rep.sides.rows {
		if sideMeasure(row[0]) {
			t.rows = append(t.rows, row)
		}
	}
	if len(t.rows) > 0 {
		v.heading(4, "Architecture counts")
		v.table(transpose(t, "Side"))
	}
}
