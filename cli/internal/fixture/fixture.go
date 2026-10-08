// Package fixture discovers the Dialect fixtures rootform test compares and
// locates where a produced Form parts from the one a fixture records.
package fixture

import (
	"bytes"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
)

// GoldenName is the fixed file name a fixture uses to record the Rootform
// document it expects.
const GoldenName = "analysis.golden"

// InputNames are the producer exports a fixture may analyze. A fixture holds
// exactly one of them.
var InputNames = []string{"plan.json", "state.json"}

// SavedPlanName is the saved plan a fixture may keep beside its plan.json
// export. The analysis must verify that the export belongs to it and then
// reads the configuration snapshot it carries, which is the only evidence for
// facts that follow references between resources.
const SavedPlanName = "plan.tfplan"

// differenceWindow bounds how much of a golden a report may quote. Goldens are
// documents of tens of kilobytes, so a difference names a position and its
// neighborhood rather than dumping the document.
const differenceWindow = 30

// Case is one fixture: an export to analyze and the document it expects.
type Case struct {
	// Name is the case directory relative to the discovery root, always
	// slash-separated so a filter behaves the same on every platform.
	Name     string
	Dir      string
	Input    string
	Expected string
	// PlanFile is the saved plan beside a plan.json export, or empty.
	PlanFile string
}

// DiscoverCases finds every fixture under root, keeping those whose name
// contains filter. An empty filter keeps all of them. When recording, a
// directory holding one export and no golden yet is a case as well: the run
// writes its golden.
func DiscoverCases(root, filter string, recording bool) ([]Case, error) {
	info, err := os.Stat(root)
	if err != nil {
		return nil, fmt.Errorf("%q could not be read", root)
	}
	if !info.IsDir() {
		return nil, fmt.Errorf("%q is not a directory", root)
	}

	cases := make([]Case, 0)
	walkErr := filepath.WalkDir(root, func(path string, entry fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if !entry.IsDir() {
			return nil
		}
		if path != root && strings.HasPrefix(entry.Name(), ".") {
			return fs.SkipDir
		}
		input, saved, err := caseInput(path, recording)
		if err != nil {
			return err
		}
		if input == "" {
			return nil
		}
		name, err := caseName(root, path)
		if err != nil {
			return err
		}
		if filter == "" || strings.Contains(name, filter) {
			discovered := Case{
				Name:     name,
				Dir:      path,
				Input:    filepath.Join(path, input),
				Expected: filepath.Join(path, GoldenName),
			}
			if saved {
				discovered.PlanFile = filepath.Join(path, SavedPlanName)
			}
			cases = append(cases, discovered)
		}
		// Directories below a fixture belong to it, never further cases.
		return fs.SkipDir
	})
	if walkErr != nil {
		return nil, fmt.Errorf("%q could not be read", root)
	}
	sort.Slice(cases, func(i, j int) bool { return cases[i].Name < cases[j].Name })
	return cases, nil
}

// caseInput names the export of a directory holding a golden and exactly one
// export, and reports whether a saved plan accompanies it. A golden alone
// records an expectation nothing produces, an export alone records no
// expectation, and two exports make the case ambiguous. A saved plan belongs
// only beside a plan.json export: beside a state export it makes the case
// ambiguous as well. When recording, an export alone is a case whose golden
// the run writes.
func caseInput(directory string, recording bool) (string, bool, error) {
	entries, err := os.ReadDir(directory)
	if err != nil {
		return "", false, err
	}
	golden := false
	saved := false
	inputs := []string{}
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		if entry.Name() == GoldenName {
			golden = true
		}
		if entry.Name() == SavedPlanName {
			saved = true
		}
		for _, name := range InputNames {
			if entry.Name() == name {
				inputs = append(inputs, name)
			}
		}
	}
	if (!golden && !recording) || len(inputs) != 1 {
		return "", false, nil
	}
	if saved && inputs[0] != "plan.json" {
		return "", false, nil
	}
	return inputs[0], saved, nil
}

func caseName(root, directory string) (string, error) {
	relative, err := filepath.Rel(root, directory)
	if err != nil {
		return "", err
	}
	if relative == "." {
		absolute, err := filepath.Abs(directory)
		if err != nil {
			return "", err
		}
		return filepath.Base(absolute), nil
	}
	return filepath.ToSlash(relative), nil
}

// Difference locates the first byte at which a produced document parts from
// the one a fixture expects.
type Difference struct {
	Offset   int
	Expected string
	Actual   string
}

func (d Difference) String() string {
	return fmt.Sprintf("at byte %d: expected %s, actual %s", d.Offset, d.Expected, d.Actual)
}

// CompareGolden reports whether the produced bytes match the expected ones,
// and where they first part when they do not.
func CompareGolden(expected, actual []byte) (Difference, bool) {
	if bytes.Equal(expected, actual) {
		return Difference{}, true
	}
	shorter := len(expected)
	if len(actual) < shorter {
		shorter = len(actual)
	}
	offset := shorter
	for index := 0; index < shorter; index++ {
		if expected[index] != actual[index] {
			offset = index
			break
		}
	}
	return Difference{
		Offset:   offset,
		Expected: quotedWindow(expected, offset),
		Actual:   quotedWindow(actual, offset),
	}, false
}

// quotedWindow renders the bytes around an offset. Quoting keeps a control
// byte in a golden from reaching the terminal raw.
func quotedWindow(data []byte, offset int) string {
	start := offset - differenceWindow
	if start < 0 {
		start = 0
	}
	if start > len(data) {
		start = len(data)
	}
	end := offset + differenceWindow
	if end > len(data) {
		end = len(data)
	}
	return strconv.Quote(string(data[start:end]))
}
