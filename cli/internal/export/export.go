// Package export turns one Form into a single self-contained HTML artifact. It
// owns the embedding rule and nothing else: the shell is supplied by the
// caller, the Form's display copy is already canonical, and no
// architecture, Terraform, or semantic decision is taken here.
package export

import (
	"bytes"
	"errors"
	"strings"
)

// Placeholder is the element a shell carries for the document it will
// receive. The shell and this package agree on it byte for byte, so a shell
// that no longer carries it fails loudly instead of exporting an empty canvas.
const Placeholder = `<script id="rootform-document" type="application/json">null</script>`

// PresentationPlaceholder is the element carrying the exact resolved
// presentation catalog used by the exported viewer.
const PresentationPlaceholder = `<script id="rootform-presentation" type="application/json">null</script>`

const (
	documentOpenMarker     = `<script id="rootform-document" type="application/json">`
	presentationOpenMarker = `<script id="rootform-presentation" type="application/json">`
	closeMarker            = `</script>`
)

// ErrNoShell reports a build carrying no export shell.
var ErrNoShell = errors.New("this build cannot export HTML")

// ErrShellUnusable reports a shell that does not carry the agreed placeholders.
var ErrShellUnusable = errors.New("the export shell carries no document placeholder")

// Render substitutes the display copy of a document and its presentation
// catalog into the shell. Both payloads are escaped so no value they carry can
// terminate or extend the element that holds it, and the result stays a pure
// function of its inputs.
func Render(shell []byte, display, presentation []byte) ([]byte, error) {
	if len(shell) == 0 {
		return nil, ErrNoShell
	}
	if len(display) == 0 {
		return nil, errors.New("the document is empty")
	}
	if len(presentation) == 0 {
		return nil, errors.New("the presentation is empty")
	}
	if bytes.Count(shell, []byte(Placeholder)) != 1 ||
		bytes.Count(shell, []byte(PresentationPlaceholder)) != 1 {
		return nil, ErrShellUnusable
	}
	rendered, ok := substitute(shell, Placeholder, documentOpenMarker, display)
	if !ok {
		return nil, ErrShellUnusable
	}
	rendered, ok = substitute(rendered, PresentationPlaceholder, presentationOpenMarker, presentation)
	if !ok {
		return nil, ErrShellUnusable
	}
	return rendered, nil
}

func substitute(shell []byte, placeholder, openMarker string, payload []byte) ([]byte, bool) {
	index := bytes.Index(shell, []byte(placeholder))
	if index < 0 {
		return nil, false
	}
	escaped := escape(payload)
	rendered := make([]byte, 0, len(shell)+len(escaped))
	rendered = append(rendered, shell[:index]...)
	rendered = append(rendered, openMarker...)
	rendered = append(rendered, escaped...)
	rendered = append(rendered, closeMarker...)
	rendered = append(rendered, shell[index+len(placeholder):]...)
	return rendered, true
}

// escape rewrites the characters that would let a document value leave its
// element. The result stays valid JSON, so the page parses the identical
// document back.
func escape(canonical []byte) string {
	replacer := strings.NewReplacer(
		"<", `\u003c`,
		">", `\u003e`,
		"&", `\u0026`,
		"\u2028", `\u2028`,
		"\u2029", `\u2029`,
	)
	return replacer.Replace(string(canonical))
}
