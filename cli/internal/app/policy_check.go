package app

import (
	"sort"

	"github.com/rootform-dev/rootform/cli/backend"
	"github.com/rootform-dev/rootform/cli/policyresult"
)

// policyPacks is the active Policy Pack set of one invocation as the backend
// loaded it: the packs rootform.lock selects with --policy-pack overlays
// applied. Nothing in it is linked until a Policy it holds is selected.
type policyPacks []backend.Pack

func (p policyPacks) empty() bool { return len(p) == 0 }

func (p policyPacks) packCount() int { return len(p) }

// loaded records every pack as a result reports it unlinked.
func (p policyPacks) loaded() []policyresult.PolicyPack {
	packs := []policyresult.PolicyPack{}
	for _, pack := range p {
		packs = append(packs, pack.Record)
	}
	return packs
}

// resolve returns the selected Policy IDs. Without selectors a command
// selects every Policy of its overlay packs, or of every active pack when it
// names no overlay.
func (p policyPacks) resolve(selectors []string) ([]string, error) {
	if len(selectors) == 0 {
		packs := map[string]struct{}{}
		for _, pack := range p {
			if pack.Overlay {
				packs[pack.Record.ID] = struct{}{}
			}
		}
		if len(packs) == 0 {
			for _, pack := range p {
				packs[pack.Record.ID] = struct{}{}
			}
		}
		for name := range packs {
			selectors = append(selectors, name+"/*")
		}
		sort.Strings(selectors)
	}
	return resolvePolicySelection(p, selectors)
}
