package form

import (
	"errors"
	"testing"
)

// A match names each target attribute once; the validator locates a missing,
// empty, or repeated attribute.
func TestEmissionMatchAttributeList(t *testing.T) {
	cases := []struct {
		name, path, code string
		by               []string
	}{
		{"no attribute", "semantics.emissions[0].match.by", CodeFieldRequired, []string{}},
		{"empty attribute", "semantics.emissions[0].match.by[1]", CodeFieldRequired, []string{"filename", ""}},
		{"repeated attribute", "semantics.emissions[0].match.by[1]", CodeInconsistent, []string{"filename", "filename"}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			analysis := planFixture()
			analysis.Semantics.Emissions[0].Match = &EmissionMatch{By: tc.by, Strategy: MatchLastSegment}
			var validation *ValidationError
			if !errors.As(analysis.Validate(), &validation) {
				t.Fatal("invalid match accepted")
			}
			for _, problem := range validation.Problems {
				if problem.Code == tc.code && problem.Path == tc.path {
					return
				}
			}
			t.Fatalf("missing %s at %s: %+v", tc.code, tc.path, validation.Problems)
		})
	}
}
