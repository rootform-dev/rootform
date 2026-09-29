// Package app runs the commands that read architecture: run, check, explain
// and validate form. It owns their orchestration and every report they write,
// and reaches compilation, comparison, presentation and Policies through the
// backend ports only.
package app

import (
	"io"
	"io/fs"

	"github.com/rootform-dev/rootform/cli/backend"
	cli "github.com/rootform-dev/rootform/cli/command"
)

// Services are the seams one invocation shares between its commands.
type Services struct {
	Stdin   io.Reader
	Stdout  io.Writer
	Stderr  io.Writer
	Backend backend.Backend
	Browser cli.BrowserLauncher
	// Version names the generator a compiled or compared Form and a Policy
	// result record.
	Version string
	// Assets are the explorer files; nil serves the API alone.
	Assets fs.FS
	// Shell is the renderer page an HTML export fills; nil refuses HTML.
	Shell []byte
}

// Run returns the run service.
func (s Services) Run() cli.AppService {
	return runService{stdin: s.Stdin, stdout: s.Stdout, stderr: s.Stderr, browser: s.Browser, backend: s.Backend, version: s.Version, shell: s.Shell, assets: s.Assets}
}

// Check returns the check service.
func (s Services) Check() cli.CheckService {
	return checkService{stdin: s.Stdin, stdout: s.Stdout, stderr: s.Stderr, backend: s.Backend, version: s.Version}
}

// Explain returns the explain service.
func (s Services) Explain() cli.ExplainService {
	return explainService{stdin: s.Stdin, stdout: s.Stdout, stderr: s.Stderr, backend: s.Backend}
}

// Validate returns the validate service: a Form is validated here, every
// other object by definitions.
func (s Services) Validate(definitions cli.ValidateService) cli.ValidateService {
	return validateService{stdin: s.Stdin, stdout: s.Stdout, stderr: s.Stderr, definitions: definitions}
}
