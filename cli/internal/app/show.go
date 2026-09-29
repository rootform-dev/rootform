package app

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"sort"
	"strconv"
	"strings"

	"github.com/rootform-dev/rootform/cli/backend"
	cli "github.com/rootform-dev/rootform/cli/command"
	"github.com/rootform-dev/rootform/cli/human"
)

// showService reports one declaration as the effective catalog defines it. It
// reads no infrastructure source and evaluates nothing. Dialect evidence is
// only the exact verified origin and content digest of the current selection.
type showService struct {
	stdout  io.Writer
	stderr  io.Writer
	backend backend.Backend
}

type shownLocation struct {
	Path string `json:"path"`
	Line int    `json:"line"`
}

type shownVersioned struct {
	Name    string `json:"name"`
	Version string `json:"version"`
}

// shownDialect reports one effective Dialect. The RF Vocabulary is not a
// Dialect and never appears here.
type shownDialect struct {
	Name          string           `json:"name"`
	Version       string           `json:"version"`
	Origin        string           `json:"origin"`
	ContentDigest string           `json:"content_digest"`
	Providers     []shownVersioned `json:"providers"`
	Concepts      []string         `json:"concepts"`
	Contexts      []string         `json:"contexts"`
	Relations     []string         `json:"relations"`
	Rules         []string         `json:"rules"`
	Source        shownLocation    `json:"source"`
}

// shownVocabulary reports the RF Vocabulary, which every Dialect refers to.
// It is not a Dialect: it ships with the binary rather than being selected,
// so it carries a contract digest instead of a selection origin.
type shownVocabulary struct {
	Name           string   `json:"name"`
	Version        string   `json:"version"`
	ContractDigest string   `json:"contract_digest"`
	Concepts       []string `json:"concepts"`
	Contexts       []string `json:"contexts"`
	Relations      []string `json:"relations"`
}

type shownConcept struct {
	ID          string        `json:"id"`
	Owner       string        `json:"owner"`
	Name        string        `json:"name"`
	Description string        `json:"description"`
	Source      shownLocation `json:"source"`
}

type shownProducer struct {
	Emission string `json:"emission"`
	Rule     string `json:"rule"`
	From     string `json:"from"`
	To       string `json:"to"`
	Via      string `json:"via"`
}

type shownContextDefinition struct {
	ID          string          `json:"id"`
	Owner       string          `json:"owner"`
	Name        string          `json:"name"`
	Description string          `json:"description"`
	Producers   []shownProducer `json:"producers"`
	Source      shownLocation   `json:"source"`
}

type shownRelationDefinition struct {
	ID          string          `json:"id"`
	Owner       string          `json:"owner"`
	Name        string          `json:"name"`
	Description string          `json:"description,omitempty"`
	Producers   []shownProducer `json:"producers"`
	Source      shownLocation   `json:"source"`
}

type shownMatch struct {
	Kind  string `json:"kind"`
	Type  string `json:"type"`
	Where string `json:"where,omitempty"`
}

// shownContext keeps the dimension under its own key: a context asserts
// architectural context in that dimension and nothing else.
type shownContext struct {
	Dimension string `json:"dimension"`
	To        string `json:"to"`
	Via       string `json:"via"`
}

// shownRelation carries the relation's canonical predicate identity.
type shownRelation struct {
	Predicate string `json:"predicate"`
	To        string `json:"to"`
	Via       string `json:"via"`
}

type shownContribution struct {
	To  string `json:"to"`
	Via string `json:"via"`
}

type shownMember struct {
	Name  string     `json:"name"`
	Via   string     `json:"via"`
	Match shownMatch `json:"match"`
}

type shownRule struct {
	ID            string              `json:"id"`
	Owner         string              `json:"owner"`
	Name          string              `json:"name"`
	Match         shownMatch          `json:"match"`
	Produces      string              `json:"produces,omitempty"`
	Contexts      []shownContext      `json:"contexts"`
	Relations     []shownRelation     `json:"relations"`
	Contributions []shownContribution `json:"contributions"`
	Composition   []shownMember       `json:"composition"`
	Source        shownLocation       `json:"source"`
}

type shownPolicy struct {
	ID      string            `json:"id"`
	Pack    string            `json:"pack"`
	Name    string            `json:"name"`
	Target  shownPolicyTarget `json:"target"`
	Assert  string            `json:"assert"`
	Message string            `json:"message"`
	Source  shownLocation     `json:"source"`
}

type shownPolicyTarget struct {
	Concept  string   `json:"concept,omitempty"`
	Rules    []string `json:"rules"`
	Dialects []string `json:"dialects"`
}

// shownPolicyPack reports one selected Policy Pack: its exact version, the
// policies it declares, and its canonical content digest.
type shownPolicyPack struct {
	Name          string        `json:"name"`
	Version       string        `json:"version"`
	Policies      []string      `json:"policies"`
	ContentDigest string        `json:"content_digest"`
	Source        shownLocation `json:"source"`
}

func (s showService) Show(options cli.ShowOptions) (cli.ShowOutcome, error) {
	switch options.Object {
	case cli.ShowDefinition:
		return s.showDefinition(options)
	case cli.ShowPolicyPack:
		return s.showPolicyPack(options)
	case cli.ShowPolicy:
		return s.showPolicy(options)
	default:
		failuref(s.stderr, "%q is not something rootform can show\n", string(options.Object))
		return cli.ShowUndecided, nil
	}
}

func (s showService) session(options cli.ShowOptions) backend.Session {
	return s.backend.Open(context.Background(),
		backend.Selection{Project: options.Project, Dialects: options.Dialect}, s.stderr)
}

// showDefinition resolves one name against the effective catalog. An owner
// name reports that source and everything it declares, a qualified
// <owner>.<kind>.<name> reports one declaration, and a bare declaration name
// is accepted while exactly one declaration carries it.
func (s showService) showDefinition(options cli.ShowOptions) (cli.ShowOutcome, error) {
	selected, err := s.session(options).Definitions(context.Background())
	if err != nil {
		return s.fail(err)
	}
	if options.Name == selected.Vocabulary.Owner {
		return s.report(shownVocabularyOf(selected.Vocabulary), options.Format)
	}
	for _, dialect := range selected.Dialects {
		if dialect.Owner == options.Name {
			return s.report(shownDialectOf(dialect), options.Format)
		}
	}
	if strings.Contains(options.Name, ".") {
		return s.showQualified(selected, options)
	}
	return s.showNamed(selected, options)
}

// showQualified reports the declaration a reference names. The owner, the
// kind, and the declared name are checked separately so a user learns which
// part of the reference is wrong instead of that the whole lookup failed.
func (s showService) showQualified(
	selected backend.Definitions,
	options cli.ShowOptions,
) (cli.ShowOutcome, error) {
	owner, kind, declared, ok := parseSymbolID(options.Name)
	if !ok {
		return s.malformedReference(selected, options.Name)
	}
	if !ownerLoaded(selected, owner) {
		return s.unknownOwner(selected, owner)
	}
	for _, entry := range catalogSymbols(selected) {
		if entry.id == options.Name {
			return s.report(entry.render(), options.Format)
		}
	}
	failuref(s.stderr,
		"%s declares no %s named %q\n\nTry:\n  rootform show %s\n",
		owner, kind, declared, owner)
	return cli.ShowNotFound, nil
}

// malformedReference reports a dotted name that is not a declaration
// reference. A policy identifier is recognized on purpose: it is a real
// identifier of another object, so it names its own command.
//
// Nothing is looked up here, so the outcome is command misuse rather than a
// definition that was not found.
func (s showService) malformedReference(
	selected backend.Definitions,
	name string,
) (cli.ShowOutcome, error) {
	parts := strings.Split(name, ".")
	if len(parts) == 3 && parts[1] == "policy" {
		failuref(s.stderr,
			"%q names a Policy, which a Policy Pack declares\n\nTry:\n  rootform show policy %s\n",
			name, name)
		return cli.ShowInvalidReference, nil
	}
	next := "rootform list dialects"
	if ownerLoaded(selected, parts[0]) {
		next = "rootform show " + parts[0]
	}
	failuref(s.stderr,
		"%q is not a declaration reference\n\nUse <owner>.<kind>.<name>, where kind is one of:\n%s\n\nTry:\n  %s\n",
		name, indentedList(symbolKinds), next)
	return cli.ShowInvalidReference, nil
}

func (s showService) unknownOwner(
	selected backend.Definitions,
	owner string,
) (cli.ShowOutcome, error) {
	failuref(s.stderr,
		"nothing named %q is loaded\n\nExpected one of:\n%s\n\nTry:\n  rootform list dialects\n",
		owner, indentedList(loadedOwners(selected)))
	return cli.ShowNotFound, nil
}

// showNamed resolves a bare declaration name. More than one owner may declare
// the same name, so an ambiguous name reports the exact references it could
// mean rather than choosing one.
func (s showService) showNamed(
	selected backend.Definitions,
	options cli.ShowOptions,
) (cli.ShowOutcome, error) {
	entries := catalogSymbols(selected)
	matches := make([]int, 0, 2)
	for index, entry := range entries {
		if entry.name == options.Name {
			matches = append(matches, index)
		}
	}
	switch len(matches) {
	case 1:
		return s.report(entries[matches[0]].render(), options.Format)
	case 0:
		failuref(s.stderr,
			"nothing named %q is loaded\n\nName a Dialect, the RF Vocabulary, or a declaration written as\n<owner>.<kind>.<name>.\n\nTry:\n  rootform list dialects\n",
			options.Name)
		return cli.ShowNotFound, nil
	default:
		candidates := make([]string, 0, len(matches))
		for _, index := range matches {
			candidates = append(candidates, entries[index].id)
		}
		sort.Strings(candidates)
		failuref(s.stderr,
			"%q names more than one declaration\n\nIt could be any of:\n%s\n\nUse the full <owner>.<kind>.<name>.\n",
			options.Name, indentedList(candidates))
		return cli.ShowUndecided, nil
	}
}

func ownerLoaded(selected backend.Definitions, owner string) bool {
	if owner == selected.Vocabulary.Owner {
		return true
	}
	for _, dialect := range selected.Dialects {
		if dialect.Owner == owner {
			return true
		}
	}
	return false
}

// loadedOwners names every source a reference may start with: the loaded
// dialects and the RF Vocabulary, which is not one of them.
func loadedOwners(selected backend.Definitions) []string {
	owners := make([]string, 0, len(selected.Dialects)+1)
	for _, dialect := range selected.Dialects {
		owners = append(owners, dialect.Owner)
	}
	owners = append(owners, selected.Vocabulary.Owner)
	sort.Strings(owners)
	return owners
}

// symbolEntry indexes one declaration by identity and renders it only when it
// is the one selected, so resolving a name never builds the whole catalog.
type symbolEntry struct {
	id     string
	name   string
	render func() shown
}

func catalogSymbols(selected backend.Definitions) []symbolEntry {
	entries := make([]symbolEntry, 0)
	for _, definition := range selected.Vocabulary.Definitions {
		entries = append(entries, symbolEntry{
			id: definition.ID, name: definition.Name,
			render: func() shown { return vocabularySymbol(definition, selected) },
		})
	}
	for _, dialect := range selected.Dialects {
		for _, declared := range dialect.Concepts {
			entries = append(entries, symbolEntry{
				id: declared.ID, name: declared.Name,
				render: func() shown {
					return shownConcept{
						ID: declared.ID, Owner: declared.Owner, Name: declared.Name,
						Description: declared.Description,
						Source:      locationOf(declared.Source),
					}
				},
			})
		}
		for _, declared := range dialect.Contexts {
			entries = append(entries, symbolEntry{
				id: declared.ID, name: declared.Name,
				render: func() shown {
					return shownContextDefinition{
						ID: declared.ID, Owner: declared.Owner, Name: declared.Name,
						Description: declared.Description,
						Producers:   contextProducers(selected.Dialects, declared.ID),
						Source:      locationOf(declared.Source),
					}
				},
			})
		}
		for _, declared := range dialect.Relations {
			entries = append(entries, symbolEntry{
				id: declared.ID, name: declared.Name,
				render: func() shown {
					return shownRelationDefinition{
						ID: declared.ID, Owner: declared.Owner, Name: declared.Name,
						Description: declared.Description,
						Producers:   relationProducers(selected.Dialects, declared.ID),
						Source:      locationOf(declared.Source),
					}
				},
			})
		}
		for _, declared := range dialect.Rules {
			entries = append(entries, symbolEntry{
				id: declared.ID, name: declared.Name,
				render: func() shown { return shownRuleOf(declared) },
			})
		}
	}
	return entries
}

// vocabularySymbol reports one RF Vocabulary definition. A shared dimension
// carries the rules that produce it, which is the evidence a reader needs to
// see how a Dialect reaches the shared vocabulary.
func vocabularySymbol(
	definition backend.VocabularyDefinition,
	selected backend.Definitions,
) shown {
	switch definition.Kind {
	case "context":
		return shownContextDefinition{
			ID: definition.ID, Owner: selected.Vocabulary.Owner, Name: definition.Name,
			Description: definition.Contract,
			Producers:   contextProducers(selected.Dialects, definition.ID),
		}
	case "relation":
		return shownRelationDefinition{
			ID: definition.ID, Owner: selected.Vocabulary.Owner, Name: definition.Name,
			Description: definition.Contract,
			Producers:   relationProducers(selected.Dialects, definition.ID),
		}
	default:
		return shownConcept{
			ID: definition.ID, Owner: selected.Vocabulary.Owner, Name: definition.Name,
			Description: definition.Contract,
		}
	}
}

func shownVocabularyOf(vocabulary backend.Vocabulary) shownVocabulary {
	shown := shownVocabulary{
		Name: vocabulary.Owner, Version: vocabulary.Version,
		ContractDigest: vocabulary.ContractDigest,
		Concepts:       make([]string, 0),
		Contexts:       make([]string, 0),
		Relations:      make([]string, 0),
	}
	for _, definition := range vocabulary.Definitions {
		switch definition.Kind {
		case "concept":
			shown.Concepts = append(shown.Concepts, definition.ID)
		case "context":
			shown.Contexts = append(shown.Contexts, definition.ID)
		case "relation":
			shown.Relations = append(shown.Relations, definition.ID)
		}
	}
	sort.Strings(shown.Concepts)
	sort.Strings(shown.Contexts)
	sort.Strings(shown.Relations)
	return shown
}

func (s showService) showPolicy(options cli.ShowOptions) (cli.ShowOutcome, error) {
	packs, err := s.session(options).PolicyDefinitions(context.Background(), options.PolicyPack)
	if err != nil {
		return s.fail(err)
	}
	declared := make([]backend.PolicyDefinition, 0)
	for _, pack := range packs {
		declared = append(declared, pack.Policies...)
	}
	ids := identifiersOf(declared, func(p backend.PolicyDefinition) string { return p.ID })
	index, ok := resolveDeclaration(s.stderr, ids, declaredPolicyQuery(ids, options.Name), "Policy", "rootform list policies")
	if !ok {
		return s.resolution(index)
	}
	policy := declared[index]
	return s.report(shownPolicy{
		ID: policy.ID, Pack: policy.Pack, Name: policy.Name,
		Target: shownPolicyTargetOf(policy.Target), Assert: policy.Assert,
		Message: policy.Message, Source: locationOf(policy.Source),
	}, options.Format)
}

func (s showService) showPolicyPack(options cli.ShowOptions) (cli.ShowOutcome, error) {
	packs, err := s.session(options).PolicyDefinitions(context.Background(), options.PolicyPack)
	if err != nil {
		return s.fail(err)
	}
	names := make([]string, 0, len(packs))
	for _, pack := range packs {
		if pack.Name == options.Name {
			if pack.ContentDigest == "" {
				human.Failure(s.stderr, "a Policy Pack digest could not be computed")
				return cli.ShowFailure, nil
			}
			shown := shownPolicyPack{
				Name: pack.Name, Version: pack.Version,
				ContentDigest: pack.ContentDigest, Source: locationOf(pack.Source),
				Policies: make([]string, 0, len(pack.Policies)),
			}
			for _, declared := range pack.Policies {
				shown.Policies = append(shown.Policies, declared.ID)
			}
			sort.Strings(shown.Policies)
			return s.report(shown, options.Format)
		}
		names = append(names, pack.Name)
	}
	sort.Strings(names)
	if len(names) == 0 {
		failuref(s.stderr,
			"no Policy Pack named %q is selected\n\nTry:\n  rootform list policy-packs\n",
			options.Name)
		return cli.ShowNotFound, nil
	}
	failuref(s.stderr,
		"no Policy Pack named %q is selected\n\nExpected one of:\n%s\n\nTry:\n  rootform list policy-packs\n",
		options.Name, indentedList(names))
	return cli.ShowNotFound, nil
}

func contextProducers(dialects []backend.Dialect, id string) []shownProducer {
	return emissionProducers(dialects, func(emission backend.Emission) bool {
		return emission.Kind == "context" && emission.Link == id
	})
}

func relationProducers(dialects []backend.Dialect, id string) []shownProducer {
	return emissionProducers(dialects, func(emission backend.Emission) bool {
		return emission.Kind == "relation" && emission.Link == id
	})
}

func emissionProducers(
	dialects []backend.Dialect,
	selectEmission func(backend.Emission) bool,
) []shownProducer {
	producers := make([]shownProducer, 0)
	for _, dialect := range dialects {
		for _, rule := range dialect.Rules {
			from := rule.ID
			if rule.Produces != "" {
				from = rule.Produces
			}
			for _, emission := range rule.Emissions {
				if !selectEmission(emission) {
					continue
				}
				producers = append(producers, shownProducer{
					Emission: emission.ID, Rule: rule.ID, From: from,
					To: emission.To, Via: emission.Via,
				})
			}
		}
	}
	sort.SliceStable(producers, func(i, j int) bool {
		if producers[i].Rule != producers[j].Rule {
			return producers[i].Rule < producers[j].Rule
		}
		if producers[i].To != producers[j].To {
			return producers[i].To < producers[j].To
		}
		return producers[i].Emission < producers[j].Emission
	})
	return producers
}

func shownDialectOf(dialect backend.Dialect) shownDialect {
	shown := shownDialect{
		Name:          dialect.Owner,
		Version:       dialect.Version,
		Origin:        catalogOrigin(dialect.Origin),
		ContentDigest: dialect.ContentDigest,
		Providers:     make([]shownVersioned, 0, len(dialect.Providers)),
		Concepts:      make([]string, 0, len(dialect.Concepts)),
		Contexts:      make([]string, 0, len(dialect.Contexts)),
		Relations:     make([]string, 0, len(dialect.Relations)),
		Rules:         make([]string, 0, len(dialect.Rules)),
		Source:        locationOf(dialect.Source),
	}
	for _, provider := range dialect.Providers {
		shown.Providers = append(shown.Providers, shownVersioned{Name: provider.Source, Version: provider.Version})
	}
	for _, concept := range dialect.Concepts {
		shown.Concepts = append(shown.Concepts, concept.ID)
	}
	for _, context := range dialect.Contexts {
		shown.Contexts = append(shown.Contexts, context.ID)
	}
	for _, relation := range dialect.Relations {
		shown.Relations = append(shown.Relations, relation.ID)
	}
	for _, rule := range dialect.Rules {
		shown.Rules = append(shown.Rules, rule.ID)
	}
	sort.Strings(shown.Concepts)
	sort.Strings(shown.Contexts)
	sort.Strings(shown.Relations)
	sort.Strings(shown.Rules)
	return shown
}

func shownRuleOf(rule backend.Rule) shownRule {
	shown := shownRule{
		ID:            rule.ID,
		Owner:         rule.Owner,
		Name:          rule.Name,
		Match:         shownMatchOf(rule.Match),
		Produces:      rule.Produces,
		Contexts:      make([]shownContext, 0),
		Relations:     make([]shownRelation, 0),
		Contributions: make([]shownContribution, 0),
		Composition:   make([]shownMember, 0),
		Source:        locationOf(rule.Source),
	}
	for _, emission := range rule.Emissions {
		switch emission.Kind {
		case "context":
			shown.Contexts = append(shown.Contexts, shownContext{
				Dimension: emission.Link, To: emission.To, Via: emission.Via,
			})
		case "relation":
			shown.Relations = append(shown.Relations, shownRelation{
				Predicate: emission.Link, To: emission.To, Via: emission.Via,
			})
		case "contribution":
			shown.Contributions = append(shown.Contributions, shownContribution{
				To: emission.To, Via: emission.Via,
			})
		}
	}
	for _, member := range rule.Composition {
		shown.Composition = append(shown.Composition, shownMember{
			Name: member.Name, Via: member.Via, Match: shownMatchOf(member.Match),
		})
	}
	return shown
}

func shownMatchOf(match backend.Match) shownMatch {
	return shownMatch{Kind: match.Kind, Type: match.Type, Where: match.Where}
}

func locationOf(location backend.Location) shownLocation {
	return shownLocation{Path: location.Path, Line: location.Line}
}

func (s showService) resolution(index int) (cli.ShowOutcome, error) {
	if index == resolveUnknown {
		return cli.ShowNotFound, nil
	}
	return cli.ShowUndecided, nil
}

func (s showService) fail(err error) (cli.ShowOutcome, error) {
	human.Failure(s.stderr, failureStatement(err))
	if failureKind(err) == backend.Failure {
		return cli.ShowFailure, nil
	}
	return cli.ShowUndecided, nil
}

type shown interface {
	writeText(io.Writer)
}

func (s showService) report(value shown, format cli.Format) (cli.ShowOutcome, error) {
	if format == cli.FormatJSON {
		encoded, err := json.MarshalIndent(value, "", "  ")
		if err != nil {
			human.Failure(s.stderr, "the definition could not be written")
			return cli.ShowFailure, nil
		}
		encoded = append(encoded, 10)
		if n, err := s.stdout.Write(encoded); err != nil || n != len(encoded) {
			human.Failure(s.stderr, "the definition could not be written")
			return cli.ShowFailure, nil
		}
		return cli.ShowReported, nil
	}
	if err := paged(s.stdout, s.stderr, value.writeText); err != nil {
		human.Failure(s.stderr, "the definition could not be written")
		return cli.ShowFailure, nil
	}
	return cli.ShowReported, nil
}

func (p shownDialect) writeText(out io.Writer) {
	human.Result(out, p.Name+"@"+p.Version)
	fmt.Fprintln(out)
	human.Summary(out,
		[2]string{"Origin", p.Origin},
		[2]string{"Providers", countOf(len(p.Providers))},
		[2]string{"Concepts", countOf(len(p.Concepts))},
		[2]string{"Contexts", countOf(len(p.Contexts))},
		[2]string{"Relations", countOf(len(p.Relations))},
		[2]string{"Rules", countOf(len(p.Rules))},
		[2]string{"Defined", sourceText(p.Source)},
	)
	writeProviderSection(out, p.Providers)
	writeSymbolSection(out, "Concepts", p.Concepts)
	writeSymbolSection(out, "Contexts", p.Contexts)
	writeSymbolSection(out, "Relations", p.Relations)
	writeSymbolSection(out, "Rules", p.Rules)
}

func (v shownVocabulary) writeText(out io.Writer) {
	human.Result(out, v.Name+"@"+v.Version)
	fmt.Fprintln(out)
	human.Summary(out,
		[2]string{"Origin", "built into rootform"},
		[2]string{"Contract", v.ContractDigest},
		[2]string{"Concepts", countOf(len(v.Concepts))},
		[2]string{"Contexts", countOf(len(v.Contexts))},
		[2]string{"Relations", countOf(len(v.Relations))},
	)
	writeSymbolSection(out, "Concepts", v.Concepts)
	writeSymbolSection(out, "Contexts", v.Contexts)
	writeSymbolSection(out, "Relations", v.Relations)
}

func (c shownConcept) writeText(out io.Writer) {
	human.Result(out, c.ID)
	fmt.Fprintln(out)
	human.Summary(out,
		[2]string{"Purpose", c.Description},
		[2]string{"Defined", sourceText(c.Source)},
	)
}

func (c shownContextDefinition) writeText(out io.Writer) {
	human.Result(out, c.ID)
	fmt.Fprintln(out)
	human.Summary(out,
		[2]string{"Purpose", c.Description},
		[2]string{"Defined", sourceText(c.Source)},
	)
	writeProducerSection(out, c.Producers)
}

func (r shownRelationDefinition) writeText(out io.Writer) {
	human.Result(out, r.ID)
	fmt.Fprintln(out)
	human.Summary(out,
		[2]string{"Purpose", r.Description},
		[2]string{"Defined", sourceText(r.Source)},
	)
	writeProducerSection(out, r.Producers)
}

func (r shownRule) writeText(out io.Writer) {
	human.Result(out, r.ID)
	fmt.Fprintln(out)
	human.Summary(out,
		[2]string{"Matches", fmt.Sprintf("%s %q", r.Match.Kind, r.Match.Type)},
		[2]string{"Where", r.Match.Where},
		[2]string{"Produces", r.Produces},
		[2]string{"Defined", sourceText(r.Source)},
	)
	if len(r.Contexts) != 0 {
		human.Section(out, fmt.Sprintf("Contexts (%d)", len(r.Contexts)))
		for _, context := range r.Contexts {
			fmt.Fprintf(out, "  %s\n", context.Dimension)
			writeFact(out, [2]string{"with", context.To}, [2]string{"via", context.Via})
		}
	}
	if len(r.Relations) != 0 {
		human.Section(out, fmt.Sprintf("Relations (%d)", len(r.Relations)))
		for _, relation := range r.Relations {
			fmt.Fprintf(out, "  %s\n", relation.Predicate)
			writeFact(out, [2]string{"to", relation.To}, [2]string{"via", relation.Via})
		}
	}
	if len(r.Contributions) != 0 {
		human.Section(out, fmt.Sprintf("Contributions (%d)", len(r.Contributions)))
		for _, contribution := range r.Contributions {
			fmt.Fprintf(out, "  %s\n", contribution.To)
			writeFact(out, [2]string{"via", contribution.Via})
		}
	}
	if len(r.Composition) != 0 {
		human.Section(out, fmt.Sprintf("Members (%d)", len(r.Composition)))
		for _, member := range r.Composition {
			fmt.Fprintf(out, "  %s\n", member.Name)
			writeFact(out,
				[2]string{"matches", fmt.Sprintf("%s %q", member.Match.Kind, member.Match.Type)},
				[2]string{"where", member.Match.Where},
				[2]string{"via", member.Via},
			)
		}
	}
}

func (p shownPolicy) writeText(out io.Writer) {
	human.Result(out, p.ID)
	fmt.Fprintln(out)
	rows := make([][2]string, 0, 6)
	if p.Target.Concept != "" {
		rows = append(rows, [2]string{"Target", p.Target.Concept})
	}
	if len(p.Target.Rules) != 0 {
		rows = append(rows, [2]string{"Rules", strings.Join(p.Target.Rules, ", ")})
	}
	if len(p.Target.Dialects) != 0 {
		rows = append(rows, [2]string{"Dialects", strings.Join(p.Target.Dialects, ", ")})
	}
	rows = append(rows,
		[2]string{"Assertion", p.Assert},
		[2]string{"Message", p.Message},
		[2]string{"Defined", sourceText(p.Source)},
	)
	human.Summary(out, rows...)
}

func (p shownPolicyPack) writeText(out io.Writer) {
	human.Result(out, p.Name+"@"+p.Version)
	fmt.Fprintln(out)
	human.Summary(out,
		[2]string{"Content", p.ContentDigest},
		[2]string{"Policies", countOf(len(p.Policies))},
		[2]string{"Defined", sourceText(p.Source)},
	)
	writeSymbolSection(out, "Policies", p.Policies)
}

// countOf reports an absent kind as no value at all, so a summary states what
// a source declares instead of printing a row of zeros.
func countOf(count int) string {
	if count == 0 {
		return ""
	}
	return strconv.Itoa(count)
}

// writeSymbolSection lists qualified identifiers under a counted heading, so
// a reader sees how much a source declares before reading the declarations.
func writeSymbolSection(out io.Writer, heading string, identifiers []string) {
	if len(identifiers) == 0 {
		return
	}
	human.Section(out, fmt.Sprintf("%s (%d)", heading, len(identifiers)))
	for _, identifier := range identifiers {
		fmt.Fprintf(out, "  %s\n", identifier)
	}
}

// writeProviderSection lists the provider versions a Dialect is written
// against, each on its own row, so a long provider name never pushes the
// version it is pinned to out of view.
func writeProviderSection(out io.Writer, providers []shownVersioned) {
	if len(providers) == 0 {
		return
	}
	human.Section(out, fmt.Sprintf("Providers (%d)", len(providers)))
	rows := make([][2]string, 0, len(providers))
	for _, provider := range providers {
		rows = append(rows, [2]string{"  " + provider.Name, provider.Version})
	}
	human.Summary(out, rows...)
}

func writeProducerSection(out io.Writer, producers []shownProducer) {
	if len(producers) == 0 {
		return
	}
	human.Section(out, fmt.Sprintf("Produced by (%d)", len(producers)))
	for _, producer := range producers {
		fmt.Fprintf(out, "  %s\n", producer.Rule)
		writeFact(out,
			[2]string{"from", producer.From},
			[2]string{"to", producer.To},
			[2]string{"via", producer.Via},
		)
	}
}

// writeFact writes the parts of one declared fact under the identity it
// belongs to. A target and a traversal each keep their own row, so neither
// runs off the line when a rule reaches deep into a resource.
func writeFact(out io.Writer, rows ...[2]string) {
	width := 0
	for _, row := range rows {
		if row[1] != "" && len(row[0]) > width {
			width = len(row[0])
		}
	}
	for _, row := range rows {
		if row[1] == "" {
			continue
		}
		fmt.Fprintf(out, "    %s%s%s\n", row[0],
			strings.Repeat(" ", width-len(row[0])+2), row[1])
	}
}

func sourceText(location shownLocation) string {
	if location.Path == "" {
		return ""
	}
	return fmt.Sprintf("%s:%d", location.Path, location.Line)
}

func shownPolicyTargetOf(target backend.PolicyTarget) shownPolicyTarget {
	shown := shownPolicyTarget{
		Concept:  target.Concept,
		Rules:    append(make([]string, 0, len(target.Rules)), target.Rules...),
		Dialects: append([]string{}, target.Dialects...),
	}
	sort.Strings(shown.Rules)
	sort.Strings(shown.Dialects)
	return shown
}

func renderPolicyTarget(target backend.PolicyTarget) string {
	return renderShownPolicyTarget(shownPolicyTargetOf(target))
}

func renderShownPolicyTarget(target shownPolicyTarget) string {
	parts := make([]string, 0, 3)
	if target.Concept != "" {
		parts = append(parts, "Concept "+target.Concept)
	}
	if len(target.Rules) != 0 {
		parts = append(parts, "Rules "+strings.Join(target.Rules, ", "))
	}
	if len(target.Dialects) != 0 {
		parts = append(parts, "Dialects "+strings.Join(target.Dialects, ", "))
	}
	return strings.Join(parts, " ")
}
