package form

import (
	"crypto/sha256"
	"encoding/hex"
	"strconv"
	"strings"
)

func escapeComponent(value string) string {
	var builder strings.Builder
	for i := 0; i < len(value); i++ {
		switch value[i] {
		case '%':
			builder.WriteString("%25")
		case ':':
			builder.WriteString("%3A")
		default:
			builder.WriteByte(value[i])
		}
	}
	return builder.String()
}

// EncodeID joins a tag and components with ':' after escaping ':' and '%'.
func EncodeID(tag string, components ...string) string {
	parts := make([]string, 0, len(components)+1)
	parts = append(parts, escapeComponent(tag))
	for _, component := range components {
		parts = append(parts, escapeComponent(component))
	}
	return strings.Join(parts, ":")
}

// RepresentationID identifies a managed or data instance by its
// stage-independent Terraform instance address.
func RepresentationID(instanceAddress string) string {
	return EncodeID("representation", IdentityContract, instanceAddress)
}

// DeclarationID identifies a configuration-level declaration.
func DeclarationID(configurationAddress string) string {
	return EncodeID("declaration", IdentityContract, configurationAddress)
}

// ExternalID identifies an external endpoint by target concept and its
// ordinal among the distinct external identities of that concept in one
// input Form. The ordinal is stable across the stages of that Form and
// means nothing across Forms: a cross comparison pairs endpoints through
// its external matches.
func ExternalID(concept string, ordinal int) string {
	return EncodeID("external", IdentityContract, concept, strconv.Itoa(ordinal))
}

// ClosureID identifies the closure of one emission for one representation.
func ClosureID(representation, emission string) string {
	return EncodeID("closure", representation, emission)
}

func ContextID(dimension, from, to string) string {
	return EncodeID("context", dimension, from, to)
}

func ContributionID(from, to string) string {
	return EncodeID("contribution", from, to)
}

func RelationID(predicate, from, to string) string {
	return EncodeID("relation", predicate, from, to)
}

func MembershipID(root, name, member string) string {
	return EncodeID("membership", root, name, member)
}

func DependencyID(from, to string) string {
	return EncodeID("dependency", from, to)
}

func DriftEntryID(address string) string {
	return EncodeID("drift", address)
}

func RepresentationChangeID(comparison string, change ChangeKind, representation string) string {
	return EncodeID("change", comparison, string(change), representation)
}

func FactChangeID(comparison string, change ChangeKind, fact string) string {
	return EncodeID("change", comparison, string(change), fact)
}

func IndeterminateID(comparison, closure, side string) string {
	return EncodeID("indeterminate", comparison, closure, side)
}

func CancellationID(fact string) string {
	return EncodeID("cancelled", fact)
}

// EmissionID derives the stable identity of an executable emission shape.
func EmissionID(value Emission) string {
	match := ""
	if value.Match != nil {
		match = string(value.Match.Strategy) + "|" + strings.Join(value.Match.By, "\x01")
	}
	key := strings.Join([]string{
		value.Rule, string(value.Kind), value.Dimension, value.Predicate, string(value.To.Kind), value.To.ID,
		value.Via, match, string(value.OnNull), string(value.OnEmpty), string(value.External), string(value.Disclose), value.Prefix,
	}, "\x00")
	return hashID("emission", key)
}

// DiagnosticID derives identity from stable fields only.
func DiagnosticID(value Diagnostic) string {
	key := strings.Join([]string{
		string(value.Phase), string(value.Severity), value.Code, string(value.Stage), value.Declaration,
		value.Representation, value.Path, value.Owner, value.Rule, value.Emission,
	}, "\x00")
	return hashID("diagnostic", key)
}

func hashID(prefix, value string) string {
	sum := sha256.Sum256([]byte(value))
	return prefix + ":" + hex.EncodeToString(sum[:])
}

// ReleaseSetIdentity derives the release-set identity from its units.
func ReleaseSetIdentity(version string, units []ReleaseSetUnit) ReleaseSet {
	canonical := append([]ReleaseSetUnit{}, units...)
	for i := 1; i < len(canonical); i++ {
		for j := i; j > 0 && canonical[j].Owner < canonical[j-1].Owner; j-- {
			canonical[j], canonical[j-1] = canonical[j-1], canonical[j]
		}
	}
	parts := []string{version}
	for _, unit := range canonical {
		parts = append(parts, unit.Owner, string(unit.Kind), unit.Version, unit.ContentDigest, unit.SemanticDigest)
	}
	sum := sha256.Sum256([]byte(strings.Join(parts, "\x00")))
	digest := "sha256:" + hex.EncodeToString(sum[:])
	return ReleaseSet{ID: "release-set:" + strings.TrimPrefix(digest, "sha256:"), Version: version, ManifestDigest: digest, Units: canonical}
}
