package app

import (
	"context"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/rootform-dev/rootform/cli/backend"
	cli "github.com/rootform-dev/rootform/cli/command"
	"github.com/rootform-dev/rootform/cli/human"
)

// fmtService formats Rootform Language sources in place, or under --check
// and --diff reports which sources would change without rewriting anything.
// The backend states the canonical text of each source.
type fmtService struct {
	stdout  io.Writer
	stderr  io.Writer
	backend backend.Backend
}

func (s fmtService) Fmt(options cli.FmtOptions) (cli.FmtOutcome, error) {
	sources, err := languageSources(options.Path)
	if err != nil {
		return s.undecided(err.Error())
	}
	drifted := false
	for _, source := range sources {
		content, err := os.ReadFile(source.path)
		if err != nil {
			return s.undecided(fmt.Sprintf("%s could not be read", source.name))
		}
		formatted, err := s.backend.Authoring().Format(context.Background(), source.name, content)
		if err != nil {
			var failure *backend.Error
			if !errors.As(err, &failure) || failure.Kind != backend.Negative {
				return s.undecided(failureStatement(err))
			}
			human.Failure(s.stderr, fmt.Sprintf("%s is not valid, so nothing was rewritten", source.name))
			return cli.FmtInvalid, nil
		}
		if string(formatted) == string(content) {
			continue
		}
		drifted = true
		switch {
		case options.Diff:
			fmt.Fprint(s.stdout, fmtUnifiedDiff(source.name, content, formatted))
		case options.Check:
			fmt.Fprintln(s.stdout, source.name)
		default:
			if err := replaceFile(source.path, formatted); err != nil {
				return s.undecided(fmt.Sprintf("%s could not be rewritten", source.name))
			}
			fmt.Fprintln(s.stdout, source.name)
		}
	}
	switch {
	case !drifted:
		return cli.FmtClean, nil
	case options.Check || options.Diff:
		return cli.FmtDrift, nil
	default:
		return cli.FmtRewritten, nil
	}
}

// undecided reports the diagnostic for a source that could not be read,
// formatted, or rewritten. Fmt never returns a non-nil error: the message is
// reported here, and the returned outcome alone tells the caller the run
// decided nothing.
func (s fmtService) undecided(message string) (cli.FmtOutcome, error) {
	human.Failure(s.stderr, message)
	return cli.FmtFailure, nil
}

type languageSource struct {
	path string
	name string
}

func languageSources(directory string) ([]languageSource, error) {
	info, err := os.Lstat(directory)
	if err != nil || !info.IsDir() || info.Mode()&os.ModeSymlink != 0 {
		return nil, fmt.Errorf("that path is not a readable directory")
	}
	sources := make([]languageSource, 0)
	err = filepath.WalkDir(directory, func(path string, entry fs.DirEntry, walkErr error) error {
		if walkErr != nil || entry == nil {
			return fmt.Errorf("that directory could not be read")
		}
		if entry.IsDir() {
			if path != directory && strings.HasPrefix(entry.Name(), ".") {
				return fs.SkipDir
			}
			return nil
		}
		if !isSourcePath(entry.Name()) {
			return nil
		}
		if entry.Type()&os.ModeSymlink != 0 || !entry.Type().IsRegular() {
			return fmt.Errorf("%s is not a regular source file", entry.Name())
		}
		relative, err := filepath.Rel(directory, path)
		if err != nil {
			return fmt.Errorf("that directory could not be read")
		}
		sources = append(sources, languageSource{path: path, name: filepath.ToSlash(relative)})
		return nil
	})
	if err != nil {
		return nil, err
	}
	sort.Slice(sources, func(i, j int) bool { return sources[i].name < sources[j].name })
	return sources, nil
}

// isSourcePath reports whether a file name is a Rootform Language source:
// native source ends in .rf.hcl and JSON source in .rf.json.
func isSourcePath(name string) bool {
	return strings.HasSuffix(name, ".rf.hcl") || strings.HasSuffix(name, ".rf.json")
}

func replaceFile(path string, content []byte) error {
	info, err := os.Lstat(path)
	if err != nil || !info.Mode().IsRegular() || info.Mode()&os.ModeSymlink != 0 {
		return fmt.Errorf("source is not a regular file")
	}
	temp, err := os.CreateTemp(filepath.Dir(path), ".rootform-format-*")
	if err != nil {
		return err
	}
	name := temp.Name()
	cleanup := func() {
		temp.Close()
		_ = os.Remove(name)
	}
	if _, err := temp.Write(content); err != nil {
		cleanup()
		return err
	}
	if err := temp.Chmod(info.Mode().Perm()); err != nil {
		cleanup()
		return err
	}
	if err := temp.Close(); err != nil {
		_ = os.Remove(name)
		return err
	}
	if err := os.Rename(name, path); err != nil {
		_ = os.Remove(name)
		return err
	}
	return nil
}

// fmtUnifiedDiff renders a unified diff between a source's current content and
// its formatted content, so --diff shows what would change without depending
// on an external diff tool.
func fmtUnifiedDiff(name string, before, after []byte) string {
	edits := fmtEdits(fmtSourceLines(before), fmtSourceLines(after))
	hunks := fmtHunks(edits)
	if len(hunks) == 0 {
		return ""
	}
	var builder strings.Builder
	fmt.Fprintf(&builder, "--- %s\n+++ %s\n", name, name)
	for _, hunk := range hunks {
		fmt.Fprintf(&builder, "@@ -%d,%d +%d,%d @@\n",
			hunk.oldStart, hunk.oldCount, hunk.newStart, hunk.newCount)
		for _, edit := range hunk.edits {
			builder.WriteByte(edit.op)
			builder.WriteString(edit.line)
			builder.WriteByte('\n')
		}
	}
	return builder.String()
}

// fmtEditOp is one line of a diff: kept, removed, or added, in the byte a
// unified diff prints for it.
type fmtEdit struct {
	op   byte
	line string
}

// fmtLCSBudget caps the comparison table. A source larger than this is
// reported as one replaced block rather than left to allocate without bound.
const fmtLCSBudget = 4_000_000

func fmtEdits(oldLines, newLines []string) []fmtEdit {
	prefix := 0
	for prefix < len(oldLines) && prefix < len(newLines) && oldLines[prefix] == newLines[prefix] {
		prefix++
	}
	suffix := 0
	for suffix < len(oldLines)-prefix && suffix < len(newLines)-prefix &&
		oldLines[len(oldLines)-1-suffix] == newLines[len(newLines)-1-suffix] {
		suffix++
	}
	oldMiddle := oldLines[prefix : len(oldLines)-suffix]
	newMiddle := newLines[prefix : len(newLines)-suffix]

	edits := make([]fmtEdit, 0, len(oldLines)+len(newLines))
	for _, line := range oldLines[:prefix] {
		edits = append(edits, fmtEdit{op: ' ', line: line})
	}
	edits = append(edits, fmtMiddleEdits(oldMiddle, newMiddle)...)
	for _, line := range oldLines[len(oldLines)-suffix:] {
		edits = append(edits, fmtEdit{op: ' ', line: line})
	}
	return edits
}

func fmtMiddleEdits(oldLines, newLines []string) []fmtEdit {
	edits := make([]fmtEdit, 0, len(oldLines)+len(newLines))
	if (len(oldLines)+1)*(len(newLines)+1) > fmtLCSBudget {
		for _, line := range oldLines {
			edits = append(edits, fmtEdit{op: '-', line: line})
		}
		for _, line := range newLines {
			edits = append(edits, fmtEdit{op: '+', line: line})
		}
		return edits
	}
	common := fmtCommonLengths(oldLines, newLines)
	oldIndex, newIndex := 0, 0
	for oldIndex < len(oldLines) && newIndex < len(newLines) {
		switch {
		case oldLines[oldIndex] == newLines[newIndex]:
			edits = append(edits, fmtEdit{op: ' ', line: oldLines[oldIndex]})
			oldIndex++
			newIndex++
		case common[oldIndex+1][newIndex] >= common[oldIndex][newIndex+1]:
			edits = append(edits, fmtEdit{op: '-', line: oldLines[oldIndex]})
			oldIndex++
		default:
			edits = append(edits, fmtEdit{op: '+', line: newLines[newIndex]})
			newIndex++
		}
	}
	for ; oldIndex < len(oldLines); oldIndex++ {
		edits = append(edits, fmtEdit{op: '-', line: oldLines[oldIndex]})
	}
	for ; newIndex < len(newLines); newIndex++ {
		edits = append(edits, fmtEdit{op: '+', line: newLines[newIndex]})
	}
	return edits
}

// fmtCommonLengths builds the longest-common-subsequence table both sides are
// walked against, so the rendered diff keeps the lines the formatter left
// alone instead of replacing the whole source.
func fmtCommonLengths(oldLines, newLines []string) [][]int {
	table := make([][]int, len(oldLines)+1)
	for row := range table {
		table[row] = make([]int, len(newLines)+1)
	}
	for row := len(oldLines) - 1; row >= 0; row-- {
		for column := len(newLines) - 1; column >= 0; column-- {
			if oldLines[row] == newLines[column] {
				table[row][column] = table[row+1][column+1] + 1
				continue
			}
			if table[row+1][column] >= table[row][column+1] {
				table[row][column] = table[row+1][column]
				continue
			}
			table[row][column] = table[row][column+1]
		}
	}
	return table
}

// fmtHunkContext is how many unchanged lines frame each change, matching what
// a unified diff conventionally shows.
const fmtHunkContext = 3

type fmtHunk struct {
	oldStart int
	oldCount int
	newStart int
	newCount int
	edits    []fmtEdit
}

func fmtHunks(edits []fmtEdit) []fmtHunk {
	changed := make([]int, 0)
	for index, edit := range edits {
		if edit.op != ' ' {
			changed = append(changed, index)
		}
	}
	if len(changed) == 0 {
		return nil
	}
	oldLine, newLine := make([]int, len(edits)), make([]int, len(edits))
	oldCursor, newCursor := 1, 1
	for index, edit := range edits {
		oldLine[index], newLine[index] = oldCursor, newCursor
		if edit.op != '+' {
			oldCursor++
		}
		if edit.op != '-' {
			newCursor++
		}
	}

	hunks := make([]fmtHunk, 0)
	start := max(changed[0]-fmtHunkContext, 0)
	end := min(changed[0]+fmtHunkContext, len(edits)-1)
	for _, index := range changed[1:] {
		if index-fmtHunkContext > end+1 {
			hunks = append(hunks, fmtHunkAt(edits, oldLine, newLine, start, end))
			start = index - fmtHunkContext
		}
		end = min(index+fmtHunkContext, len(edits)-1)
	}
	return append(hunks, fmtHunkAt(edits, oldLine, newLine, start, end))
}

func fmtHunkAt(edits []fmtEdit, oldLine, newLine []int, start, end int) fmtHunk {
	hunk := fmtHunk{
		oldStart: oldLine[start],
		newStart: newLine[start],
		edits:    edits[start : end+1],
	}
	for _, edit := range hunk.edits {
		if edit.op != '+' {
			hunk.oldCount++
		}
		if edit.op != '-' {
			hunk.newCount++
		}
	}
	return hunk
}

// fmtSourceLines splits source content into lines without a trailing empty
// element for a final newline, so a diff never reports a phantom blank line.
func fmtSourceLines(content []byte) []string {
	text := strings.TrimSuffix(string(content), "\n")
	if text == "" {
		return nil
	}
	return strings.Split(text, "\n")
}
