package cli_test

import (
	"context"
	"encoding/json"
	"io"
	"path/filepath"
	"reflect"
	"strings"
	"testing"

	"github.com/rootform-dev/rootform/cli"
	"github.com/rootform-dev/rootform/cli/backend"
	"github.com/rootform-dev/rootform/cli/backend/backendtest"
)

// inOrder requires every marker to occur in body, each after the previous
// one.
func inOrder(t *testing.T, body string, markers ...string) {
	t.Helper()
	at := 0
	for _, marker := range markers {
		i := strings.Index(body[at:], marker)
		if i < 0 {
			t.Fatalf("%q is missing or out of order in:\n%s", marker, body)
		}
		at += i + len(marker)
	}
}

// preparedDialect is a project whose one external Dialect was downloaded.
func preparedDialect(_ context.Context, request backend.Preparation) (backend.Prepared, error) {
	return backend.Prepared{
		Dialects:   []backend.PreparedVersion{{Name: "payments", Version: "0.1.0", Source: "oci:registry.example.com/acme/dialects@sha256:1", Status: backend.Acquired}},
		Downloaded: 2048,
	}, nil
}

func TestInitReportsWhatItPrepared(t *testing.T) {
	var requests []backend.Preparation
	fake := &backendtest.Fake{PrepareFunc: func(ctx context.Context, request backend.Preparation) (backend.Prepared, error) {
		requests = append(requests, request)
		if request.Project == "empty" {
			return backend.Prepared{}, nil
		}
		return preparedDialect(ctx, request)
	}}
	env := cli.Env{Backend: fake}
	code, out, errb := invoke(t, env, "init", "empty")
	if code != 0 || out != "Project ready\n\nExternal content  none\n" || errb != "" {
		t.Fatalf("empty init = %d, %q, %q", code, out, errb)
	}
	code, out, errb = invoke(t, env, "init", "--locked", "--offline", "--details")
	if code != 0 || out != "Project prepared\n\nExternal Dialects      1\nExternal Policy Packs  0\nDownloaded             2.0 KiB\n" {
		t.Fatalf("init = %d, %q, %q", code, out, errb)
	}
	inOrder(t, errb, "Prepared content", "  Dialect payments@0.1.0", "Status", "acquired", "Source", "oci:registry.example.com/acme/dialects@sha256:1")
	want := backend.Preparation{Project: ".", Locked: true, Offline: true}
	if len(requests) != 2 || requests[0].Project != "empty" || requests[1] != want {
		t.Fatalf("requests = %+v", requests)
	}
	code, out, _ = invoke(t, env, "init", "--format", "json")
	var report map[string]any
	if err := json.Unmarshal([]byte(out), &report); code != 0 || err != nil {
		t.Fatalf("json init = %d, %v, %q", code, err, out)
	}
	wantReport := map[string]any{
		"format_version": "1", "prepared": true, "downloaded_bytes": float64(2048),
		"dialects": []any{map[string]any{"kind": "dialect", "name": "payments", "version": "0.1.0",
			"source": "oci:registry.example.com/acme/dialects@sha256:1", "status": "acquired"}},
	}
	if !reflect.DeepEqual(report, wantReport) {
		t.Fatalf("json init = %v, want %v", report, wantReport)
	}
}

// A failed preparation states its reason and exits with the status of its
// kind, writing no report.
func TestInitRefusalExits(t *testing.T) {
	for kind, want := range map[backend.Kind]int{backend.Negative: 1, backend.NoAnswer: 3, backend.Failure: 4} {
		fake := &backendtest.Fake{PrepareFunc: func(context.Context, backend.Preparation) (backend.Prepared, error) {
			return backend.Prepared{}, &backend.Error{Kind: kind, Message: "1 selection is not available locally"}
		}}
		code, out, errb := invoke(t, cli.Env{Backend: fake}, "init", "--format", "json")
		if code != want || out != "" || errb != "rootform: 1 selection is not available locally\n" {
			t.Fatalf("kind %d: init = %d, %q, %q", kind, code, out, errb)
		}
	}
}

func vendoredFamily(_ context.Context, request backend.Vendoring) (backend.Vendored, error) {
	vendored := backend.Vendored{Directory: filepath.Join(".rootform", string(request.Family))}
	switch request.Family {
	case backend.Dialects:
		vendored.Versions = []backend.VendoredVersion{{Name: "payments", Version: "0.1.0", Source: "local:dialects/payments"}}
	default:
		vendored.Versions = []backend.VendoredVersion{{Name: "checks", Version: "1.0.0"}}
	}
	return vendored, nil
}

func TestVendorCopiesEverySelectedFamily(t *testing.T) {
	var requests []backend.Vendoring
	fake := &backendtest.Fake{
		SelectedFunc: func(_ context.Context, project string) ([]backend.Family, error) {
			if project != "" {
				t.Fatalf("vendor read project %q", project)
			}
			return []backend.Family{backend.Dialects, backend.PolicyPacks}, nil
		},
		VendorFunc: func(ctx context.Context, request backend.Vendoring) (backend.Vendored, error) {
			requests = append(requests, request)
			return vendoredFamily(ctx, request)
		},
	}
	code, out, errb := invoke(t, cli.Env{Backend: fake}, "vendor")
	if code != 0 || errb != "" {
		t.Fatalf("vendor = %d, %q", code, errb)
	}
	inOrder(t, out, "External Dialects vendored\n\n", "Destination", filepath.Join(".rootform", "dialects"),
		"Dialects (1)", "  payments@0.1.0\n", "Source", "local:dialects/payments",
		"\n\nExternal Policy Packs vendored\n\n", "Policy Packs (1)", "  checks@1.0.0\n")
	if len(requests) != 2 || requests[0].Family != backend.Dialects || requests[1].Family != backend.PolicyPacks {
		t.Fatalf("requests = %+v", requests)
	}

	requests = nil
	code, out, _ = invoke(t, cli.Env{Backend: fake}, "vendor", "policy-packs", "--offline")
	if code != 0 || !strings.Contains(out, "Mode") || !strings.Contains(out, "offline") ||
		len(requests) != 1 || requests[0] != (backend.Vendoring{Family: backend.PolicyPacks, Offline: true}) {
		t.Fatalf("vendor policy-packs --offline = %d, %q, %+v", code, out, requests)
	}
}

func TestVendorRefusals(t *testing.T) {
	code, out, errb := invoke(t, cli.Env{Backend: &backendtest.Fake{}}, "vendor")
	if code != 3 || out != "" || errb != "rootform: rootform.lock selects no content to vendor\n" {
		t.Fatalf("vendor without a selection = %d, %q, %q", code, out, errb)
	}
	for kind, want := range map[backend.Kind]int{backend.Negative: 1, backend.NoAnswer: 3, backend.Failure: 4} {
		fake := &backendtest.Fake{
			SelectedFunc: func(context.Context, string) ([]backend.Family, error) {
				return []backend.Family{backend.Dialects, backend.PolicyPacks}, nil
			},
			VendorFunc: func(_ context.Context, request backend.Vendoring) (backend.Vendored, error) {
				if request.Family == backend.PolicyPacks {
					return backend.Vendored{}, &backend.Error{Kind: kind, Message: "selected Policy Pack checks is invalid"}
				}
				return vendoredFamily(context.Background(), request)
			},
		}
		code, out, errb := invoke(t, cli.Env{Backend: fake}, "vendor")
		if code != want || !strings.HasPrefix(out, "External Dialects vendored\n") || strings.Contains(out, "Policy Packs") ||
			errb != "rootform: selected Policy Pack checks is invalid\n" {
			t.Fatalf("kind %d: vendor = %d, %q, %q", kind, code, out, errb)
		}
	}
	failing := &backendtest.Fake{SelectedFunc: func(context.Context, string) ([]backend.Family, error) {
		return nil, &backend.Error{Kind: backend.NoAnswer, Message: "rootform.lock is invalid"}
	}}
	if code, _, errb := invoke(t, cli.Env{Backend: failing}, "vendor"); code != 3 || errb != "rootform: rootform.lock is invalid\n" {
		t.Fatalf("vendor with an invalid lock = %d, %q", code, errb)
	}
}

// addedLedger is the outcome of adding one local Dialect to a project that
// vendors its Dialects.
var addedLedger = backend.Changed{
	Modified: true, LockWritten: true, Vendored: []backend.Family{backend.Dialects},
	Edits:    []backend.Edit{{Action: "add", Kind: "dialect", Name: "ledger", Version: "0.1.0", Source: "local/ledger"}},
	Notices:  []string{"Policy Packs are not vendored"},
	Warnings: []string{"rootform.lock.new could not be removed"},
}

func TestSelectionChangesAreReported(t *testing.T) {
	var requests []backend.Change
	fake := &backendtest.Fake{ChangeFunc: func(_ context.Context, request backend.Change, notices io.Writer) (backend.Changed, error) {
		requests = append(requests, request)
		_, _ = io.WriteString(notices, "a diagnostic\n")
		return addedLedger, nil
	}}
	code, out, errb := invoke(t, cli.Env{Backend: fake}, "add", "dialects", "./local/ledger", "--format", "json")
	if code != 0 || errb != "a diagnostic\nrootform: warning: rootform.lock.new could not be removed\n" {
		t.Fatalf("add = %d, %q", code, errb)
	}
	var report map[string]any
	if err := json.Unmarshal([]byte(out), &report); err != nil {
		t.Fatal(err)
	}
	want := map[string]any{
		"format_version": "1", "command": "add", "object": "dialects", "dry_run": false,
		"changed": true, "lock_written": true, "vendored": []any{"dialects"},
		"changes": []any{map[string]any{"action": "add", "kind": "dialect", "name": "ledger", "version": "0.1.0", "source": "local/ledger"}},
		"notices": []any{"Policy Packs are not vendored"}, "warnings": []any{"rootform.lock.new could not be removed"},
	}
	if !reflect.DeepEqual(report, want) {
		t.Fatalf("report = %v, want %v", report, want)
	}
	if want := (backend.Change{Verb: "add", Family: backend.Dialects, Operands: []string{"./local/ledger"}}); !reflect.DeepEqual(requests[0], want) {
		t.Fatalf("request = %+v, want %+v", requests[0], want)
	}

	project := t.TempDir()
	requests = nil
	code, out, _ = invoke(t, cli.Env{Backend: fake}, "update", "dialect", "ledger", "./next", "--project", project, "--offline", "--dry-run")
	if code != 0 || !strings.HasPrefix(out, "Planned changes to "+filepath.Join(project, "rootform.lock")+" (nothing written)\n") {
		t.Fatalf("update = %d, %q", code, out)
	}
	wantRequest := backend.Change{Verb: "update", Family: backend.Dialects, Operands: []string{"ledger", "./next"},
		Project: project, Offline: true, DryRun: true}
	if !reflect.DeepEqual(requests[0], wantRequest) {
		t.Fatalf("request = %+v, want %+v", requests[0], wantRequest)
	}
	code, _, _ = invoke(t, cli.Env{Backend: fake, Getenv: func(name string) string {
		if name == "ROOTFORM_OFFLINE" {
			return "1"
		}
		return ""
	}}, "add", "policy-packs", "./checks")
	if code != 0 || !requests[1].Offline || !requests[1].OfflineFromEnvironment || requests[1].Family != backend.PolicyPacks {
		t.Fatalf("add with ROOTFORM_OFFLINE = %d, %+v", code, requests[1])
	}
	code, _, _ = invoke(t, cli.Env{Backend: fake}, "remove", "dialects", "aws", "--embedded")
	if code != 0 || requests[2].Verb != "remove" || !requests[2].Embedded {
		t.Fatalf("remove --embedded = %d, %+v", code, requests[2])
	}
}

// With --project, the lock and the vendored copies are named as the working
// directory reaches them; without it the text keeps the project-relative
// names.
func TestSelectionTextNamesProjectPaths(t *testing.T) {
	other := t.TempDir()
	line := "\n  add      Dialect ledger 0.1.0  (local/ledger)\n"
	edits := []backend.Edit{{Action: "add", Kind: "dialect", Name: "ledger", Version: "0.1.0", Source: "local/ledger"}}
	for _, tt := range []struct {
		name    string
		args    []string
		changed backend.Changed
		want    string
	}{
		{"updated", []string{"--project", other}, backend.Changed{Modified: true, Vendored: []backend.Family{backend.Dialects, backend.PolicyPacks}, Edits: edits},
			filepath.Join(other, "rootform.lock") + " updated\n" + line + "\nVendored again: " +
				filepath.Join(other, ".rootform", "dialects") + ", " + filepath.Join(other, ".rootform", "policy-packs") + "\n"},
		{"planned", []string{"--project", other, "--dry-run"}, backend.Changed{Modified: true, Vendored: []backend.Family{backend.Dialects}, Edits: edits},
			"Planned changes to " + filepath.Join(other, "rootform.lock") + " (nothing written)\n" + line + "\nWould vendor again: " +
				filepath.Join(other, ".rootform", "dialects") + "\n"},
		{"unchanged", []string{"--project", other}, backend.Changed{},
			filepath.Join(other, "rootform.lock") + " already matches; nothing changed\n"},
		{"the working directory", nil, backend.Changed{Modified: true, Vendored: []backend.Family{backend.Dialects}, Edits: edits, Notices: []string{"one"}},
			"rootform.lock updated\n" + line + "\nVendored again: " + filepath.Join(".rootform", "dialects") + "\n\nNote: one\n"},
		{"an update and an embedded owner", nil, backend.Changed{Modified: true, Edits: []backend.Edit{
			{Action: "update", Kind: "policy-pack", Name: "checks", Version: "1.1.0", Previous: "1.0.0", Source: "oci:registry.example.com/acme/policies@sha256:1"},
			{Action: "include", Kind: "dialect", Name: "aws", Source: "embedded"},
		}}, "rootform.lock updated\n\n  update   Policy Pack checks 1.0.0 -> 1.1.0  (oci:registry.example.com/acme/policies@sha256:1)\n" +
			"  include  Dialect aws  (embedded)\n"},
	} {
		t.Run(tt.name, func(t *testing.T) {
			fake := &backendtest.Fake{ChangeFunc: func(context.Context, backend.Change, io.Writer) (backend.Changed, error) {
				return tt.changed, nil
			}}
			code, out, errb := invoke(t, cli.Env{Backend: fake}, append([]string{"add", "dialects", "./local/ledger"}, tt.args...)...)
			if code != 0 || out != tt.want || errb != "" {
				t.Fatalf("add = %d, %q, %q; want %q", code, out, errb, tt.want)
			}
		})
	}
}

// Every failure of a change exits with the status of its kind.
func TestSelectionFailureExits(t *testing.T) {
	for kind, want := range map[backend.Kind]int{backend.Usage: 2, backend.Negative: 1, backend.NoAnswer: 3, backend.Failure: 4} {
		fake := &backendtest.Fake{ChangeFunc: func(context.Context, backend.Change, io.Writer) (backend.Changed, error) {
			return backend.Changed{}, &backend.Error{Kind: kind, Message: "Dialect unknown is not selected\n\nTry:\n  rootform list dialects"}
		}}
		code, out, errb := invoke(t, cli.Env{Backend: fake}, "remove", "dialects", "unknown")
		if code != want || out != "" || errb != "rootform: Dialect unknown is not selected\n\nTry:\n  rootform list dialects\n" {
			t.Fatalf("kind %d: remove = %d, %q, %q", kind, code, out, errb)
		}
	}
}

func TestStoreInstallsAndDeletesVersions(t *testing.T) {
	unit := backend.Unit{Name: "payments", Version: "0.1.0", Repository: "registry.example.com/acme/dialects",
		ManifestDigest: "sha256:m", ContentDigest: "sha256:c"}
	var installs []backend.Installation
	var uninstalled [][]string
	fake := &backendtest.Fake{
		InstallFunc: func(_ context.Context, request backend.Installation) ([]backend.Unit, error) {
			installs = append(installs, request)
			return []backend.Unit{unit}, nil
		},
		UninstallFunc: func(_ context.Context, family backend.Family, versions []string) ([]backend.Unit, error) {
			if family != backend.PolicyPacks {
				t.Fatalf("family = %q", family)
			}
			uninstalled = append(uninstalled, versions)
			return nil, nil
		},
	}
	code, out, _ := invoke(t, cli.Env{Backend: fake}, "install", "dialects", "registry.example.com/acme/dialects:0.1.0", "--offline")
	if code != 0 || out != "Installed\n\n  payments 0.1.0  (registry.example.com/acme/dialects)\n" {
		t.Fatalf("install = %d, %q", code, out)
	}
	wantInstall := backend.Installation{Family: backend.Dialects, References: []string{"registry.example.com/acme/dialects:0.1.0"}, Offline: true}
	if !reflect.DeepEqual(installs, []backend.Installation{wantInstall}) {
		t.Fatalf("installs = %+v", installs)
	}
	code, out, _ = invoke(t, cli.Env{Backend: fake}, "install", "dialects", "registry.example.com/acme/dialects:0.1.0", "--format", "json")
	var report map[string]any
	if err := json.Unmarshal([]byte(out), &report); code != 0 || err != nil {
		t.Fatalf("json install = %d, %v", code, err)
	}
	want := map[string]any{"format_version": "1", "command": "install", "units": []any{map[string]any{
		"kind": "dialect", "name": "payments", "version": "0.1.0", "repository": "registry.example.com/acme/dialects",
		"manifest_digest": "sha256:m", "content_digest": "sha256:c",
	}}}
	if !reflect.DeepEqual(report, want) {
		t.Fatalf("report = %v, want %v", report, want)
	}
	code, out, _ = invoke(t, cli.Env{Backend: fake}, "uninstall", "policy-packs", "checks@1.0.0", "checks@1.0.0")
	if code != 0 || out != "Nothing uninstalled\n" || !reflect.DeepEqual(uninstalled, [][]string{{"checks@1.0.0", "checks@1.0.0"}}) {
		t.Fatalf("uninstall = %d, %q, %v", code, out, uninstalled)
	}
	code, out, _ = invoke(t, cli.Env{Backend: fake}, "uninstall", "policy-packs", "checks@1.0.0", "--format", "json")
	if code != 0 || out != "{\n  \"format_version\": \"1\",\n  \"command\": \"uninstall\",\n  \"units\": []\n}\n" {
		t.Fatalf("json uninstall = %d, %q", code, out)
	}
}

func TestStoreFailureExits(t *testing.T) {
	for kind, want := range map[backend.Kind]int{backend.Usage: 2, backend.Negative: 1, backend.NoAnswer: 3, backend.Failure: 4} {
		fake := &backendtest.Fake{UninstallFunc: func(context.Context, backend.Family, []string) ([]backend.Unit, error) {
			return nil, &backend.Error{Kind: kind, Message: "payments@0.1.0 is not installed\n\nTry:\n  rootform list dialects --installed"}
		}}
		code, out, errb := invoke(t, cli.Env{Backend: fake}, "uninstall", "dialects", "payments@0.1.0")
		if code != want || out != "" || !strings.HasPrefix(errb, "rootform: payments@0.1.0 is not installed\n") {
			t.Fatalf("kind %d: uninstall = %d, %q, %q", kind, code, out, errb)
		}
	}
}
