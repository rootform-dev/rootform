package app

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"sort"
	"strings"
	"unicode/utf8"

	"github.com/rootform-dev/rootform/cli/backend"
	"github.com/rootform-dev/rootform/cli/form"
	cli "github.com/rootform-dev/rootform/cli/internal/command"
	"github.com/rootform-dev/rootform/cli/internal/human"
)

// explainService justifies one conclusion: how an instance was interpreted
// and which evidence supports its facts, how a rule applied, or why a Policy
// reached the outcome a check result records. Inputs are read through the
// loader run and check use; no Policy is ever evaluated.
type explainService struct {
	stdin   io.Reader
	stdout  io.Writer
	stderr  io.Writer
	backend backend.Backend
}

func (s explainService) Explain(options cli.ExplainOptions) error {
	if s.stdin == nil {
		s.stdin = os.Stdin
	}
	if s.stdout == nil {
		s.stdout = io.Discard
	}
	if s.stderr == nil {
		s.stderr = io.Discard
	}
	if options.Project != "" {
		info, err := os.Stat(options.Project)
		if err != nil || !info.IsDir() {
			return cli.RunError{Code: cli.ExitUsage, Message: "--project requires a directory"}
		}
	}
	switch options.Object {
	case cli.ExplainInstance:
		return s.explainInstance(options)
	case cli.ExplainRule:
		return s.explainRule(options)
	case cli.ExplainPolicy:
		return s.explainPolicy(options)
	}
	return cli.RunError{Code: cli.ExitUsage, Message: fmt.Sprintf("%q is not something rootform can explain", string(options.Object))}
}

// explainedStage is the one stage an instance or rule explanation reads: the
// architecture of a plan, state or saved single-input Form, or one side of a
// comparison Form.
type explainedStage struct {
	input string
	side  string
	form  *form.InputForm
	stage form.Stage
}

func (e explainedStage) architecture() *form.Architecture { return e.form.Stages[e.stage] }

// head names what the explanation read, in the words the user typed.
func (e explainedStage) head() [][2]string {
	rows := [][2]string{{"Input", e.input}}
	if e.side != "" {
		rows = append(rows, [2]string{"Side", titleWord(e.side)})
	}
	stage := stageWords(e.stage)
	if a := e.architecture(); a != nil && a.Reconstruction != nil {
		stage += " (reconstructed)"
	}
	return append(rows, [2]string{"Stage", stage})
}

// loadInput reads the input as run does, with this command's project and
// evidence options.
func (s explainService) loadInput(options cli.ExplainOptions) (operand, error) {
	providerMap, attestations, err := validateAttestations(options.Producer, options.ProviderMap)
	if err != nil {
		return operand{}, cli.RunError{Code: cli.ExitUsage, Message: err.Error()}
	}
	if options.PlanComplete != "" {
		attestations = append(attestations, form.Attestation{Name: "plan-complete", Value: options.PlanComplete})
	}
	ctx := context.Background()
	sess := s.backend.Open(ctx, backend.Selection{Project: options.Project, Locked: options.Locked, Dialects: options.Dialect}, s.stderr)
	return loadOperand(ctx, s.stdin, s.stderr, operandRequest{
		command:      "explain " + string(options.Object) + " " + shellQuote(options.Name) + " --input",
		input:        options.Input,
		planFile:     options.PlanFile,
		savedRefusal: explainSavedOption(options),
		planComplete: options.PlanComplete != "",
		export:       backend.Export{RequireEnrichment: options.RequireEnrichment, Producer: options.Producer, PlanComplete: options.PlanComplete != "", ProviderMap: providerMap, Attestations: attestations},
	}, sess)
}

// explainSavedOption names the first option that cannot affect a saved Form.
func explainSavedOption(o cli.ExplainOptions) string {
	switch {
	case o.PlanFile != "":
		return "--plan-file"
	case len(o.Dialect) > 0:
		return "--dialect"
	case o.Locked:
		return "--locked"
	case o.Producer != "":
		return "--producer"
	case len(o.ProviderMap) > 0:
		return "--provider-map"
	case o.PlanComplete != "":
		return "--plan-complete"
	case o.RequireEnrichment:
		return "--require-enrichment"
	}
	return ""
}

// selectExplainedStage settles the stage an instance or rule explanation
// reads. A comparison Form needs --side, and --side beside another input is
// refused.
func selectExplainedStage(loaded operand, options cli.ExplainOptions) (explainedStage, error) {
	decoded := loaded.result.Decoded
	if decoded.Comparison != nil && options.Side == "" {
		return explainedStage{}, cli.RunError{Code: cli.ExitUsage, Message: fmt.Sprintf("%s is a comparison Form; --side before or --side after chooses the side to explain\n\nTry:\n  rootform explain %s %s --input %s --side after", loaded.name, options.Object, shellQuote(options.Name), shellQuote(options.Input))}
	}
	if decoded.Comparison == nil && options.Side != "" {
		return explainedStage{}, cli.RunError{Code: cli.ExitUsage, Message: fmt.Sprintf("--side selects a side of a comparison Form; %s is a %s Form", loaded.name, formKind(decoded))}
	}
	side, err := form.Select(decoded, form.Stage(options.Stage), options.Side)
	if err != nil {
		return explainedStage{}, cli.RunError{Code: cli.ExitNoAnswer, Message: stageUnavailable(err).detail}
	}
	return explainedStage{input: loaded.name, side: options.Side, form: &side.Form, stage: side.Stage}, nil
}

type explainedFact struct {
	Kind      string   `json:"kind"`
	Direction string   `json:"direction"`
	Name      string   `json:"name,omitempty"`
	Other     string   `json:"other"`
	OtherKind string   `json:"other_kind"`
	Evidence  []string `json:"evidence"`
	Rules     []string `json:"rules"`
}

type explainedClosure struct {
	Emission   string          `json:"emission"`
	Kind       string          `json:"kind"`
	Name       string          `json:"name,omitempty"`
	Target     string          `json:"target"`
	Via        string          `json:"via"`
	Match      string          `json:"match,omitempty"`
	Outcome    form.Outcome    `json:"outcome"`
	Reason     form.Reason     `json:"reason,omitempty"`
	Facts      int             `json:"facts"`
	Candidates form.Candidates `json:"candidates"`
}

type explainedDependency struct {
	Direction string   `json:"direction"`
	Other     string   `json:"other"`
	Roles     []string `json:"roles"`
}

type explainedDiagnostic struct {
	Severity form.DiagnosticSeverity `json:"severity"`
	Code     string                  `json:"code"`
	Message  string                  `json:"message"`
}

type explainedInstance struct {
	Side            string                  `json:"side,omitempty"`
	Stage           form.Stage              `json:"stage"`
	Address         string                  `json:"address"`
	Kind            form.RepresentationKind `json:"kind"`
	Type            string                  `json:"type,omitempty"`
	Status          form.InstanceStatus     `json:"status"`
	Actions         []string                `json:"actions"`
	PreviousAddress string                  `json:"previous_address,omitempty"`
	Provider        string                  `json:"provider,omitempty"`
	Interpretation  *form.Interpretation    `json:"interpretation,omitempty"`
	Rule            string                  `json:"rule,omitempty"`
	Concept         string                  `json:"concept,omitempty"`
	Implementation  form.Implementation     `json:"implementation"`
	Facts           []explainedFact         `json:"facts"`
	Closures        []explainedClosure      `json:"closures"`
	Dependencies    []explainedDependency   `json:"dependencies"`
	Diagnostics     []explainedDiagnostic   `json:"diagnostics"`
}

func (s explainService) explainInstance(options cli.ExplainOptions) error {
	loaded, err := s.loadInput(options)
	if err != nil {
		return err
	}
	target, err := selectExplainedStage(loaded, options)
	if err != nil {
		return err
	}
	a := target.architecture()
	declarations := map[string]form.Declaration{}
	for _, d := range a.Declarations {
		declarations[d.ID] = d
	}
	var matches []form.Representation
	for _, r := range a.Representations {
		if r.Address == options.Name {
			matches = append(matches, r)
		}
	}
	if len(matches) == 0 {
		for _, r := range a.Representations {
			if d, ok := declarations[r.Declaration]; ok && d.Address == options.Name {
				matches = append(matches, r)
			}
		}
	}
	if len(matches) == 0 {
		return cli.RunError{Code: cli.ExitNegative, Message: instanceNotFound(a, options.Name, target)}
	}
	sort.Slice(matches, func(i, j int) bool { return matches[i].Address < matches[j].Address })
	explained := make([]explainedInstance, 0, len(matches))
	for _, r := range matches {
		e := describeInstance(target.form, a, target.stage, r, declarations)
		e.Side = target.side
		explained = append(explained, e)
	}
	if options.Format == cli.FormatJSON {
		return s.writeJSON(explained)
	}
	if err := paged(s.stdout, s.stderr, func(w io.Writer) {
		title := "Instance explained"
		if len(explained) > 1 {
			title = fmt.Sprintf("%d instances explained", len(explained))
		}
		human.Verdict(w, title, human.Neutral)
		fmt.Fprintln(w)
		writeRows(w, "", target.head())
		for _, e := range explained {
			e.writeText(w, options.Details)
		}
	}); err != nil {
		return errExplanationNotWritten
	}
	return nil
}

// instanceNotFound names the stage that holds no such instance and offers
// the instances whose address resembles the one asked for.
func instanceNotFound(a *form.Architecture, name string, target explainedStage) string {
	message := fmt.Sprintf("no instance at %s in the %s stage", safeText(name), stageWords(target.stage))
	if target.side != "" {
		message += " of the " + titleWord(target.side) + " side"
	}
	suggestions := []string{}
	needle := strings.ToLower(name)
	// An instance key the stage does not have still names a declaration
	// whose instances are worth offering.
	declaration := needle
	if open := strings.LastIndex(needle, "["); open > 0 && strings.HasSuffix(needle, "]") {
		declaration = needle[:open]
	}
	for _, r := range a.Representations {
		address := strings.ToLower(r.Address)
		if r.Address != "" && (strings.Contains(address, needle) || (declaration != needle && strings.HasPrefix(address, declaration+"["))) {
			suggestions = append(suggestions, r.Address)
		}
	}
	sort.Strings(suggestions)
	if len(suggestions) == 0 {
		return message
	}
	message += "\n\nInstances with a similar address:"
	for i, suggestion := range suggestions {
		if i == reportTextLimit {
			message += fmt.Sprintf("\n  %d of %d instances shown.", i, len(suggestions))
			break
		}
		message += "\n  " + safeText(suggestion)
	}
	return message
}

// stageNames names every instance of a stage by its address, and an external
// endpoint by its concept, never by a recorded identity.
func stageNames(a *form.Architecture) (map[string]string, map[string]form.RepresentationKind) {
	names := map[string]string{}
	kinds := map[string]form.RepresentationKind{}
	for _, other := range a.Representations {
		kinds[other.ID] = other.Kind
		if other.Address != "" {
			names[other.ID] = other.Address
		} else {
			names[other.ID] = "external " + shortName(other.Concept)
		}
	}
	return names, kinds
}

func describeInstance(inputForm *form.InputForm, a *form.Architecture, stage form.Stage, r form.Representation, declarations map[string]form.Declaration) explainedInstance {
	names, kinds := stageNames(a)
	emissions := map[string]form.Emission{}
	for _, e := range inputForm.Semantics.Emissions {
		emissions[e.ID] = e
	}
	e := explainedInstance{Stage: stage, Address: r.Address, Kind: r.Kind, Status: r.Status, Actions: append([]string{}, r.Actions...), PreviousAddress: r.PreviousAddress, Interpretation: r.Interpretation, Rule: r.Rule, Concept: r.Concept, Implementation: r.Implementation, Facts: []explainedFact{}, Closures: []explainedClosure{}, Dependencies: []explainedDependency{}, Diagnostics: []explainedDiagnostic{}}
	if d, ok := declarations[r.Declaration]; ok {
		e.Type = d.Type
	}
	if r.Provider != nil {
		e.Provider = r.Provider.Address
	}
	fact := func(kind, name, from, to string, provenance []form.FactProvenance) {
		direction, other := "", ""
		switch r.ID {
		case from:
			direction, other = "outgoing", to
		case to:
			direction, other = "incoming", from
		default:
			return
		}
		f := explainedFact{Kind: kind, Direction: direction, Name: name, Other: names[other], OtherKind: string(kinds[other]), Evidence: []string{}, Rules: []string{}}
		for _, p := range provenance {
			f.Evidence = append(f.Evidence, string(p.Evidence))
			f.Rules = append(f.Rules, p.Rule)
		}
		f.Evidence, f.Rules = unique(f.Evidence), unique(f.Rules)
		e.Facts = append(e.Facts, f)
	}
	for _, x := range a.Relations {
		fact("relation", shortName(x.Predicate), x.From, x.To, x.Provenance)
	}
	for _, x := range a.Contexts {
		fact("context", shortName(x.Dimension), x.From, x.To, x.Provenance)
	}
	for _, x := range a.Contributions {
		fact("contribution", "", x.From, x.To, x.Provenance)
	}
	sort.SliceStable(e.Facts, func(i, j int) bool {
		if e.Facts[i].Direction != e.Facts[j].Direction {
			return e.Facts[i].Direction > e.Facts[j].Direction
		}
		return e.Facts[i].Kind+e.Facts[i].Name+e.Facts[i].Other < e.Facts[j].Kind+e.Facts[j].Name+e.Facts[j].Other
	})
	for _, c := range a.Closures {
		if c.Representation != r.ID {
			continue
		}
		e.Closures = append(e.Closures, closureOf(c, emissions[c.Emission]))
	}
	sort.SliceStable(e.Closures, func(i, j int) bool {
		if e.Closures[i].Via != e.Closures[j].Via {
			return e.Closures[i].Via < e.Closures[j].Via
		}
		return e.Closures[i].Match < e.Closures[j].Match
	})
	for _, d := range a.Dependencies {
		roles := []string{}
		for _, role := range d.Roles {
			roles = append(roles, string(role))
		}
		switch r.ID {
		case d.From:
			e.Dependencies = append(e.Dependencies, explainedDependency{Direction: "depends on", Other: names[d.To], Roles: roles})
		case d.To:
			e.Dependencies = append(e.Dependencies, explainedDependency{Direction: "required by", Other: names[d.From], Roles: roles})
		}
	}
	sort.SliceStable(e.Dependencies, func(i, j int) bool {
		return e.Dependencies[i].Direction+e.Dependencies[i].Other < e.Dependencies[j].Direction+e.Dependencies[j].Other
	})
	cited := map[string]bool{}
	for _, id := range r.Diagnostics {
		cited[id] = true
	}
	if r.Interpretation != nil {
		for _, id := range r.Interpretation.Diagnostics {
			cited[id] = true
		}
	}
	for _, d := range inputForm.Diagnostics {
		if cited[d.ID] || (d.Representation == r.ID && (d.Stage == "" || d.Stage == stage)) {
			e.Diagnostics = append(e.Diagnostics, explainedDiagnostic{Severity: d.Severity, Code: d.Code, Message: d.Message})
		}
	}
	return e
}

// closureOf describes one closure by the emission it resolved.
func closureOf(c form.Closure, em form.Emission) explainedClosure {
	name := em.Predicate
	if em.Kind == form.EmissionContext {
		name = em.Dimension
	}
	match := ""
	if em.Match != nil {
		match = string(em.Match.Strategy) + " by " + strings.Join(em.Match.By, " or ")
	}
	return explainedClosure{Emission: c.Emission, Kind: string(em.Kind), Name: shortName(name), Target: shortName(em.To.ID), Via: em.Via, Match: match, Outcome: c.Outcome, Reason: c.Reason, Facts: len(c.Facts), Candidates: c.Candidates}
}

func (e explainedInstance) writeText(w io.Writer, details bool) {
	human.Section(w, safeText(e.Address))
	kind := string(e.Kind) + " instance"
	if e.Type != "" {
		kind += " of " + e.Type
	}
	kind += "; " + string(e.Status)
	if len(e.Actions) > 0 {
		kind += " (" + strings.Join(e.Actions, ", ") + ")"
	}
	rows := [][2]string{{"Instance", kind}}
	if e.Status == form.StatusCarried {
		rows = append(rows, [2]string{"Plan evidence", "Carried from the prior state; this plan did not evaluate this instance."})
	}
	if e.PreviousAddress != "" {
		rows = append(rows, [2]string{"Previously", e.PreviousAddress})
	}
	if e.Provider != "" {
		rows = append(rows, [2]string{"Provider", e.Provider})
	}
	rows = append(rows, [2]string{"Interpretation", interpretationWords(e)})
	if e.Implementation.Kind == form.ImplementationComposition {
		words := "composition of " + countWithNoun(len(e.Implementation.Members), "member", "members")
		if len(e.Implementation.Unresolved) > 0 {
			words += fmt.Sprintf("; %d unresolved", len(e.Implementation.Unresolved))
		}
		rows = append(rows, [2]string{"Implementation", words})
	}
	rows = append(rows, [2]string{"Conclusion", instanceConclusion(e)})
	writeWrapped(w, "  ", rows, labelWidth(rows), map[string]bool{"Instance": true, "Previously": true, "Provider": true, "Interpretation": true, "Implementation": true})
	facts := [][]string{}
	for _, f := range e.Facts {
		arrow := "->"
		if f.Direction == "incoming" {
			arrow = "<-"
		}
		label := f.Kind
		if f.Name != "" {
			label += " " + f.Name
		}
		facts = append(facts, []string{arrow + " " + safeText(label), safeText(f.Other), "evidence: " + strings.Join(f.Evidence, ", ")})
	}
	writeList(w, "Facts", facts, func(string) human.Status { return human.Unknown })
	closures := [][]string{}
	outcomes := map[string]human.Status{}
	for _, c := range e.Closures {
		label := c.Kind
		if c.Name != "" {
			label += " " + c.Name
		}
		via := "via " + c.Via
		if c.Match != "" {
			via += ", match " + c.Match
		}
		outcome, status := closureWords(c)
		outcomes[outcome] = status
		closures = append(closures, []string{safeText(label + " -> " + c.Target), safeText(via), outcome})
	}
	writeList(w, "Closures", closures, func(last string) human.Status { return outcomes[last] })
	dependencies := [][]string{}
	for _, d := range e.Dependencies {
		dependencies = append(dependencies, []string{d.Direction, safeText(d.Other), strings.Join(d.Roles, ", ")})
	}
	writeList(w, "Dependencies", dependencies, func(string) human.Status { return human.Unknown })
	diagnostics := [][]string{}
	for _, d := range e.Diagnostics {
		row := []string{string(d.Severity)}
		if details {
			row = append(row, d.Code)
		}
		diagnostics = append(diagnostics, append(row, safeText(d.Message)))
	}
	writeList(w, "Diagnostics", diagnostics, func(string) human.Status { return human.Neutral })
}

// instanceConclusion states what the evidence establishes about an instance
// before the facts and closures that establish it: how it was interpreted,
// what each kind of fact its Rule emits came to, and the facts entering it.
func instanceConclusion(e explainedInstance) string {
	var lead string
	switch {
	case e.Interpretation != nil && e.Interpretation.Status == form.InterpretationApplied:
		lead = "Interpreted by " + e.Rule
		if e.Concept != "" {
			lead = "Interpreted as " + shortName(e.Concept) + " by " + e.Rule
		}
	case e.Interpretation != nil && e.Interpretation.Status == form.InterpretationIndeterminate:
		lead = "Its interpretation is undecided (" + inlineReason(string(e.Interpretation.Reason)) + "), so it emits no fact"
	case e.Interpretation != nil && e.Interpretation.Status == form.InterpretationFailed:
		lead = "Its interpretation failed, so it emits no fact"
	case e.Kind == form.RepresentationExternal:
		lead = "An external endpoint other instances name; it emits no fact"
	default:
		lead = "No Rule interpreted it, so it emits no fact"
	}
	type subject struct {
		words   string
		ends    []string
		reasons []string
		absent  bool
	}
	var order []string
	subjects := map[string]*subject{}
	of := func(kind, name string) *subject {
		key := kind + "\x00" + name
		if subjects[key] == nil {
			subjects[key] = &subject{words: subjectWords(kind, name)}
			order = append(order, key)
		}
		return subjects[key]
	}
	for _, c := range e.Closures {
		s := of(c.Kind, c.Name)
		switch c.Outcome {
		case form.OutcomeIndeterminate:
			s.reasons = append(s.reasons, inlineReason(string(c.Reason)))
		case form.OutcomeAbsent:
			s.absent = true
		}
	}
	incoming := map[string][]string{}
	var entering []string
	for _, f := range e.Facts {
		if f.Direction == "incoming" {
			key := subjectWords(f.Kind, f.Name)
			if incoming[key] == nil {
				entering = append(entering, key)
			}
			incoming[key] = append(incoming[key], f.Other)
			continue
		}
		of(f.Kind, f.Name).ends = append(of(f.Kind, f.Name).ends, f.Other)
	}
	// Determined facts lead, then what stayed undecided, then absences.
	var parts [3][]string
	for _, key := range order {
		s := subjects[key]
		undecided := ""
		if len(s.reasons) > 0 {
			undecided = "indeterminate (" + strings.Join(unique(s.reasons), ", ") + ")"
		}
		switch {
		case len(s.ends) > 0 && undecided != "":
			parts[0] = append(parts[0], s.words+" to "+listWords(s.ends)+", partly "+undecided)
		case len(s.ends) > 0:
			parts[0] = append(parts[0], s.words+" to "+listWords(s.ends))
		case undecided != "":
			parts[1] = append(parts[1], s.words+" "+undecided)
		case s.absent:
			parts[2] = append(parts[2], s.words+" absent")
		}
	}
	for _, key := range entering {
		parts[0] = append(parts[0], key+" from "+listWords(unique(incoming[key])))
	}
	all := append(append(parts[0], parts[1]...), parts[2]...)
	if len(all) == 0 {
		if e.Interpretation != nil && e.Interpretation.Status == form.InterpretationApplied {
			return lead + "; its Rule establishes no fact."
		}
		return lead + "."
	}
	return lead + ": " + strings.Join(all, "; ") + "."
}

// closureWords states a closure outcome and the status its color reinforces.
func closureWords(c explainedClosure) (string, human.Status) {
	words, status := string(c.Outcome), human.Neutral
	switch c.Outcome {
	case form.OutcomeResolved:
		words, status = "resolved, "+countWithNoun(c.Facts, "fact", "facts"), human.Good
	case form.OutcomeIndeterminate:
		words, status = "indeterminate ("+inlineReason(string(c.Reason))+")", human.Warn
	}
	if c.Candidates.Unknown > 0 || c.Candidates.Excluded > 0 {
		words += fmt.Sprintf("; candidates: %d known equal, %d unknown, %d excluded", c.Candidates.KnownEqual, c.Candidates.Unknown, c.Candidates.Excluded)
	}
	return words, status
}

// writeList writes one titled list of an explanation, every row, with its
// columns aligned. The last column is Rootform wording, dimmed unless a
// status tints it. A list whose aligned rows would pass the report width
// stacks each row: its first column, then every other column on its own
// indented line.
func writeList(w io.Writer, title string, rows [][]string, status func(string) human.Status) {
	if len(rows) == 0 {
		return
	}
	fmt.Fprintf(w, "\n  %s\n", human.Emphasis(w, title, human.Neutral))
	widths := map[int]int{}
	for _, row := range rows {
		for i := 0; i < len(row)-1; i++ {
			widths[i] = max(widths[i], utf8.RuneCountInString(row[i]))
		}
	}
	aligned := 4
	for _, row := range rows {
		width := 4
		for i, cell := range row {
			if i < len(row)-1 {
				width += widths[i] + 2
				continue
			}
			width += utf8.RuneCountInString(cell)
		}
		aligned = max(aligned, width)
	}
	tinted := func(cell string) string {
		switch tint := status(cell); tint {
		case human.Unknown:
			return human.Dim(w, cell)
		case human.Neutral:
			return cell
		default:
			return human.Tint(w, cell, tint)
		}
	}
	for j, row := range rows {
		if aligned > reportLineWidth {
			if j > 0 && len(row) > 2 {
				fmt.Fprintln(w)
			}
			for i, cell := range row {
				switch {
				case i == 0:
					fmt.Fprintf(w, "    %s\n", cell)
				case i == len(row)-1:
					fmt.Fprintf(w, "      %s\n", tinted(cell))
				default:
					fmt.Fprintf(w, "      %s\n", cell)
				}
			}
			continue
		}
		var b strings.Builder
		for i, cell := range row {
			if i < len(row)-1 {
				b.WriteString(cell + strings.Repeat(" ", widths[i]-utf8.RuneCountInString(cell)+2))
				continue
			}
			b.WriteString(tinted(cell))
		}
		fmt.Fprintf(w, "    %s\n", strings.TrimRight(b.String(), " "))
	}
}

func interpretationWords(e explainedInstance) string {
	if e.Interpretation == nil {
		if e.Kind == form.RepresentationExternal {
			return "external endpoint named by another instance; not interpreted"
		}
		return "not interpreted"
	}
	i := e.Interpretation
	switch i.Status {
	case form.InterpretationApplied:
		words := "applied " + e.Rule
		if e.Concept != "" {
			words += " as " + shortName(e.Concept)
		}
		return words
	case form.InterpretationNone:
		if len(i.Candidates) == 0 {
			return "none: no selected Dialect has a Rule for this type"
		}
		return "none: " + strings.Join(i.Candidates, ", ") + " did not match this instance"
	case form.InterpretationIndeterminate:
		return "indeterminate (" + strings.ReplaceAll(string(i.Reason), "_", " ") + "); candidates: " + strings.Join(i.Candidates, ", ")
	case form.InterpretationFailed:
		return "failed; see diagnostics"
	}
	return string(i.Status)
}

type explainedEmission struct {
	Kind     string              `json:"kind"`
	Name     string              `json:"name,omitempty"`
	Target   form.TargetRef      `json:"target"`
	Via      string              `json:"via"`
	Match    *form.EmissionMatch `json:"match,omitempty"`
	OnNull   form.NullSemantics  `json:"on_null"`
	OnEmpty  form.NullSemantics  `json:"on_empty"`
	External form.ExternalPolicy `json:"external"`
	Disclose form.Disclosure     `json:"disclose"`
	Outcomes map[string]int      `json:"outcomes,omitempty"`
	Reasons  []string            `json:"reasons"`
	Facts    int                 `json:"facts"`
	Evidence []string            `json:"evidence"`
}

type explainedRule struct {
	Rule          form.RuleDefinition `json:"rule"`
	Emissions     []explainedEmission `json:"emissions"`
	Side          string              `json:"side,omitempty"`
	Stage         form.Stage          `json:"stage"`
	Applied       []string            `json:"applied"`
	Candidate     int                 `json:"candidate_without_match"`
	Indeterminate int                 `json:"candidate_indeterminate"`
}

func (s explainService) explainRule(options cli.ExplainOptions) error {
	loaded, err := s.loadInput(options)
	if err != nil {
		return err
	}
	target, err := selectExplainedStage(loaded, options)
	if err != nil {
		return err
	}
	semantics := target.form.Semantics
	identifiers := identifiersOf(semantics.Rules, func(r form.RuleDefinition) string { return r.ID })
	index, found := lookupIdentifier(identifiers, options.Name)
	if !found {
		hint := "rootform list dialects"
		if owner, _, qualified := strings.Cut(options.Name, "."); qualified {
			for _, id := range identifiers {
				if strings.HasPrefix(id, owner+".") {
					hint = "rootform show " + owner
					break
				}
			}
		}
		return cli.RunError{Code: cli.ExitNegative, Message: fmt.Sprintf("no Rule named %q in the semantics of %s\n\nTry:\n  %s", options.Name, target.input, hint)}
	}
	if index == resolveAmbiguous {
		matching := []string{}
		for _, id := range identifiers {
			if strings.HasSuffix(id, "."+options.Name) || strings.HasSuffix(id, "/"+options.Name) {
				matching = append(matching, id)
			}
		}
		return cli.RunError{Code: cli.ExitNoAnswer, Message: fmt.Sprintf("%q names more than one Rule; use the full identifier\n\nIt could be any of:\n%s", options.Name, identList(matching))}
	}
	rule := semantics.Rules[index]
	out := explainedRule{Rule: rule, Emissions: []explainedEmission{}, Side: target.side, Stage: target.stage, Applied: []string{}}
	outcomes := map[string]map[string]int{}
	a := target.architecture()
	for _, r := range a.Representations {
		if r.Rule == rule.ID {
			out.Applied = append(out.Applied, r.Address)
		}
	}
	sort.Strings(out.Applied)
	out.Candidate, out.Indeterminate = candidateCounts(a, rule.ID)
	reasons := map[string][]string{}
	for _, c := range a.Closures {
		if outcomes[c.Emission] == nil {
			outcomes[c.Emission] = map[string]int{}
		}
		outcomes[c.Emission][string(c.Outcome)]++
		if c.Outcome == form.OutcomeIndeterminate && c.Reason != "" {
			reasons[c.Emission] = append(reasons[c.Emission], string(c.Reason))
		}
	}
	// A fact several closures support counts once for its emission.
	facts, evidence := map[string]map[string]bool{}, map[string][]string{}
	count := func(id string, provenance []form.FactProvenance) {
		for _, p := range provenance {
			if p.Rule == rule.ID {
				if facts[p.Emission] == nil {
					facts[p.Emission] = map[string]bool{}
				}
				facts[p.Emission][id] = true
				evidence[p.Emission] = append(evidence[p.Emission], string(p.Evidence))
			}
		}
	}
	for _, x := range a.Relations {
		count(x.ID, x.Provenance)
	}
	for _, x := range a.Contexts {
		count(x.ID, x.Provenance)
	}
	for _, x := range a.Contributions {
		count(x.ID, x.Provenance)
	}
	for _, e := range semantics.Emissions {
		if e.Rule != rule.ID {
			continue
		}
		name := e.Predicate
		if e.Kind == form.EmissionContext {
			name = e.Dimension
		}
		out.Emissions = append(out.Emissions, explainedEmission{Kind: string(e.Kind), Name: name, Target: e.To, Via: e.Via, Match: e.Match, OnNull: e.OnNull, OnEmpty: e.OnEmpty, External: e.External, Disclose: e.Disclose, Outcomes: outcomes[e.ID], Reasons: unique(reasons[e.ID]), Facts: len(facts[e.ID]), Evidence: unique(evidence[e.ID])})
	}
	if options.Format == cli.FormatJSON {
		return s.writeJSON(out)
	}
	if err := paged(s.stdout, s.stderr, func(w io.Writer) { out.writeText(w, target) }); err != nil {
		return errExplanationNotWritten
	}
	return nil
}

// candidateCounts counts the instances that named a rule as a candidate
// without applying it: those whose predicate evaluated false, and those the
// evidence left undecided, an unknown predicate or an ambiguous match.
func candidateCounts(a *form.Architecture, rule string) (unmatched, indeterminate int) {
	for _, r := range a.Representations {
		if r.Rule == rule || r.Interpretation == nil || r.Interpretation.Status == form.InterpretationApplied {
			continue
		}
		for _, candidate := range r.Interpretation.Candidates {
			switch {
			case candidate != rule:
			case r.Interpretation.Status == form.InterpretationNone:
				unmatched++
			default:
				indeterminate++
			}
		}
	}
	return unmatched, indeterminate
}

func (out explainedRule) writeText(w io.Writer, target explainedStage) {
	rule := out.Rule
	human.Verdict(w, "Rule explained", human.Neutral)
	fmt.Fprintln(w)
	rows := append(target.head(), [2]string{"Rule", rule.ID}, [2]string{"Matches", rule.MatchKind + " " + rule.MatchType})
	if rule.Concept != "" {
		rows = append(rows, [2]string{"Concept", rule.Concept})
	}
	if rule.Identity != nil {
		rows = append(rows, [2]string{"Identity", strings.Join(rule.Identity.Attributes, ", ") + " (" + string(rule.Identity.Scope) + " scope)"})
	}
	if rule.Endpoint != nil {
		rows = append(rows, [2]string{"Endpoint", strings.Join(rule.Endpoint.Attributes, ", ")})
	}
	if rule.Composition != nil {
		rows = append(rows, [2]string{"Composition", countWithNoun(len(rule.Composition.Members), "member", "members")})
	}
	rows = append(rows, [2]string{"Applied to", countWithNoun(len(out.Applied), "instance", "instances")})
	if out.Candidate > 0 {
		rows = append(rows, [2]string{"Not matched", countWithNoun(out.Candidate, "candidate instance", "candidate instances")})
	}
	if out.Indeterminate > 0 {
		rows = append(rows, [2]string{"Indeterminate", countWithNoun(out.Indeterminate, "candidate instance", "candidate instances")})
	}
	rows = append(rows, [2]string{"Conclusion", out.conclusion()})
	writeWrapped(w, "", rows, labelWidth(rows), map[string]bool{"Input": true, "Rule": true, "Matches": true, "Concept": true, "Identity": true, "Endpoint": true})
	if len(out.Emissions) > 0 {
		human.Section(w, "Emissions")
		for i, e := range out.Emissions {
			if i > 0 {
				fmt.Fprintln(w)
			}
			label := e.Kind
			if e.Name != "" {
				label += " " + e.Name
			}
			fmt.Fprintf(w, "  %s\n", safeText(label+" -> "+e.Target.ID))
			fields := [][2]string{{"Via", e.Via}}
			if e.Match != nil {
				fields = append(fields, [2]string{"Match", string(e.Match.Strategy) + " by " + strings.Join(e.Match.By, " or ")})
			}
			fields = append(fields, [2]string{"On null", string(e.OnNull)}, [2]string{"On empty", string(e.OnEmpty)}, [2]string{"External", string(e.External)})
			if len(e.Outcomes) > 0 {
				closures := fmt.Sprintf("%d resolved, %d absent, %d indeterminate", e.Outcomes["resolved"], e.Outcomes["absent"], e.Outcomes["indeterminate"])
				if len(e.Reasons) > 0 {
					labels := make([]string, len(e.Reasons))
					for i, reason := range e.Reasons {
						labels[i] = inlineReason(reason)
					}
					closures += " (" + strings.Join(labels, ", ") + ")"
				}
				fields = append(fields, [2]string{"Closures", closures})
			}
			produced := "none"
			if e.Facts > 0 {
				produced = fmt.Sprintf("%d (evidence: %s)", e.Facts, strings.Join(e.Evidence, ", "))
			}
			fields = append(fields, [2]string{"Facts", produced})
			writeWrapped(w, "    ", fields, labelWidth(fields), map[string]bool{"Via": true, "Match": true})
		}
	}
	if len(out.Applied) > 0 {
		human.Section(w, "Instances")
		for _, address := range out.Applied {
			fmt.Fprintf(w, "  %s\n", safeText(address))
		}
	}
}

// conclusion states what a Rule came to at this stage before how: the
// instances it interpreted, the facts its emissions established, and the
// closures that established none.
func (out explainedRule) conclusion() string {
	lead := "Interpreted " + countWithNoun(len(out.Applied), "instance", "instances")
	if len(out.Applied) == 0 {
		lead = "Interpreted no instance"
	}
	if len(out.Emissions) == 0 {
		return lead + "; it declares no emission."
	}
	facts, absent, undecided := 0, 0, 0
	var reasons []string
	for _, e := range out.Emissions {
		facts += e.Facts
		absent += e.Outcomes[string(form.OutcomeAbsent)]
		undecided += e.Outcomes[string(form.OutcomeIndeterminate)]
		for _, reason := range e.Reasons {
			reasons = append(reasons, inlineReason(reason))
		}
	}
	words := lead + " and established no fact"
	if facts > 0 {
		words = lead + " and established " + countWithNoun(facts, "fact", "facts")
	}
	var rest []string
	if absent > 0 {
		rest = append(rest, countWithNoun(absent, "closure", "closures")+" absent")
	}
	if undecided > 0 {
		rest = append(rest, countWithNoun(undecided, "closure", "closures")+" indeterminate ("+strings.Join(unique(reasons), ", ")+")")
	}
	if len(rest) > 0 {
		words += "; " + strings.Join(rest, "; ")
	}
	return words + "."
}

func (s explainService) writeJSON(value any) error {
	encoded, err := json.MarshalIndent(value, "", "  ")
	if err != nil {
		return cli.RunError{Code: cli.ExitFailure, Message: "OUTPUT_FAILED: the explanation could not be encoded"}
	}
	if _, err := s.stdout.Write(append(encoded, '\n')); err != nil {
		return errExplanationNotWritten
	}
	return nil
}

var errExplanationNotWritten = cli.RunError{Code: cli.ExitFailure, Message: "OUTPUT_FAILED: standard output could not be written"}

func unique(values []string) []string {
	seen := map[string]bool{}
	out := []string{}
	for _, v := range values {
		if !seen[v] {
			seen[v] = true
			out = append(out, v)
		}
	}
	sort.Strings(out)
	return out
}
