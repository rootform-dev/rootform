package command

import (
	"errors"
	"reflect"
	"strings"
	"testing"
)

type stubPublish struct {
	got     []PublishOptions
	outcome PublishOutcome
	err     error
}

func (service *stubPublish) Publish(options PublishOptions) (PublishOutcome, error) {
	service.got = append(service.got, options)
	return service.outcome, service.err
}

func TestPublishCommandContract(t *testing.T) {
	service := &stubPublish{outcome: PublishCompleted}
	stdout, stderr := &strings.Builder{}, &strings.Builder{}
	env := &Env{
		Stdout: stdout,
		Stderr: stderr,
		Args: []string{
			"publish", "dialects", "./oci",
			"--to", "registry.example/acme/dialects",
			"--dry-run", "--format", "json",
		},
		Publish: service,
	}
	if got := Run(env); got != ExitOK {
		t.Fatalf("Run = %d, want %d: %s", got, ExitOK, stderr.String())
	}
	want := []PublishOptions{{
		Object:     DistributionDialects,
		Layout:     "./oci",
		Repository: "registry.example/acme/dialects",
		DryRun:     true,
		Format:     FormatJSON,
	}}
	if !reflect.DeepEqual(service.got, want) {
		t.Fatalf("options = %#v, want %#v", service.got, want)
	}
}

func TestPublishArguments(t *testing.T) {
	for _, testCase := range []struct {
		name string
		args []string
	}{
		{name: "missing layout", args: []string{
			"publish", "dialects", "--to", "registry.example/acme/dialects",
		}},
		{name: "extra layout", args: []string{
			"publish", "dialects", "./one", "./two",
			"--to", "registry.example/acme/dialects",
		}},
		{name: "missing destination", args: []string{
			"publish", "dialects", "./oci",
		}},
		{name: "unsupported format", args: []string{
			"publish", "dialects", "./oci",
			"--to", "registry.example/acme/dialects", "--format", "yaml",
		}},
	} {
		t.Run(testCase.name, func(t *testing.T) {
			service := &stubPublish{outcome: PublishCompleted}
			stdout, stderr := &strings.Builder{}, &strings.Builder{}
			if got := Run(&Env{
				Stdout: stdout, Stderr: stderr,
				Args: testCase.args, Publish: service,
			}); got != ExitUsage {
				t.Fatalf("Run = %d, want %d: %s", got, ExitUsage, stderr.String())
			}
			if len(service.got) != 0 {
				t.Fatalf("service called with %#v", service.got)
			}
			if stdout.Len() != 0 {
				t.Fatalf("usage wrote stdout: %q", stdout.String())
			}
		})
	}
}

func TestPublishHasNoIdentityOverride(t *testing.T) {
	env := &Env{Publish: &stubPublish{outcome: PublishCompleted}}
	command := newPublishDialectsCommand(env)
	for _, name := range []string{"tag", "version", "name"} {
		if command.Flags().Lookup(name) != nil {
			t.Fatalf("publish exposes forbidden --%s override", name)
		}
	}
}

func TestPublishOutcomeAndFailureExitContract(t *testing.T) {
	for _, testCase := range []struct {
		name    string
		service *stubPublish
		want    int
	}{
		{
			name:    "invalid layout",
			service: &stubPublish{outcome: PublishInvalid},
			want:    ExitNegative,
		},
		{
			name:    "service error",
			service: &stubPublish{err: errors.New("publication unavailable")},
			want:    ExitFailure,
		},
	} {
		t.Run(testCase.name, func(t *testing.T) {
			stderr := &strings.Builder{}
			got := Run(&Env{
				Stdout: &strings.Builder{}, Stderr: stderr,
				Args: []string{
					"publish", "dialects", "./oci",
					"--to", "registry.example/acme/dialects",
				},
				Publish: testCase.service,
			})
			if got != testCase.want {
				t.Fatalf("Run = %d, want %d: %s", got, testCase.want, stderr.String())
			}
		})
	}
}

func TestPublishPolicyPacksCommandContract(t *testing.T) {
	t.Run("explicit options with dry run and JSON", func(t *testing.T) {
		service := &stubPublish{outcome: PublishCompleted}
		stdout, stderr := &strings.Builder{}, &strings.Builder{}
		if got := Run(&Env{
			Stdout: stdout, Stderr: stderr,
			Args: []string{
				"publish", "policy-packs", "./oci",
				"--to", "registry.example/acme/policies",
				"--dry-run", "--format", "json",
			},
			Publish: service,
		}); got != ExitOK {
			t.Fatalf("Run = %d, want %d: %s", got, ExitOK, stderr.String())
		}
		want := []PublishOptions{{
			Object: DistributionPolicyPacks,
			Layout: "./oci", Repository: "registry.example/acme/policies",
			DryRun: true, Format: FormatJSON,
		}}
		if !reflect.DeepEqual(service.got, want) {
			t.Fatalf("options = %#v, want %#v", service.got, want)
		}
	})

	t.Run("a destination repository is required", func(t *testing.T) {
		for _, args := range [][]string{
			{"publish", "policy-packs", "./oci"},
			{"publish", "policy-packs"},
			{"publish", "policy-packs", "./one", "./two",
				"--to", "registry.example/acme/policies"},
		} {
			service := &stubPublish{outcome: PublishCompleted}
			stdout, stderr := &strings.Builder{}, &strings.Builder{}
			if got := Run(&Env{
				Stdout: stdout, Stderr: stderr,
				Args: args, Publish: service,
			}); got != ExitUsage {
				t.Fatalf("Run(%v) = %d, want %d: %s", args, got, ExitUsage, stderr.String())
			}
			if len(service.got) != 0 || stdout.Len() != 0 {
				t.Fatalf("Run(%v) reached the service or wrote stdout: %#v, %q",
					args, service.got, stdout.String())
			}
		}
	})

	t.Run("no discovery index in V0", func(t *testing.T) {
		service := &stubPublish{outcome: PublishCompleted}
		stdout, stderr := &strings.Builder{}, &strings.Builder{}
		if got := Run(&Env{
			Stdout: stdout, Stderr: stderr,
			Args: []string{
				"publish", "dialects", "./oci",
				"--to", "registry.example/acme/dialects", "--index",
			},
			Publish: service,
		}); got != ExitUsage {
			t.Fatalf("Run = %d, want %d: %s", got, ExitUsage, stderr.String())
		}
		if len(service.got) != 0 {
			t.Fatalf("--index reached the service with %#v", service.got)
		}
		if !strings.Contains(stderr.String(), "unknown flag") {
			t.Fatalf("diagnostic does not name the refused flag: %q", stderr.String())
		}
	})
}
