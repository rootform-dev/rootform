package command

import (
	"errors"
	"strings"
	"testing"
)

type recordingLauncher struct {
	opened   []string
	failWith error
}

func (l *recordingLauncher) Open(url string) error {
	l.opened = append(l.opened, url)
	return l.failWith
}

// browserPolicyService implements the accepted browser lifecycle on the cli
// seam: open the served URL unless NoBrowser is set, and keep a launch
// failure non-fatal for the exit code.
type browserPolicyService struct {
	launcher  BrowserLauncher
	url       string
	last      Options
	launchErr error
}

func (s *browserPolicyService) Run(opts Options) error {
	s.last = opts
	if opts.NoBrowser {
		return nil
	}
	if err := s.launcher.Open(s.url); err != nil {
		s.launchErr = err
	}
	return nil
}

func TestBrowserOpenPolicy(t *testing.T) {
	t.Run("a normal run delivers no-browser off and opens the browser", func(t *testing.T) {
		launcher := &recordingLauncher{}
		service := &browserPolicyService{launcher: launcher, url: "http://127.0.0.1:21717"}
		env, _, _ := newTestEnv([]string{"run", fixtureInput()}, service)
		if got := Run(env); got != ExitOK {
			t.Fatalf("Run = %d, want %d", got, ExitOK)
		}
		if service.last.NoBrowser {
			t.Fatalf("a normal run reported NoBrowser: %+v", service.last)
		}
		if len(launcher.opened) != 1 || launcher.opened[0] != service.url {
			t.Fatalf("browser opened %v, want the served URL once", launcher.opened)
		}
	})

	t.Run("--no-browser delivers the flag off and never opens the browser", func(t *testing.T) {
		launcher := &recordingLauncher{}
		service := &browserPolicyService{launcher: launcher, url: "http://127.0.0.1:21717"}
		env, _, _ := newTestEnv([]string{"run", fixtureInput(), "--no-browser"}, service)
		if got := Run(env); got != ExitOK {
			t.Fatalf("Run = %d, want %d", got, ExitOK)
		}
		if !service.last.NoBrowser {
			t.Fatalf("--no-browser was not delivered: %+v", service.last)
		}
		if len(launcher.opened) != 0 {
			t.Fatalf("--no-browser still opened the browser %v", launcher.opened)
		}
	})

	t.Run("a launch failure keeps the exit code unchanged", func(t *testing.T) {
		launcher := &recordingLauncher{failWith: errors.New("sentinel-launch-boom")}
		service := &browserPolicyService{launcher: launcher, url: "http://127.0.0.1:21717"}
		env, _, errb := newTestEnv([]string{"run", fixtureInput()}, service)
		if got := Run(env); got != ExitOK {
			t.Fatalf("Run = %d, want %d even when the launcher fails", got, ExitOK)
		}
		if len(launcher.opened) != 1 {
			t.Fatalf("browser opened %v, want one attempt", launcher.opened)
		}
		if service.launchErr == nil {
			t.Fatal("the launcher failure was not observed by the service")
		}
		if strings.Contains(errb.String(), "sentinel-launch-boom") {
			t.Fatalf("native launcher error reached stderr: %q", errb.String())
		}
	})
}
