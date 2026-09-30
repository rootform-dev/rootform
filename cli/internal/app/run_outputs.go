package app

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	cli "github.com/rootform-dev/rootform/cli/internal/command"
	"github.com/rootform-dev/rootform/cli/internal/export"
	"github.com/rootform-dev/rootform/cli/internal/human"
)

// outputFormat selects a format from a recognized file extension, whichever
// command owns that format.
func outputFormat(path string) string {
	lower := strings.ToLower(path)
	switch {
	case strings.HasSuffix(lower, ".sarif.json"), strings.HasSuffix(lower, ".sarif"):
		return "sarif"
	case strings.HasSuffix(lower, ".json"):
		return "json"
	case strings.HasSuffix(lower, ".txt"):
		return "text"
	case strings.HasSuffix(lower, ".md"):
		return "markdown"
	case strings.HasSuffix(lower, ".html"):
		return "html"
	}
	return ""
}

func canonicalOutputPath(p string) (string, error) {
	absolute, err := filepath.Abs(p)
	if err != nil {
		return "", err
	}
	if resolved, err := filepath.EvalSymlinks(absolute); err == nil {
		return resolved, nil
	}
	parent, err := filepath.EvalSymlinks(filepath.Dir(absolute))
	if err != nil {
		return absolute, nil
	}
	return filepath.Join(parent, filepath.Base(absolute)), nil
}

// outputRules names the formats one command writes. foreign explains a
// recognized format that belongs to the other command.
type outputRules struct {
	formats    map[string]bool
	extensions string
	foreign    func(output string) error
}

var runOutputRules = outputRules{
	formats:    map[string]bool{"text": true, "json": true, "markdown": true, "html": true},
	extensions: ".txt, .json, .md, or .html",
	foreign: func(output string) error {
		return fmt.Errorf("output %q is a SARIF log of Policy results; run never evaluates Policies\n\nTry:\n  rootform check INPUT -o %s", output, shellQuote(output))
	},
}

var checkOutputRules = outputRules{
	formats:    map[string]bool{"text": true, "json": true, "markdown": true, "sarif": true},
	extensions: ".txt, .json, .md, .sarif, or .sarif.json",
	foreign: func(output string) error {
		return fmt.Errorf("output %q is the interactive HTML export of a Form; check writes text, JSON, Markdown, and SARIF reports\n\nTry:\n  rootform run INPUT --no-serve -o %s", output, shellQuote(output))
	},
}

// validateOutputs refuses every output request that is ambiguous or would
// overwrite an input, before anything is read or written. inputs may hold
// empty entries for options that were not given.
func validateOutputs(outputs []string, format string, inputs []string, rules outputRules) error {
	if len(outputs) > 1 && format != "" {
		return errors.New("--format applies to standard output or a single output; give each output a recognized extension instead")
	}
	seen := map[string]string{}
	var existing []struct {
		path string
		info os.FileInfo
	}
	for _, out := range outputs {
		if out == "" || out == "-" {
			return errors.New("--output requires a file path; standard output already carries the summary or --format")
		}
		outputInfo, outputErr := os.Stat(out)
		if outputErr == nil && outputInfo.IsDir() {
			return fmt.Errorf("output %q is a directory", out)
		}
		extension := outputFormat(out)
		if extension != "" && !rules.formats[extension] {
			return rules.foreign(out)
		}
		if extension == "" && format == "" {
			return fmt.Errorf("output %q needs %s, or --format", out, rules.extensions)
		}
		if format != "" && extension != "" && format != extension {
			return fmt.Errorf("--format %s conflicts with output %q", format, out)
		}
		canonical, err := canonicalOutputPath(out)
		if err != nil {
			return errors.New("output path is invalid")
		}
		if earlier := seen[canonical]; earlier != "" {
			return fmt.Errorf("duplicate output targets: %q and %q", earlier, out)
		}
		seen[canonical] = out
		if outputErr == nil {
			for _, prior := range existing {
				if os.SameFile(outputInfo, prior.info) {
					return fmt.Errorf("duplicate output targets: %q and %q", prior.path, out)
				}
			}
			existing = append(existing, struct {
				path string
				info os.FileInfo
			}{out, outputInfo})
		}
		for _, input := range inputs {
			if input == "" || input == "-" {
				continue
			}
			same, err := canonicalOutputPath(input)
			if err == nil && same == canonical {
				return fmt.Errorf("output %q resolves to an input", out)
			}
			if outputErr == nil {
				if inputInfo, inputErr := os.Stat(input); inputErr == nil && os.SameFile(outputInfo, inputInfo) {
					return fmt.Errorf("output %q resolves to an input", out)
				}
			}
		}
	}
	return nil
}

// renderedOutput is one report rendered before anything is written.
type renderedOutput struct {
	path string
	body []byte
}

type outputWriteError struct {
	message      string
	failed       []string
	written      []string
	stdoutFailed bool
	permission   bool
}

func (e outputWriteError) Error() string { return e.message }

func outputRunError(err error) cli.RunError {
	var failure outputWriteError
	if !errors.As(err, &failure) {
		return cli.RunError{Code: cli.ExitFailure, Message: err.Error()}
	}
	headline := "cannot write the requested outputs"
	switch {
	case len(failure.failed) == 1 && !failure.stdoutFailed:
		headline = "cannot write " + quoteAll(failure.failed)[0]
	case len(failure.failed) == 0 && failure.stdoutFailed:
		headline = "cannot write standard output"
	}
	var detail []string
	if len(failure.failed) > 1 || (len(failure.failed) == 1 && failure.stdoutFailed) {
		detail = append(detail, "Files not written: "+strings.Join(quoteAll(failure.failed), ", "))
	}
	if failure.stdoutFailed && len(failure.failed) > 0 {
		detail = append(detail, "Standard output could not be written")
	}
	if failure.permission {
		detail = append(detail, "permission denied")
	}
	if len(failure.written) > 0 {
		detail = append(detail, "Written: "+strings.Join(quoteAll(failure.written), ", "))
	}
	return technicalError(cli.ExitFailure, "OUTPUT_FAILED", failure.message,
		headline, strings.Join(detail, "\n"))
}

// writeRendered writes each file through a temporary sibling renamed into
// place, then standard output, which is written even when a file failed. A
// human report opens in the pager only then, once every file is in place. A
// failure names the files that were written.
func writeRendered(stdout, stderr io.Writer, files []renderedOutput, stdoutBody []byte, report bool) error {
	written, failed := []string{}, []string{}
	permission := false
	for _, file := range files {
		if err := writeAtomicOutput(file.path, file.body); err != nil {
			failed = append(failed, file.path)
			permission = permission || errors.Is(err, os.ErrPermission)
			continue
		}
		written = append(written, file.path)
		progress(stderr, "Wrote", file.path)
	}
	stdoutFailed := false
	if len(stdoutBody) > 0 {
		if report {
			stdoutFailed = human.Page(stdout, stderr, stdoutBody) != nil
		} else if n, err := stdout.Write(stdoutBody); err != nil || n != len(stdoutBody) {
			stdoutFailed = true
		}
	}
	var problems []string
	if len(failed) > 0 {
		problems = append(problems, strings.Join(quoteAll(failed), ", ")+" could not be written")
	}
	if stdoutFailed {
		problems = append(problems, "standard output could not be written")
	}
	if len(problems) == 0 {
		return nil
	}
	message := "OUTPUT_FAILED: " + strings.Join(problems, "; ")
	if len(written) > 0 {
		message += "; written: " + strings.Join(quoteAll(written), ", ")
	}
	return outputWriteError{message: message, failed: failed, written: written,
		stdoutFailed: stdoutFailed, permission: permission}
}

// writeOutputs renders every requested format from the one result first, so
// a format that cannot be produced stops the run before any file changes, then
// writes each file through a temporary sibling renamed into place.
func (s runService) writeOutputs(options cli.Options, r runResult) error {
	report := buildRunReport(r, options)
	files := make([]renderedOutput, 0, len(options.Output))
	for _, out := range options.Output {
		format := outputFormat(out)
		if format == "" {
			format = options.Format
		}
		body, err := s.render(format, r, report)
		if err != nil {
			return err
		}
		files = append(files, renderedOutput{path: out, body: body})
	}
	stdoutFormat := "text"
	if len(options.Output) == 0 && options.Format != "" {
		stdoutFormat = options.Format
	}
	var stdoutBody []byte
	if stdoutFormat == "text" {
		var buffer bytes.Buffer
		summary := report
		summary.complete = options.NoServe
		summary.writeText(human.Redirect(s.stdout, &buffer))
		stdoutBody = buffer.Bytes()
	} else {
		body, err := s.render(stdoutFormat, r, report)
		if err != nil {
			return err
		}
		stdoutBody = body
	}
	return writeRendered(s.stdout, s.stderr, files, stdoutBody, stdoutFormat == "text" && options.NoServe)
}

// render produces one format for a file. Text written anywhere but a terminal
// is plain, and a text file lists every entry.
func (s runService) render(format string, r runResult, report runReport) ([]byte, error) {
	switch format {
	case "text":
		var buffer bytes.Buffer
		report.complete = true
		report.writeText(&buffer)
		return buffer.Bytes(), nil
	case "markdown":
		return report.markdown(), nil
	case "json":
		// The encoded document already ends with its one newline.
		return append([]byte{}, r.payload...), nil
	case "html":
		page, err := export.Render(s.shell, r.display, r.presentation)
		if errors.Is(err, export.ErrNoShell) {
			return nil, errors.New("HTML_UNAVAILABLE: this build carries no renderer; use a release build of rootform for .html output")
		}
		if err != nil {
			return nil, errors.New("HTML_UNAVAILABLE: the renderer shell cannot hold this document")
		}
		return page, nil
	}
	return nil, fmt.Errorf("format %q is not supported", format)
}

// writeAtomicOutput replaces target only with a complete file; an interrupted
// or failed write leaves the previous file untouched and removes the
// temporary sibling.
func writeAtomicOutput(target string, body []byte) error {
	dir := filepath.Dir(target)
	file, err := os.CreateTemp(dir, ".rootform-*.tmp")
	if err != nil {
		return err
	}
	tmp := file.Name()
	defer os.Remove(tmp)
	if _, err = file.Write(body); err != nil {
		file.Close()
		return err
	}
	if err = file.Sync(); err != nil {
		file.Close()
		return err
	}
	if err = file.Close(); err != nil {
		return err
	}
	return os.Rename(tmp, target)
}
