package app

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"sort"
	"strconv"
	"strings"
	"text/tabwriter"

	"github.com/rootform-dev/rootform/cli/backend"
	cli "github.com/rootform-dev/rootform/cli/internal/command"
	"github.com/rootform-dev/rootform/cli/internal/human"
)

// listService reports what the effective catalog declares: supplied Dialects
// and selected dialects. It reads no infrastructure source and evaluates
// nothing. Origins and content digests come only from the verified release
// set selection; no installed, index, or recommendation evidence is used.
type listService struct {
	stdout  io.Writer
	stderr  io.Writer
	backend backend.Backend
}

// listedDialect reports one effective Dialect and its exact selection
// evidence. The RF Vocabulary is not a Dialect and never appears here.
type listedDialect struct {
	Name          string `json:"name"`
	Version       string `json:"version"`
	Origin        string `json:"origin"`
	ContentDigest string `json:"content_digest"`
	Concepts      int    `json:"concepts"`
	Contexts      int    `json:"contexts"`
	Relations     int    `json:"relations"`
	Rules         int    `json:"rules"`
}

// listedPolicyPack reports one selected Policy Pack: its exact version, its
// canonical source digest, and the policies it declares.
type listedPolicyPack struct {
	Name          string `json:"name"`
	Version       string `json:"version"`
	Policies      int    `json:"policies"`
	ContentDigest string `json:"content_digest"`
}

type listedDeclaration struct {
	ID    string `json:"id"`
	Owner string `json:"owner,omitempty"`
	// Pack names the owning Policy Pack for policy declarations. A policy is
	// never a member of a dialect, so its declaration carries no dialect.
	Pack string `json:"pack,omitempty"`
	Name string `json:"name"`
	// Of names what the declaration is tied to: the concept a policy targets,
	// the concept a rule produces, or the kind a concept belongs to.
	Of string `json:"of"`
}

// installedUnit is one installed version in machine output.
type installedUnit struct {
	Kind           string `json:"kind"`
	Name           string `json:"name"`
	Version        string `json:"version"`
	Repository     string `json:"repository"`
	ManifestDigest string `json:"manifest_digest"`
	ContentDigest  string `json:"content_digest"`
}

func (s listService) List(options cli.ListOptions) (cli.ListOutcome, error) {
	// A listing is rendered whole before it is written, so a long one can open
	// in the pager; JSON goes straight to standard output.
	stdout := s.stdout
	written := &outputWriteTracker{Writer: stdout}
	var listing bytes.Buffer
	if options.Format == cli.FormatJSON {
		s.stdout = human.Redirect(stdout, written)
	} else {
		s.stdout = human.Redirect(stdout, &listing)
	}
	var outcome cli.ListOutcome
	var err error
	switch options.Object {
	case cli.ListPolicyPacks, cli.ListPolicies:
		outcome, err = s.listGovernance(options)
	case cli.ListDialects:
		outcome, err = s.listDialects(options)
	default:
		failuref(s.stderr, "%q is not something rootform can list\n",
			string(options.Object))
		return cli.ListUndecided, nil
	}
	if human.Page(stdout, s.stderr, listing.Bytes()) != nil {
		written.failed = true
	}
	if written.failed && options.Format != cli.FormatJSON {
		human.Failure(s.stderr, "the listing could not be written")
	}
	if written.failed || options.Installed && outcome == cli.ListUndecided {
		return cli.ListFailure, nil
	}
	return outcome, err
}

type outputWriteTracker struct {
	io.Writer
	failed bool
}

func (w *outputWriteTracker) Write(data []byte) (int, error) {
	n, err := w.Writer.Write(data)
	if err != nil || n != len(data) {
		w.failed = true
	}
	if err == nil && n != len(data) {
		err = io.ErrShortWrite
	}
	return n, err
}

func (s listService) listGovernance(options cli.ListOptions) (cli.ListOutcome, error) {
	if options.Installed {
		return s.listInstalled(options)
	}
	ctx := context.Background()
	session := s.backend.Open(ctx, backend.Selection{Project: options.Project}, s.stderr)
	packs, err := session.PolicyDefinitions(ctx, options.PolicyPack)
	if err != nil {
		return s.undecided(err)
	}
	return s.reportPacks(packs, options)
}

func (s listService) listDialects(options cli.ListOptions) (cli.ListOutcome, error) {
	if options.Installed {
		return s.listInstalled(options)
	}
	ctx := context.Background()
	session := s.backend.Open(ctx, backend.Selection{Project: options.Project, Dialects: options.Dialect}, s.stderr)
	definitions, err := session.Definitions(ctx)
	if err != nil {
		return s.undecided(err)
	}
	narrowed, err := selectDialects(definitions.Dialects, options.Names)
	if err != nil {
		human.Failure(s.stderr, err.Error())
		return cli.ListNotFound, nil
	}
	return s.reportDialects(narrowed, options.Format)
}

func (s listService) undecided(err error) (cli.ListOutcome, error) {
	refusal(s.stderr, err)
	if failureKind(err) == backend.Failure {
		return cli.ListFailure, nil
	}
	return cli.ListUndecided, nil
}

// reportDialects writes the effective Dialect catalog in canonical order. The
// default listing carries the dialect name a user types next; the wide and
// JSON forms carry the selection evidence, which only JSON states exactly.
func (s listService) reportDialects(selected []backend.Dialect, format cli.Format) (cli.ListOutcome, error) {
	dialects := make([]listedDialect, 0, len(selected))
	for _, dialect := range selected {
		dialects = append(dialects, listedDialect{
			Name:          dialect.Owner,
			Version:       dialect.Version,
			Origin:        catalogOrigin(dialect.Origin),
			ContentDigest: dialect.ContentDigest,
			Concepts:      len(dialect.Concepts),
			Contexts:      len(dialect.Contexts),
			Relations:     len(dialect.Relations),
			Rules:         len(dialect.Rules),
		})
	}
	sort.SliceStable(dialects, func(i, j int) bool {
		if dialects[i].Name != dialects[j].Name {
			return dialects[i].Name < dialects[j].Name
		}
		return dialects[i].Version < dialects[j].Version
	})
	if format == cli.FormatJSON {
		if !writeJSONList(s.stdout, s.stderr, dialects) {
			return cli.ListFailure, nil
		}
		return cli.ListReported, nil
	}
	if len(dialects) == 0 {
		human.Empty(s.stdout, "Dialects")
		return cli.ListReported, nil
	}
	if format == cli.FormatWide {
		rows := make([][]string, 0, len(dialects))
		for _, entry := range dialects {
			rows = append(rows, []string{entry.Name, entry.Version, entry.Origin,
				strconv.Itoa(entry.Concepts), strconv.Itoa(entry.Contexts),
				strconv.Itoa(entry.Relations), strconv.Itoa(entry.Rules)})
		}
		headers := []string{"NAME", "VERSION", "ORIGIN", "CONCEPTS",
			"CONTEXTS", "RELATIONS", "RULES"}
		alignRight(headers, rows, 3)
		writeTable(s.stdout, headers, rows)
		return cli.ListReported, nil
	}
	for _, entry := range dialects {
		fmt.Fprintln(s.stdout, entry.Name)
	}
	return cli.ListReported, nil
}

// reportPacks reports either the selected Policy Packs or the policies they
// declare, always in canonical order.
func (s listService) reportPacks(
	packs []backend.PolicyPackDefinition,
	options cli.ListOptions,
) (cli.ListOutcome, error) {
	if options.Object == cli.ListPolicyPacks {
		listed := make([]listedPolicyPack, 0, len(packs))
		for _, pack := range packs {
			if pack.ContentDigest == "" {
				return cli.ListUndecided, fmt.Errorf("a Policy Pack digest could not be computed")
			}
			listed = append(listed, listedPolicyPack{
				Name: pack.Name, Version: pack.Version,
				Policies: len(pack.Policies), ContentDigest: pack.ContentDigest,
			})
		}
		sort.SliceStable(listed, func(i, j int) bool {
			if listed[i].Name != listed[j].Name {
				return listed[i].Name < listed[j].Name
			}
			return listed[i].Version < listed[j].Version
		})
		return s.reportPackIdentities(listed, options.Format)
	}
	declarations := make([]listedDeclaration, 0, len(packs))
	for _, pack := range packs {
		for _, declared := range pack.Policies {
			declarations = append(declarations, listedDeclaration{
				ID: declared.ID, Pack: declared.Pack, Name: declared.Name,
				Of: renderPolicyTarget(declared.Target),
			})
		}
	}
	sort.SliceStable(declarations, func(i, j int) bool {
		return declarations[i].ID < declarations[j].ID
	})
	return s.reportPolicies(declarations, options.Format)
}

func (s listService) reportPackIdentities(
	listed []listedPolicyPack,
	format cli.Format,
) (cli.ListOutcome, error) {
	if format == cli.FormatJSON {
		if !writeJSONList(s.stdout, s.stderr, listed) {
			return cli.ListFailure, nil
		}
		return cli.ListReported, nil
	}
	if len(listed) == 0 {
		human.Empty(s.stdout, "Policy Packs")
		return cli.ListReported, nil
	}
	if format == cli.FormatWide {
		rows := make([][]string, 0, len(listed))
		for _, entry := range listed {
			rows = append(rows, []string{entry.Name, entry.Version,
				strconv.Itoa(entry.Policies)})
		}
		headers := []string{"NAME", "VERSION", "POLICIES"}
		alignRight(headers, rows, 2)
		writeTable(s.stdout, headers, rows)
		return cli.ListReported, nil
	}
	for _, entry := range listed {
		fmt.Fprintln(s.stdout, entry.Name)
	}
	return cli.ListReported, nil
}

func (s listService) reportPolicies(
	declarations []listedDeclaration,
	format cli.Format,
) (cli.ListOutcome, error) {
	if format == cli.FormatJSON {
		if !writeJSONList(s.stdout, s.stderr, declarations) {
			return cli.ListFailure, nil
		}
		return cli.ListReported, nil
	}
	if len(declarations) == 0 {
		human.Empty(s.stdout, "Policies")
		return cli.ListReported, nil
	}
	if format == cli.FormatWide {
		rows := make([][]string, 0, len(declarations))
		for _, entry := range declarations {
			rows = append(rows, []string{entry.ID, entry.Of})
		}
		writeTable(s.stdout, []string{"POLICY", "TARGETS"}, rows)
		return cli.ListReported, nil
	}
	for _, entry := range declarations {
		fmt.Fprintln(s.stdout, entry.ID)
	}
	return cli.ListReported, nil
}

// listInstalled reports the verified versions in the Rootform home. It reads
// no project, creates no directory, and uses no network.
func (s listService) listInstalled(options cli.ListOptions) (cli.ListOutcome, error) {
	family, kind, noun := backend.Dialects, "dialect", "installed Dialects"
	if options.Object != cli.ListDialects {
		family, kind, noun = backend.PolicyPacks, "policy-pack", "installed Policy Packs"
	}
	installed, err := s.backend.Home().Installed(context.Background(), family)
	if err != nil {
		return s.undecided(err)
	}
	units := make([]installedUnit, 0, len(installed))
	for _, unit := range installed {
		units = append(units, installedUnit{Kind: kind, Name: unit.Name, Version: unit.Version,
			Repository: unit.Repository, ManifestDigest: unit.ManifestDigest,
			ContentDigest: unit.ContentDigest})
	}
	switch {
	case options.Format == cli.FormatJSON:
		if !writeJSONList(s.stdout, s.stderr, units) {
			return cli.ListUndecided, nil
		}
	case len(units) == 0:
		human.Empty(s.stdout, noun)
	case options.Format == cli.FormatWide:
		rows := make([][]string, 0, len(units))
		for _, unit := range units {
			rows = append(rows, []string{unit.Name, unit.Version, unit.Repository, unit.ManifestDigest, unit.ContentDigest})
		}
		writeTable(s.stdout, []string{"NAME", "VERSION", "REPOSITORY", "MANIFEST", "CONTENT"}, rows)
	default:
		rows := make([][]string, 0, len(units))
		for _, unit := range units {
			rows = append(rows, []string{unit.Name + "@" + unit.Version, unit.Repository + "@" + unit.ManifestDigest})
		}
		writeTable(s.stdout, []string{"INSTALLED", "FROM"}, rows)
	}
	return cli.ListReported, nil
}

// writeTable aligns one row per definition with padding alone, so a listing
// stays readable and greppable without terminal styling.
func writeTable(out io.Writer, headers []string, rows [][]string) {
	writer := tabwriter.NewWriter(out, 0, 0, 2, 32, 0)
	fmt.Fprintln(writer, strings.Join(headers, "\t"))
	for _, row := range rows {
		fmt.Fprintln(writer, strings.Join(row, "\t"))
	}
	writer.Flush()
}

// alignRight pads a counted column so its values line up under the right
// edge of the heading. A tab writer aligns every column the same way, so the
// padding is applied before it sees the row.
func alignRight(headers []string, rows [][]string, from int) {
	for column := from; column < len(headers); column++ {
		width := len(headers[column])
		for _, row := range rows {
			if len(row[column]) > width {
				width = len(row[column])
			}
		}
		headers[column] = pad(headers[column], width)
		for _, row := range rows {
			row[column] = pad(row[column], width)
		}
	}
}

func pad(value string, width int) string {
	return strings.Repeat(" ", width-len(value)) + value
}

// selectDialects narrows the loaded set by name. A name that no loaded source
// declares is refused rather than dropped: a mistyped filter must not read as
// an empty but successful listing.
func selectDialects(dialects []backend.Dialect, selection []string) ([]backend.Dialect, error) {
	if len(selection) == 0 {
		return dialects, nil
	}
	available := make([]string, 0, len(dialects))
	byName := map[string]struct{}{}
	for _, dialect := range dialects {
		available = append(available, dialect.Owner)
		byName[dialect.Owner] = struct{}{}
	}
	sort.Strings(available)

	wanted := make(map[string]struct{}, len(selection))
	var unknown []string
	for _, name := range selection {
		if _, ok := byName[name]; !ok {
			unknown = append(unknown, name)
			continue
		}
		wanted[name] = struct{}{}
	}
	if len(unknown) != 0 {
		sort.Strings(unknown)
		return nil, fmt.Errorf("no dialect named %s is loaded\n\nExpected one of:\n%s\n\nTry:\n  rootform list dialects",
			strings.Join(quoteAll(unknown), ", "), indentedList(available))
	}
	narrowed := make([]backend.Dialect, 0, len(wanted))
	for _, dialect := range dialects {
		if _, ok := wanted[dialect.Owner]; ok {
			narrowed = append(narrowed, dialect)
		}
	}
	return narrowed, nil
}

func writeJSONList[Entry listedDialect | listedDeclaration | listedPolicyPack | installedUnit](
	stdout, stderr io.Writer, entries []Entry,
) bool {
	// A nil slice would encode as null, which a consumer cannot iterate.
	if entries == nil {
		entries = []Entry{}
	}
	encoded, err := json.MarshalIndent(entries, "", "  ")
	if err != nil {
		human.Failure(stderr, "the listing could not be written")
		return false
	}
	if _, err := stdout.Write(append(encoded, 10)); err != nil {
		human.Failure(stderr, "the listing could not be written")
		return false
	}
	return true
}
