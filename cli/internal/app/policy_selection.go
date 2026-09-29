package app

import (
	"fmt"
	"sort"
	"strings"

	"github.com/rootform-dev/rootform/cli/backend"
)

// policyID is the identity of the Policy name that pack declares.
func policyID(pack, name string) string {
	return pack + ".policy." + name
}

// policyIdentity reads PACK/NAME, the short form check selectors and SARIF
// rule identities use, as the Policy identity PACK.policy.NAME. Any other
// query is returned unchanged.
func policyIdentity(query string) string {
	if pack, name, found := strings.Cut(query, "/"); found && pack != "" && name != "" {
		return policyID(pack, name)
	}
	return query
}

// resolvePolicySelection returns the sorted IDs of the Policies a selection
// names, before anything is linked or evaluated. A selector that names no
// declared Policy is refused rather than dropped: a mistyped selection must
// not read as a clean check over nothing.
func resolvePolicySelection(packs []backend.Pack, selection []string) ([]string, error) {
	declared := make(map[string]struct{})
	packNames := make(map[string]struct{}, len(packs))
	for _, pack := range packs {
		packNames[pack.Record.ID] = struct{}{}
		for _, declaredPolicy := range pack.Policies {
			declared[declaredPolicy] = struct{}{}
		}
	}
	declaredIDs := make([]string, 0, len(declared))
	for id := range declared {
		declaredIDs = append(declaredIDs, id)
	}
	sort.Strings(declaredIDs)

	wanted := make(map[string]struct{}, len(selection))
	var unknown []string
	var ambiguous []string
	for _, selector := range selection {
		if pack, whole := strings.CutSuffix(selector, "/*"); whole {
			if _, ok := packNames[pack]; !ok {
				unknown = append(unknown, selector)
				continue
			}
			for _, id := range declaredIDs {
				if strings.HasPrefix(id, pack+".policy.") {
					wanted[id] = struct{}{}
				}
			}
			continue
		}
		if _, ok := declared[selector]; ok {
			wanted[selector] = struct{}{}
			continue
		}
		// pack/name is the short form of the qualified pack.policy.name.
		if pack, name, qualified := strings.Cut(selector, "/"); qualified {
			id := policyID(pack, name)
			if _, ok := declared[id]; ok && pack != "" && name != "" {
				wanted[id] = struct{}{}
			} else {
				unknown = append(unknown, selector)
			}
			continue
		}
		if !strings.Contains(selector, ".") {
			matches := make([]string, 0, 1)
			for _, id := range declaredIDs {
				if strings.HasSuffix(id, ".policy."+selector) {
					matches = append(matches, id)
				}
			}
			if len(matches) == 1 {
				wanted[matches[0]] = struct{}{}
				continue
			}
			if len(matches) > 1 {
				ambiguous = append(ambiguous, fmt.Sprintf(
					"%q matches %s", selector, strings.Join(quoteAll(matches), ", ")))
				continue
			}
		}
		unknown = append(unknown, selector)
	}
	if len(unknown) != 0 {
		sort.Strings(unknown)
		return nil, fmt.Errorf(
			"no Policy named %s is declared by the loaded Policy Packs\n\nTry:\n  rootform list policies",
			strings.Join(quoteAll(unknown), ", "))
	}
	if len(ambiguous) != 0 {
		sort.Strings(ambiguous)
		return nil, fmt.Errorf(
			"Policy selection is ambiguous: %s\n\nUse:\n  <policy-pack>.policy.<name>",
			strings.Join(ambiguous, "; "))
	}
	selected := make([]string, 0, len(wanted))
	for id := range wanted {
		selected = append(selected, id)
	}
	sort.Strings(selected)
	return selected, nil
}

func quoteAll(values []string) []string {
	quoted := make([]string, 0, len(values))
	for _, value := range values {
		quoted = append(quoted, fmt.Sprintf("%q", value))
	}
	return quoted
}
