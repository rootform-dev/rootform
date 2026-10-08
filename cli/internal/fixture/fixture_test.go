package fixture

import (
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
)

func writeFixture(t *testing.T, root, relative string, files map[string]string) string {
	t.Helper()
	directory := filepath.Join(root, filepath.FromSlash(relative))
	if err := os.MkdirAll(directory, 0o755); err != nil {
		t.Fatal(err)
	}
	for name, content := range files {
		if err := os.WriteFile(filepath.Join(directory, name), []byte(content), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	return directory
}

func caseNames(cases []Case) []string {
	names := make([]string, 0, len(cases))
	for _, discovered := range cases {
		names = append(names, discovered.Name)
	}
	return names
}

func TestDiscoverCasesFindsFixturesAtAnyDepth(t *testing.T) {
	root := t.TempDir()
	writeFixture(t, root, "slice/gke", map[string]string{"plan.json": "", GoldenName: "{}"})
	writeFixture(t, root, "slice/network", map[string]string{"plan.json": "", GoldenName: "{}"})

	discovered, err := DiscoverCases(root, "", false)
	if err != nil {
		t.Fatal(err)
	}
	want := []string{"slice/gke", "slice/network"}
	if got := caseNames(discovered); !reflect.DeepEqual(got, want) {
		t.Fatalf("discovered %v, want %v", got, want)
	}
	if discovered[0].Expected != filepath.Join(discovered[0].Dir, GoldenName) {
		t.Fatalf("expected golden %q is not inside the case directory %q",
			discovered[0].Expected, discovered[0].Dir)
	}
}

func TestDiscoverCasesRequiresOneExportAndGolden(t *testing.T) {
	root := t.TempDir()
	writeFixture(t, root, "golden-only", map[string]string{GoldenName: "{}"})
	writeFixture(t, root, "export-only", map[string]string{"plan.json": ""})
	writeFixture(t, root, "complete", map[string]string{"plan.json": "", GoldenName: "{}"})

	discovered, err := DiscoverCases(root, "", false)
	if err != nil {
		t.Fatal(err)
	}
	if got := caseNames(discovered); !reflect.DeepEqual(got, []string{"complete"}) {
		t.Fatalf("discovered %v, want only the complete fixture", got)
	}

	// Recording turns an export without a golden into a case whose golden
	// the run writes; a golden alone still records nothing to produce.
	recording, err := DiscoverCases(root, "", true)
	if err != nil {
		t.Fatal(err)
	}
	if got := caseNames(recording); !reflect.DeepEqual(got, []string{"complete", "export-only"}) {
		t.Fatalf("recording discovered %v, want the complete and export-only fixtures", got)
	}
}

func TestDiscoverCasesKeepsNestedDirectoriesInTheirCase(t *testing.T) {
	root := t.TempDir()
	writeFixture(t, root, "app", map[string]string{"plan.json": "", GoldenName: "{}"})
	writeFixture(t, root, "app/modules/network", map[string]string{"plan.json": "", GoldenName: "{}"})

	discovered, err := DiscoverCases(root, "", false)
	if err != nil {
		t.Fatal(err)
	}
	if got := caseNames(discovered); !reflect.DeepEqual(got, []string{"app"}) {
		t.Fatalf("discovered %v, want the enclosing fixture only", got)
	}
}

func TestDiscoverCasesSkipsHiddenDirectories(t *testing.T) {
	root := t.TempDir()
	writeFixture(t, root, ".git/objects", map[string]string{"plan.json": "", GoldenName: "{}"})
	writeFixture(t, root, "visible", map[string]string{"plan.json": "", GoldenName: "{}"})

	discovered, err := DiscoverCases(root, "", false)
	if err != nil {
		t.Fatal(err)
	}
	if got := caseNames(discovered); !reflect.DeepEqual(got, []string{"visible"}) {
		t.Fatalf("discovered %v, want the visible fixture only", got)
	}
}

func TestDiscoverCasesNarrowsToTheFilter(t *testing.T) {
	root := t.TempDir()
	writeFixture(t, root, "cloud-sql", map[string]string{"plan.json": "", GoldenName: "{}"})
	writeFixture(t, root, "gke", map[string]string{"plan.json": "", GoldenName: "{}"})

	discovered, err := DiscoverCases(root, "sql", false)
	if err != nil {
		t.Fatal(err)
	}
	if got := caseNames(discovered); !reflect.DeepEqual(got, []string{"cloud-sql"}) {
		t.Fatalf("discovered %v, want the matching fixture only", got)
	}
}

func TestDiscoverCasesIsDeterministic(t *testing.T) {
	root := t.TempDir()
	for _, name := range []string{"zeta", "alpha", "mu"} {
		writeFixture(t, root, name, map[string]string{"plan.json": "", GoldenName: "{}"})
	}

	first, err := DiscoverCases(root, "", false)
	if err != nil {
		t.Fatal(err)
	}
	second, err := DiscoverCases(root, "", false)
	if err != nil {
		t.Fatal(err)
	}
	want := []string{"alpha", "mu", "zeta"}
	if got := caseNames(first); !reflect.DeepEqual(got, want) {
		t.Fatalf("discovered %v, want %v", got, want)
	}
	if !reflect.DeepEqual(caseNames(first), caseNames(second)) {
		t.Fatalf("two runs discovered %v then %v", caseNames(first), caseNames(second))
	}
}

// A run with nothing to compare is not an error here: the caller decides that
// an empty run proves nothing, and it needs a slice it can range over.
func TestDiscoverCasesReturnsAnEmptySliceWhenNothingMatches(t *testing.T) {
	discovered, err := DiscoverCases(t.TempDir(), "", false)
	if err != nil {
		t.Fatal(err)
	}
	if discovered == nil {
		t.Fatal("discovered a nil slice, want an empty one")
	}
	if len(discovered) != 0 {
		t.Fatalf("discovered %v, want nothing", caseNames(discovered))
	}
}

func TestDiscoverCasesRefusesSomethingThatIsNotADirectory(t *testing.T) {
	root := t.TempDir()
	file := filepath.Join(root, "architecture.json")
	if err := os.WriteFile(file, []byte("{}"), 0o644); err != nil {
		t.Fatal(err)
	}

	_, err := DiscoverCases(file, "", false)
	if err == nil {
		t.Fatal("a regular file was accepted as a discovery root")
	}
	if !strings.Contains(err.Error(), `"`+file+`"`) {
		t.Fatalf("the report %q does not quote the given path", err.Error())
	}

	if _, err := DiscoverCases(filepath.Join(root, "absent"), "", false); err == nil {
		t.Fatal("a missing directory was accepted as a discovery root")
	}
}

func TestCompareGoldenAcceptsIdenticalBytes(t *testing.T) {
	if _, equal := CompareGolden([]byte(`{"a":1}`), []byte(`{"a":1}`)); !equal {
		t.Fatal("identical documents were reported as differing")
	}
}

func TestCompareGoldenLocatesTheFirstDifferingByte(t *testing.T) {
	difference, equal := CompareGolden([]byte(`{"a":1}`), []byte(`{"a":2}`))
	if equal {
		t.Fatal("differing documents were reported as identical")
	}
	if difference.Offset != 5 {
		t.Fatalf("reported byte %d, want 5", difference.Offset)
	}
	if !strings.Contains(difference.String(), "at byte 5") {
		t.Fatalf("the report %q does not name the position", difference.String())
	}
}

func TestCompareGoldenReportsATruncatedDocument(t *testing.T) {
	difference, equal := CompareGolden([]byte(`{"a":1}`), []byte(`{"a":`))
	if equal {
		t.Fatal("a truncated document was reported as identical")
	}
	if difference.Offset != 5 {
		t.Fatalf("reported byte %d, want the length of the shorter document", difference.Offset)
	}
}

// A golden is a single line of tens of kilobytes; a report that dumped it
// would bury the one position a user needs.
func TestCompareGoldenQuotesOnlyTheSurroundingBytes(t *testing.T) {
	expected := []byte(strings.Repeat("a", 5000) + "x" + strings.Repeat("a", 5000))
	actual := []byte(strings.Repeat("a", 5000) + "y" + strings.Repeat("a", 5000))

	difference, equal := CompareGolden(expected, actual)
	if equal {
		t.Fatal("differing documents were reported as identical")
	}
	if length := len(difference.String()); length > 200 {
		t.Fatalf("the report is %d bytes long, want a short window", length)
	}
}

func TestCompareGoldenQuotesUnprintableBytes(t *testing.T) {
	difference, equal := CompareGolden([]byte("a\x00b"), []byte("a\x01b"))
	if equal {
		t.Fatal("differing documents were reported as identical")
	}
	if strings.ContainsRune(difference.String(), '\x00') {
		t.Fatalf("the report %q carries a raw control byte", difference.String())
	}
}

func TestDiscoverCasesRefusesTwoExports(t *testing.T) {
	root := t.TempDir()
	writeFixture(t, root, "ambiguous", map[string]string{"plan.json": "", "state.json": "", GoldenName: "{}"})
	writeFixture(t, root, "state", map[string]string{"state.json": "", GoldenName: "{}"})

	discovered, err := DiscoverCases(root, "", false)
	if err != nil {
		t.Fatal(err)
	}
	if got := caseNames(discovered); !reflect.DeepEqual(got, []string{"state"}) {
		t.Fatalf("discovered %v, want the state fixture only", got)
	}
	if filepath.Base(discovered[0].Input) != "state.json" {
		t.Fatalf("input %q", discovered[0].Input)
	}
}

func TestDiscoverCasesPairsASavedPlanOnlyWithAPlanExport(t *testing.T) {
	root := t.TempDir()
	writeFixture(t, root, "enriched", map[string]string{"plan.json": "", SavedPlanName: "", GoldenName: "{}"})
	writeFixture(t, root, "plain", map[string]string{"plan.json": "", GoldenName: "{}"})
	writeFixture(t, root, "state-with-saved-plan", map[string]string{"state.json": "", SavedPlanName: "", GoldenName: "{}"})

	discovered, err := DiscoverCases(root, "", false)
	if err != nil {
		t.Fatal(err)
	}
	if got, want := caseNames(discovered), []string{"enriched", "plain"}; !reflect.DeepEqual(got, want) {
		t.Fatalf("discovered %v, want %v", got, want)
	}
	if discovered[0].PlanFile != filepath.Join(discovered[0].Dir, SavedPlanName) {
		t.Fatalf("enriched case plan file %q", discovered[0].PlanFile)
	}
	if discovered[1].PlanFile != "" {
		t.Fatalf("plain case names a saved plan %q", discovered[1].PlanFile)
	}
}
