package form

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
)

// Encode validates and serializes the one Form that decoded holds.
func Encode(decoded Form) ([]byte, error) {
	if decoded.Input != nil {
		if err := decoded.Input.Validate(); err != nil {
			return nil, err
		}
		return decoded.Input.Encode()
	}
	if decoded.Comparison != nil {
		if err := decoded.Comparison.Validate(); err != nil {
			return nil, err
		}
		return decoded.Comparison.Encode()
	}
	return nil, errors.New("no document")
}

// Digest identifies a Form by its canonical serialization: the bytes Encode
// writes, which include the generator version and exclude timestamps and
// local paths. Equal digests mean equal Form bytes, not merely equivalent
// architectures.
func Digest(decoded Form) (string, error) {
	data, err := Encode(decoded)
	if err != nil {
		return "", err
	}
	sum := sha256.Sum256(data)
	return "sha256:" + hex.EncodeToString(sum[:]), nil
}
