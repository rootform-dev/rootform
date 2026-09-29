package command

import (
	"reflect"
	"strings"
	"testing"
)

type explainRecorder struct {
	got    ExplainOptions
	called bool
}

func (r *explainRecorder) Explain(o ExplainOptions) error { r.got, r.called = o, true; return nil }

func explainRun(args ...string) (int, *explainRecorder, string, string) {
	recorder := &explainRecorder{}
	env, stdout, stderr := newTestEnv(append([]string{"explain"}, args...), &recorderService{})
	env.Explain = recorder
	code := Run(env)
	return code, recorder, stdout.String(), stderr.String()
}

func TestExplainGrammar(t *testing.T) {
	for _, test := range []struct {
		args []string
		want ExplainOptions
	}{
		{
			[]string{"instance", "aws_vpc.main", "--input", "plan.json"},
			ExplainOptions{Object: ExplainInstance, Name: "aws_vpc.main", Input: "plan.json", Format: FormatText},
		},
		{
			[]string{"rule", "aws.rule.vpc", "--input", "comparison.json", "--side", "after", "--stage", "planned", "--format", "json", "--details"},
			ExplainOptions{Object: ExplainRule, Name: "aws.rule.vpc", Input: "comparison.json", Side: "after", Stage: "planned", Format: FormatJSON, Details: true},
		},
		{
			[]string{"policy", "baseline/vpc-flow-logs", "--result", "results.json", "--input", "form.json", "--side", "before", "--project", "/work"},
			ExplainOptions{Object: ExplainPolicy, Name: "baseline/vpc-flow-logs", Result: "results.json", Input: "form.json", Side: "before", Format: FormatText, Project: "/work"},
		},
		{
			[]string{"policy", "vpc-flow-logs", "--result", "-"},
			ExplainOptions{Object: ExplainPolicy, Name: "vpc-flow-logs", Result: "-", Format: FormatText},
		},
	} {
		code, recorder, _, stderr := explainRun(test.args...)
		if code != ExitOK || !recorder.called || !reflect.DeepEqual(recorder.got, test.want) {
			t.Errorf("%v: code=%d options=%+v stderr=%q", test.args, code, recorder.got, stderr)
		}
	}
}

// Every refusal happens before the service reads an input or a result.
func TestExplainRefusesBeforeReadingAnything(t *testing.T) {
	for _, test := range []struct {
		args []string
		want []string
	}{
		{[]string{"architecture", "aws_vpc.main", "--input", "plan.json"}, []string{"explain architecture is now explain instance", "rootform explain instance ADDRESS --input INPUT"}},
		{[]string{"semantics", "aws.rule.vpc"}, []string{"explain semantics is now explain rule", "rootform show RULE"}},
		{[]string{"instance"}, []string{"explain instance needs one address", "Usage:\n  rootform explain instance <address> --input <input> [options]\n"}},
		{[]string{"rule"}, []string{"explain rule needs one rule", "Usage:\n  rootform explain rule <rule> --input <input> [options]\n"}},
		{[]string{"policy"}, []string{"explain policy needs one policy", "Usage:\n  rootform explain policy <policy> --result <file> [options]\n"}},
		{[]string{"instance", "aws_vpc.main"}, []string{"explain instance needs --input"}},
		{[]string{"rule", "aws.rule.vpc"}, []string{"needs --input", "rootform show aws.rule.vpc"}},
		{[]string{"policy", "vpc-flow-logs"}, []string{"explain policy needs --result", "rootform check plan.json -o results.json"}},
		{[]string{"policy", "vpc-flow-logs", "--result", "-", "--input", "-"}, []string{"only one input may read standard input"}},
		{[]string{"policy", "vpc-flow-logs", "--result", "r.json", "--dialect", "./d"}, []string{"--dialect shapes how --input compiles and needs --input"}},
		{[]string{"policy", "vpc-flow-logs", "--result", "r.json", "--plan-file", "saved.tfplan"}, []string{"--plan-file shapes how --input compiles and needs --input"}},
		{[]string{"policy", "vpc-flow-logs", "--result", "r.json", "--stage", "planned"}, []string{"unknown flag: --stage"}},
		{[]string{"policy", "vpc-flow-logs", "--result", "r.json", "--policy-pack", "./p"}, []string{"--policy-pack belongs to check; explain policy explains the outcomes\na result recorded and never evaluates Policies", "Try:\n  rootform check plan.json --policy-pack ./p -o r.json\n  rootform explain policy vpc-flow-logs --result r.json\n"}},
		{[]string{"policy", "vpc-flow-logs", "--result", "-", "--input", "form.json", "--policy-pack", "./p"}, []string{"Try:\n  rootform check form.json --policy-pack ./p -o results.json\n  rootform explain policy vpc-flow-logs --result results.json\n"}},
		{[]string{"instance", "x", "--input", "plan.json", "--side", "both"}, []string{"--side must be before or after", "rootform explain instance --help"}},
		{[]string{"instance", "x", "--input", "plan.json", "--stage", "applied"}, []string{"--stage must be planned, refreshed, or recorded"}},
		{[]string{"rule", "x", "--input", "plan.json", "--format", "sarif"}, []string{"--format must be text or json"}},
		{[]string{"instance", "x", "--input", "plan.json", "--plan-complete", "yes"}, []string{"--plan-complete accepts only attested"}},
		{[]string{"instance", "x", "--input", "plan.json", "--locked", "--dialect", "./d"}, []string{"--locked and --dialect cannot be used together"}},
	} {
		code, recorder, stdout, stderr := explainRun(test.args...)
		if code != ExitUsage || recorder.called || stdout != "" {
			t.Errorf("%v: code=%d called=%v stdout=%q", test.args, code, recorder.called, stdout)
		}
		for _, want := range test.want {
			if !strings.Contains(stderr, want) {
				t.Errorf("%v: stderr lacks %q:\n%s", test.args, want, stderr)
			}
		}
	}
}

func TestExplainHelpListsOnlyCurrentNames(t *testing.T) {
	env, stdout, stderr := newTestEnv([]string{"explain", "--help"}, &recorderService{})
	if code := Run(env); code != ExitOK {
		t.Fatalf("help = %d: %s", code, stderr)
	}
	help := stdout.String()
	for _, want := range []string{"  instance ", "  policy ", "  rule "} {
		if !strings.Contains(help, want) {
			t.Errorf("explain help lacks %q:\n%s", want, help)
		}
	}
	for _, retired := range []string{"architecture", "semantics"} {
		if strings.Contains(help, retired) {
			t.Errorf("explain help names the retired %q:\n%s", retired, help)
		}
	}
}
