package command

import (
	"fmt"
	"strings"

	"github.com/spf13/cobra"
)

type Format string

const (
	FormatText     Format = "text"
	FormatJSON     Format = "json"
	FormatSARIF    Format = "sarif"
	FormatMarkdown Format = "markdown"
	FormatHTML     Format = "html"
)

// exitStatus ends a command that already reported its outcome with that
// outcome's exit code; nothing more is printed.
type exitStatus struct{ code int }

func (e exitStatus) Error() string { return fmt.Sprintf("command exit %d", e.code) }

// formatFlag declares --format with its values, the first being the default.
func formatFlag(cmd *cobra.Command, target *string, values ...string) {
	cmd.Flags().StringVar(target, "format", "",
		"output format: `"+strings.Join(values, "|")+"`; default: "+values[0])
	completeValues(cmd, "format", values...)
}

func parseFormat(value string, allowed ...Format) (Format, error) {
	if value == "" {
		return allowed[0], nil
	}
	for _, candidate := range allowed {
		if value == string(candidate) {
			return candidate, nil
		}
	}
	names := make([]string, 0, len(allowed))
	for _, candidate := range allowed {
		names = append(names, string(candidate))
	}
	return "", usageError{msg: fmt.Sprintf("--format must be %s, but %q was given", orList(names), value)}
}

// orList names alternatives as usage messages do: "a or b", "a, b, or c".
func orList(words []string) string {
	switch len(words) {
	case 0:
		return ""
	case 1:
		return words[0]
	case 2:
		return words[0] + " or " + words[1]
	}
	return strings.Join(words[:len(words)-1], ", ") + ", or " + words[len(words)-1]
}
