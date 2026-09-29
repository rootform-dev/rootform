package app

import (
	"bytes"
	"errors"
	"fmt"
	"io"

	cli "github.com/rootform-dev/rootform/cli/command"
	"github.com/rootform-dev/rootform/cli/human"
	"github.com/rootform-dev/rootform/cli/policyresult"
)

// render produces every requested report from one result before anything is
// written. Standard output carries the text summary, or the --format output
// when no file is written; a failed check writes standard output only when a
// format was asked for. A file takes the format its extension names, or
// --format when its name names none.
func (s checkService) render(run *checkRun, result policyresult.Result, summary bool) ([]renderedOutput, []byte, error) {
	o := run.options
	files := make([]renderedOutput, 0, len(o.Output))
	for _, out := range o.Output {
		format := outputFormat(out)
		if format == "" {
			format = o.Format
		}
		body, err := renderCheck(format, result, run, io.Discard)
		if err != nil {
			return nil, nil, err
		}
		files = append(files, renderedOutput{path: out, body: body})
	}
	format := checkStdoutFormat(o)
	if !summary {
		return files, nil, nil
	}
	body, err := renderCheck(format, result, run, s.stdout)
	if err != nil {
		return nil, nil, err
	}
	return files, body, nil
}

// checkStdoutFormat is the format standard output carries: the text summary,
// or --format when no file is written.
func checkStdoutFormat(o cli.CheckOptions) string {
	if len(o.Output) == 0 && o.Format != "" {
		return o.Format
	}
	return "text"
}

// renderCheck renders one format. Text is colored only for a terminal
// writer and lists every entry; Markdown keeps its abbreviation; JSON and
// SARIF never carry styling.
func renderCheck(format string, result policyresult.Result, run *checkRun, terminal io.Writer) ([]byte, error) {
	switch format {
	case "text":
		var buffer bytes.Buffer
		buildCheckReport(result, run).writeText(human.Redirect(terminal, &buffer))
		return buffer.Bytes(), nil
	case "markdown":
		return checkMarkdown(result, run), nil
	case "json":
		encoded, err := policyresult.Serialize(result)
		if err != nil {
			return nil, errors.New("OUTPUT_FAILED: the Policy result could not be encoded")
		}
		return encoded, nil
	case "sarif":
		encoded, err := policyresult.SerializeSARIF(result)
		if err != nil {
			return nil, errors.New("OUTPUT_FAILED: the SARIF log could not be produced")
		}
		return encoded, nil
	}
	return nil, fmt.Errorf("format %q is not supported", format)
}
