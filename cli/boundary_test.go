package cli_test

import (
	"go/parser"
	"go/token"
	"io/fs"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"testing"
)

const modulePath = "github.com/rootform-dev/rootform/cli"

// exported are the packages a program built on this module imports: the entry
// point, the backend ports with their conformance suite, and the models they
// carry. Everything else stays under internal.
var exported = map[string]bool{
	".":                   true,
	"backend":             true,
	"backend/backendtest": true,
	"form":                true,
	"policyresult":        true,
	"detect":              true,
	"command":             true,
	"human":               true,
}

// models are the packages whose types cross the backend ports. They import
// the standard library and each other only, so a backend never depends on the
// command line.
var models = map[string]bool{
	"backend":             true,
	"backend/backendtest": true,
	"form":                true,
	"policyresult":        true,
	"detect":              true,
}

// framework are the packages that build the command tree; only they import
// Cobra and pflag.
var framework = map[string]bool{
	"command":               true,
	"internal/clireference": true,
}

// TestModuleBoundary reads the imports of every Go file of this module.
func TestModuleBoundary(t *testing.T) {
	packages := map[string]bool{}
	err := filepath.WalkDir(".", func(path string, entry fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if entry.IsDir() {
			if name := entry.Name(); path != "." && (name == "testdata" || strings.HasPrefix(name, ".") || strings.HasPrefix(name, "_")) {
				return filepath.SkipDir
			}
			return nil
		}
		if !strings.HasSuffix(path, ".go") {
			return nil
		}
		dir := filepath.ToSlash(filepath.Dir(path))
		test := strings.HasSuffix(path, "_test.go")
		if !test {
			packages[dir] = true
		}
		file, err := parser.ParseFile(token.NewFileSet(), path, nil, parser.ImportsOnly)
		if err != nil {
			return err
		}
		for _, spec := range file.Imports {
			imported, err := strconv.Unquote(spec.Path.Value)
			if err != nil {
				return err
			}
			switch {
			case imported == modulePath || strings.HasPrefix(imported, modulePath+"/"):
				target := strings.TrimPrefix(strings.TrimPrefix(imported, modulePath), "/")
				if models[dir] && !test && !models[target] {
					t.Errorf("%s imports %s; a model or a port imports only the standard library and other models", path, imported)
				}
			case strings.Contains(strings.SplitN(imported, "/", 2)[0], "."):
				if (imported != "github.com/spf13/cobra" && imported != "github.com/spf13/pflag") || !framework[dir] {
					t.Errorf("%s imports %s; the only third-party packages are Cobra and pflag, imported by the command framework", path, imported)
				}
			}
		}
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
	var public []string
	for dir := range packages {
		if dir != "internal" && !strings.HasPrefix(dir, "internal/") {
			public = append(public, dir)
		}
	}
	sort.Strings(public)
	for _, dir := range public {
		if !exported[dir] {
			t.Errorf("package %s is importable outside this module; move it under internal", dir)
		}
	}
	for dir := range exported {
		if !packages[dir] {
			t.Errorf("exported package %s is missing", dir)
		}
	}
}
