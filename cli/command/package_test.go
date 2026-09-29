package command

import (
	"reflect"
	"strings"
	"testing"
)

type stubPackage struct {
	got     []PackageOptions
	outcome PackageOutcome
	err     error
}

func (s *stubPackage) Package(options PackageOptions) (PackageOutcome, error) {
	s.got = append(s.got, options)
	return s.outcome, s.err
}

func TestPackageDialectsCommandContract(t *testing.T) {
	t.Run("help describes generic local registry layout", func(t *testing.T) {
		out := &strings.Builder{}
		errOut := &strings.Builder{}
		env := &Env{
			Stdout: out,
			Stderr: errOut,
			Args:   []string{"package", "dialects", "--help"},
		}
		if got := Run(env); got != ExitOK {
			t.Fatalf("Run = %d, want %d: %s", got, ExitOK, errOut.String())
		}
		if !strings.Contains(out.String(), "exact Dialect packages") ||
			!strings.Contains(out.String(), "local-only registry layout") ||
			strings.Contains(out.String(), "--repository") ||
			strings.Contains(out.String(), "official index") {
			t.Fatalf("package help misstates generic layout: %q", out.String())
		}
	})

	service := &stubPackage{outcome: PackageWritten}
	out := &strings.Builder{}
	errOut := &strings.Builder{}
	env := &Env{
		Stdout: out,
		Stderr: errOut,
		Args: []string{
			"package", "dialects", "./dialects", "--to", "./oci",
			"--source-url", "https://github.com/acme/dialects",
			"--revision", "0123456789abcdef",
			"--documentation-url", "https://docs.example.com/dialects",
			"--licenses", "MPL-2.0",
		},
		Package: service,
	}
	if got := Run(env); got != ExitOK {
		t.Fatalf("Run = %d, want %d: %s", got, ExitOK, errOut.String())
	}
	want := []PackageOptions{{
		Object: DistributionDialects,
		Source: "./dialects", Destination: "./oci",
		ProvenanceSource:   "https://github.com/acme/dialects",
		ProvenanceRevision: "0123456789abcdef",
		ProvenanceDocs:     "https://docs.example.com/dialects",
		ProvenanceLicenses: "MPL-2.0",
	}}
	if !reflect.DeepEqual(service.got, want) {
		t.Fatalf("options = %#v, want %#v", service.got, want)
	}

	missing := &stubPackage{outcome: PackageWritten}
	env.Package = missing
	env.Args = []string{"package", "dialects", "./dialects"}
	if got := Run(env); got != ExitUsage {
		t.Fatalf("missing --to Run = %d, want %d", got, ExitUsage)
	}
	if len(missing.got) != 0 {
		t.Fatalf("service called %d times", len(missing.got))
	}
}

func TestPackagePolicyPacksCommandContract(t *testing.T) {
	t.Run("explicit options and provenance", func(t *testing.T) {
		service := &stubPackage{outcome: PackageWritten}
		stdout, stderr := &strings.Builder{}, &strings.Builder{}
		env := &Env{
			Stdout: stdout, Stderr: stderr,
			Args: []string{
				"package", "policy-packs", "./policies", "--to", "./oci",
				"--source-url", "https://github.com/acme/policies",
				"--revision", "0123456789abcdef",
				"--documentation-url", "https://docs.example.com/policies",
				"--licenses", "MPL-2.0",
			},
			Package: service,
		}
		if got := Run(env); got != ExitOK {
			t.Fatalf("Run = %d, want %d: %s", got, ExitOK, stderr.String())
		}
		want := []PackageOptions{{
			Object: DistributionPolicyPacks,
			Source: "./policies", Destination: "./oci",
			ProvenanceSource:   "https://github.com/acme/policies",
			ProvenanceRevision: "0123456789abcdef",
			ProvenanceDocs:     "https://docs.example.com/policies",
			ProvenanceLicenses: "MPL-2.0",
		}}
		if !reflect.DeepEqual(service.got, want) {
			t.Fatalf("options = %#v, want %#v", service.got, want)
		}
	})

	t.Run("an output directory is required", func(t *testing.T) {
		for _, args := range [][]string{
			{"package", "policy-packs", "./policies"},
			{"package", "policy-packs"},
			{"package", "policy-packs", "./one", "./two", "--to", "./oci"},
		} {
			service := &stubPackage{outcome: PackageWritten}
			stdout, stderr := &strings.Builder{}, &strings.Builder{}
			if got := Run(&Env{
				Stdout: stdout, Stderr: stderr,
				Args: args, Package: service,
			}); got != ExitUsage {
				t.Fatalf("Run(%v) = %d, want %d: %s", args, got, ExitUsage, stderr.String())
			}
			if len(service.got) != 0 || stdout.Len() != 0 {
				t.Fatalf("Run(%v) reached the service or wrote stdout: %#v, %q",
					args, service.got, stdout.String())
			}
		}
	})

	t.Run("a rejected package is a domain failure", func(t *testing.T) {
		for _, object := range []string{"dialects", "policy-packs"} {
			service := &stubPackage{outcome: PackageInvalid}
			if got := Run(&Env{
				Stdout:  &strings.Builder{},
				Stderr:  &strings.Builder{},
				Args:    []string{"package", object, "./source", "--to", "./oci"},
				Package: service,
			}); got != ExitNegative {
				t.Fatalf("package %s exit = %d, want %d", object, got, ExitNegative)
			}
		}
	})
}
