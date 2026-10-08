package document

import (
	"go/parser"
	"go/token"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

// TestDocumentBoundary pins the reader to the standard library. A document is
// bytes under a ceiling; what those bytes mean belongs to the consumer, so no
// architecture, plan, semantic, or command type may enter this package.
func TestDocumentBoundary(t *testing.T) {
	_, file, _, _ := runtime.Caller(0)
	paths, err := filepath.Glob(filepath.Join(filepath.Dir(file), "*.go"))
	if err != nil {
		t.Fatal(err)
	}
	for _, path := range paths {
		if strings.HasSuffix(path, "_test.go") {
			continue
		}
		node, err := parser.ParseFile(token.NewFileSet(), path, nil, 0)
		if err != nil {
			t.Fatal(err)
		}
		if node.Name.Name != "document" {
			t.Errorf("%s declares package %q, want document", filepath.Base(path), node.Name.Name)
		}
		for _, spec := range node.Imports {
			importPath := strings.Trim(spec.Path.Value, `"`)
			if strings.Contains(strings.SplitN(importPath, "/", 2)[0], ".") {
				t.Errorf("%s imports %q; the document reader uses the standard library only",
					filepath.Base(path), importPath)
			}
		}
	}
}
