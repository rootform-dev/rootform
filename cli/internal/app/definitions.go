package app

import (
	"errors"
	"io"
	"regexp"
	"slices"
	"strings"

	"github.com/rootform-dev/rootform/cli/backend"
	"github.com/rootform-dev/rootform/cli/form"
)

// failureKind classifies a failure to load definitions. A failure outside the
// backend contract reads as a selection that did not resolve.
func failureKind(err error) backend.Kind {
	var failure *backend.Error
	if errors.As(err, &failure) {
		return failure.Kind
	}
	return backend.Unresolved
}

// failureStatement is what a reader sees of a failure: the human statement
// when the backend states one apart from its message, else the message.
func failureStatement(err error) string {
	var failure *backend.Error
	if errors.As(err, &failure) && failure.Human != "" {
		return failure.Human
	}
	return err.Error()
}

// noAnswerError is a failure that leaves no answer: the selection itself is
// invalid or required and absent.
type noAnswerError struct{ message string }

func (e noAnswerError) Error() string  { return e.message }
func (e noAnswerError) NoAnswer() bool { return true }

// identifierPattern is the grammar of a Rootform identifier: lowercase
// kebab-case ASCII.
var identifierPattern = regexp.MustCompile(`^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$`)

// maxIdentifierBytes bounds the length of a Rootform identifier.
const maxIdentifierBytes = 64

// validIdentifier reports whether value is a well-formed Rootform
// identifier, 1 to 64 bytes long.
func validIdentifier(value string) bool {
	return len(value) > 0 && len(value) <= maxIdentifierBytes &&
		identifierPattern.MatchString(value)
}

// symbolKinds are the kinds a declaration reference names, in the order a
// diagnostic lists them.
var symbolKinds = []string{"concept", "context", "relation", "rule"}

// parseSymbolID reads a declaration reference, <owner>.<kind>.<name>.
func parseSymbolID(value string) (owner, kind, name string, ok bool) {
	parts := strings.Split(value, ".")
	if len(parts) != 3 || !validIdentifier(parts[0]) || !validIdentifier(parts[2]) {
		return "", "", "", false
	}
	if !slices.Contains(symbolKinds, parts[1]) {
		return "", "", "", false
	}
	return parts[0], parts[1], parts[2], true
}

// catalogOrigin names where a Dialect of the current catalog comes from, in
// every list and show format: embedded in this rootform, local, or oci. A
// Form records the same provenance as it stood when the Form was compiled,
// and its format names the embedded origin supplied.
func catalogOrigin(origin form.SemanticOrigin) string {
	if origin == form.SemanticSupplied {
		return "embedded"
	}
	return string(origin)
}

func indentedList(values []string) string {
	lines := make([]string, 0, len(values))
	for _, value := range values {
		lines = append(lines, "  "+value)
	}
	return strings.Join(lines, "\n")
}

// resolveDeclaration finds the one identifier a query names, exactly or by
// its last segment, and states why when it cannot.
func resolveDeclaration(
	stderr io.Writer,
	identifiers []string,
	query, object, suggestion string,
) (int, bool) {
	if query == "" || len(identifiers) == 0 {
		if len(identifiers) == 0 {
			failuref(stderr, "no %s is loaded\n\nTry:\n  %s\n", object, suggestion)
		}
		return resolveUnknown, false
	}
	index, found := lookupIdentifier(identifiers, query)
	if !found {
		failuref(stderr, "no %s named %q is declared\n\nTry:\n  %s\n",
			object, query, suggestion)
		return resolveUnknown, false
	}
	if index == resolveAmbiguous {
		failuref(stderr,
			"%q names more than one %s\n\nUse the full canonical identifier.\n\nIt could be any of:\n%s\n",
			query, object, identList(identifiers))
		return resolveAmbiguous, false
	}
	return index, true
}

// declaredPolicyQuery resolves a PACK/NAME query to the identity it names
// among ids, so every command that names a Policy accepts the same forms. A
// query that names no declared Policy is kept as typed for the diagnostic.
func declaredPolicyQuery(ids []string, query string) string {
	if id := policyIdentity(query); id != query && slices.Contains(ids, id) {
		return id
	}
	return query
}
