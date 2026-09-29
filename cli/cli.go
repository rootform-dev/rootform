// Package cli is the Rootform command line: its commands, options, help,
// completions, argument checks, exit statuses and reports. A program builds
// one Env from its process and a backend, and calls Run once.
package cli

import (
	"io"
	"io/fs"

	"github.com/rootform-dev/rootform/cli/backend"
	"github.com/rootform-dev/rootform/cli/command"
	"github.com/rootform-dev/rootform/cli/human"
	"github.com/rootform-dev/rootform/cli/internal/app"
)

// Env is what one invocation reads from its process and its backend.
type Env struct {
	Stdin  io.Reader
	Stdout io.Writer
	Stderr io.Writer
	// Args are the arguments after the program name.
	Args      []string
	Getwd     func() (string, error)
	Getenv    func(string) string
	LookupEnv func(string) (string, bool)
	// InputTerminal reports whether standard input is an interactive
	// terminal. A nil seam preserves interactive behavior for embedded
	// callers.
	InputTerminal func() bool
	// Interactive styles human reports for the terminals Stdout and Stderr
	// reach, lets a long report open in a pager and opens the explorer in the
	// default browser. Without it every report is plain and written
	// directly, and only Browser opens the explorer.
	Interactive bool
	// Backend compiles, compares, presents and evaluates architecture, and
	// describes the selected definitions. Without one, the commands that
	// need it report that they are not configured.
	Backend backend.Backend
	// Browser opens the explorer address. Nil uses the default browser when
	// Interactive.
	Browser Browser
	// Version is the version of the program, which every Form and Policy
	// result it produces records.
	Version string
	// Assets are the explorer files; nil serves the explorer API alone.
	Assets fs.FS
	// ExportShell is the renderer page an HTML export fills; nil refuses
	// HTML exports.
	ExportShell []byte
	// Commands supplies the command services this module does not implement,
	// bound to the streams Run writes to.
	Commands func(stdin io.Reader, stdout, stderr io.Writer) Commands
}

// Browser opens one address in a browser.
type Browser interface {
	Open(url string) error
}

// Commands are command services implemented outside this module.
type Commands struct {
	Compile command.CompileService
	Fmt     command.FmtService
	Package command.PackageService
	Publish command.PublishService
	LSP     command.LanguageServerService
}

// Run executes one command line and returns the process exit status.
func Run(env Env) int {
	stdout, stderr := env.Stdout, env.Stderr
	if stdout == nil {
		stdout = io.Discard
	}
	if stderr == nil {
		stderr = io.Discard
	}
	if env.Interactive {
		stdout, stderr = human.Stream(stdout), human.Stream(stderr)
	}
	commandEnv := &command.Env{
		Stdout:        stdout,
		Stderr:        stderr,
		Args:          env.Args,
		Getwd:         env.Getwd,
		Getenv:        env.Getenv,
		InputTerminal: env.InputTerminal,
		Version:       env.Version,
	}
	var browser command.BrowserLauncher
	if env.Browser != nil {
		browser = env.Browser
	}
	if env.Interactive {
		getenv, lookupEnv := env.Getenv, env.LookupEnv
		if getenv == nil {
			getenv = func(string) string { return "" }
		}
		if lookupEnv == nil {
			lookupEnv = func(string) (string, bool) { return "", false }
		}
		commandEnv.Color = func(mode string) (bool, error) {
			if err := human.SetColorMode(mode, getenv); err != nil {
				return false, err
			}
			return human.Colored(stdout), nil
		}
		commandEnv.Paging = func(requested bool) { human.SetPaging(requested, lookupEnv) }
		commandEnv.Page = human.Page
		if browser == nil {
			browser = app.SystemBrowser{}
		}
	}
	services := app.Services{
		Stdin: env.Stdin, Stdout: stdout, Stderr: stderr,
		Backend: env.Backend, Browser: browser, Version: env.Version,
		Assets: env.Assets, Shell: env.ExportShell, Getwd: env.Getwd,
	}
	if env.Backend != nil {
		commandEnv.Service = services.Run()
		commandEnv.Check = services.Check()
		commandEnv.Explain = services.Explain()
		commandEnv.List = services.List()
		commandEnv.Show = services.Show()
		commandEnv.Test = services.Test()
		commandEnv.Init = services.Init()
		commandEnv.Vendor = services.Vendor()
		commandEnv.Selection = services.Selection()
		commandEnv.Store = services.Store()
	}
	var external Commands
	if env.Commands != nil {
		external = env.Commands(env.Stdin, stdout, stderr)
	}
	commandEnv.Validate = services.Validate()
	commandEnv.Compile = external.Compile
	commandEnv.Fmt = external.Fmt
	commandEnv.Package = external.Package
	commandEnv.Publish = external.Publish
	commandEnv.LSP = external.LSP
	return command.Run(commandEnv)
}
