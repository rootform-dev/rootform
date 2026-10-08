package app

import (
	"sort"
	"strings"
)

// identifiersOf names each declaration by its identity.
func identifiersOf[Declared any](declared []Declared, id func(Declared) string) []string {
	identifiers := make([]string, 0, len(declared))
	for _, entry := range declared {
		identifiers = append(identifiers, id(entry))
	}
	return identifiers
}

const (
	resolveUnknown   = -1
	resolveAmbiguous = -2
)

func lookupIdentifier(identifiers []string, query string) (int, bool) {
	exact := resolveUnknown
	for index, identifier := range identifiers {
		if identifier != query {
			continue
		}
		if exact != resolveUnknown {
			return resolveAmbiguous, true
		}
		exact = index
	}
	if exact != resolveUnknown {
		return exact, true
	}
	if strings.ContainsAny(query, "/.") {
		return resolveUnknown, false
	}
	matches := make([]int, 0, 1)
	for index, identifier := range identifiers {
		if strings.HasSuffix(identifier, "/"+query) || strings.HasSuffix(identifier, "."+query) {
			matches = append(matches, index)
		}
	}
	if len(matches) == 1 {
		return matches[0], true
	}
	if len(matches) > 1 {
		return resolveAmbiguous, true
	}
	return resolveUnknown, false
}

func identList(identifiers []string) string {
	ordered := append([]string{}, identifiers...)
	sort.Strings(ordered)
	lines := make([]string, 0, len(ordered))
	for _, identifier := range ordered {
		lines = append(lines, "  "+identifier)
	}
	return strings.Join(lines, "\n")
}
