package command

import (
	"fmt"
	"io"
	"sort"
	"strconv"
	"strings"
	"unicode/utf8"

	"github.com/spf13/cobra"
	"github.com/spf13/pflag"
)

// Help lists a command's options by intention. A flag's heading travels on
// the flag itself, so the CLI reference and the help read the same groups.
const (
	flagGroupAnnotation  = "rootform_help_group"
	flagGroupsAnnotation = "rootform_help_groups"
	// flagRankAnnotation places a flag within a heading that lists its flags
	// in the order a command names them rather than by name.
	flagRankAnnotation = "rootform_help_rank"
	// ownUsageAnnotation marks a parent that also acts without a subcommand,
	// so its usage shows both forms.
	ownUsageAnnotation = "rootform_help_own_usage"
	// OptionsGroup heads the flags a command files under no other heading.
	OptionsGroup = "Options"
	// GlobalGroup heads the options every command accepts.
	GlobalGroup = "Global options"
)

// groupFlags files each named flag under title. Headings print in the order a
// command first names them, after the ungrouped options.
func groupFlags(cmd *cobra.Command, title string, names ...string) {
	for _, name := range names {
		flag := cmd.Flags().Lookup(name)
		if flag == nil {
			panic("help group " + title + " names unknown flag --" + name)
		}
		setFlagGroup(flag, title)
	}
	if cmd.Annotations == nil {
		cmd.Annotations = map[string]string{}
	}
	order := cmd.Annotations[flagGroupsAnnotation]
	for _, existing := range strings.Split(order, "\n") {
		if existing == title {
			return
		}
	}
	if order != "" {
		order += "\n"
	}
	cmd.Annotations[flagGroupsAnnotation] = order + title
}

// groupFlagsInOrder files flags under title as groupFlags does, and lists
// them in the order named, the main flag before the ones that refine it.
func groupFlagsInOrder(cmd *cobra.Command, title string, names ...string) {
	groupFlags(cmd, title, names...)
	for i, name := range names {
		flag := cmd.Flags().Lookup(name)
		flag.Annotations[flagRankAnnotation] = []string{strconv.Itoa(i)}
	}
}

// flagRank is the place a heading listed in order gives a flag. Flags of
// other headings share one rank and keep their order by name.
func flagRank(flag *pflag.Flag) int {
	if values := flag.Annotations[flagRankAnnotation]; len(values) == 1 {
		if rank, err := strconv.Atoi(values[0]); err == nil {
			return rank
		}
	}
	return -1
}

func setFlagGroup(flag *pflag.Flag, title string) {
	if flag.Annotations == nil {
		flag.Annotations = map[string][]string{}
	}
	flag.Annotations[flagGroupAnnotation] = []string{title}
}

// FlagGroup names the help heading of one flag.
func FlagGroup(flag *pflag.Flag) string {
	if values := flag.Annotations[flagGroupAnnotation]; len(values) == 1 {
		return values[0]
	}
	return OptionsGroup
}

// HelpGroup names the heading help files a flag under. Inherited flags, help
// and version are global to every command.
func HelpGroup(flag *pflag.Flag, inherited bool) string {
	if inherited || flag.Name == "help" || flag.Name == "version" {
		return GlobalGroup
	}
	return FlagGroup(flag)
}

// UsageLine is the synopsis help prints for a command, one form per line.
func UsageLine(cmd *cobra.Command) string {
	subcommand := cmd.CommandPath() + " <command> [options]"
	if !cmd.HasParent() {
		return subcommand
	}
	synopsis := strings.TrimSuffix(cmd.UseLine(), " [flags]") + " [options]"
	if !cmd.HasAvailableSubCommands() {
		return synopsis
	}
	if cmd.Annotations[ownUsageAnnotation] == "" {
		return subcommand
	}
	return synopsis + "\n" + subcommand
}

// writeHelp prints one command's help: its sentence, usage, examples, its
// commands, its options grouped by intention, then its notes and exit
// statuses. Titles carry the accent only when color is on.
func writeHelp(w io.Writer, cmd *cobra.Command, colored bool) {
	var b strings.Builder
	section := func(title string) {
		if colored {
			title = ansiTitle + title + ansiReset
		}
		b.WriteString("\n" + title + "\n")
	}
	b.WriteString(sentence(cmd.Short) + "\n")
	section("Usage")
	for _, line := range strings.Split(UsageLine(cmd), "\n") {
		b.WriteString("  " + line + "\n")
	}
	if example := strings.TrimRight(cmd.Example, "\n "); example != "" {
		section("Examples")
		b.WriteString(example + "\n")
	}
	writeCommands(&b, cmd, section, colored)
	writeFlags(&b, cmd, section)
	notes, exits, _ := strings.Cut(cmd.Long, "Exit status:\n")
	if notes = strings.TrimSpace(notes); notes != "" {
		section("Notes")
		for _, line := range strings.Split(notes, "\n") {
			if strings.TrimSpace(line) == "" {
				b.WriteString("\n")
				continue
			}
			b.WriteString("  " + line + "\n")
		}
	}
	if exits = strings.TrimRight(exits, "\n "); exits != "" {
		section("Exit status")
		b.WriteString(exits + "\n")
	}
	fmt.Fprint(w, b.String())
}

func sentence(short string) string {
	short = strings.TrimSpace(short)
	if short == "" || strings.HasSuffix(short, ".") {
		return short
	}
	return short + "."
}

func writeCommands(b *strings.Builder, cmd *cobra.Command, section func(string), colored bool) {
	width := 0
	for _, child := range cmd.Commands() {
		if !child.Hidden {
			width = max(width, utf8.RuneCountInString(child.Name()))
		}
	}
	for _, group := range CommandSections(cmd) {
		section(group.Title)
		for _, child := range group.Commands {
			name := child.Name() + strings.Repeat(" ", width-utf8.RuneCountInString(child.Name()))
			if colored {
				name = ansiName + name + ansiReset
			}
			b.WriteString("  " + name + "  " + child.Short + "\n")
		}
	}
}

// CommandSection is one commands heading of a parent's help and the visible
// commands it lists.
type CommandSection struct {
	Title    string
	Commands []*cobra.Command
}

// CommandSections returns the commands headings help prints for cmd, in
// order. A parent without groups lists every visible command under Commands.
func CommandSections(cmd *cobra.Command) []CommandSection {
	children := []*cobra.Command{}
	for _, child := range cmd.Commands() {
		if !child.Hidden {
			children = append(children, child)
		}
	}
	if len(children) == 0 {
		return nil
	}
	if len(cmd.Groups()) == 0 {
		return []CommandSection{{Title: "Commands", Commands: children}}
	}
	sections := []CommandSection{}
	for _, group := range cmd.Groups() {
		section := CommandSection{Title: group.Title}
		for _, child := range children {
			if child.GroupID == group.ID {
				section.Commands = append(section.Commands, child)
			}
		}
		if len(section.Commands) != 0 {
			sections = append(sections, section)
		}
	}
	return sections
}

// FlagSection is one options heading of a command's help and the visible
// flags it lists.
type FlagSection struct {
	Title string
	Flags []*pflag.Flag
}

// FlagSections returns the options headings help prints for cmd, in order:
// ungrouped options, the headings in the order the command names them, then
// the global options.
func FlagSections(cmd *cobra.Command) []FlagSection {
	groups := map[string][]*pflag.Flag{}
	add := func(flag *pflag.Flag, inherited bool) {
		if flag.Hidden {
			return
		}
		title := HelpGroup(flag, inherited)
		groups[title] = append(groups[title], flag)
	}
	cmd.LocalFlags().VisitAll(func(flag *pflag.Flag) { add(flag, false) })
	cmd.InheritedFlags().VisitAll(func(flag *pflag.Flag) { add(flag, true) })
	order := []string{OptionsGroup}
	if declared := cmd.Annotations[flagGroupsAnnotation]; declared != "" {
		order = append(order, strings.Split(declared, "\n")...)
	}
	order = append(order, GlobalGroup)
	sections := []FlagSection{}
	for _, title := range order {
		if flags := groups[title]; len(flags) != 0 {
			sort.SliceStable(flags, func(i, j int) bool { return flagRank(flags[i]) < flagRank(flags[j]) })
			sections = append(sections, FlagSection{Title: title, Flags: flags})
		}
	}
	return sections
}

func writeFlags(b *strings.Builder, cmd *cobra.Command, section func(string)) {
	for _, group := range FlagSections(cmd) {
		section(group.Title)
		for _, flag := range group.Flags {
			b.WriteString("  " + flagSynopsis(flag) + "\n")
			_, usage := pflag.UnquoteUsage(flag)
			for _, line := range wrap(usage, 72) {
				b.WriteString("      " + line + "\n")
			}
		}
	}
}

// flagSynopsis names a flag and the value it takes.
func flagSynopsis(flag *pflag.Flag) string {
	name := "--" + flag.Name
	if flag.Shorthand != "" {
		name = "-" + flag.Shorthand + ", " + name
	}
	if flag.Value.Type() == "bool" {
		return name
	}
	value, _ := pflag.UnquoteUsage(flag)
	if value == "" || value == flag.Value.Type() {
		value = "value"
	}
	return name + " <" + value + ">"
}

func wrap(text string, width int) []string {
	words := strings.Fields(text)
	lines := []string{}
	current := ""
	for _, word := range words {
		if current != "" && utf8.RuneCountInString(current)+1+utf8.RuneCountInString(word) > width {
			lines = append(lines, current)
			current = word
			continue
		}
		if current != "" {
			current += " "
		}
		current += word
	}
	if current != "" {
		lines = append(lines, current)
	}
	return lines
}
