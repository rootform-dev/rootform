package command

import (
	"errors"

	"github.com/spf13/cobra"
)

type PublishOptions struct {
	Object     DistributionObject
	Layout     string
	Repository string
	DryRun     bool
	Format     Format
}

type PublishOutcome int

const (
	PublishUndecided PublishOutcome = iota
	PublishCompleted
	PublishInvalid
	PublishFailure
)

type PublishService interface {
	Publish(PublishOptions) (PublishOutcome, error)
}

func newPublishCommand(env *Env) *cobra.Command {
	command := &cobra.Command{
		Use:   "publish <object>",
		Short: "Publish packaged Rootform content",
		Long:  "Publish validated Rootform packages to a registry repository.\n\nExit status:\n  0  help was shown\n  2  the command was used incorrectly",
		Example: "  rootform publish dialects ./oci --to registry.example.com/acme/dialects\n" +
			"  rootform publish policy-packs ./oci --to registry.example.com/acme/policies",
		Args:          objectRequired("publish", "dialects", "policy-packs"),
		RunE:          func(cmd *cobra.Command, args []string) error { return cmd.Help() },
		SilenceErrors: true,
		SilenceUsage:  true,
	}
	command.AddCommand(newPublishDialectsCommand(env), newPublishPolicyPacksCommand(env))
	return command
}

func newPublishDialectsCommand(env *Env) *cobra.Command {
	options := &PublishOptions{}
	format := ""
	command := &cobra.Command{
		Use:   "dialects <layout>",
		Short: "Publish a verified Dialect registry layout",
		Long: "Validate an existing local Rootform registry layout, publish its external\n" +
			"Dialects to one registry repository, repull every manifest by digest, and\n" +
			"verify the complete Dialect set. Only the exact selected Dialects are\n" +
			"written. Packaging and dry-run remain offline.\n\n" +
			"The text or JSON result goes to standard output. Diagnostics go to\n" +
			"standard error.\n\n" +
			"Exit status:\n" +
			"  0  publication or dry-run verification completed\n" +
			"  1  the registry layout is invalid\n" +
			"  2  the command was used incorrectly\n" +
			"  4  the layout could not be read, or registry publication or\n" +
			"     verification failed",
		Example: "  rootform publish dialects ./oci --to registry.example.com/acme/dialects\n" +
			"  rootform publish dialects ./oci --to localhost:5000/acme/dialects --dry-run\n" +
			"  rootform publish dialects ./oci --to registry.example.com/acme/dialects \\\n" +
			"    --dry-run --format json",
		Args: exactlyOne("publish dialects", "layout"),
		RunE: func(cmd *cobra.Command, args []string) error {
			options.Object = DistributionDialects
			options.Layout = args[0]
			if options.Repository == "" {
				return usageError{msg: "publish dialects needs a destination repository\n\nUsage:\n  rootform publish dialects <layout> --to <repository>"}
			}
			selected, err := parseFormat(format, FormatText, FormatJSON)
			if err != nil {
				return err
			}
			options.Format = selected
			if env.Publish == nil {
				return errors.New("publish service is not configured")
			}
			outcome, err := env.Publish.Publish(*options)
			if err != nil {
				return serviceFailure(err)
			}
			return publishOutcomeExit(outcome)
		},
		SilenceErrors: true,
		SilenceUsage:  true,
	}
	command.Flags().StringVar(&options.Repository, "to", "", "publish to the tagless OCI `repository`")
	command.Flags().BoolVar(&options.DryRun, "dry-run", false,
		"report the verified publication plan without network access")
	formatFlag(command, &format, "text", "json")
	return command
}

func newPublishPolicyPacksCommand(env *Env) *cobra.Command {
	options := &PublishOptions{}
	format := ""
	command := &cobra.Command{
		Use:   "policy-packs <layout>",
		Short: "Publish a verified Policy Pack registry layout",
		Long: "Validate an existing local Policy Pack registry layout, publish every\n" +
			"Policy Pack to one registry repository, and repull each manifest by\n" +
			"digest. Policy Packs are published exactly as selected. Dry-run remains\n" +
			"offline.\n\n" +
			"The text or JSON result goes to standard output. Diagnostics go to\n" +
			"standard error.\n\n" +
			"Exit status:\n" +
			"  0  publication or dry-run verification completed\n" +
			"  1  the registry layout is invalid\n" +
			"  2  the command was used incorrectly\n" +
			"  4  the layout could not be read, or registry publication or\n" +
			"     verification failed",
		Example: "  rootform publish policy-packs ./oci --to registry.example.com/acme/policies\n" +
			"  rootform publish policy-packs ./oci --to localhost:5000/acme/policies\n" +
			"  rootform publish policy-packs ./oci --to registry.example.com/acme/policies \\\n" +
			"    --dry-run --format json",
		Args: exactlyOne("publish policy-packs", "layout"),
		RunE: func(cmd *cobra.Command, args []string) error {
			options.Object = DistributionPolicyPacks
			options.Layout = args[0]
			if options.Repository == "" {
				return usageError{msg: "publish policy-packs needs a destination repository\n\nUsage:\n  rootform publish policy-packs <layout> --to <repository>"}
			}
			selected, err := parseFormat(format, FormatText, FormatJSON)
			if err != nil {
				return err
			}
			options.Format = selected
			if env.Publish == nil {
				return errors.New("publish service is not configured")
			}
			outcome, err := env.Publish.Publish(*options)
			if err != nil {
				return serviceFailure(err)
			}
			return publishOutcomeExit(outcome)
		},
		SilenceErrors: true,
		SilenceUsage:  true,
	}
	command.Flags().StringVar(&options.Repository, "to", "", "publish to the tagless OCI `repository`")
	command.Flags().BoolVar(&options.DryRun, "dry-run", false,
		"report the verified publication plan without network access")
	formatFlag(command, &format, "text", "json")
	return command
}

func publishOutcomeExit(outcome PublishOutcome) error {
	switch outcome {
	case PublishCompleted:
		return nil
	case PublishInvalid:
		return exitStatus{code: ExitNegative}
	case PublishFailure:
		return exitStatus{code: ExitFailure}
	default:
		return UnavailableError{Message: "publish did not report a result"}
	}
}
