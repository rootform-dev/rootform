package app

import (
	"errors"
	"os/exec"
	"runtime"
)

// SystemBrowser opens an address in the platform default browser. Only the
// constructed loopback URL is ever passed to an external program, never a
// path or free-form user input.
type SystemBrowser struct{}

func (SystemBrowser) Open(url string) error {
	switch runtime.GOOS {
	case "darwin":
		return startProcess("open", url)
	case "linux":
		return startProcess("xdg-open", url)
	case "windows":
		return startProcess("rundll32", "url.dll,FileProtocolHandler", url)
	default:
		return errors.New("the default browser is not supported on this platform")
	}
}

func startProcess(name string, arguments ...string) error {
	return exec.Command(name, arguments...).Start()
}
