package command

import (
	"errors"
	"testing"
)

type countingService struct {
	calls int
	last  Options
}

func (c *countingService) Run(opts Options) error {
	c.calls++
	c.last = opts
	return nil
}

func TestCLILifecycleContract(t *testing.T) {
	t.Run("a clean run exits zero, invokes the service once, and writes nothing", func(t *testing.T) {
		service := &countingService{}
		env, out, errb := newTestEnv([]string{"run", fixtureInput()}, service)
		if got := Run(env); got != ExitOK {
			t.Fatalf("Run = %d, want %d", got, ExitOK)
		}
		if service.calls != 1 {
			t.Fatalf("service was invoked %d times, want 1", service.calls)
		}
		if service.last.Input != fixtureInput() || service.last.NoBrowser {
			t.Fatalf("service received %+v", service.last)
		}
		if out.Len() != 0 || errb.Len() != 0 {
			t.Fatalf("a clean run wrote output; stdout=%q stderr=%q", out.String(), errb.String())
		}
	})

	t.Run("a usage error exits two and never reaches the service", func(t *testing.T) {
		service := &countingService{}
		env, out, errb := newTestEnv([]string{"run", "--frobnicate", fixtureInput()}, service)
		if got := Run(env); got != ExitUsage {
			t.Fatalf("Run = %d, want %d", got, ExitUsage)
		}
		if service.calls != 0 {
			t.Fatalf("a usage error invoked the service %d times", service.calls)
		}
		if out.Len() != 0 {
			t.Fatalf("a usage error wrote to stdout: %q", out.String())
		}
		assertUsageDiagnostic(t, errb.String())
	})

	t.Run("a runtime failure exits one without leaking the native error", func(t *testing.T) {
		env, _, errb := newTestEnv([]string{"run", fixtureInput()}, &failingService{err: errors.New("sentinel-service-secret")})
		if got := Run(env); got != ExitFailure {
			t.Fatalf("Run = %d, want %d", got, ExitFailure)
		}
		if errb.String() != runtimeDiagnostic {
			t.Fatalf("stderr = %q, want %q", errb.String(), runtimeDiagnostic)
		}
	})

	t.Run("successive runs keep their own lifecycle", func(t *testing.T) {
		first := &countingService{}
		if got := Run(mustEnv(t, []string{"run", fixtureInput()}, first)); got != ExitOK {
			t.Fatalf("first run = %d, want %d", got, ExitOK)
		}
		if got := Run(mustEnv(t, []string{"--help"}, &recorderService{})); got != ExitOK {
			t.Fatalf("help run = %d, want %d", got, ExitOK)
		}
		second := &countingService{}
		if got := Run(mustEnv(t, []string{"run", fixtureInput()}, second)); got != ExitOK {
			t.Fatalf("second run = %d, want %d", got, ExitOK)
		}
		if first.calls != 1 || second.calls != 1 {
			t.Fatalf("run counts leaked between invocations: first=%d second=%d", first.calls, second.calls)
		}
		if second.last.Input != fixtureInput() || second.last.NoBrowser {
			t.Fatalf("second run received leaked state: %+v", second.last)
		}
	})
}

func mustEnv(t *testing.T, args []string, service AppService) *Env {
	t.Helper()
	env, _, _ := newTestEnv(args, service)
	return env
}
