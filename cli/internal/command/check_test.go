package command

import (
	"bytes"
	"strings"
	"testing"
)

func checkTestEnv(args []string) (*Env, *checkRecorder, *bytes.Buffer, *bytes.Buffer) {
	env, stdout, stderr := newTestEnv(args, &recorderService{})
	recorder := &checkRecorder{}
	env.Check = recorder
	return env, recorder, stdout, stderr
}

func TestCheckGrammar(t *testing.T) {
	env, recorder, _, stderr := checkTestEnv([]string{"check", "comparison.json", "--side", "before", "--stage", "refreshed", "--policy", "checks/*", "--policy", "other.policy.x", "--policy-pack", "./checks", "--project", "/work", "--plan-file", "plan.tfplan", "--require-enrichment", "--plan-complete=attested", "--producer", "opentofu", "--provider-map", "a=b", "-o", "results.json", "-o", "results.sarif"})
	if code := Run(env); code != 0 {
		t.Fatalf("code=%d: %s", code, stderr)
	}
	o := recorder.got
	if o.Input != "comparison.json" || o.Side != "before" || o.Stage != "refreshed" || len(o.Policy) != 2 || len(o.PolicyPack) != 1 || o.Project != "/work" || o.PlanFile != "plan.tfplan" || !o.RequireEnrichment || o.PlanComplete != "attested" || o.Producer != "opentofu" || len(o.ProviderMap) != 1 || len(o.Output) != 2 {
		t.Fatalf("options=%+v", o)
	}
	env, recorder, _, stderr = checkTestEnv([]string{"check", "-", "--locked", "--format", "sarif"})
	if code := Run(env); code != 0 || recorder.got.Input != "-" || !recorder.got.Locked || recorder.got.Format != "sarif" {
		t.Fatalf("code=%d options=%+v stderr=%s", code, recorder.got, stderr)
	}
}

func TestCheckUsage(t *testing.T) {
	for _, test := range []struct {
		args []string
		want string
	}{
		{[]string{"check"}, "needs one input"},
		{[]string{"check", "one", "two"}, "needs one input"},
		{[]string{"check", "plan.json", "--format", "html"}, "rootform run plan.json --no-serve -o report.html"},
		{[]string{"check", "plan.json", "--format", "yaml"}, "--format must be text, json, markdown, or sarif"},
		{[]string{"check", "plan.json", "--diff", "other.json"}, "unknown flag: --diff"},
		{[]string{"check", "plan.json", "--no-serve"}, "unknown flag: --no-serve"},
		{[]string{"check", "plan.json", "--port", "0"}, "unknown flag: --port"},
	} {
		env, recorder, stdout, stderr := checkTestEnv(test.args)
		if got := Run(env); got != ExitUsage || recorder.called || stdout.Len() != 0 {
			t.Errorf("%v: code=%d called=%v stdout=%q", test.args, got, recorder.called, stdout)
		}
		if !strings.Contains(stderr.String(), test.want) {
			t.Errorf("%v: stderr=%q, want %q", test.args, stderr, test.want)
		}
	}
}

// Option values are refused by the service once the outputs are known safe,
// so that such a usage error still replaces every requested report.
func TestCheckOptionValues(t *testing.T) {
	for _, test := range []struct {
		opts CheckOptions
		want string
	}{
		{CheckOptions{Stage: "drift"}, "--stage must be planned, refreshed, or recorded"},
		{CheckOptions{Side: "left"}, "--side must be before, after, or both"},
		{CheckOptions{PlanComplete: "yes"}, "--plan-complete accepts only attested"},
		{CheckOptions{Policy: []string{" "}}, "--policy requires a nonempty selection"},
		{CheckOptions{Locked: true, PolicyPack: []string{"./p"}}, "--locked and --policy-pack cannot be used together"},
		{CheckOptions{Locked: true, Dialect: []string{"./d"}}, "--locked and --dialect cannot be used together"},
	} {
		err := ValidateCheckOptions(test.opts)
		if _, usage := err.(usageError); !usage || !strings.Contains(err.Error(), test.want) {
			t.Errorf("%+v: %v, want usage error %q", test.opts, err, test.want)
		}
	}
	if err := ValidateCheckOptions(CheckOptions{Stage: "recorded", Side: "before", PlanComplete: "attested", Policy: []string{"checks/*"}, Locked: true}); err != nil {
		t.Fatal(err)
	}
	env, recorder, _, stderr := checkTestEnv([]string{"check", "plan.json", "--stage", "drift", "-o", "result.json"})
	if code := Run(env); code != 0 || recorder.got.Stage != "drift" {
		t.Fatalf("option value refused before the service: code=%d stderr=%s", code, stderr)
	}
}

func TestCheckExitPropagation(t *testing.T) {
	for _, code := range []int{1, 2, 3, 4} {
		env, _, _ := newTestEnv([]string{"check", "plan.json"}, &recorderService{})
		env.Check = failingCheck{err: RunError{Code: code, Message: "POLICY_X: failure"}}
		stderr := env.Stderr.(*bytes.Buffer)
		if got := Run(env); got != code || !strings.Contains(stderr.String(), "rootform: POLICY_X: failure") {
			t.Fatalf("exit=%d want=%d: %s", got, code, stderr)
		}
	}
}

type failingCheck struct{ err error }

func (s failingCheck) Check(CheckOptions) error { return s.err }

func TestRootHelpListsCheckBesideRun(t *testing.T) {
	env, stdout, _ := newTestEnv([]string{"--help"}, &recorderService{})
	if code := Run(env); code != 0 {
		t.Fatalf("help code=%d", code)
	}
	help := stdout.String()
	start := strings.Index(help, "\nAnalyze\n")
	if start < 0 {
		t.Fatalf("root help lacks the Analyze group:\n%s", help)
	}
	analyze := help[start+1:]
	analyze = analyze[:strings.Index(analyze, "\n\n")]
	for _, want := range []string{"run ", "check "} {
		if !strings.Contains(analyze, want) {
			t.Fatalf("Analyze group lacks %q:\n%s", want, analyze)
		}
	}
}
