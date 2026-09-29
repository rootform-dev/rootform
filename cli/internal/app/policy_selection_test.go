package app

import (
	"reflect"
	"strings"
	"testing"

	"github.com/rootform-dev/rootform/cli/backend"
	"github.com/rootform-dev/rootform/cli/policyresult"
)

func selectionPacks(ids ...string) []backend.Pack {
	byPack := map[string][]string{}
	order := []string{}
	for _, id := range ids {
		pack, _, _ := strings.Cut(id, ".policy.")
		if _, seen := byPack[pack]; !seen {
			order = append(order, pack)
		}
		byPack[pack] = append(byPack[pack], id)
	}
	packs := []backend.Pack{}
	for _, pack := range order {
		packs = append(packs, backend.Pack{Record: policyresult.PolicyPack{ID: pack, Version: "0.1.0"}, Policies: byPack[pack]})
	}
	return packs
}

func TestPolicySelectionForms(t *testing.T) {
	packs := selectionPacks("filter.policy.pass", "filter.policy.fail", "guard.policy.pass", "guard.policy.unique")
	for _, test := range []struct {
		selectors []string
		want      []string
	}{
		{[]string{"filter/*"}, []string{"filter.policy.fail", "filter.policy.pass"}},
		{[]string{"filter/pass"}, []string{"filter.policy.pass"}},
		{[]string{"guard.policy.pass"}, []string{"guard.policy.pass"}},
		{[]string{"unique"}, []string{"guard.policy.unique"}},
		{[]string{"filter/pass", "filter.policy.pass", "guard/*"}, []string{"filter.policy.pass", "guard.policy.pass", "guard.policy.unique"}},
	} {
		got, err := resolvePolicySelection(packs, test.selectors)
		if err != nil || !reflect.DeepEqual(got, test.want) {
			t.Fatalf("%v = %v, %v; want %v", test.selectors, got, err, test.want)
		}
	}
}

func TestPolicySelectionRefusesUnknownAndAmbiguousNames(t *testing.T) {
	packs := selectionPacks("filter.policy.pass", "guard.policy.pass")
	for _, selector := range []string{"filter/missing", "absent/pass", "/pass", "filter/", "missing/*", "filter.policy.missing", "nothing"} {
		if _, err := resolvePolicySelection(packs, []string{selector}); err == nil || !strings.Contains(err.Error(), "no Policy named") {
			t.Fatalf("%s: error = %v", selector, err)
		}
	}
	_, err := resolvePolicySelection(packs, []string{"pass"})
	if err == nil || !strings.Contains(err.Error(), `"filter.policy.pass", "guard.policy.pass"`) {
		t.Fatalf("ambiguous error = %v", err)
	}
}

func TestPolicySelectionOfAnEmptyPackSelectsNothing(t *testing.T) {
	packs := []backend.Pack{{Record: policyresult.PolicyPack{ID: "empty", Version: "0.1.0"}}}
	got, err := resolvePolicySelection(packs, []string{"empty/*"})
	if err != nil || len(got) != 0 {
		t.Fatalf("empty pack = %v, %v", got, err)
	}
}

func TestDefaultSelectionPrefersOverlays(t *testing.T) {
	set := policyPacks(selectionPacks("locked.policy.one", "overlay.policy.two"))
	set[1].Overlay = true
	got, err := set.resolve(nil)
	if err != nil || !reflect.DeepEqual(got, []string{"overlay.policy.two"}) {
		t.Fatalf("overlay default = %v, %v", got, err)
	}
	set[1].Overlay = false
	got, err = set.resolve(nil)
	if err != nil || !reflect.DeepEqual(got, []string{"locked.policy.one", "overlay.policy.two"}) {
		t.Fatalf("project default = %v, %v", got, err)
	}
}
