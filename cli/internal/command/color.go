package command

import (
	"errors"
	"strconv"
	"strings"
)

// Accepted values of the global --color option.
const (
	colorAuto   = "auto"
	colorAlways = "always"
	colorNever  = "never"
)

// colorOption validates --color at parse time so an unknown value reports the
// accepted set instead of silently falling back.
type colorOption struct{ value string }

func (option *colorOption) String() string { return option.value }

func (option *colorOption) Type() string { return "mode" }

func (option *colorOption) Set(value string) error {
	switch value {
	case colorAuto, colorAlways, colorNever:
		option.value = value
		return nil
	default:
		return errors.New("accepted values are auto, always, and never")
	}
}

// requestedColorMode reads --color before the command line is parsed, so the
// help output a user is about to read already carries the requested styling.
// An unrecognized value keeps the default here and is reported by the parser.
func requestedColorMode(args []string) string {
	for index := 0; index < len(args); index++ {
		argument := args[index]
		if argument == "--" {
			break
		}
		if value, found := strings.CutPrefix(argument, "--color="); found {
			return value
		}
		if argument == "--color" && index+1 < len(args) {
			return args[index+1]
		}
	}
	return colorAuto
}

// resolveColor applies the requested mode and reports whether standard output
// carries color.
func resolveColor(env *Env, args []string) bool {
	if env.Color == nil {
		return false
	}
	mode := requestedColorMode(args)
	switch mode {
	case colorAuto, colorAlways, colorNever:
	default:
		mode = colorAuto
	}
	enabled, err := env.Color(mode)
	return err == nil && enabled
}

// requestedPaging reports whether the command line leaves paging on: only
// --no-pager before "--" turns it off. An invalid value is refused by the
// parser before any report is written.
func requestedPaging(args []string) bool {
	for _, argument := range args {
		if argument == "--" {
			break
		}
		if argument == "--no-pager" {
			return false
		}
		if value, found := strings.CutPrefix(argument, "--no-pager="); found {
			off, err := strconv.ParseBool(value)
			return err != nil || !off
		}
	}
	return true
}

// resolvePaging applies the paging request before any command writes.
func resolvePaging(env *Env, args []string) {
	if env.Paging != nil {
		env.Paging(requestedPaging(args))
	}
}

const (
	ansiReset = "\x1b[0m"
	ansiTitle = "\x1b[1m\x1b[38;5;208m"
	ansiName  = "\x1b[1m"
	ansiDim   = "\x1b[2m"
)

// colorizeUsage marks the structure of the usage text: section titles carry
// the product accent, command names stand out, and their one-line summaries
// stay secondary. The plain template is returned unchanged when color is off,
// so uncolored help never differs by a single byte.
func colorizeUsage(template string, enabled bool) string {
	if !enabled {
		return template
	}
	for _, title := range []string{
		"Usage:", "Aliases:", "Examples:", "Available Commands:",
		"Additional Commands:", "Flags:", "Global Flags:", "Additional help topics:",
	} {
		template = strings.ReplaceAll(template, title, ansiTitle+title+ansiReset)
	}
	template = strings.ReplaceAll(template, "{{.Title}}", ansiTitle+"{{.Title}}"+ansiReset)
	template = strings.ReplaceAll(template,
		"{{rpad .Name .NamePadding }}", ansiName+"{{rpad .Name .NamePadding }}"+ansiReset)
	template = strings.ReplaceAll(template, "{{.Short}}", ansiDim+"{{.Short}}"+ansiReset)
	return template
}
