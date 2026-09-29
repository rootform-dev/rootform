package app

import (
	"errors"
	"strings"

	"github.com/rootform-dev/rootform/cli/form"
)

// validateAttestations checks the producer and provider-map attestations of
// one command and returns the provider bindings and the attestations a
// compiled Form records.
func validateAttestations(producer string, mappings []string) (map[string]string, []form.Attestation, error) {
	if producer != "" && producer != "terraform" && producer != "opentofu" {
		return nil, nil, errors.New("--producer must be terraform or opentofu")
	}
	result := map[string]string{}
	entries := []form.Attestation{}
	if producer != "" {
		entries = append(entries, form.Attestation{Name: "producer", Value: producer})
	}
	for _, entry := range mappings {
		observed, bound, ok := strings.Cut(entry, "=")
		if !ok || observed == "" || bound == "" || result[observed] != "" {
			return nil, nil, errors.New("--provider-map requires unique observed=binding pairs")
		}
		result[observed] = bound
		entries = append(entries, form.Attestation{Name: "provider-map", Value: entry})
	}
	return result, entries, nil
}
