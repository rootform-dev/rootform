package command

import (
	"strings"
	"testing"
)

func TestRunGrammar(t *testing.T) {
	service := &recorderService{}
	args := []string{"run", "first.json", "--diff", "second.json", "--before-stage", "recorded", "--after-stage", "planned", "--plan-file", "saved.tfplan", "--diff-plan-file", "other.tfplan", "--require-enrichment", "--plan-complete=attested", "--producer=terraform", "--provider-map", "a=b", "--project", "/work", "--dialect", "d1", "--dialect", "d2", "-o", "one.json", "-o", "two.md", "--no-browser", "--no-serve", "--port", "0"}
	env, _, stderr := newTestEnv(args, service)
	if code := Run(env); code != 0 {
		t.Fatalf("code=%d: %s", code, stderr)
	}
	o := service.got
	if o.Input != "first.json" || o.DiffInput != "second.json" || o.BeforeStage != "recorded" || o.AfterStage != "planned" || o.PlanFile != "saved.tfplan" || o.DiffPlanFile != "other.tfplan" || !o.RequireEnrichment || o.PlanComplete != "attested" || o.Producer != "terraform" || len(o.ProviderMap) != 1 || o.Project != "/work" || len(o.Dialect) != 2 || len(o.Policy) != 0 || len(o.PolicyPack) != 0 || len(o.Output) != 2 || !o.NoBrowser || !o.NoServe || o.Port != 0 {
		t.Fatalf("options=%+v", o)
	}
}

func TestRunRefusesPolicyEvaluation(t *testing.T) {
	for _, args := range [][]string{
		{"run", "plan.json", "--policy", "checks/*"},
		{"run", "plan.json", "--policy-pack", "./checks"},
		{"run", "plan.json", "--no-serve", "--format", "sarif"},
	} {
		service := &recorderService{}
		env, stdout, stderr := newTestEnv(args, service)
		if got := Run(env); got != ExitUsage || service.got.Input != "" || stdout.Len() != 0 {
			t.Fatalf("%v: code=%d called=%v stdout=%q", args, got, service.got.Input != "", stdout)
		}
		if !strings.Contains(stderr.String(), "run never evaluates Policies") || !strings.Contains(stderr.String(), "rootform check plan.json") {
			t.Fatalf("%v: stderr=%q", args, stderr)
		}
	}
	env, _, stderr := newTestEnv([]string{"run", "plan.json", "--policy-pack", "./checks"}, &recorderService{})
	if Run(env); !strings.HasSuffix(stderr.String(), "Try:\n  rootform check plan.json --policy-pack ./checks\n") {
		t.Fatalf("the suggestion does not keep the Policy Pack given: %q", stderr)
	}
	root := NewRootCommand(&Env{})
	run, _, err := root.Find([]string{"run"})
	if err != nil {
		t.Fatal(err)
	}
	for _, name := range []string{"policy", "policy-pack"} {
		if flag := run.Flags().Lookup(name); flag == nil || !flag.Hidden {
			t.Fatalf("run --%s must stay hidden and refused", name)
		}
	}
	for _, word := range []string{"sarif", "policy", "Policies passed"} {
		if strings.Contains(strings.ToLower(run.Example), word) {
			t.Fatalf("run examples still teach %q:\n%s", word, run.Example)
		}
	}
}

func TestRunSingleStage(t *testing.T) {
	service := &recorderService{}
	env, _, stderr := newTestEnv([]string{"run", "input.json", "--stage", "refreshed"}, service)
	if code := Run(env); code != 0 || service.got.Stage != "refreshed" {
		t.Fatalf("code=%d stage=%q stderr=%s", code, service.got.Stage, stderr)
	}
}
func TestRunUsage(t *testing.T) {
	const help, usage = "Try:\n  rootform run --help\n", "Usage:\n  rootform run <input> [--diff <input>] [options]\n"
	for _, c := range []struct {
		args       []string
		want, hint string
	}{
		{[]string{"run"}, "run needs one input, but 0 arguments were given", usage},
		{[]string{"run", "one", "two"}, "run needs one input, but 2 arguments were given", usage},
		{[]string{"run", "-", "--diff", "-"}, "only one input may read standard input", help},
		{[]string{"run", "one", "--port", "65536"}, "--port must be between 0 and 65535, but 65536 was given", help},
		{[]string{"run", "one", "--port", "-1"}, "--port must be between 0 and 65535, but -1 was given", help},
		{[]string{"run", "one", "--plan-complete", "true"}, "--plan-complete accepts only attested", help},
		{[]string{"run", "one", "--stage", "unknown"}, "--stage must be planned, refreshed, or recorded, but \"unknown\" was given", help},
		{[]string{"run", "one", "--diff", "two", "--stage", "planned"}, "--stage selects the stage of one input; with --diff, --before-stage\nselects the stage of one and --after-stage the stage of two", "Try:\n  rootform run one --diff two --before-stage planned\n  rootform run one --diff two --after-stage planned\n"},
		{[]string{"run", "one", "--diff", "two", "--before-stage", "unknown"}, "--before-stage must be planned, refreshed, or recorded, but \"unknown\" was given", help},
		{[]string{"run", "one", "--before-side", "unknown"}, "--before-side is retired; a saved comparison is not a --diff operand,\nand --before-stage selects the stage of one", "Try:\n  rootform run one --diff INPUT --before-stage STAGE\n"},
		{[]string{"run", "one", "--diff", "two", "--after-side", "after"}, "--after-side is retired; a saved comparison is not a --diff operand,\nand --after-stage selects the stage of two", "Try:\n  rootform run one --diff two --after-stage STAGE\n"},
		{[]string{"run", "-", "--diff", "two", "--before-side", "after"}, "--before-side is retired; a saved comparison is not a --diff operand,\nand --before-stage selects the stage of the first input", "Try:\n  rootform run INPUT --diff two --before-stage STAGE\n"},
		{[]string{"run", "one", "--no-serve", "--format", "json", "--details"}, "--details expands the text or Markdown summary, and this command writes none", "Try:\n  rootform run one --no-serve --details\n"},
		{[]string{"run", "one", "--before-stage", "planned"}, "--before-stage applies to a comparison and needs --diff", help},
		{[]string{"run", "one", "--after-stage", "planned"}, "--after-stage applies to a comparison and needs --diff", help},
		{[]string{"run", "one", "--diff-plan-file", "other.tfplan"}, "--diff-plan-file applies to a comparison and needs --diff", help},
		{[]string{"run", "one", "--format", "yaml"}, "--format must be text, json, markdown, or html", help},
		{[]string{"run", "one", "--locked", "--dialect", "override"}, "--locked and --dialect cannot be used together", "Try:\n  rootform run --locked\n"},
		{[]string{"run", "one", "--no-watch"}, "unknown flag: --no-watch", help},
	} {
		env, stdout, stderr := newTestEnv(c.args, &recorderService{})
		if got := Run(env); got != 2 {
			t.Errorf("%v: code=%d stderr=%s", c.args, got, stderr)
		}
		if stdout.Len() != 0 {
			t.Errorf("%v: stdout=%s", c.args, stdout)
		}
		if !strings.HasPrefix(stderr.String(), "rootform: "+c.want+"\n") || !strings.HasSuffix(stderr.String(), c.hint) {
			t.Errorf("%v: stderr=%q, want %q then %q", c.args, stderr, c.want, c.hint)
		}
	}
}
func TestRetiredAnalysisCommands(t *testing.T) {
	for _, name := range []string{"build", "diff", "view", "watch"} {
		env, stdout, stderr := newTestEnv([]string{name, "input"}, &recorderService{})
		if got := Run(env); got != 2 {
			t.Errorf("%s: code=%d stderr=%s", name, got, stderr)
		}
		if stdout.Len() != 0 {
			t.Errorf("%s: stdout=%s", name, stdout)
		}
		if !strings.Contains(stderr.String(), "rootform run") {
			t.Errorf("%s: missing run guidance: %s", name, stderr)
		}
	}
	help, _, _ := newTestEnv(nil, &recorderService{})
	for _, cmd := range NewRootCommand(help).Commands() {
		if cmd.Name() == "build" || cmd.Name() == "diff" || cmd.Name() == "view" {
			t.Fatalf("retired command %s registered", cmd.Name())
		}
	}
}
func TestRunExitPropagation(t *testing.T) {
	for _, code := range []int{1, 2, 3, 4} {
		env, _, stderr := newTestEnv([]string{"run", "input"}, failingService{err: RunError{Code: code, Message: "failure"}})
		if got := Run(env); got != code {
			t.Fatalf("exit=%d want=%d: %s", got, code, stderr)
		}
		if !strings.Contains(stderr.String(), "failure") {
			t.Fatal(stderr.String())
		}
	}
}

type failingService struct{ err error }

func (s failingService) Run(Options) error { return s.err }
