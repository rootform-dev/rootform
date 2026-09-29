package command

import (
	"errors"
)

// serviceFailure maps a service's classified error to the command exit contract.
func serviceFailure(err error) error {
	var usage interface{ UsageError() bool }
	if errors.As(err, &usage) && usage.UsageError() {
		return usageError{msg: err.Error()}
	}
	var negative interface{ Negative() bool }
	if errors.As(err, &negative) && negative.Negative() {
		return NegativeError{Message: err.Error()}
	}
	var noAnswer interface{ NoAnswer() bool }
	if errors.As(err, &noAnswer) && noAnswer.NoAnswer() {
		return RunError{Code: ExitNoAnswer, Message: err.Error()}
	}
	return UnavailableError{Message: err.Error()}
}
