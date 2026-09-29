// Package backend declares what the Rootform command line needs from the
// engine that compiles, resolves and evaluates architecture. The command line
// owns every command, its options, its orchestration and its reports; a
// backend answers with structured values and sanitized errors. Signatures
// carry only the types of this module and of the standard library.
package backend

import (
	"context"
	"io"

	"github.com/rootform-dev/rootform/cli/form"
	"github.com/rootform-dev/rootform/cli/policyresult"
)

// Backend opens the selection of one command, compares Forms, and reaches the
// Rootform home and the authoring tools.
type Backend interface {
	// Open prepares the project selection of one command. It performs no
	// work until a session method needs the project, its Dialect catalog or
	// its Policy Packs. notices receives the plain lines a selection states
	// while it loads: a source used for this command only, or the
	// diagnostics of a source that does not compile.
	Open(ctx context.Context, selection Selection, notices io.Writer) Session
	// Compare compares the selected stage of two Forms, before then after.
	Compare(ctx context.Context, before, after form.Side) *form.ComparisonForm
	// Home is the Rootform home of this machine.
	Home() Home
	// Authoring compiles Dialect and Policy Pack sources as they stand.
	Authoring() Authoring
}

// Selection names the project whose selection one command reads.
type Selection struct {
	// Project is the project directory; empty means the working directory.
	Project string
	// Locked requires the project to hold rootform.lock.
	Locked bool
	// Dialects are Dialect source directories used for this command only.
	Dialects []string
}

// Session is the selection of one command, loaded at most once.
type Session interface {
	// Compile compiles a plan JSON or a state JSON against the selected
	// Dialects. A saved Form never reaches it: it reopens as it is.
	Compile(ctx context.Context, export Export) (Compiled, error)
	// Presentation returns the presentation catalog of the Dialects behind
	// focus and the warnings to state. It never fails: an unavailable
	// catalog is the empty one.
	Presentation(ctx context.Context, focus *form.InputForm) Presentation
	// Policies loads the selected Policy Packs with the overlays of this
	// command applied: source directories or compiled Policy Pack files.
	Policies(ctx context.Context, overlays []string) (PolicySet, error)
	// Definitions returns what the selected Dialects and the RF Vocabulary
	// declare. It loads the Dialect catalog Compile compiles against.
	Definitions(ctx context.Context) (Definitions, error)
	// PolicyDefinitions compiles the selected Policy Pack sources, with the
	// overlays of this command applied, without linking them, and returns
	// what they declare. A compiled Policy Pack file is refused: it no longer
	// holds its source.
	PolicyDefinitions(ctx context.Context, overlays []string) ([]PolicyPackDefinition, error)
}

// Export is one producer export and the options that shape its compilation.
type Export struct {
	// Data is the plan JSON or state JSON as read.
	Data []byte
	// PlanFile is the saved plan that enriches a plan JSON; empty for none.
	PlanFile string
	// RequireEnrichment refuses a plan JSON whose saved plan does not pair.
	RequireEnrichment bool
	// Producer is the attested producer: terraform, opentofu or empty.
	Producer string
	// PlanComplete records that the plan is attested complete.
	PlanComplete bool
	// ProviderMap binds an observed provider source to a provider binding.
	ProviderMap map[string]string
	// Attestations are recorded in the Form as given.
	Attestations []form.Attestation
}

// Compiled is the Form of one export and the outcome of its enrichment.
type Compiled struct {
	Form       *form.InputForm
	Enrichment form.SnapshotEnrichment
}

// Presentation is a presentation catalog and the warnings it raised.
type Presentation struct {
	Catalog  []byte
	Warnings []string
}

// PolicySet is the active Policy Packs of one command. Nothing is linked
// until a Policy a pack holds is evaluated.
type PolicySet interface {
	// Packs lists the loaded packs: source packs, then compiled packs.
	Packs() []Pack
	// Evaluate evaluates the selected Policies against one stage of one
	// architecture and returns the finalized result of that architecture.
	// Only the packs holding a selected Policy are linked; a pack that does
	// not link leaves this architecture without an answer.
	Evaluate(ctx context.Context, architecture *form.InputForm, stage form.Stage, selected []string) policyresult.Architecture
}

// Pack is one loaded Policy Pack.
type Pack struct {
	// Record identifies the pack as a result records it unlinked.
	Record policyresult.PolicyPack
	// Overlay marks a pack a --policy-pack source supplied for this command.
	Overlay bool
	// Policies are the identities of the Policies the pack declares.
	Policies []string
}

// Definitions are the declarations of the selected Dialects and of the RF
// Vocabulary they refer to.
type Definitions struct {
	Vocabulary Vocabulary
	// Dialects are the selected Dialects in catalog order.
	Dialects []Dialect
}

// Vocabulary is the RF Vocabulary. It ships with the backend rather than
// being selected, so it carries a contract digest instead of an origin.
type Vocabulary struct {
	// Owner is the owner every vocabulary identity starts with.
	Owner          string
	Version        string
	ContractDigest string
	Definitions    []VocabularyDefinition
}

// VocabularyDefinition is one concept, context or relation of the RF
// Vocabulary.
type VocabularyDefinition struct {
	// Kind is concept, context or relation.
	Kind     string
	ID       string
	Name     string
	Contract string
}

// Dialect is one selected Dialect and what it declares.
type Dialect struct {
	Owner   string
	Version string
	// Origin is where the selected version comes from.
	Origin        form.SemanticOrigin
	ContentDigest string
	Source        Location
	// Providers are the provider versions the Dialect is written against.
	Providers []Provider
	Concepts  []Declaration
	Contexts  []Declaration
	Relations []Declaration
	Rules     []Rule
}

// Location is where a declaration is written.
type Location struct {
	Path string
	Line int
}

// Provider is one provider source and the version a Dialect targets.
type Provider struct {
	Source  string
	Version string
}

// Declaration is one concept, context or relation a Dialect declares.
type Declaration struct {
	ID          string
	Owner       string
	Name        string
	Description string
	Source      Location
}

// Rule is one rule a Dialect declares. Expressions and traversals are
// written as the Rootform Language writes them.
type Rule struct {
	ID    string
	Owner string
	Name  string
	Match Match
	// Produces is the concept the rule gives what it matches; empty when it
	// gives none.
	Produces    string
	Emissions   []Emission
	Composition []Member
	Source      Location
}

// Match is what a rule or a composition member matches.
type Match struct {
	Kind  string
	Type  string
	Where string
}

// Emission is one context, relation or contribution a rule emits.
type Emission struct {
	ID string
	// Kind is context, relation or contribution.
	Kind string
	// Link is the dimension of a context or the predicate of a relation. It
	// is empty for a contribution.
	Link string
	To   string
	Via  string
}

// Member is one member of a rule's composition.
type Member struct {
	Name  string
	Via   string
	Match Match
}

// PolicyPackDefinition is one Policy Pack source and what it declares.
type PolicyPackDefinition struct {
	Name    string
	Version string
	// ContentDigest identifies the canonical source. It is empty when it
	// could not be computed.
	ContentDigest string
	Source        Location
	Policies      []PolicyDefinition
}

// PolicyDefinition is one Policy as its Policy Pack declares it.
type PolicyDefinition struct {
	ID     string
	Pack   string
	Name   string
	Target PolicyTarget
	// Assert is the assertion as the Rootform Language writes it.
	Assert  string
	Message string
	Source  Location
}

// PolicyTarget is what a Policy applies to.
type PolicyTarget struct {
	// Concept is the targeted concept; empty when the Policy targets rules.
	Concept  string
	Rules    []string
	Dialects []string
}

// Home is the Rootform home of one machine: the Dialect and Policy Pack
// versions installed from registries.
type Home interface {
	// Installed lists the installed versions of one family. It reads no
	// project and uses no network.
	Installed(ctx context.Context, family Family) ([]Unit, error)
}

// Family names a kind of distributed content.
type Family string

const (
	// Dialects are Dialect packages.
	Dialects Family = "dialects"
	// PolicyPacks are Policy Pack packages.
	PolicyPacks Family = "policy-packs"
)

// Unit is one installed version.
type Unit struct {
	Name    string
	Version string
	// Repository and ManifestDigest name the registry artifact the version
	// was installed from.
	Repository     string
	ManifestDigest string
	ContentDigest  string
}

// Authoring compiles the sources of Dialects and Policy Packs as they stand,
// without selecting or loading anything else.
type Authoring interface {
	// Dialects compiles the Dialect sources directory holds and reports
	// every diagnostic.
	Dialects(ctx context.Context, directory string) (DialectCompilation, error)
}

// DialectCompilation is the outcome of compiling Dialect sources.
type DialectCompilation struct {
	// Empty reports a directory that holds no Dialect source.
	Empty bool
	// Dialects are the Dialects that compiled, in compilation order.
	Dialects []Identity
	// Diagnostics are every problem the compilation found.
	Diagnostics []Diagnostic
}

// Identity names one version of a Dialect or a Policy Pack.
type Identity struct {
	Name    string
	Version string
}

// Diagnostic is one problem found in a source.
type Diagnostic struct {
	Code    string
	Message string
	// Path, Line and Column locate the problem. Path is empty for a problem
	// of the whole source; Column is zero when the position has none.
	Path   string
	Line   int
	Column int
}

// Kind classifies a failure; the command line maps it to an exit status.
type Kind int

const (
	// NoAnswer means the input, the selection or the evidence allows no
	// answer.
	NoAnswer Kind = iota
	// Failure is an operational failure: a file, the Rootform home, the
	// network, a registry or a server.
	Failure
	// Negative is a decided negative answer.
	Negative
	// Usage means the command was used incorrectly.
	Usage
	// Unresolved means a selected Dialect or Policy Pack, or a source this
	// command supplies, is missing, invalid or does not compile.
	Unresolved
)

// Error is a failure reported across a port. Every text it carries is
// already safe to print: it names no private path, registry response or
// internal detail beyond what the command states.
type Error struct {
	Kind Kind
	// Code is the diagnostic code a machine report carries. It is empty
	// when Message already leads with its code.
	Code string
	// Message is the statement a machine report carries.
	Message string
	// Human is the statement a reader sees when it differs from Message.
	Human string
	// Detail is guidance stated under the failure, one line each.
	Detail string
}

func (e *Error) Error() string { return e.Message }
