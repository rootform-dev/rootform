package app

import (
	"errors"
	"fmt"
	"io"
	"strings"

	"github.com/rootform-dev/rootform/cli/backend"
	"github.com/rootform-dev/rootform/cli/form"
	cli "github.com/rootform-dev/rootform/cli/internal/command"
	"github.com/rootform-dev/rootform/cli/internal/human"
)

func technicalError(exit int, code, message, headline, body string) cli.RunError {
	return cli.RunError{
		Code: exit, Message: message, DiagnosticCode: code,
		Headline: headline, Body: strings.Trim(body, "\n"),
	}
}

func stageFailureWords(err error) (string, string, bool) {
	var unavailable form.StageUnavailableError
	if !errors.As(err, &unavailable) {
		return "", "", false
	}
	return fmt.Sprintf("%s has no %s stage", unavailable.Subject, stageWords(unavailable.Stage)),
		"Available: " + strings.Join(unavailable.Available, ", "), true
}

func stageRunError(err error) cli.RunError {
	if headline, body, ok := stageFailureWords(err); ok {
		return technicalError(cli.ExitNoAnswer, "STAGE_UNAVAILABLE", err.Error(), headline, body)
	}
	return cli.RunError{Code: cli.ExitNoAnswer, Message: err.Error()}
}

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
