package app

import "testing"

func TestLookupIdentifierIsOwnerFirstAndKeepsDeclarationIndex(t *testing.T) {
	identifiers := []string{"zeta.concept.shared", "alpha.concept.other", "alpha.concept.shared"}
	tests := []struct {
		query string
		index int
		found bool
	}{
		{query: "alpha.concept.other", index: 1, found: true},
		{query: "other", index: 1, found: true},
		{query: "shared", index: -2, found: true},
		{query: "wrong/other", index: -1, found: false},
	}
	for _, test := range tests {
		index, found := lookupIdentifier(identifiers, test.query)
		if index != test.index || found != test.found {
			t.Fatalf("lookup %q = (%d, %t), want (%d, %t)",
				test.query, index, found, test.index, test.found)
		}
	}
}
