package command

import (
	"bytes"
	"path/filepath"
	"strings"
	"testing"
)

type recordingSelection struct{ got []SelectionOptions }

func (s *recordingSelection) Mutate(options SelectionOptions) error {
	s.got = append(s.got, options)
	return nil
}

// TestProjectSurface pins which commands select a project: every command
// that reads or changes a project's rootform.lock and takes no positional
// project directory. Commands that read a named directory, a saved Form, or
// only the Rootform home declare none.
func TestProjectSurface(t *testing.T) {
	root := NewRootCommand(&Env{})
	for _, path := range []string{
		"run", "check", "explain instance", "explain rule", "explain policy",
		"list dialects", "list policies", "list policy-packs",
		"show", "show policy", "show policy-pack",
		"validate rule", "validate concept", "validate context", "validate relation", "validate policy",
		"add dialects", "add policy-packs", "remove dialects", "remove policy-packs",
		"update dialect", "update policy-pack",
		"vendor", "vendor dialects", "vendor policy-packs",
	} {
		if findCommand(t, root, strings.Fields(path)...).Flags().Lookup("project") == nil {
			t.Errorf("rootform %s has no --project", path)
		}
	}
	for _, path := range []string{
		"init", "validate form", "validate dialects", "test", "fmt",
		"install dialects", "install policy-packs", "uninstall dialects", "uninstall policy-packs",
		"package dialects", "package policy-packs", "publish dialects", "publish policy-packs",
		"compile policy-pack",
	} {
		if findCommand(t, root, strings.Fields(path)...).Flags().Lookup("project") != nil {
			t.Errorf("rootform %s declares --project", path)
		}
	}
}

// A --project that names no directory is refused before any service runs,
// and one that does reaches the service as typed.
func TestProjectReachesTheServiceOnlyAsADirectory(t *testing.T) {
	directory := t.TempDir()
	missing := filepath.Join(directory, "absent")
	for _, args := range [][]string{
		{"add", "dialects", "./payments"},
		{"remove", "dialects", "payments"},
		{"update", "dialect", "payments"},
		{"vendor"},
		{"vendor", "dialects"},
		{"vendor", "policy-packs"},
		{"validate", "rule", "aws.rule.subnet"},
	} {
		for _, project := range []string{missing, directory} {
			selection, vendor, validate := &recordingSelection{}, &vendorStub{}, &vocabularyValidation{}
			var stdout, stderr bytes.Buffer
			code := Run(&Env{Stdout: &stdout, Stderr: &stderr, Args: append(append([]string{}, args...), "--project", project),
				Getenv: func(string) string { return "" }, Selection: selection, Vendor: vendor, Validate: validate})
			var got []string
			for _, options := range selection.got {
				got = append(got, options.Project)
			}
			for _, options := range vendor.got {
				got = append(got, options.Project)
			}
			for _, options := range validate.got {
				got = append(got, options.Project)
			}
			if project == missing {
				if code != ExitUsage || len(got) != 0 || stderr.String() != "rootform: --project requires a directory\n" {
					t.Errorf("%v --project absent: code=%d services=%v stderr=%q", args, code, got, stderr.String())
				}
				continue
			}
			if code != ExitOK || len(got) != 1 || got[0] != directory {
				t.Errorf("%v --project dir: code=%d services=%v stderr=%q", args, code, got, stderr.String())
			}
		}
	}
}
