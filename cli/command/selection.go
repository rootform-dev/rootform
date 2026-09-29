package command

import (
	"errors"
	"fmt"
	"os"
	"strings"

	"github.com/spf13/cobra"
)

// SelectionVerb names one rootform.lock mutation.
type SelectionVerb string

const (
	SelectionAdd    SelectionVerb = "add"
	SelectionRemove SelectionVerb = "remove"
	SelectionUpdate SelectionVerb = "update"
)

// SelectionOptions carries one add, remove, or update run. Operands are the
// sources for add, the names for remove, and the name then optional source
// for update.
type SelectionOptions struct {
	Verb     SelectionVerb
	Object   DistributionObject
	Operands []string
	// Project is the directory whose rootform.lock and vendored copies
	// change; empty means the working directory.
	Project        string
	Replace        bool
	Embedded       bool
	Offline        bool
	OfflineFromEnv bool
	DryRun         bool
	Format         Format
}

// SelectionService is the only writer of rootform.lock.
type SelectionService interface {
	Mutate(SelectionOptions) error
}

// InstallOptions carries one install run of OCI references.
type InstallOptions struct {
	Object     DistributionObject
	References []string
	Offline    bool
	Format     Format
}

// UninstallOptions carries one uninstall run of exact name@version units.
type UninstallOptions struct {
	Object DistributionObject
	Units  []string
	Format Format
}

// StoreService installs and removes content in the Rootform home only.
type StoreService interface {
	Install(InstallOptions) error
	Uninstall(UninstallOptions) error
}

// dialectOverrideFlag declares the invocation-only Dialect source flag.
func dialectOverrideFlag(cmd *cobra.Command, target *[]string) {
	cmd.Flags().StringArrayVar(target, "dialect", nil,
		"use Dialect source `dir` for this command only; repeatable")
}

// policyPackOverlayFlag names local Policy Pack source directories that
// replace the selected pack of the same name for this run only.
func policyPackOverlayFlag(cmd *cobra.Command, target *[]string) {
	cmd.Flags().StringArrayVar(target, "policy-pack", nil,
		"add or replace the Policy Pack at `path`, a source directory or a compiled file, for this command only; repeatable")
}

// projectFlag selects the Rootform project a command reads its selection
// from. It never changes the working directory.
func projectFlag(cmd *cobra.Command, target *string) {
	cmd.Flags().StringVar(target, "project", "",
		"read rootform.lock from project `dir`; paths stay relative to the working directory; default: the working directory")
}

// changedProjectFlag selects the Rootform project whose rootform.lock or
// vendored copies a command writes. It never changes the working directory.
func changedProjectFlag(cmd *cobra.Command, target *string) {
	cmd.Flags().StringVar(target, "project", "",
		"change rootform.lock and vendored copies in project `dir`; paths stay relative to the working directory; default: the working directory")
}

// requireProjectDirectory refuses a --project that names no directory before
// anything is read.
func requireProjectDirectory(project string) error {
	if project == "" {
		return nil
	}
	if info, err := os.Stat(project); err != nil || !info.IsDir() {
		return RunError{Code: ExitUsage, Message: "--project requires a directory"}
	}
	return nil
}

// refuseLockedOverrides keeps --locked runs on exactly the recorded selection.
func refuseLockedOverrides(command string, locked bool, dialects, policyPacks []string) error {
	if !locked || len(dialects) == 0 && len(policyPacks) == 0 {
		return nil
	}
	flag := "--dialect"
	if len(dialects) == 0 {
		flag = "--policy-pack"
	}
	return usageError{msg: fmt.Sprintf("--locked and %s cannot be used together\n\n"+
		"--locked runs exactly what rootform.lock selects.\n\nTry:\n  rootform %s --locked", flag, command)}
}

type selectionFamily struct {
	object DistributionObject
	noun   string
}

// UpdateObject names the object word of rootform update. update acts on
// exactly one named unit, so it takes the singular noun, like show
// policy-pack and compile policy-pack; commands that act on several units
// or on a whole family keep the plural.
func UpdateObject(object DistributionObject) string {
	if object == DistributionPolicyPacks {
		return "policy-pack"
	}
	return "dialect"
}

// commandObject is the object word a verb uses for one family.
func commandObject(verb SelectionVerb, object DistributionObject) string {
	if verb == SelectionUpdate {
		return UpdateObject(object)
	}
	return string(object)
}

func selectionFamilies() []selectionFamily {
	return []selectionFamily{
		{object: DistributionDialects, noun: "Dialect"},
		{object: DistributionPolicyPacks, noun: "Policy Pack"},
	}
}

func newSelectionCommand(env *Env, verb SelectionVerb, short, long string) *cobra.Command {
	name := string(verb)
	cmd := &cobra.Command{
		Use:           name + " <object>",
		Short:         short,
		Long:          long + "\n\nExit status:\n  0  help was shown\n  2  the command was used incorrectly",
		Example:       selectionExamples(verb, DistributionDialects) + "\n" + selectionExamples(verb, DistributionPolicyPacks),
		Args:          objectRequired(name, commandObject(verb, DistributionDialects), commandObject(verb, DistributionPolicyPacks)),
		RunE:          func(cmd *cobra.Command, args []string) error { return cmd.Help() },
		SilenceErrors: true,
		SilenceUsage:  true,
	}
	for _, family := range selectionFamilies() {
		cmd.AddCommand(newSelectionObjectCommand(env, verb, family))
	}
	return cmd
}

func selectionExamples(verb SelectionVerb, object DistributionObject) string {
	switch {
	case verb == SelectionAdd && object == DistributionDialects:
		return "  rootform add dialects ./dialects/payments\n" +
			"  rootform add dialects \\\n" +
			"    registry.example.com/acme/dialects:dialect-payments-0.1.0\n" +
			"  rootform add dialects ./dialects/aws --replace"
	case verb == SelectionAdd:
		return "  rootform add policy-packs ./policies\n" +
			"  rootform add policy-packs \\\n" +
			"    registry.example.com/acme/policies:policy-pack-baseline-0.1.0\n" +
			"  rootform add policy-packs ./policies --dry-run"
	case verb == SelectionRemove && object == DistributionDialects:
		return "  rootform remove dialects payments\n" +
			"  rootform remove dialects payments billing --dry-run\n" +
			"  rootform remove dialects aws --embedded"
	case verb == SelectionRemove:
		return "  rootform remove policy-packs baseline\n" +
			"  rootform remove policy-packs baseline audit\n" +
			"  rootform remove policy-packs baseline --format json"
	case object == DistributionDialects:
		return "  rootform update dialect payments\n" +
			"  rootform update dialect payments ./dialects/payments-next\n" +
			"  rootform update dialect payments \\\n" +
			"    registry.example.com/acme/dialects:dialect-payments-0.2.0"
	default:
		return "  rootform update policy-pack baseline\n" +
			"  rootform update policy-pack baseline ./policies\n" +
			"  rootform update policy-pack baseline \\\n" +
			"    registry.example.com/acme/policies:policy-pack-baseline-0.2.0"
	}
}

func selectionLong(verb SelectionVerb, family selectionFamily) string {
	plural := family.noun + "s"
	var body string
	negative := "a source is invalid or a named selection is absent"
	noAnswer := "rootform.lock is invalid, selections conflict, or --offline needs\n" +
		"     content that is not installed"
	failure := "a file, Rootform home, or network operation failed"
	switch verb {
	case SelectionAdd:
		if family.object == DistributionDialects {
			body = fmt.Sprintf("Add %s to rootform.lock. Each source is a local directory (./path),\n"+
				"a registry reference with a tag or digest, or the owner of an embedded Dialect\n"+
				"that the project excluded.", plural)
		} else {
			body = fmt.Sprintf("Add %s to rootform.lock. Each source is a local directory\n"+
				"(./path) or a registry reference with a tag or digest.", plural)
		}
		body += "\n\nRootform compiles and verifies every source, records its exact identity,\n" +
			"and writes rootform.lock once, or not at all. A registry source is\n" +
			"installed in the Rootform home. A tag is resolved once and never\n" +
			"recorded."
		if family.object == DistributionDialects {
			body += "\n\nA Dialect whose owner is embedded in Rootform replaces the embedded\n" +
				"one only with --replace."
		}
	case SelectionRemove:
		body = fmt.Sprintf("Remove %s from rootform.lock by name. Every name must be selected;\n"+
			"otherwise nothing changes.", plural)
		negative = "a named selection is absent or the remaining selection is invalid"
		noAnswer = "rootform.lock is invalid"
		failure = "a file or Rootform home operation failed"
		if family.object == DistributionDialects {
			body += "\n\nRemoving a Dialect that replaced an embedded one makes the embedded\n" +
				"one active again. With --embedded, each name must instead be an embedded\n" +
				"Dialect that no selection replaces; it is excluded from the project."
			noAnswer = "rootform.lock is invalid, or --embedded names a Dialect that is not\n" +
				"     embedded or that a selection replaces"
		}
	default:
		body = fmt.Sprintf("Change one selected %s. Without a source, a local selection is\n"+
			"read again from its recorded path, which records content you edited. With\n"+
			"a source, the selection switches to it. The source must declare the same\n"+
			"name; a registry selection needs a source because no tag is recorded.", family.noun)
	}
	return body + "\n\nWhen the project vendors this family under .rootform/, the vendored\n" +
		"copy changes together with rootform.lock.\n\n" +
		"The summary goes to standard output. Diagnostics go to standard error.\n\n" +
		"Exit status:\n" +
		"  0  rootform.lock matches the request\n" +
		"  1  " + negative + "\n" +
		"  2  the command was used incorrectly\n" +
		"  3  " + noAnswer + "\n" +
		"  4  " + failure
}

func newSelectionObjectCommand(env *Env, verb SelectionVerb, family selectionFamily) *cobra.Command {
	options := &SelectionOptions{Verb: verb, Object: family.object}
	format := ""
	path := string(verb) + " " + commandObject(verb, family.object)
	use := path + " <source>..."
	short := "Add " + family.noun + "s to rootform.lock"
	switch verb {
	case SelectionRemove:
		use, short = path+" <name>...", "Remove "+family.noun+"s from rootform.lock"
	case SelectionUpdate:
		use, short = path+" <name> [source]", "Change one selected "+family.noun
	}
	cmd := &cobra.Command{
		Use:     strings.TrimPrefix(use, string(verb)+" "),
		Short:   short,
		Long:    selectionLong(verb, family),
		Example: selectionExamples(verb, family.object),
		Args: func(cmd *cobra.Command, args []string) error {
			switch {
			case verb == SelectionUpdate && (len(args) == 0 || len(args) > 2):
				return usageError{msg: fmt.Sprintf(
					"%s needs a name and at most one source, but %s given\n\nUsage:\n  rootform %s <name> [source]",
					path, counted(len(args), "argument was", "arguments were"), path)}
			case len(args) == 0:
				what := "source"
				if verb == SelectionRemove {
					what = "name"
				}
				return usageError{msg: fmt.Sprintf("%s needs at least one %s\n\nUsage:\n  rootform %s", path, what, use)}
			}
			return nil
		},
		RunE: func(cmd *cobra.Command, args []string) error {
			selected, err := parseFormat(format, FormatText, FormatJSON)
			if err != nil {
				return err
			}
			options.Format = selected
			options.Operands = append([]string{}, args...)
			if err := requireProjectDirectory(options.Project); err != nil {
				return err
			}
			if verb != SelectionRemove {
				flagOffline := options.Offline
				fromEnv := applyOfflineEnvironment(env, &options.Offline)
				options.OfflineFromEnv = !flagOffline && fromEnv
			}
			if env.Selection == nil {
				return errors.New("selection service is not configured")
			}
			if err := env.Selection.Mutate(*options); err != nil {
				return serviceFailure(err)
			}
			return nil
		},
		SilenceErrors: true,
		SilenceUsage:  true,
	}
	if verb == SelectionAdd && family.object == DistributionDialects {
		cmd.Flags().BoolVar(&options.Replace, "replace", false,
			"replace the embedded Dialect with the same owner")
	}
	if verb == SelectionRemove && family.object == DistributionDialects {
		cmd.Flags().BoolVar(&options.Embedded, "embedded", false,
			"exclude the named embedded Dialects from the project")
	}
	if verb != SelectionRemove {
		cmd.Flags().BoolVar(&options.Offline, "offline", false,
			"use no network; accept local and installed sources")
	}
	cmd.Flags().BoolVar(&options.DryRun, "dry-run", false,
		"print the planned change and write nothing")
	changedProjectFlag(cmd, &options.Project)
	formatFlag(cmd, &format, "text", "json")
	return cmd
}

func newInstallCommand(env *Env) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "install <object>",
		Short: "Install registry content in the Rootform home",
		Long: "Download and verify Dialects or Policy Packs into the Rootform home.\n" +
			"Installing makes content available on this machine; it selects\n" +
			"nothing for any project.\n\nExit status:\n" +
			"  0  help was shown\n  2  the command was used incorrectly",
		Example: "  rootform install dialects \\\n" +
			"    registry.example.com/acme/dialects:dialect-payments-0.1.0\n" +
			"  rootform install policy-packs \\\n" +
			"    registry.example.com/acme/policies:policy-pack-baseline-0.1.0",
		Args:          objectRequired("install", "dialects", "policy-packs"),
		RunE:          func(cmd *cobra.Command, args []string) error { return cmd.Help() },
		SilenceErrors: true,
		SilenceUsage:  true,
	}
	for _, family := range selectionFamilies() {
		cmd.AddCommand(newInstallObjectCommand(env, family))
	}
	return cmd
}

func newInstallObjectCommand(env *Env, family selectionFamily) *cobra.Command {
	options := &InstallOptions{Object: family.object}
	format := ""
	path := "install " + string(family.object)
	repository := "registry.example.com/acme/dialects"
	reference := repository + ":dialect-payments-0.1.0"
	if family.object == DistributionPolicyPacks {
		repository = "registry.example.com/acme/policies"
		reference = repository + ":policy-pack-baseline-0.1.0"
	}
	cmd := &cobra.Command{
		Use:   string(family.object) + " <reference>...",
		Short: "Install " + family.noun + "s from registry references",
		Long: "Resolve each registry reference once, verify the " + family.noun + " it\n" +
			"names, and install it in the Rootform home. A version is immutable on a\n" +
			"machine: installing the same version from other content fails.\n\n" +
			"No project file is read or written. Use rootform add to select content.\n\n" +
			"The summary goes to standard output. Diagnostics go to standard error.\n\n" +
			"Exit status:\n" +
			"  0  every reference is installed\n" +
			"  1  content is invalid or a named version is absent\n" +
			"  2  the command was used incorrectly\n" +
			"  3  --offline needs content that is not installed\n" +
			"  4  a registry, network, or Rootform home operation failed",
		Example: "  rootform " + path + " \\\n" +
			"    " + reference + "\n" +
			"  rootform " + path + " --format json \\\n" +
			"    " + reference + "\n" +
			"  rootform " + path + " --offline \\\n" +
			"    " + repository + "@sha256:<digest>",
		Args: func(cmd *cobra.Command, args []string) error {
			if len(args) == 0 {
				return usageError{msg: fmt.Sprintf("%s needs at least one registry reference\n\nUsage:\n  rootform %s <reference>...", path, path)}
			}
			return nil
		},
		RunE: func(cmd *cobra.Command, args []string) error {
			selected, err := parseFormat(format, FormatText, FormatJSON)
			if err != nil {
				return err
			}
			options.Format = selected
			options.References = append([]string{}, args...)
			applyOfflineEnvironment(env, &options.Offline)
			if env.Store == nil {
				return errors.New("store service is not configured")
			}
			if err := env.Store.Install(*options); err != nil {
				return serviceFailure(err)
			}
			return nil
		},
		SilenceErrors: true,
		SilenceUsage:  true,
	}
	cmd.Flags().BoolVar(&options.Offline, "offline", false,
		"use no network; accept installed digest references")
	formatFlag(cmd, &format, "text", "json")
	return cmd
}

func newUninstallCommand(env *Env) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "uninstall <object>",
		Short: "Delete installed versions from the Rootform home",
		Long: "Delete exact installed versions of Dialects or Policy Packs from the\n" +
			"Rootform home. Projects are not read; a project that still selects a\n" +
			"deleted version gets it back through rootform init.\n\nExit status:\n" +
			"  0  help was shown\n  2  the command was used incorrectly",
		Example: "  rootform uninstall dialects payments@0.1.0\n" +
			"  rootform uninstall policy-packs baseline@1.0.0",
		Args:          objectRequired("uninstall", "dialects", "policy-packs"),
		RunE:          func(cmd *cobra.Command, args []string) error { return cmd.Help() },
		SilenceErrors: true,
		SilenceUsage:  true,
	}
	for _, family := range selectionFamilies() {
		cmd.AddCommand(newUninstallObjectCommand(env, family))
	}
	return cmd
}

func newUninstallObjectCommand(env *Env, family selectionFamily) *cobra.Command {
	options := &UninstallOptions{Object: family.object}
	format := ""
	path := "uninstall " + string(family.object)
	cmd := &cobra.Command{
		Use:   string(family.object) + " <name@version>...",
		Short: "Delete installed " + family.noun + " versions",
		Long: "Delete each named installed version from the Rootform home. The whole\n" +
			"request fails before deleting anything when a version is not installed.\n\n" +
			"The summary goes to standard output. Diagnostics go to standard error.\n\n" +
			"Exit status:\n" +
			"  0  every named version was deleted\n" +
			"  1  a named version is not installed\n" +
			"  2  the command was used incorrectly\n" +
			"  4  the Rootform home could not be read or changed",
		Example: "  rootform " + path + " example@1.0.0\n" +
			"  rootform " + path + " example@1.0.0 example@1.1.0\n" +
			"  rootform " + path + " example@1.0.0 --format json",
		Args: func(cmd *cobra.Command, args []string) error {
			if len(args) == 0 {
				return usageError{msg: fmt.Sprintf("%s needs at least one name@version\n\nUsage:\n  rootform %s <name@version>...", path, path)}
			}
			for _, arg := range args {
				name, version, found := strings.Cut(arg, "@")
				if !found || name == "" || version == "" {
					return usageError{msg: fmt.Sprintf("%q is not name@version\n\nUsage:\n  rootform %s <name@version>...", arg, path)}
				}
			}
			return nil
		},
		RunE: func(cmd *cobra.Command, args []string) error {
			selected, err := parseFormat(format, FormatText, FormatJSON)
			if err != nil {
				return err
			}
			options.Format = selected
			options.Units = append([]string{}, args...)
			if env.Store == nil {
				return errors.New("store service is not configured")
			}
			if err := env.Store.Uninstall(*options); err != nil {
				return serviceFailure(err)
			}
			return nil
		},
		SilenceErrors: true,
		SilenceUsage:  true,
	}
	formatFlag(cmd, &format, "text", "json")
	return cmd
}

func newAddCommand(env *Env) *cobra.Command {
	return newSelectionCommand(env, SelectionAdd, "Add content to rootform.lock",
		"Select Dialects or Policy Packs for this project. rootform add, remove,\n"+
			"and update are the only commands that write rootform.lock.")
}

func newRemoveCommand(env *Env) *cobra.Command {
	return newSelectionCommand(env, SelectionRemove, "Remove content from rootform.lock",
		"Drop selected Dialects or Policy Packs from this project, or exclude an\n"+
			"embedded Dialect.")
}

func newUpdateCommand(env *Env) *cobra.Command {
	return newSelectionCommand(env, SelectionUpdate, "Change a selection in rootform.lock",
		"Record new content for one selected Dialect or Policy Pack, or switch\n"+
			"it to another exact source.")
}
