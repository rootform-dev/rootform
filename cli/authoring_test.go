package cli_test

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"

	"github.com/rootform-dev/rootform/cli"
	"github.com/rootform-dev/rootform/cli/backend"
	"github.com/rootform-dev/rootform/cli/backend/backendtest"
	"github.com/rootform-dev/rootform/cli/form"
	"github.com/rootform-dev/rootform/cli/internal/document"
)

const (
	unformattedDialect = "dialect \"core\" {\n  version=\"0.1.0\"\n}\n"
	formattedDialect   = "dialect \"core\" {\n  version = \"0.1.0\"\n}\n"
)

// spacedVersion is the canonical text of the fake formatter: it spaces the
// assignment of a version, and a lone brace is not valid.
func spacedVersion(_ context.Context, name string, source []byte) ([]byte, error) {
	if bytes.Equal(source, []byte("{")) {
		return nil, &backend.Error{Kind: backend.Negative, Message: name + " is not valid"}
	}
	return bytes.ReplaceAll(source, []byte("version=\""), []byte("version = \"")), nil
}

// sources writes files, named by slash paths, below a new directory.
func sources(t *testing.T, files map[string]string) string {
	t.Helper()
	root := t.TempDir()
	for name, body := range files {
		path := filepath.Join(root, filepath.FromSlash(name))
		if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(path, []byte(body), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	return root
}

func readText(t *testing.T, path string) string {
	t.Helper()
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	return string(data)
}

// fmt asks the backend for the canonical text of every source below the
// directory in name order, skipping hidden directories and other files, and
// rewrites the sources whose text differs.
func TestFmtRewritesTheSourcesThatDiffer(t *testing.T) {
	var asked []string
	fake := &backendtest.Fake{FormatFunc: func(ctx context.Context, name string, source []byte) ([]byte, error) {
		asked = append(asked, name)
		return spacedVersion(ctx, name, source)
	}}
	root := sources(t, map[string]string{
		"b/dialect.rf.hcl": unformattedDialect, "a.rf.json": "{}", ".hidden/x.rf.hcl": unformattedDialect, "notes.txt": "version=\"1\"",
	})
	code, out, errb := invoke(t, cli.Env{Backend: fake}, "fmt", root)
	if code != 0 || out != "b/dialect.rf.hcl\n" || errb != "" {
		t.Fatalf("fmt = %d, %q, %q", code, out, errb)
	}
	if want := []string{"a.rf.json", "b/dialect.rf.hcl"}; !reflect.DeepEqual(asked, want) {
		t.Fatalf("formatted %v, want %v", asked, want)
	}
	if got := readText(t, filepath.Join(root, "b", "dialect.rf.hcl")); got != formattedDialect {
		t.Fatalf("the rewritten source is %q", got)
	}
	if got := readText(t, filepath.Join(root, ".hidden", "x.rf.hcl")); got != unformattedDialect {
		t.Fatal("a source of a hidden directory was rewritten")
	}
	code, out, errb = invoke(t, cli.Env{Backend: fake}, "fmt", root)
	if code != 0 || out != "" || errb != "" {
		t.Fatalf("a formatted tree = %d, %q, %q", code, out, errb)
	}
}

// --check names the sources that differ and --diff shows how; neither
// rewrites them.
func TestFmtInspectionsReportDrift(t *testing.T) {
	fake := &backendtest.Fake{FormatFunc: spacedVersion}
	root := sources(t, map[string]string{"plan.rf.hcl": unformattedDialect})
	code, out, _ := invoke(t, cli.Env{Backend: fake}, "fmt", root, "--check")
	if code != 1 || out != "plan.rf.hcl\n" {
		t.Fatalf("fmt --check = %d, %q", code, out)
	}
	code, out, _ = invoke(t, cli.Env{Backend: fake}, "fmt", root, "--diff")
	want := "--- plan.rf.hcl\n+++ plan.rf.hcl\n@@ -1,3 +1,3 @@\n dialect \"core\" {\n-  version=\"0.1.0\"\n+  version = \"0.1.0\"\n }\n"
	if code != 1 || out != want {
		t.Fatalf("fmt --diff = %d, %q, want %q", code, out, want)
	}
	if got := readText(t, filepath.Join(root, "plan.rf.hcl")); got != unformattedDialect {
		t.Fatal("an inspection rewrote the source")
	}
}

// A source that is not valid is a negative answer that rewrites nothing; a
// backend that cannot format and a directory that cannot be read stop fmt.
func TestFmtRefusals(t *testing.T) {
	root := sources(t, map[string]string{"bad.rf.json": "{"})
	code, out, errb := invoke(t, cli.Env{Backend: &backendtest.Fake{FormatFunc: spacedVersion}}, "fmt", root)
	if code != 1 || out != "" || errb != "rootform: bad.rf.json is not valid, so nothing was rewritten\n" {
		t.Fatalf("invalid source = %d, %q, %q", code, out, errb)
	}
	unavailable := &backendtest.Fake{FormatFunc: func(context.Context, string, []byte) ([]byte, error) {
		return nil, &backend.Error{Kind: backend.Failure, Message: "the formatter is unavailable"}
	}}
	code, _, errb = invoke(t, cli.Env{Backend: unavailable}, "fmt", root)
	if code != 4 || errb != "rootform: the formatter is unavailable\n" {
		t.Fatalf("formatter failure = %d, %q", code, errb)
	}
	code, _, errb = invoke(t, cli.Env{Backend: unavailable}, "fmt", filepath.Join(root, "absent"))
	if code != 4 || errb != "rootform: that path is not a readable directory\n" {
		t.Fatalf("missing directory = %d, %q", code, errb)
	}
}

// compile policy-pack pins the Policy Pack to the semantics of the saved
// Form, writes the compiled file with a final newline and summarizes it.
func TestCompileWritesThePinnedPolicyPack(t *testing.T) {
	semantics := write(t, "form.json", fixture(t, "plan.json"))
	want := fixtureForm(t, "plan.json").Input.Semantics
	source, output := t.TempDir(), filepath.Join(t.TempDir(), "pack.json")
	var compiled []string
	fake := &backendtest.Fake{PolicyPackFunc: func(_ context.Context, directory string, pinned form.Semantics, _ io.Writer) (backend.CompiledPolicyPack, error) {
		compiled = append(compiled, directory)
		if !reflect.DeepEqual(pinned, want) {
			t.Error("the Policy Pack is not pinned to the semantics of the Form")
		}
		return backend.CompiledPolicyPack{Name: "checks", Version: "0.1.0", Pins: 3, Digest: "sha256:abc", Content: []byte(`{"policy_pack":"checks"}`)}, nil
	}}
	code, out, errb := invoke(t, cli.Env{Backend: fake}, "compile", "policy-pack", source, "--semantics", semantics, "-o", output)
	if code != 0 || errb != "" {
		t.Fatalf("compile = %d, %q", code, errb)
	}
	inOrder(t, out, "Policy Pack compiled\n\n", "Policy Pack", "checks@0.1.0\n", "Form", semantics+"\n", "Semantic pins", "3\n", "Digest", "sha256:abc\n", "Destination", output+"\n")
	if got := readText(t, output); got != "{\"policy_pack\":\"checks\"}\n" {
		t.Fatalf("the compiled file is %q", got)
	}
	if len(compiled) != 1 || compiled[0] != source {
		t.Fatalf("compiled %v, want %s", compiled, source)
	}
}

// A Policy Pack that does not compile states its diagnostics and writes no
// file; a Form that cannot pin it never reaches the backend.
func TestCompileRefusals(t *testing.T) {
	source, output := t.TempDir(), filepath.Join(t.TempDir(), "pack.json")
	semantics := write(t, "form.json", fixture(t, "plan.json"))
	fake := &backendtest.Fake{PolicyPackFunc: func(_ context.Context, _ string, _ form.Semantics, notices io.Writer) (backend.CompiledPolicyPack, error) {
		_, _ = io.WriteString(notices, "pack.rf.hcl:3:1: error: POLICY_TARGET: unknown concept\n")
		return backend.CompiledPolicyPack{}, &backend.Error{Kind: backend.Negative, Message: "the Policy Pack could not be compiled"}
	}}
	code, out, errb := invoke(t, cli.Env{Backend: fake}, "compile", "policy-pack", source, "--semantics", semantics, "-o", output)
	if code != 1 || out != "" || errb != "pack.rf.hcl:3:1: error: POLICY_TARGET: unknown concept\nrootform: the Policy Pack could not be compiled\n" {
		t.Fatalf("compile = %d, %q, %q", code, out, errb)
	}
	if _, err := os.Stat(output); !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("a Policy Pack that did not compile was written: %v", err)
	}
	unreached := &backendtest.Fake{PolicyPackFunc: func(context.Context, string, form.Semantics, io.Writer) (backend.CompiledPolicyPack, error) {
		t.Error("a Form that cannot pin the Policy Pack reached the backend")
		return backend.CompiledPolicyPack{}, nil
	}}
	for _, c := range []struct {
		name, source, semantics, want string
		exit                          int
	}{
		{"invalid Form", source, write(t, "invalid.json", []byte("{}")), "the --semantics file must be a valid state or plan Form", 1},
		{"oversized Form", source, oversized(t, "form.json"), document.Limit(), 1},
		{"missing Form", source, filepath.Join(t.TempDir(), "absent.json"), "the --semantics file must be a readable Form", 4},
		{"missing source", filepath.Join(source, "absent"), semantics, "the Policy Pack source must be a readable directory", 4},
	} {
		t.Run(c.name, func(t *testing.T) {
			code, _, errb := invoke(t, cli.Env{Backend: unreached}, "compile", "policy-pack", c.source, "--semantics", c.semantics, "-o", output)
			if code != c.exit || !strings.HasPrefix(errb, "rootform: ") || !strings.Contains(errb, c.want) {
				t.Fatalf("compile = %d, %q", code, errb)
			}
		})
	}
}

// package names the family, sources, destination and provenance of the
// layout, and lists each packaged version.
func TestPackageListsThePackagedVersions(t *testing.T) {
	var requests []backend.Packaging
	fake := &backendtest.Fake{PackageFunc: func(_ context.Context, request backend.Packaging) ([]backend.Packaged, error) {
		requests = append(requests, request)
		return []backend.Packaged{{Name: "network", Version: "0.1.0", Digest: "sha256:1", Size: 2048}}, nil
	}}
	code, out, errb := invoke(t, cli.Env{Backend: fake}, "package", "policy-packs", "./src", "--to", "./oci",
		"--source-url", "https://example.com/src", "--revision", "abc", "--documentation-url", "https://example.com/docs", "--licenses", "MPL-2.0")
	if code != 0 || errb != "" {
		t.Fatalf("package = %d, %q", code, errb)
	}
	inOrder(t, out, "Policy Packs packaged\n\n", "Destination", "./oci\n", "Policy Packs  1\n", "Policy Packs (1)", "  network@0.1.0\n", "Digest", "sha256:1\n", "Size", "2.0 KiB\n")
	want := backend.Packaging{Family: backend.PolicyPacks, Source: "./src", Destination: "./oci", Provenance: backend.Provenance{
		Source: "https://example.com/src", Revision: "abc", Documentation: "https://example.com/docs", Licenses: "MPL-2.0",
	}}
	if len(requests) != 1 || requests[0] != want {
		t.Fatalf("requests = %+v, want %+v", requests, want)
	}
	code, out, _ = invoke(t, cli.Env{Backend: fake}, "package", "dialects", "./src", "--to", "./oci")
	if code != 0 || len(requests) != 2 || requests[1].Family != backend.Dialects {
		t.Fatalf("package dialects = %d, %+v", code, requests)
	}
	inOrder(t, out, "Dialects packaged\n\n", "Destination  ./oci\n", "Dialects     1\n", "Dialects (1)", "  network@0.1.0\n")
}

// A packaging failure states its reason and exits with the status of its
// kind.
func TestPackageRefusalExits(t *testing.T) {
	for kind, want := range map[backend.Kind]int{backend.Negative: 1, backend.Failure: 4} {
		fake := &backendtest.Fake{PackageFunc: func(context.Context, backend.Packaging) ([]backend.Packaged, error) {
			return nil, &backend.Error{Kind: kind, Message: "package destination already exists"}
		}}
		code, out, errb := invoke(t, cli.Env{Backend: fake}, "package", "dialects", "./src", "--to", "./oci")
		if code != want || out != "" || errb != "rootform: package destination already exists\n" {
			t.Fatalf("kind %d: %d, %q, %q", kind, code, out, errb)
		}
	}
}

// published is the publication of one version the fake answers.
func published(_ context.Context, request backend.Publication) (backend.Published, error) {
	return backend.Published{FormatVersion: "1", DryRun: request.DryRun, Repository: request.Repository, Versions: []backend.PublishedVersion{{
		Name: "acme", Version: "0.1.0", Repository: request.Repository, Tag: "acme-0.1.0",
		ManifestDigest: "sha256:aaaa", ManifestSize: 512, Size: 2048, Status: "published",
		Provenance: backend.Provenance{Source: "https://example.com/src", Licenses: "MPL-2.0"},
	}}}, nil
}

// publish reports each version it published or planned, and a dry run
// states the provenance the versions record.
func TestPublishReportsEachVersion(t *testing.T) {
	var requests []backend.Publication
	fake := &backendtest.Fake{PublishFunc: func(ctx context.Context, request backend.Publication) (backend.Published, error) {
		requests = append(requests, request)
		return published(ctx, request)
	}}
	code, out, errb := invoke(t, cli.Env{Backend: fake}, "publish", "dialects", "./oci", "--to", "registry.example.com/acme/dialects")
	if code != 0 || errb != "" || strings.Contains(out, "Provenance") {
		t.Fatalf("publish = %d, %q, %q", code, out, errb)
	}
	inOrder(t, out, "Published Dialect acme@0.1.0\n", "Registry", "registry.example.com/acme/dialects\n", "Digest", "sha256:aaaa\n", "Size", "2.0 KiB\n")
	code, out, _ = invoke(t, cli.Env{Backend: fake}, "publish", "policy-packs", "./oci", "--to", "registry.example.com/acme/policies", "--dry-run")
	if code != 0 || strings.Contains(out, "revision") {
		t.Fatalf("publish --dry-run = %d, %q", code, out)
	}
	inOrder(t, out, "Would publish Policy Pack acme@0.1.0\n", "Provenance", "source", "https://example.com/src\n", "licenses", "MPL-2.0\n")
	want := []backend.Publication{
		{Family: backend.Dialects, Layout: "./oci", Repository: "registry.example.com/acme/dialects"},
		{Family: backend.PolicyPacks, Layout: "./oci", Repository: "registry.example.com/acme/policies", DryRun: true},
	}
	if !reflect.DeepEqual(requests, want) {
		t.Fatalf("requests = %+v, want %+v", requests, want)
	}
}

// The JSON report of a publication names its versions by the key of the
// family.
func TestPublishJSONNamesTheFamily(t *testing.T) {
	fake := &backendtest.Fake{PublishFunc: published}
	for family, keys := range map[string][2]string{"dialects": {"dialects", "owner"}, "policy-packs": {"policy_packs", "name"}} {
		code, out, errb := invoke(t, cli.Env{Backend: fake}, "publish", family, "./oci", "--to", "registry.example.com/acme/x", "--format", "json")
		var report map[string]any
		if err := json.Unmarshal([]byte(out), &report); code != 0 || err != nil || errb != "" {
			t.Fatalf("publish %s = %d, %v, %q", family, code, err, errb)
		}
		want := map[string]any{"format_version": "1", "dry_run": false, "repository": "registry.example.com/acme/x", keys[0]: []any{map[string]any{
			keys[1]: "acme", "version": "0.1.0", "repository": "registry.example.com/acme/x", "tag": "acme-0.1.0",
			"manifest_digest": "sha256:aaaa", "manifest_size": float64(512), "size": float64(2048), "status": "published",
			"provenance": map[string]any{"source": "https://example.com/src", "licenses": "MPL-2.0"},
		}}}
		if !reflect.DeepEqual(report, want) {
			t.Fatalf("publish %s = %v, want %v", family, report, want)
		}
	}
}

// An invalid repository is incorrect usage, an invalid layout a negative
// answer and any other failure an operational one; a failed publication
// writes no report.
func TestPublishRefusalExits(t *testing.T) {
	for kind, want := range map[backend.Kind]int{backend.Usage: 2, backend.Negative: 1, backend.Failure: 4} {
		fake := &backendtest.Fake{PublishFunc: func(context.Context, backend.Publication) (backend.Published, error) {
			return backend.Published{}, &backend.Error{Kind: kind, Message: "destination tag conflict"}
		}}
		code, out, errb := invoke(t, cli.Env{Backend: fake}, "publish", "dialects", "./oci", "--to", "registry.example.com/acme/dialects", "--format", "json")
		if code != want || out != "" || !strings.HasPrefix(errb, "rootform: destination tag conflict\n") {
			t.Fatalf("kind %d: %d, %q, %q", kind, code, out, errb)
		}
	}
}

// lsp serves the language server over standard input and standard output,
// and a server that stops before the client exits is a failure that quotes
// no frame.
func TestLSPServesTheProcessStreams(t *testing.T) {
	fake := &backendtest.Fake{ServeLanguageFunc: func(_ context.Context, input io.ReadCloser, output io.Writer) error {
		frames, err := io.ReadAll(input)
		if err != nil {
			return err
		}
		_, err = output.Write(append([]byte("echo:"), frames...))
		return err
	}}
	code, out, errb := invoke(t, cli.Env{Backend: fake, Stdin: strings.NewReader("frame")}, "lsp")
	if code != 0 || out != "echo:frame" || errb != "" {
		t.Fatalf("lsp = %d, %q, %q", code, out, errb)
	}
	fake.ServeLanguageFunc = func(context.Context, io.ReadCloser, io.Writer) error { return errors.New("broken frame") }
	code, out, errb = invoke(t, cli.Env{Backend: fake}, "lsp")
	if code != 4 || out != "" || errb != "rootform: the language server stopped before the client completed shutdown\n" {
		t.Fatalf("lsp failure = %d, %q, %q", code, out, errb)
	}
}
