package app

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"path/filepath"
	"strings"

	"github.com/rootform-dev/rootform/cli/backend"
	cli "github.com/rootform-dev/rootform/cli/internal/command"
	"github.com/rootform-dev/rootform/cli/internal/human"
)

// lockName is the file that records a project's selection.
const lockName = "rootform.lock"

// usageRefusal is a request the command line refuses as used incorrectly.
type usageRefusal struct{ message string }

func (e usageRefusal) Error() string    { return e.message }
func (e usageRefusal) UsageError() bool { return true }

// commandFailure states a backend failure in the terms of the command exit
// contract. A failure outside the backend contract stops the command.
func commandFailure(err error) error {
	var failure *backend.Error
	if !errors.As(err, &failure) {
		return err
	}
	if failure.Code != "" && failure.Human != "" {
		exit := cli.ExitFailure
		switch failure.Kind {
		case backend.Usage:
			exit = cli.ExitUsage
		case backend.Negative:
			exit = cli.ExitNegative
		case backend.NoAnswer:
			exit = cli.ExitNoAnswer
		}
		return technicalError(exit, failure.Code, failure.Message, failure.Human, failure.Detail)
	}
	switch failure.Kind {
	case backend.Usage:
		return usageRefusal{message: failure.Message}
	case backend.Negative:
		return cli.NegativeError{Message: failure.Message}
	case backend.NoAnswer:
		return noAnswerError{message: failure.Message}
	default:
		return errors.New(failure.Message)
	}
}

// refusal states why a project could not be prepared or vendored, and
// returns the class of the failure.
func refusal(stderr io.Writer, err error) backend.Kind {
	var failure *backend.Error
	if errors.As(err, &failure) {
		if failure.Code != "" && failure.Human != "" {
			cli.WriteTechnicalError(stderr, failure.Human, failure.Detail, failure.Code)
		} else {
			human.Failure(stderr, failureStatement(err))
		}
		return failure.Kind
	}
	human.Failure(stderr, failureStatement(err))
	return backend.Failure
}

// projectPath names a path of the selected project as the working directory
// reaches it, so a run with --project never prints a path relative to another
// directory.
func projectPath(project, name string) string {
	if project == "" {
		return filepath.FromSlash(name)
	}
	return filepath.Join(project, filepath.FromSlash(name))
}

func formatBytes(size int64) string {
	if size < 1024 {
		return fmt.Sprintf("%d B", size)
	}
	if size < 1024*1024 {
		return fmt.Sprintf("%.1f KiB", float64(size)/1024)
	}
	return fmt.Sprintf("%.1f MiB", float64(size)/(1024*1024))
}

// initService prepares one project's exact locked selection. It never
// detects providers, resolves versions, prompts or writes rootform.lock.
type initService struct {
	stdout  io.Writer
	stderr  io.Writer
	backend backend.Backend
}

// preparationReport is the machine report of one preparation.
type preparationReport struct {
	FormatVersion   string         `json:"format_version"`
	Prepared        bool           `json:"prepared"`
	Dialects        []preparedUnit `json:"dialects,omitempty"`
	PolicyPacks     []preparedUnit `json:"policy_packs,omitempty"`
	DownloadedBytes int64          `json:"downloaded_bytes,omitempty"`
}

type preparedUnit struct {
	Kind    string `json:"kind"`
	Name    string `json:"name"`
	Version string `json:"version"`
	Source  string `json:"source"`
	Status  string `json:"status"`
}

func preparedUnits(kind string, versions []backend.PreparedVersion) []preparedUnit {
	units := make([]preparedUnit, 0, len(versions))
	for _, version := range versions {
		units = append(units, preparedUnit{Kind: kind, Name: version.Name, Version: version.Version,
			Source: version.Source, Status: string(version.Status)})
	}
	return units
}

func (s initService) Init(options cli.InitOptions) (cli.InitOutcome, error) {
	prepared, err := s.backend.Projects().Prepare(context.Background(), backend.Preparation{
		Project: options.Path, Locked: options.Locked, Offline: options.Offline,
	})
	if err != nil {
		switch refusal(s.stderr, err) {
		case backend.Negative:
			return cli.InitInvalid, nil
		case backend.NoAnswer:
			return cli.InitNoAnswer, nil
		default:
			return cli.InitFailure, nil
		}
	}
	if options.Format == cli.FormatJSON {
		encoded, err := json.MarshalIndent(preparationReport{
			FormatVersion: "1", Prepared: true,
			Dialects:        preparedUnits("dialect", prepared.Dialects),
			PolicyPacks:     preparedUnits("policy-pack", prepared.PolicyPacks),
			DownloadedBytes: prepared.Downloaded,
		}, "", "  ")
		if err != nil {
			return cli.InitFailure, errors.New("initialization result could not be encoded")
		}
		if _, err := fmt.Fprintf(s.stdout, "%s\n", encoded); err != nil {
			return cli.InitFailure, errors.New("initialization result could not be written")
		}
	} else {
		s.writeResult(prepared, options.Details)
	}
	return cli.InitCompleted, nil
}

// writeResult renders a deterministic text summary. Details adds one line per
// unit without changing status or behavior.
func (s initService) writeResult(prepared backend.Prepared, details bool) {
	if len(prepared.Dialects) == 0 && len(prepared.PolicyPacks) == 0 {
		human.Verdict(s.stdout, "Project ready", human.Good)
		fmt.Fprintln(s.stdout)
		human.Summary(s.stdout, [2]string{"External content", "none"})
		return
	}
	human.Verdict(s.stdout, "Project prepared", human.Good)
	fmt.Fprintln(s.stdout)
	rows := [][2]string{
		{"External Dialects", fmt.Sprint(len(prepared.Dialects))},
		{"External Policy Packs", fmt.Sprint(len(prepared.PolicyPacks))},
	}
	if prepared.Downloaded != 0 {
		rows = append(rows, [2]string{"Downloaded", formatBytes(prepared.Downloaded)})
	}
	human.Summary(s.stdout, rows...)
	if details {
		human.Section(s.stderr, "Prepared content")
		for _, unit := range prepared.Dialects {
			fmt.Fprintf(s.stderr, "  Dialect %s@%s\n", unit.Name, unit.Version)
			human.Summary(s.stderr, [2]string{"    Status", string(unit.Status)}, [2]string{"    Source", unit.Source})
		}
		for _, unit := range prepared.PolicyPacks {
			fmt.Fprintf(s.stderr, "  Policy Pack %s@%s\n", unit.Name, unit.Version)
			human.Summary(s.stderr, [2]string{"    Status", string(unit.Status)}, [2]string{"    Source", unit.Source})
		}
	}
}

// vendorService copies exactly the locked Dialects or Policy Pack sources
// into a project. It never resolves a version or changes rootform.lock.
type vendorService struct {
	stdout  io.Writer
	stderr  io.Writer
	backend backend.Backend
}

func (s vendorService) Vendor(options cli.VendorOptions) (cli.VendorOutcome, error) {
	if options.Object == "" {
		return s.vendorAll(options)
	}
	return s.vendorFamily(options)
}

// vendorAll copies every family rootform.lock selects. A lock that selects
// nothing is refused, like a family vendor run with nothing to copy.
func (s vendorService) vendorAll(options cli.VendorOptions) (cli.VendorOutcome, error) {
	families, err := s.backend.Projects().Selected(context.Background(), options.Project)
	if err != nil {
		return s.refuse(err)
	}
	if len(families) == 0 {
		human.Failure(s.stderr, "rootform.lock selects no content to vendor")
		return cli.VendorNoAnswer, nil
	}
	for index, family := range families {
		if index != 0 {
			fmt.Fprintln(s.stdout)
		}
		options.Object = cli.DistributionObject(family)
		outcome, err := s.vendorFamily(options)
		if err != nil || outcome != cli.VendorCopied {
			return outcome, err
		}
	}
	return cli.VendorCopied, nil
}

func (s vendorService) vendorFamily(options cli.VendorOptions) (cli.VendorOutcome, error) {
	vendored, err := s.backend.Projects().Vendor(context.Background(), backend.Vendoring{
		Project: options.Project, Family: backend.Family(options.Object),
		Destination: options.Destination, Offline: options.Offline,
	})
	if err != nil {
		return s.refuse(err)
	}
	title := "External Dialects vendored"
	itemTitle := "Dialects"
	if options.Object == cli.DistributionPolicyPacks {
		title = "External Policy Packs vendored"
		itemTitle = "Policy Packs"
	}
	human.Verdict(s.stdout, title, human.Good)
	fmt.Fprintln(s.stdout)
	rows := [][2]string{
		{"Destination", vendored.Directory},
		{itemTitle, fmt.Sprint(len(vendored.Versions))},
	}
	if options.Offline {
		rows = append(rows, [2]string{"Mode", "offline"})
	}
	human.Summary(s.stdout, rows...)
	human.Section(s.stdout, fmt.Sprintf("%s (%d)", itemTitle, len(vendored.Versions)))
	for _, unit := range vendored.Versions {
		fmt.Fprintf(s.stdout, "  %s@%s\n", unit.Name, unit.Version)
		if unit.Source != "" {
			human.Summary(s.stdout, [2]string{"    Source", unit.Source})
		}
	}
	return cli.VendorCopied, nil
}

func (s vendorService) refuse(err error) (cli.VendorOutcome, error) {
	switch refusal(s.stderr, err) {
	case backend.Negative:
		return cli.VendorInvalid, nil
	case backend.NoAnswer:
		return cli.VendorNoAnswer, nil
	default:
		return cli.VendorFailure, nil
	}
}

// selectionService changes rootform.lock through the backend, its only
// writer, and reports the change.
type selectionService struct {
	stdout  io.Writer
	stderr  io.Writer
	backend backend.Backend
}

// selectionReport is the machine report of one add, remove or update.
type selectionReport struct {
	FormatVersion string          `json:"format_version"`
	Command       string          `json:"command"`
	Object        string          `json:"object"`
	DryRun        bool            `json:"dry_run"`
	Changed       bool            `json:"changed"`
	LockWritten   bool            `json:"lock_written"`
	Vendored      []string        `json:"vendored"`
	Changes       []selectionEdit `json:"changes"`
	Notices       []string        `json:"notices"`
	Warnings      []string        `json:"warnings"`
}

// selectionEdit is one selection change in machine output.
type selectionEdit struct {
	Action   string `json:"action"`
	Kind     string `json:"kind"`
	Name     string `json:"name"`
	Version  string `json:"version,omitempty"`
	Previous string `json:"previous_version,omitempty"`
	Source   string `json:"source,omitempty"`
	Replaces bool   `json:"replaces_embedded,omitempty"`
}

func (s selectionService) Mutate(options cli.SelectionOptions) error {
	changed, err := s.backend.Projects().Change(context.Background(), backend.Change{
		Verb: string(options.Verb), Family: backend.Family(options.Object), Operands: options.Operands,
		Project: options.Project, Replace: options.Replace, Embedded: options.Embedded,
		Offline: options.Offline, OfflineFromEnvironment: options.OfflineFromEnv, DryRun: options.DryRun,
	}, s.stderr)
	if err != nil {
		return commandFailure(err)
	}
	report := selectionReport{
		FormatVersion: "1", Command: string(options.Verb), Object: string(options.Object),
		DryRun: options.DryRun, Changed: changed.Modified, LockWritten: changed.LockWritten,
		Vendored: make([]string, 0, len(changed.Vendored)), Changes: make([]selectionEdit, 0, len(changed.Edits)),
		Notices: append([]string{}, changed.Notices...), Warnings: append([]string{}, changed.Warnings...),
	}
	for _, family := range changed.Vendored {
		report.Vendored = append(report.Vendored, string(family))
	}
	for _, edit := range changed.Edits {
		report.Changes = append(report.Changes, selectionEdit{
			Action: edit.Action, Kind: edit.Kind, Name: edit.Name, Version: edit.Version,
			Previous: edit.Previous, Source: edit.Source, Replaces: edit.ReplacesEmbedded,
		})
	}
	return s.write(report, options)
}

func (s selectionService) write(report selectionReport, options cli.SelectionOptions) error {
	for _, warning := range report.Warnings {
		fmt.Fprintln(s.stderr, "rootform: warning: "+warning)
	}
	if options.Format == cli.FormatJSON {
		encoded, err := json.MarshalIndent(report, "", "  ")
		if err != nil {
			return errors.New("the result could not be encoded")
		}
		_, err = fmt.Fprintf(s.stdout, "%s\n", encoded)
		return err
	}
	switch {
	case !report.Changed:
		human.Result(s.stdout, projectPath(options.Project, lockName)+" already matches; nothing changed")
		return nil
	case report.DryRun:
		human.Verdict(s.stdout, "Planned changes to "+projectPath(options.Project, lockName)+" (nothing written)", human.Neutral)
	default:
		human.Verdict(s.stdout, projectPath(options.Project, lockName)+" updated", human.Good)
	}
	fmt.Fprintln(s.stdout)
	for _, change := range report.Changes {
		fmt.Fprintf(s.stdout, "  %-8s %s\n", change.Action, describeChange(change))
	}
	if len(report.Vendored) != 0 {
		verb := "Vendored"
		if report.DryRun {
			verb = "Would vendor"
		}
		vendored := make([]string, 0, len(report.Vendored))
		for _, family := range report.Vendored {
			vendored = append(vendored, projectPath(options.Project, ".rootform/"+family))
		}
		fmt.Fprintf(s.stdout, "\n%s again: %s\n", verb, strings.Join(vendored, ", "))
	}
	for _, notice := range report.Notices {
		fmt.Fprintf(s.stdout, "\nNote: %s\n", notice)
	}
	return nil
}

func describeChange(change selectionEdit) string {
	kind := "Dialect"
	if change.Kind == "policy-pack" {
		kind = "Policy Pack"
	}
	text := kind + " " + change.Name
	switch {
	case change.Previous != "" && change.Previous != change.Version:
		text += " " + change.Previous + " -> " + change.Version
	case change.Version != "":
		text += " " + change.Version
	}
	if change.Source != "" && change.Source != "embedded" {
		text += "  (" + change.Source + ")"
	}
	if change.Source == "embedded" {
		text += "  (embedded)"
	}
	return text
}

// storeService installs and deletes content in the Rootform home. It never
// reads or writes a project.
type storeService struct {
	stdout  io.Writer
	stderr  io.Writer
	backend backend.Backend
}

type storeReport struct {
	FormatVersion string          `json:"format_version"`
	Command       string          `json:"command"`
	Units         []installedUnit `json:"units"`
}

func (s storeService) Install(options cli.InstallOptions) error {
	units, err := s.backend.Home().Install(context.Background(), backend.Installation{
		Family: backend.Family(options.Object), References: options.References, Offline: options.Offline,
	})
	if err != nil {
		return commandFailure(err)
	}
	return s.write(storeReportOf("install", options.Object, units), options.Format, "Installed", "Nothing installed")
}

func (s storeService) Uninstall(options cli.UninstallOptions) error {
	units, err := s.backend.Home().Uninstall(context.Background(), backend.Family(options.Object), options.Units)
	if err != nil {
		return commandFailure(err)
	}
	return s.write(storeReportOf("uninstall", options.Object, units), options.Format, "Uninstalled", "Nothing uninstalled")
}

func storeReportOf(command string, object cli.DistributionObject, units []backend.Unit) storeReport {
	kind := "dialect"
	if object == cli.DistributionPolicyPacks {
		kind = "policy-pack"
	}
	report := storeReport{FormatVersion: "1", Command: command, Units: make([]installedUnit, 0, len(units))}
	for _, unit := range units {
		report.Units = append(report.Units, installedUnit{Kind: kind, Name: unit.Name, Version: unit.Version,
			Repository: unit.Repository, ManifestDigest: unit.ManifestDigest, ContentDigest: unit.ContentDigest})
	}
	return report
}

func (s storeService) write(report storeReport, format cli.Format, verb, empty string) error {
	if format == cli.FormatJSON {
		encoded, err := json.MarshalIndent(report, "", "  ")
		if err != nil {
			return errors.New("the result could not be encoded")
		}
		_, err = fmt.Fprintf(s.stdout, "%s\n", encoded)
		return err
	}
	if len(report.Units) == 0 {
		human.Result(s.stdout, empty)
		return nil
	}
	human.Verdict(s.stdout, verb, human.Good)
	fmt.Fprintln(s.stdout)
	for _, unit := range report.Units {
		fmt.Fprintf(s.stdout, "  %s %s  (%s)\n", unit.Name, unit.Version, unit.Repository)
	}
	return nil
}
