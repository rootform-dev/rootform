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

// Backend opens the selection of one command and compares Forms.
type Backend interface {
	// Open prepares the project selection of one command. It performs no
	// work until a session method needs the project, its Dialect catalog or
	// its Policy Packs. notices receives the plain lines a selection states
	// while it loads: a source used for this command only, or the
	// diagnostics of a source that does not compile.
	Open(ctx context.Context, selection Selection, notices io.Writer) Session
	// Compare compares the selected stage of two Forms, before then after.
	Compare(ctx context.Context, before, after form.Side) *form.ComparisonForm
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
