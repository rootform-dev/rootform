package command

import (
	"errors"

	"github.com/spf13/cobra"
)

// VendorOptions carries the parsed options for one vendoring run.
type VendorOptions struct {
	Object DistributionObject
	// Project is the directory whose rootform.lock selection is vendored
	// into its .rootform directory; empty means the working directory.
	Project string
	// Destination is the directory the resolved non-embedded content is copied
	// into.
	Destination string
	Offline     bool
}

// VendorOutcome is the framework-neutral result of one vendoring run.
type VendorOutcome int

const (
	// VendorNoAnswer is the zero value, so a service that returns nothing
	// never reads as vendored.
	VendorNoAnswer VendorOutcome = iota
	VendorCopied
	VendorInvalid
	VendorFailure
)

// VendorService is the injected non-embedded content materialization seam.
type VendorService interface {
	Vendor(VendorOptions) (VendorOutcome, error)
}

func newVendorCommand(env *Env) *cobra.Command {
	options := &VendorOptions{}
	cmd := &cobra.Command{
		Use:         "vendor",
		Annotations: map[string]string{ownUsageAnnotation: "true"},
		Short:       "Vendor selected non-embedded content",
		Long: "Materialize the project's exact non-embedded selections: Dialects\n" +
			"and Policy Pack sources, with their licenses and notices.\n\n" +
			"Without a command, vendor writes every family that rootform.lock selects\n" +
			"into .rootform in the project directory. Run vendor dialects or vendor\n" +
			"policy-packs to vendor only that family.\n\n" +
			"Exit status:\n" +
			"  0  every selected unit was copied\n" +
			"  1  selected content is invalid, missing, or differs from rootform.lock\n" +
			"  2  the command was used incorrectly\n" +
			"  3  no content was selected, rootform.lock is invalid, or --offline\n" +
			"     needs content that is not installed\n" +
			"  4  a file, the Rootform home, or the registry could not be read or written",
		Example: "  rootform vendor\n  rootform vendor dialects\n  rootform vendor policy-packs",
		Args: func(cmd *cobra.Command, args []string) error {
			if len(args) == 0 {
				return nil
			}
			return objectRequired("vendor", "dialects", "policy-packs")(cmd, args)
		},
		RunE: func(cmd *cobra.Command, args []string) error {
			options.Object = ""
			if err := requireProjectDirectory(options.Project); err != nil {
				return err
			}
			applyOfflineEnvironment(env, &options.Offline)
			if env.Vendor == nil {
				return errors.New("vendor service is not configured")
			}
			outcome, err := env.Vendor.Vendor(*options)
			return vendorOutcomeExit(outcome, err)
		},
		SilenceErrors: true,
		SilenceUsage:  true,
	}
	cmd.Flags().BoolVar(&options.Offline, "offline", false,
		"use no network; copy only local and installed content")
	vendoredProjectFlag(cmd, &options.Project)
	cmd.AddCommand(newVendorDialectsCommand(env), newVendorPolicyPacksCommand(env))
	return cmd
}

// vendoredProjectFlag selects the Rootform project whose selection vendor
// copies. It never changes the working directory.
func vendoredProjectFlag(cmd *cobra.Command, target *string) {
	cmd.Flags().StringVar(target, "project", "",
		"vendor what rootform.lock selects in project `dir`; paths stay relative to the working directory; default: the working directory")
}

func newVendorDialectsCommand(env *Env) *cobra.Command {
	options := &VendorOptions{}
	cmd := &cobra.Command{
		Use:   "dialects",
		Short: "Vendor selected Dialects",
		Long: "Materialize the exact Dialect selection from rootform.lock: external\n" +
			"Dialects from remote or local sources, with their licenses and notices.\n" +
			"Policy Packs have their own vendoring destination and are never\n" +
			"materialized here. Embedded Dialects, the RF Vocabulary, and derived\n" +
			"caches are never materialized. No version is resolved and rootform.lock\n" +
			"is never changed.\n\n" +
			"Without --to, vendor writes .rootform/dialects in the project directory.\n" +
			"Commands that read that project use that directory as the exclusive\n" +
			"source for these selections when present.\n\n" +
			"Copied names and versions go to standard output. Diagnostics go to\n" +
			"standard error.\n\n" +
			"Exit status:\n" +
			"  0  every selected unit was copied\n" +
			"  1  selected content is invalid, missing, or differs from rootform.lock\n" +
			"  2  the command was used incorrectly\n" +
			"  3  no content was selected, rootform.lock is invalid, or --offline\n" +
			"     needs content that is not installed\n" +
			"  4  a file, the Rootform home, or the registry could not be read or written",
		Example: "  rootform init ./infra --no-input\n" +
			"  rootform vendor dialects\n" +
			"  rootform vendor dialects --to ./offline/dialects",
		Args: noArguments("vendor dialects"),
		RunE: func(cmd *cobra.Command, args []string) error {
			options.Object = DistributionDialects
			if err := requireProjectDirectory(options.Project); err != nil {
				return err
			}
			applyOfflineEnvironment(env, &options.Offline)
			if env.Vendor == nil {
				return errors.New("vendor service is not configured")
			}
			outcome, err := env.Vendor.Vendor(*options)
			return vendorOutcomeExit(outcome, err)
		},
		SilenceErrors: true,
		SilenceUsage:  true,
	}
	cmd.Flags().StringVar(&options.Destination, "to", "",
		"copy into `directory`; default: .rootform/dialects in the project")
	cmd.Flags().BoolVar(&options.Offline, "offline", false,
		"use no network; copy only local and installed Dialects")
	vendoredProjectFlag(cmd, &options.Project)
	return cmd
}

func newVendorPolicyPacksCommand(env *Env) *cobra.Command {
	options := &VendorOptions{}
	cmd := &cobra.Command{
		Use:   "policy-packs",
		Short: "Vendor selected Policy Packs",
		Long: "Materialize the exact Policy Pack selection from rootform.lock:\n" +
			"Policy Packs from local sources, the Rootform home, or their pinned\n" +
			"registry repositories, with their licenses and notices. Dialects have\n" +
			"their own vendoring destination and are never materialized here. No\n" +
			"version is resolved and rootform.lock is never changed.\n\n" +
			"Without --to, vendor writes .rootform/policy-packs in the project\n" +
			"directory. Commands using the project's Policy Pack selection use that\n" +
			"directory exclusively when present. An explicit local --policy-pack\n" +
			"source replaces the selected Policy Pack with the same name for that\n" +
			"invocation.\n\n" +
			"Copied names and versions go to standard output. Diagnostics go to\n" +
			"standard error.\n\n" +
			"Exit status:\n" +
			"  0  every selected unit was copied\n" +
			"  1  selected content is invalid, missing, or differs from rootform.lock\n" +
			"  2  the command was used incorrectly\n" +
			"  3  no content was selected, rootform.lock is invalid, or --offline\n" +
			"     needs content that is not installed\n" +
			"  4  a file, the Rootform home, or the registry could not be read or written",
		Example: "  rootform vendor policy-packs\n" +
			"  rootform vendor policy-packs --to ./offline/policy-packs\n" +
			"  rootform package policy-packs ./policies --to ./artifacts/policies",
		Args: noArguments("vendor policy-packs"),
		RunE: func(cmd *cobra.Command, args []string) error {
			options.Object = DistributionPolicyPacks
			if err := requireProjectDirectory(options.Project); err != nil {
				return err
			}
			applyOfflineEnvironment(env, &options.Offline)
			if env.Vendor == nil {
				return errors.New("vendor service is not configured")
			}
			outcome, err := env.Vendor.Vendor(*options)
			return vendorOutcomeExit(outcome, err)
		},
		SilenceErrors: true,
		SilenceUsage:  true,
	}
	cmd.Flags().StringVar(&options.Destination, "to", "",
		"copy into `directory`; default: .rootform/policy-packs in the project")
	cmd.Flags().BoolVar(&options.Offline, "offline", false,
		"use no network; copy only local and installed Policy Packs")
	vendoredProjectFlag(cmd, &options.Project)
	return cmd
}

func vendorOutcomeExit(outcome VendorOutcome, err error) error {
	if err != nil {
		return serviceFailure(err)
	}
	switch outcome {
	case VendorCopied:
		return nil
	case VendorInvalid:
		return exitStatus{code: ExitNegative}
	case VendorNoAnswer:
		return exitStatus{code: ExitNoAnswer}
	default:
		return exitStatus{code: ExitFailure}
	}
}
