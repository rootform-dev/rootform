// Package app runs the commands that read architecture and definitions (run,
// check, explain, validate, list, show and test), the commands that prepare
// and change projects and the Rootform home (init, vendor, add, remove,
// update, install and uninstall) and the authoring commands (fmt, compile,
// package, publish and lsp). It owns their orchestration and every report
// they write, and reaches the engine through the backend ports only.
package app

import (
	"io"
	"io/fs"
	"strings"

	"github.com/rootform-dev/rootform/cli/backend"
	cli "github.com/rootform-dev/rootform/cli/command"
)

// Services are the seams one invocation shares between its commands.
type Services struct {
	Stdin  io.Reader
	Stdout io.Writer
	Stderr io.Writer
	// Frames is standard output as the process received it, unstyled: the
	// language server writes its protocol frames to it.
	Frames  io.Writer
	Backend backend.Backend
	Browser cli.BrowserLauncher
	// Version names the generator a compiled or compared Form and a Policy
	// result record.
	Version string
	// Assets are the explorer files; nil serves the API alone.
	Assets fs.FS
	// Shell is the renderer page an HTML export fills; nil refuses HTML.
	Shell []byte
	// Getwd reads the working directory whose selection a named validation
	// loads when no project is named.
	Getwd func() (string, error)
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

// Validate returns the validate service. A Form validates without a backend;
// every other object needs one.
func (s Services) Validate() cli.ValidateService {
	return validateService{stdin: s.Stdin, stdout: s.Stdout, stderr: s.Stderr, backend: s.Backend, getwd: s.Getwd}
}

// List returns the list service.
func (s Services) List() cli.ListService {
	return listService{stdout: s.Stdout, stderr: s.Stderr, backend: s.Backend}
}

// Show returns the show service.
func (s Services) Show() cli.ShowService {
	return showService{stdout: s.Stdout, stderr: s.Stderr, backend: s.Backend}
}

// Test returns the test service.
func (s Services) Test() cli.TestService {
	return testService{stdout: s.Stdout, stderr: s.Stderr, backend: s.Backend}
}

// Init returns the init service.
func (s Services) Init() cli.InitService {
	return initService{stdout: s.Stdout, stderr: s.Stderr, backend: s.Backend}
}

// Vendor returns the vendor service.
func (s Services) Vendor() cli.VendorService {
	return vendorService{stdout: s.Stdout, stderr: s.Stderr, backend: s.Backend}
}

// Selection returns the service of add, remove and update.
func (s Services) Selection() cli.SelectionService {
	return selectionService{stdout: s.Stdout, stderr: s.Stderr, backend: s.Backend}
}

// Store returns the service of install and uninstall.
func (s Services) Store() cli.StoreService {
	return storeService{stdout: s.Stdout, stderr: s.Stderr, backend: s.Backend}
}

// Fmt returns the fmt service.
func (s Services) Fmt() cli.FmtService {
	return fmtService{stdout: s.Stdout, stderr: s.Stderr, backend: s.Backend}
}

// Compile returns the service of compile policy-pack.
func (s Services) Compile() cli.CompileService {
	return compileService{stdout: s.Stdout, stderr: s.Stderr, backend: s.Backend}
}

// Package returns the package service.
func (s Services) Package() cli.PackageService {
	return packageService{stdout: s.Stdout, stderr: s.Stderr, backend: s.Backend}
}

// Publish returns the publish service.
func (s Services) Publish() cli.PublishService {
	return publishService{stdout: s.Stdout, stderr: s.Stderr, backend: s.Backend}
}

// LSP returns the language server service. It reads Stdin and writes to
// Frames.
func (s Services) LSP() cli.LanguageServerService {
	input, ok := s.Stdin.(io.ReadCloser)
	switch {
	case ok:
	case s.Stdin == nil:
		input = io.NopCloser(strings.NewReader(""))
	default:
		input = io.NopCloser(s.Stdin)
	}
	output := s.Frames
	if output == nil {
		output = io.Discard
	}
	return languageServerService{input: input, output: output, backend: s.Backend}
}
