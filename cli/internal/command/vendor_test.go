package command

import (
	"bytes"
	"reflect"
	"strings"
	"testing"
)

type vendorStub struct {
	got []VendorOptions
}

func TestVendorHelpExitStatus(t *testing.T) {
	root := NewRootCommand(&Env{})
	want := "Exit status:\n" +
		"  0  every selected unit was copied\n" +
		"  1  selected content is invalid, missing, or differs from rootform.lock\n" +
		"  2  the command was used incorrectly\n" +
		"  3  no content was selected, rootform.lock is invalid, or --offline\n" +
		"     needs content that is not installed\n" +
		"  4  a file, the Rootform home, or the registry could not be read or written"
	for _, path := range [][]string{{"vendor"}, {"vendor", "dialects"}, {"vendor", "policy-packs"}} {
		command := findCommand(t, root, path...)
		if !strings.Contains(command.Long, want) {
			t.Errorf("%s exit help = %q, want %q", strings.Join(path, " "), command.Long, want)
		}
	}
}

func (stub *vendorStub) Vendor(options VendorOptions) (VendorOutcome, error) {
	stub.got = append(stub.got, options)
	return VendorCopied, nil
}

func TestVendorDialectsCommandUsesOnlyExactMaterializationFlags(t *testing.T) {
	t.Run("explicit options", func(t *testing.T) {
		stub := &vendorStub{}
		env := &Env{
			Stdout: &bytes.Buffer{}, Stderr: &bytes.Buffer{},
			Args:   []string{"vendor", "dialects", "--to", "./offline/dialects", "--offline"},
			Getenv: func(string) string { return "" }, Vendor: stub,
		}
		if code := Run(env); code != ExitOK {
			t.Fatalf("exit = %d", code)
		}
		want := []VendorOptions{{
			Object: DistributionDialects, Destination: "./offline/dialects", Offline: true,
		}}
		if !reflect.DeepEqual(stub.got, want) {
			t.Fatalf("options = %#v", stub.got)
		}
	})

	t.Run("environment forces offline", func(t *testing.T) {
		stub := &vendorStub{}
		env := &Env{
			Stdout: &bytes.Buffer{}, Stderr: &bytes.Buffer{},
			Args: []string{"vendor", "dialects"},
			Getenv: func(name string) string {
				if name == "ROOTFORM_OFFLINE" {
					return "1"
				}
				return ""
			},
			Vendor: stub,
		}
		if code := Run(env); code != ExitOK {
			t.Fatalf("exit = %d", code)
		}
		if len(stub.got) != 1 || !stub.got[0].Offline {
			t.Fatalf("options = %#v", stub.got)
		}
	})

	t.Run("no resolution flags", func(t *testing.T) {
		for _, flag := range []string{"--source", "--upgrade", "--locked"} {
			env := &Env{
				Stdout: &bytes.Buffer{}, Stderr: &bytes.Buffer{},
				Args: []string{"vendor", "dialects", flag}, Vendor: &vendorStub{},
			}
			if code := Run(env); code != ExitUsage {
				t.Fatalf("%s exit = %d", flag, code)
			}
		}
	})
}

func TestVendorPolicyPacksCommandUsesOnlyExactMaterializationFlags(t *testing.T) {
	t.Run("explicit options", func(t *testing.T) {
		stub := &vendorStub{}
		env := &Env{
			Stdout: &bytes.Buffer{}, Stderr: &bytes.Buffer{},
			Args:   []string{"vendor", "policy-packs", "--to", "./offline/policy-packs", "--offline"},
			Getenv: func(string) string { return "" }, Vendor: stub,
		}
		if code := Run(env); code != ExitOK {
			t.Fatalf("exit = %d", code)
		}
		want := []VendorOptions{{
			Object: DistributionPolicyPacks, Destination: "./offline/policy-packs", Offline: true,
		}}
		if !reflect.DeepEqual(stub.got, want) {
			t.Fatalf("options = %#v", stub.got)
		}
	})

	t.Run("environment forces offline", func(t *testing.T) {
		stub := &vendorStub{}
		env := &Env{
			Stdout: &bytes.Buffer{}, Stderr: &bytes.Buffer{},
			Args: []string{"vendor", "policy-packs"},
			Getenv: func(name string) string {
				if name == "ROOTFORM_OFFLINE" {
					return "1"
				}
				return ""
			},
			Vendor: stub,
		}
		if code := Run(env); code != ExitOK {
			t.Fatalf("exit = %d", code)
		}
		if len(stub.got) != 1 || stub.got[0].Object != DistributionPolicyPacks || !stub.got[0].Offline {
			t.Fatalf("options = %#v", stub.got)
		}
	})

	t.Run("no resolution flags", func(t *testing.T) {
		for _, flag := range []string{"--source", "--upgrade", "--locked", "--policy-pack"} {
			env := &Env{
				Stdout: &bytes.Buffer{}, Stderr: &bytes.Buffer{},
				Args: []string{"vendor", "policy-packs", flag}, Vendor: &vendorStub{},
			}
			if code := Run(env); code != ExitUsage {
				t.Fatalf("%s exit = %d", flag, code)
			}
		}
	})
}
