package command

import (
	"errors"

	"github.com/spf13/cobra"
)

type DistributionObject string

const (
	DistributionDialects    DistributionObject = "dialects"
	DistributionPolicyPacks DistributionObject = "policy-packs"
)

type PackageOptions struct {
	Object             DistributionObject
	Source             string
	Destination        string
	ProvenanceSource   string
	ProvenanceRevision string
	ProvenanceDocs     string
	ProvenanceLicenses string
}

type PackageOutcome int

const (
	PackageUndecided PackageOutcome = iota
	PackageWritten
	PackageInvalid
	PackageFailure
)

type PackageService interface {
	Package(PackageOptions) (PackageOutcome, error)
}

func newPackageCommand(env *Env) *cobra.Command {
	command := &cobra.Command{
		Use:   "package <object>",
		Short: "Package Rootform content for distribution",
		Long:  "Build deterministic local registry layouts from validated Rootform packages.\n\nExit status:\n  0  help was shown\n  2  the command was used incorrectly",
		Example: "  rootform package dialects ./dialects --to ./artifacts/dialects\n" +
			"  rootform package policy-packs ./policies --to ./artifacts/policies",
		Args:          objectRequired("package", "dialects", "policy-packs"),
		RunE:          func(cmd *cobra.Command, args []string) error { return cmd.Help() },
		SilenceErrors: true,
		SilenceUsage:  true,
	}
	command.AddCommand(newPackageDialectsCommand(env), newPackagePolicyPacksCommand(env))
	return command
}

func newPackageDialectsCommand(env *Env) *cobra.Command {
	options := &PackageOptions{}
	command := &cobra.Command{
		Use:   "dialects <directory>",
		Short: "Build Dialect packages",
		Long: "Compile an external Dialect source set and write one deterministic,\n" +
			"local-only registry layout of exact Dialect packages. Dialects embedded\n" +
			"in Rootform are never packaged. Nothing is sent to a registry.\n\n" +
			"The summary goes to standard output. Diagnostics go to standard error.\n\n" +
			"Exit status:\n" +
			"  0  the registry layout was written\n" +
			"  1  the Dialect source is invalid\n" +
			"  2  the command was used incorrectly\n" +
			"  4  a source could not be read or the layout could not be written",
		Example: "  rootform package dialects ./dialects --to ./artifacts/oci\n" +
			"  rootform package dialects . --to ./artifacts/oci\n" +
			"  rootform package dialects ./own --to ./oci --licenses MPL-2.0",
		Args: exactlyOne("package dialects", "directory"),
		RunE: func(cmd *cobra.Command, args []string) error {
			options.Object = DistributionDialects
			options.Source = args[0]
			if options.Destination == "" {
				return usageError{msg: "package dialects needs an output directory\n\nUsage:\n  rootform package dialects <directory> --to <directory>"}
			}
			if env.Package == nil {
				return errors.New("package service is not configured")
			}
			outcome, err := env.Package.Package(*options)
			if err != nil {
				return serviceFailure(err)
			}
			return packageOutcomeExit(outcome)
		},
		SilenceErrors: true,
		SilenceUsage:  true,
	}
	command.Flags().StringVar(&options.Destination, "to", "", "write the registry layout to `directory`")
	command.Flags().StringVar(&options.ProvenanceSource, "source-url", "",
		"record the canonical source `url` in OCI provenance")
	command.Flags().StringVar(&options.ProvenanceRevision, "revision", "",
		"record the source-control `revision` in OCI provenance")
	command.Flags().StringVar(&options.ProvenanceDocs, "documentation-url", "",
		"record the documentation `url` in OCI provenance")
	command.Flags().StringVar(&options.ProvenanceLicenses, "licenses", "",
		"record the SPDX license `expression` in OCI provenance")
	return command
}

func newPackagePolicyPacksCommand(env *Env) *cobra.Command {
	options := &PackageOptions{}
	command := &cobra.Command{
		Use:   "policy-packs <directory>",
		Short: "Build Policy Pack packages",
		Long: "Compile a Policy Pack source set and write one deterministic, local-only\n" +
			"registry layout of exact Policy Pack packages. Nothing is sent to a\n" +
			"registry.\n\n" +
			"The summary goes to standard output. Diagnostics go to standard error.\n\n" +
			"Exit status:\n" +
			"  0  the registry layout was written\n" +
			"  1  the Policy Pack source is invalid\n" +
			"  2  the command was used incorrectly\n" +
			"  4  a source could not be read or the layout could not be written",
		Example: "  rootform package policy-packs ./policies --to ./artifacts/policies\n" +
			"  rootform package policy-packs ./baseline --to ./baseline-oci\n" +
			"  rootform package policy-packs . --to ./oci",
		Args: exactlyOne("package policy-packs", "directory"),
		RunE: func(cmd *cobra.Command, args []string) error {
			options.Object = DistributionPolicyPacks
			options.Source = args[0]
			if options.Destination == "" {
				return usageError{msg: "package policy-packs needs an output directory\n\nUsage:\n  rootform package policy-packs <directory> --to <directory>"}
			}
			if env.Package == nil {
				return errors.New("package service is not configured")
			}
			outcome, err := env.Package.Package(*options)
			if err != nil {
				return serviceFailure(err)
			}
			return packageOutcomeExit(outcome)
		},
		SilenceErrors: true,
		SilenceUsage:  true,
	}
	command.Flags().StringVar(&options.Destination, "to", "", "write the registry layout to `directory`")
	command.Flags().StringVar(&options.ProvenanceSource, "source-url", "",
		"record the canonical source `url` in OCI provenance")
	command.Flags().StringVar(&options.ProvenanceRevision, "revision", "",
		"record the source-control `revision` in OCI provenance")
	command.Flags().StringVar(&options.ProvenanceDocs, "documentation-url", "",
		"record the documentation `url` in OCI provenance")
	command.Flags().StringVar(&options.ProvenanceLicenses, "licenses", "",
		"record the SPDX license `expression` in OCI provenance")
	return command
}

func packageOutcomeExit(outcome PackageOutcome) error {
	switch outcome {
	case PackageWritten:
		return nil
	case PackageInvalid:
		return exitStatus{code: ExitNegative}
	case PackageFailure:
		return exitStatus{code: ExitFailure}
	default:
		return UnavailableError{Message: "package did not report a result"}
	}
}
