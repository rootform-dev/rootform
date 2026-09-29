package app

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"os/signal"
	"strconv"

	"github.com/rootform-dev/rootform/cli/backend"
	"github.com/rootform-dev/rootform/cli/form"
	cli "github.com/rootform-dev/rootform/cli/internal/command"
	"github.com/rootform-dev/rootform/cli/internal/document"
	"github.com/rootform-dev/rootform/cli/internal/human"
)

// compileService materializes one immutable, evaluation-ready Policy Pack.
// Linking happens once against the semantic snapshot of an explicit Rootform
// document; replay reads the resulting pins and never refreshes them
// from another document.
type compileService struct {
	stdout  io.Writer
	stderr  io.Writer
	backend backend.Backend
}

func (s compileService) CompilePolicyPack(options cli.CompileOptions) error {
	info, err := os.Stat(options.Source)
	if err != nil || !info.IsDir() {
		return errors.New("the Policy Pack source must be a readable directory")
	}
	semanticInfo, err := os.Stat(options.Semantics)
	if err != nil || !semanticInfo.Mode().IsRegular() {
		return errors.New("the --semantics file must be a readable Form")
	}
	data, err := document.ReadFile("the --semantics file", options.Semantics)
	if errors.Is(err, document.ErrTooLarge) {
		return cli.NegativeError{Message: err.Error()}
	}
	if err != nil {
		return errors.New("the --semantics file must be a readable Form")
	}
	decoded, err := form.Decode(data)
	if err != nil || decoded.Input == nil {
		return cli.NegativeError{Message: "the --semantics file must be a valid state or plan Form"}
	}
	compiled, err := s.backend.Authoring().PolicyPack(context.Background(), options.Source, decoded.Input.Semantics, s.stderr)
	if err != nil {
		return commandFailure(err)
	}
	sink, err := openDestination(options.Output, io.Discard)
	if err != nil {
		return err
	}
	defer sink.Abort()
	if _, err := sink.Write(append(compiled.Content, '\n')); err != nil {
		return errors.New("the compiled Policy Pack could not be written")
	}
	if err := sink.Commit(); err != nil {
		return err
	}
	human.Verdict(s.stdout, "Policy Pack compiled", human.Good)
	fmt.Fprintln(s.stdout)
	human.Summary(s.stdout,
		[2]string{"Policy Pack", compiled.Name + "@" + compiled.Version},
		[2]string{"Form", options.Semantics},
		[2]string{"Semantic pins", strconv.Itoa(compiled.Pins)},
		[2]string{"Digest", compiled.Digest},
		[2]string{"Destination", options.Output},
	)
	return nil
}

// distributed names the family a package or publish command distributes, in
// the plural a summary counts it with and the singular a line names one
// version with.
func distributed(object cli.DistributionObject) (family backend.Family, plural, singular string) {
	if object == cli.DistributionPolicyPacks {
		return backend.PolicyPacks, "Policy Packs", "Policy Pack"
	}
	return backend.Dialects, "Dialects", "Dialect"
}

// packageService writes the registry layout of a source set and reports the
// versions it holds.
type packageService struct {
	stdout  io.Writer
	stderr  io.Writer
	backend backend.Backend
}

func (s packageService) Package(options cli.PackageOptions) (cli.PackageOutcome, error) {
	family, plural, _ := distributed(options.Object)
	packaged, err := s.backend.Authoring().Package(context.Background(), backend.Packaging{
		Family: family, Source: options.Source, Destination: options.Destination,
		Provenance: backend.Provenance{
			Source: options.ProvenanceSource, Revision: options.ProvenanceRevision,
			Documentation: options.ProvenanceDocs, Licenses: options.ProvenanceLicenses,
		},
	})
	if err != nil {
		if refusal(s.stderr, err) == backend.Negative {
			return cli.PackageInvalid, nil
		}
		return cli.PackageFailure, nil
	}
	writePackagedText(s.stdout, plural, options.Destination, packaged)
	return cli.PackageWritten, nil
}

func writePackagedText(out io.Writer, plural, destination string, packaged []backend.Packaged) {
	human.Verdict(out, plural+" packaged", human.Good)
	fmt.Fprintln(out)
	human.Summary(out,
		[2]string{"Destination", destination},
		[2]string{plural, fmt.Sprint(len(packaged))},
	)
	human.Section(out, fmt.Sprintf("%s (%d)", plural, len(packaged)))
	for _, version := range packaged {
		fmt.Fprintf(out, "  %s@%s\n", version.Name, version.Version)
		human.Summary(out,
			[2]string{"    Digest", version.Digest},
			[2]string{"    Size", formatBytes(version.Size)},
		)
	}
}

// publishService publishes a registry layout, or plans its publication, and
// reports each version in text or JSON.
type publishService struct {
	stdout  io.Writer
	stderr  io.Writer
	backend backend.Backend
}

func (s publishService) Publish(options cli.PublishOptions) (cli.PublishOutcome, error) {
	family, _, singular := distributed(options.Object)
	published, err := s.backend.Authoring().Publish(context.Background(), backend.Publication{
		Family: family, Layout: options.Layout, Repository: options.Repository, DryRun: options.DryRun,
	})
	if err != nil {
		return s.failure(err)
	}
	if options.Format == cli.FormatJSON {
		encoded, err := json.MarshalIndent(publicationReport(family, published), "", "  ")
		if err != nil {
			return cli.PublishUndecided, errors.New("publication result could not be encoded")
		}
		if _, err := fmt.Fprintf(s.stdout, "%s\n", encoded); err != nil {
			return cli.PublishUndecided, errors.New("publication result could not be written")
		}
		return cli.PublishCompleted, nil
	}
	writePublishedText(s.stdout, singular, published)
	return cli.PublishCompleted, nil
}

// failure refuses an invalid repository as incorrect usage, and otherwise
// states why the publication failed.
func (s publishService) failure(err error) (cli.PublishOutcome, error) {
	var failure *backend.Error
	if errors.As(err, &failure) && failure.Kind == backend.Usage {
		return cli.PublishUndecided, usageRefusal{message: failure.Message}
	}
	if refusal(s.stderr, err) == backend.Negative {
		return cli.PublishInvalid, nil
	}
	return cli.PublishFailure, nil
}

func writePublishedText(output io.Writer, singular string, published backend.Published) {
	for _, version := range published.Versions {
		action := "Published"
		switch {
		case published.DryRun:
			action = "Would publish"
		case version.Status == "already_present":
			action = "Verified existing"
		}
		fmt.Fprintf(output, "%s %s %s@%s\n", action, singular, version.Name, version.Version)
		human.Summary(output, [2]string{"  Registry", version.Repository}, [2]string{"  Digest", version.ManifestDigest}, [2]string{"  Size", formatBytes(version.Size)})
	}
	if !published.DryRun || len(published.Versions) == 0 {
		return
	}
	provenance := published.Versions[0].Provenance
	rows := make([][2]string, 0, 4)
	for _, row := range [][2]string{
		{"source", provenance.Source},
		{"revision", provenance.Revision},
		{"documentation", provenance.Documentation},
		{"licenses", provenance.Licenses},
	} {
		if row[1] != "" {
			rows = append(rows, row)
		}
	}
	if len(rows) != 0 {
		human.Section(output, "Provenance")
		human.Summary(output, rows...)
	}
}

// dialectPublication and policyPackPublication are the machine reports of a
// publication.
type dialectPublication struct {
	FormatVersion string             `json:"format_version"`
	DryRun        bool               `json:"dry_run"`
	Repository    string             `json:"repository"`
	Dialects      []publishedDialect `json:"dialects"`
}

type publishedDialect struct {
	Owner          string                `json:"owner"`
	Version        string                `json:"version"`
	Repository     string                `json:"repository"`
	Tag            string                `json:"tag"`
	ManifestDigest string                `json:"manifest_digest"`
	ManifestSize   int64                 `json:"manifest_size"`
	Size           int64                 `json:"size"`
	Status         string                `json:"status"`
	Provenance     publicationProvenance `json:"provenance"`
}

type policyPackPublication struct {
	FormatVersion string                `json:"format_version"`
	DryRun        bool                  `json:"dry_run"`
	Repository    string                `json:"repository"`
	PolicyPacks   []publishedPolicyPack `json:"policy_packs"`
}

type publishedPolicyPack struct {
	Name           string                `json:"name"`
	Version        string                `json:"version"`
	Repository     string                `json:"repository"`
	Tag            string                `json:"tag"`
	ManifestDigest string                `json:"manifest_digest"`
	ManifestSize   int64                 `json:"manifest_size"`
	Size           int64                 `json:"size"`
	Status         string                `json:"status"`
	Provenance     publicationProvenance `json:"provenance"`
}

type publicationProvenance struct {
	Source        string `json:"source,omitempty"`
	Revision      string `json:"revision,omitempty"`
	Documentation string `json:"documentation,omitempty"`
	Licenses      string `json:"licenses,omitempty"`
}

// publicationReport is the machine report of one publication of family.
func publicationReport(family backend.Family, published backend.Published) any {
	if family == backend.PolicyPacks {
		report := policyPackPublication{FormatVersion: published.FormatVersion, DryRun: published.DryRun, Repository: published.Repository}
		if published.Versions != nil {
			report.PolicyPacks = make([]publishedPolicyPack, 0, len(published.Versions))
		}
		for _, version := range published.Versions {
			report.PolicyPacks = append(report.PolicyPacks, publishedPolicyPack{
				Name: version.Name, Version: version.Version, Repository: version.Repository, Tag: version.Tag,
				ManifestDigest: version.ManifestDigest, ManifestSize: version.ManifestSize, Size: version.Size,
				Status: version.Status, Provenance: publicationProvenance(version.Provenance),
			})
		}
		return report
	}
	report := dialectPublication{FormatVersion: published.FormatVersion, DryRun: published.DryRun, Repository: published.Repository}
	if published.Versions != nil {
		report.Dialects = make([]publishedDialect, 0, len(published.Versions))
	}
	for _, version := range published.Versions {
		report.Dialects = append(report.Dialects, publishedDialect{
			Owner: version.Name, Version: version.Version, Repository: version.Repository, Tag: version.Tag,
			ManifestDigest: version.ManifestDigest, ManifestSize: version.ManifestSize, Size: version.Size,
			Status: version.Status, Provenance: publicationProvenance(version.Provenance),
		})
	}
	return report
}

// languageServerService serves the language server over standard input and
// the unstyled standard output: protocol frames are its only output. An
// interrupt ends it cleanly.
type languageServerService struct {
	input   io.ReadCloser
	output  io.Writer
	backend backend.Backend
}

func (s languageServerService) Run() error {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt)
	defer stop()
	return s.backend.Authoring().ServeLanguage(ctx, s.input, s.output)
}
