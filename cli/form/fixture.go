package form

import "errors"

// FixtureJSON returns the bytes a Dialect fixture records as its golden: the
// canonical input Form with its semantic snapshot narrowed to the definitions
// the Form reaches, exactly as the display copy narrows it. Record-tier
// identities stay: a golden is the Dialect author's test data, and what a
// rule records is part of what the fixture proves. The complete snapshot is
// the Dialect set itself, which a fixture has no reason to repeat: it made
// every official fixture golden about 1.8 MB and changed all of them on any
// Dialect edit. The input must be a validated input Form and is never modified.
func FixtureJSON(a *InputForm) ([]byte, error) {
	if a == nil {
		return nil, errors.New("a fixture records a state or plan Form")
	}
	fixture := a.Canonicalize()
	if err := narrowSemantics(fixture); err != nil {
		return nil, err
	}
	return fixture.Encode()
}
