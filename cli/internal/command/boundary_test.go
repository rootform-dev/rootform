package command

import (
	"go/ast"
	"go/parser"
	"go/token"
	"os"
	"reflect"
	"strconv"
	"strings"
	"testing"
)

func TestCLILayerBoundary(t *testing.T) {
	entries, err := os.ReadDir(".")
	if err != nil {
		t.Fatal(err)
	}
	var productionFiles []string
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".go") ||
			strings.HasSuffix(entry.Name(), "_test.go") {
			continue
		}
		productionFiles = append(productionFiles, entry.Name())
	}
	if len(productionFiles) == 0 {
		t.Fatal("CLI package contains no production Go files")
	}

	fset := token.NewFileSet()
	var envFields []string
	for _, fileName := range productionFiles {
		source, err := os.ReadFile(fileName)
		if err != nil {
			t.Fatal(err)
		}
		file, err := parser.ParseFile(fset, fileName, source, 0)
		if err != nil {
			t.Fatalf("parse %s: %v", fileName, err)
		}
		for _, imp := range file.Imports {
			path, err := strconv.Unquote(imp.Path.Value)
			if err != nil {
				t.Fatalf("import %s: %v", imp.Path.Value, err)
			}
			standardLibrary := !strings.Contains(strings.SplitN(path, "/", 2)[0], ".")
			cliFramework := path == "github.com/spf13/cobra" || path == "github.com/spf13/pflag"
			if (!standardLibrary && !cliFramework) || strings.HasPrefix(path, "internal/") {
				t.Errorf("%s imports non-standard-library path %q; the CLI package imports only the standard library, cobra, and pflag", fileName, path)
			}
			if strings.Contains(path, "hcl") || strings.Contains(path, "terraform") ||
				strings.Contains(path, "semantics") || strings.Contains(path, "provider") ||
				strings.Contains(path, "frontend") {
				t.Errorf("%s imports forbidden path %q; parser, semantic, provider, and frontend types stay outside the CLI boundary", fileName, path)
			}
		}
		for _, decl := range file.Decls {
			switch typed := decl.(type) {
			case *ast.GenDecl:
				for _, spec := range typed.Specs {
					typeSpec, ok := spec.(*ast.TypeSpec)
					if !ok || typeSpec.Name.Name != "Env" {
						continue
					}
					structType, ok := typeSpec.Type.(*ast.StructType)
					if !ok {
						t.Fatal("Env is not a struct")
					}
					for _, field := range structType.Fields.List {
						if len(field.Names) == 0 {
							continue
						}
						envFields = append(envFields, field.Names[0].Name)
					}
				}
				if typed.Tok != token.VAR {
					continue
				}
				for _, spec := range typed.Specs {
					value, ok := spec.(*ast.ValueSpec)
					if !ok {
						continue
					}
					for _, name := range value.Names {
						if name.Name != "_" {
							t.Errorf("%s declares package-level var %q; the CLI keeps no package-global mutable state", fileName, name.Name)
						}
					}
				}
			case *ast.FuncDecl:
				if typed.Body == nil {
					continue
				}
				assertNoOSExit(t, fileName, typed.Body)
			}
		}
	}

	wantEnvFields := []string{
		"Stdout", "Stderr", "Args", "Getwd", "Getenv", "InputTerminal", "Color", "Paging", "Page", "Service", "Check", "Browser",
		"Compile", "List", "Show",
		"Validate", "Fmt", "Test", "Explain", "Vendor", "Selection", "Store", "Init", "Package", "Publish", "LSP", "Version",
	}
	if !reflect.DeepEqual(envFields, wantEnvFields) {
		t.Fatalf("Env fields = %v, want pinned order %v", envFields, wantEnvFields)
	}
}

func assertNoOSExit(t *testing.T, fileName string, body *ast.BlockStmt) {
	t.Helper()
	ast.Inspect(body, func(node ast.Node) bool {
		call, ok := node.(*ast.CallExpr)
		if !ok {
			return true
		}
		selector, ok := call.Fun.(*ast.SelectorExpr)
		if !ok {
			return true
		}
		identifier, ok := selector.X.(*ast.Ident)
		if !ok || identifier.Name != "os" || selector.Sel.Name != "Exit" {
			return true
		}
		t.Errorf("%s calls os.Exit; command handlers and the CLI package never exit the process", fileName)
		return true
	})
}
