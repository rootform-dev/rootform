package app

import (
	"errors"
	"fmt"
	"io"
	"strings"

	"github.com/rootform-dev/rootform/cli/backend"
	"github.com/rootform-dev/rootform/cli/human"
)

// failuref states an operational error assembled from values, so no caller
// hand-builds the prefix the failure primitive owns.
func failuref(writer io.Writer, format string, args ...any) {
	human.Failure(writer, strings.TrimSuffix(fmt.Sprintf(format, args...), "\n"))
}

// selectionFailure is a project selection problem that stopped governance:
// the machine message is one line, the human message may carry guidance.
type selectionFailure struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	human   string
	detail  string
	// operational marks a project file the system could not read, which
	// stops the command without deciding anything about the selection.
	operational bool
}

// selectionFailureOf reads why the project selection or its Policy Packs are
// unavailable from the failure the backend reported. A failure outside the
// backend contract states no cause it cannot vouch for.
func selectionFailureOf(err error) selectionFailure {
	var failure *backend.Error
	if errors.As(err, &failure) {
		return selectionFailure{Code: failure.Code, Message: failure.Message, human: failure.Human, detail: failure.Detail, operational: failure.Kind == backend.Failure}
	}
	return selectionFailure{Code: "SELECTION_PROJECT_UNREADABLE", Message: "the project selection could not be loaded", operational: true}
}

func countWithNoun(count int, singular, plural string) string {
	noun := plural
	if count == 1 {
		noun = singular
	}
	return fmt.Sprintf("%d %s", count, noun)
}
