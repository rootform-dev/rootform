// Package clireference exports the command tree as the CLI reference that the
// documentation is generated from.
package clireference

import (
	"encoding/json"
	"slices"
	"strings"

	"github.com/rootform-dev/rootform/cli/internal/command"
	"github.com/spf13/cobra"
	"github.com/spf13/pflag"
)

// Output is the path of the committed reference from the module root.
const Output = "../contracts/reference/cli.json"

type Document struct {
	FormatVersion int       `json:"format_version"`
	Commands      []Command `json:"commands"`
}

type Command struct {
	Path           string   `json:"path"`
	Usage          string   `json:"usage"`
	Group          string   `json:"group,omitempty"`
	Summary        string   `json:"summary"`
	Description    string   `json:"description"`
	Aliases        []string `json:"aliases,omitempty"`
	Examples       string   `json:"examples,omitempty"`
	Deprecated     string   `json:"deprecated,omitempty"`
	CommandGroups  []string `json:"command_groups,omitempty"`
	Subcommands    []string `json:"subcommands,omitempty"`
	FlagGroups     []string `json:"flag_groups,omitempty"`
	Flags          []Flag   `json:"flags,omitempty"`
	InheritedFlags []Flag   `json:"inherited_flags,omitempty"`
}

type Flag struct {
	Name                string `json:"name"`
	Shorthand           string `json:"shorthand,omitempty"`
	Type                string `json:"type"`
	Group               string `json:"group"`
	Default             string `json:"default"`
	Usage               string `json:"usage"`
	Required            bool   `json:"required,omitempty"`
	NoOptionDefault     string `json:"no_option_default,omitempty"`
	Deprecated          string `json:"deprecated,omitempty"`
	ShorthandDeprecated string `json:"shorthand_deprecated,omitempty"`
}

// Current exports declarations only; no command or service is executed.
func Current() ([]byte, error) {
	// Any nonempty version enables the installed CLI's --version flag.
	return Export(command.NewRootCommand(&command.Env{Version: "reference"}))
}

func Export(root *cobra.Command) ([]byte, error) {
	doc := Document{FormatVersion: 1, Commands: []Command{}}
	var visit func(*cobra.Command)
	visit = func(cmd *cobra.Command) {
		if cmd.Hidden {
			return
		}
		entry := Command{
			Path: cmd.CommandPath(), Usage: command.UsageLine(cmd), Group: commandGroup(cmd),
			Summary: strings.TrimSpace(cmd.Short), Description: strings.TrimSpace(cmd.Long),
			Aliases: slices.Clone(cmd.Aliases), Examples: strings.TrimSpace(cmd.Example),
			Deprecated: cmd.Deprecated,
			Flags:      flags(cmd.LocalFlags(), false), InheritedFlags: flags(cmd.InheritedFlags(), true),
		}
		if len(cmd.Groups()) != 0 {
			for _, section := range command.CommandSections(cmd) {
				entry.CommandGroups = append(entry.CommandGroups, section.Title)
			}
		}
		for _, section := range command.FlagSections(cmd) {
			entry.FlagGroups = append(entry.FlagGroups, section.Title)
		}
		slices.Sort(entry.Aliases)
		children := slices.Clone(cmd.Commands())
		slices.SortFunc(children, func(a, b *cobra.Command) int { return strings.Compare(a.Name(), b.Name()) })
		for _, child := range children {
			if !child.Hidden {
				entry.Subcommands = append(entry.Subcommands, child.CommandPath())
			}
		}
		doc.Commands = append(doc.Commands, entry)
		for _, child := range children {
			visit(child)
		}
	}
	visit(root)
	data, err := json.MarshalIndent(doc, "", "  ")
	if err != nil {
		return nil, err
	}
	return append(data, '\n'), nil
}

// commandGroup names the heading its parent's help lists a command under.
func commandGroup(cmd *cobra.Command) string {
	if !cmd.HasParent() || cmd.GroupID == "" {
		return ""
	}
	for _, group := range cmd.Parent().Groups() {
		if group.ID == cmd.GroupID {
			return group.Title
		}
	}
	return ""
}

func flags(set *pflag.FlagSet, inherited bool) []Flag {
	var result []Flag
	set.VisitAll(func(flag *pflag.Flag) {
		if flag.Hidden {
			return
		}
		result = append(result, Flag{
			Name: flag.Name, Shorthand: flag.Shorthand, Type: flag.Value.Type(), Group: command.HelpGroup(flag, inherited),
			Default: flag.DefValue, Usage: flag.Usage,
			Required:        slices.Contains(flag.Annotations[cobra.BashCompOneRequiredFlag], "true"),
			NoOptionDefault: flag.NoOptDefVal, Deprecated: flag.Deprecated,
			ShorthandDeprecated: flag.ShorthandDeprecated,
		})
	})
	slices.SortFunc(result, func(a, b Flag) int { return strings.Compare(a.Name, b.Name) })
	return result
}
