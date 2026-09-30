package command

import (
	"fmt"
	"testing"
)

func TestServiceFailureKeepsStructuredRunError(t *testing.T) {
	want := RunError{
		Code: ExitNoAnswer, Message: "rootform.lock is invalid",
		DiagnosticCode: "SELECTION_LOCK_INVALID", Headline: "rootform.lock is invalid",
		Body: "Expected strict JSON with known fields and no duplicates",
	}
	got := serviceFailure(fmt.Errorf("selection: %w", want))
	if got != want {
		t.Fatalf("serviceFailure = %#v, want %#v", got, want)
	}
}
