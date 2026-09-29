package command

import (
	"errors"
	"fmt"
	"strings"

	"github.com/spf13/cobra"
)

func resolveDir(env *Env, args []string) (string, error) {
	if len(args) == 1 && args[0] != "" {
		return args[0], nil
	}
	if env.Getwd == nil {
		return "", errors.New("working directory is not configured")
	}
	return env.Getwd()
}

// quoted renders a user-supplied value the way a diagnostic must show it:
// exactly as it was typed, so a user recognizes their own input.
func quoted(value string) string { return fmt.Sprintf("%q", value) }

// noArguments rejects any positional argument, naming the command that takes
// none rather than reporting a count alone.
func noArguments(path string) cobra.PositionalArgs {
	return func(cmd *cobra.Command, args []string) error {
		if len(args) == 0 {
			return nil
		}
		return usageError{msg: fmt.Sprintf(
			"%s takes no arguments, but %s given\n\n%s",
			path, counted(len(args), "argument was", "arguments were"), usageSection(cmd))}
	}
}

// atMostOneInput backs a command whose single positional is optional, naming
// what the argument stands for so an extra one reports more than a count.
func atMostOneInput(path, argument string) cobra.PositionalArgs {
	return func(cmd *cobra.Command, args []string) error {
		if len(args) <= 1 {
			return nil
		}
		return usageError{msg: fmt.Sprintf(
			"%s accepts one %s, but %s given\n\n%s",
			path, argument, counted(len(args), "was", "were"), usageSection(cmd))}
	}
}

// exactlyOne requires one positional argument and names what it stands for, so
// a missing argument reports what to supply instead of a count.
func exactlyOne(path, argument string) cobra.PositionalArgs {
	return func(cmd *cobra.Command, args []string) error {
		if len(args) == 1 {
			return nil
		}
		return usageError{msg: fmt.Sprintf(
			"%s needs one %s, but %s given\n\n%s",
			path, argument, counted(len(args), "argument was", "arguments were"),
			usageSection(cmd))}
	}
}

// usageSection repeats the synopsis help prints for a command, so a usage
// error shows the options the command requires as well as its arguments.
func usageSection(cmd *cobra.Command) string {
	lines := strings.Split(UsageLine(cmd), "\n")
	for i, line := range lines {
		lines[i] = "  " + line
	}
	return "Usage:\n" + strings.Join(lines, "\n")
}

// objectRequired backs a verb that acts on several kinds of object. The verb
// alone is not a run: it names the objects it accepts so the next command is
// obvious, and a misspelled object suggests the objects it resembles.
func objectRequired(verb string, objects ...string) cobra.PositionalArgs {
	return func(cmd *cobra.Command, args []string) error {
		if len(args) == 0 {
			return usageError{msg: fmt.Sprintf(
				"%s needs an object\n\nExpected:\n%s\n\nTry:\n  rootform %s %s",
				verb, indented(objects), verb, objects[0])}
		}
		return usageError{msg: fmt.Sprintf(
			"%s cannot act on %s\n\nExpected:\n%s\n\nTry:\n%s",
			verb, quoted(args[0]), indented(objects),
			tryCommands("rootform "+verb, closeCommands(cmd, args[0], objects), "rootform "+verb+" --help"))}
	}
}

// closeCommands keeps the candidates cobra suggests for a misspelled command
// name: those within two edits of it or starting with it.
func closeCommands(cmd *cobra.Command, typed string, candidates []string) []string {
	if typed == "" {
		return nil
	}
	if cmd.SuggestionsMinimumDistance <= 0 {
		cmd.SuggestionsMinimumDistance = 2
	}
	suggested := map[string]bool{}
	for _, name := range cmd.SuggestionsFor(typed) {
		suggested[name] = true
	}
	matches := make([]string, 0, len(suggested))
	for _, name := range candidates {
		if suggested[name] {
			matches = append(matches, name)
		}
	}
	return matches
}

// commandNames lists the subcommands help shows, in help order.
func commandNames(cmd *cobra.Command) []string {
	names := make([]string, 0, len(cmd.Commands()))
	for _, child := range cmd.Commands() {
		if child.IsAvailableCommand() {
			names = append(names, child.Name())
		}
	}
	return names
}

// tryCommands writes the Try lines of a misspelled command: each close name
// after its parent path, or the fallback when no name is close.
func tryCommands(parent string, names []string, fallback string) string {
	if len(names) == 0 {
		return "  " + fallback
	}
	lines := make([]string, 0, len(names))
	for _, name := range names {
		lines = append(lines, "  "+parent+" "+name)
	}
	return strings.Join(lines, "\n")
}

func indented(values []string) string {
	lines := make([]string, 0, len(values))
	for _, value := range values {
		lines = append(lines, "  "+value)
	}
	return strings.Join(lines, "\n")
}
