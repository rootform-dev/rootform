package command

import (
	"strings"
)

func applyPreparationEnvironment(env *Env, offline, noInput *bool) {
	applyOfflineEnvironment(env, offline)
	getenv := env.Getenv
	if getenv == nil {
		getenv = func(string) string { return "" }
	}
	if strings.TrimSpace(getenv("ROOTFORM_INPUT")) == "0" ||
		strings.EqualFold(strings.TrimSpace(getenv("CI")), "true") ||
		(env.InputTerminal != nil && !env.InputTerminal()) {
		*noInput = true
	}
}

func applyOfflineEnvironment(env *Env, offline *bool) bool {
	getenv := env.Getenv
	if getenv == nil {
		getenv = func(string) string { return "" }
	}
	if strings.TrimSpace(getenv("ROOTFORM_OFFLINE")) == "1" {
		*offline = true
		return true
	}
	return false
}
