package app

import (
	"fmt"
	"io"

	"github.com/rootform-dev/rootform/cli/internal/human"
)

// writeWarning states a condition that did not stop the command from producing
// its result, so it never claims the operational prefix an error carries.
func writeWarning(writer io.Writer, message string) {
	fmt.Fprintln(writer, human.Tint(writer, "warning", human.Warn)+" "+message)
}
