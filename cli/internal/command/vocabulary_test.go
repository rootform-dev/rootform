package command

import (
	"reflect"
	"strings"
	"testing"
)

type vocabularyValidation struct{ got []ValidateOptions }

func (s *vocabularyValidation) Validate(options ValidateOptions) (ValidateOutcome, error) {
	s.got = append(s.got, options)
	return ValidateValid, nil
}

// A shared dimension and a shared predicate are reached by reference, so the
// surviving grammar must carry a qualified reference to the lookup unchanged
// while validation keeps naming the kind it checks.
func TestContextRelationCommandOptions(t *testing.T) {
	for _, testCase := range []struct{ noun, name string }{
		{noun: "context", name: "google.context.ownership"},
		{noun: "relation", name: "google.relation.runs-as"},
	} {
		t.Run(testCase.noun, func(t *testing.T) {
			noun, name := testCase.noun, testCase.name
			show, validate := &stubShow{outcome: ShowReported}, &vocabularyValidation{}
			for _, args := range [][]string{
				{"show", name, "--format", "json"},
				{"validate", noun, name, "--format", "json"},
			} {
				stdout, stderr := &strings.Builder{}, &strings.Builder{}
				if code := Run(&Env{Args: args, Stdout: stdout, Stderr: stderr, Show: show, Validate: validate}); code != ExitOK {
					t.Fatalf("%v = %d, %s", args, code, stderr)
				}
			}
			if !reflect.DeepEqual(show.got, []ShowOptions{{Object: ShowDefinition, Name: name, Format: FormatJSON}}) {
				t.Fatalf("show = %+v", show.got)
			}
			if !reflect.DeepEqual(validate.got, []ValidateOptions{{Object: ValidateObject(noun), Name: name, Format: FormatJSON}}) {
				t.Fatalf("validate = %+v", validate.got)
			}
		})
	}
}

func TestVocabularyHelpSurface(t *testing.T) {
	for _, path := range []string{"show", "validate context", "validate relation"} {
		t.Run(path, func(t *testing.T) {
			stdout, stderr := &strings.Builder{}, &strings.Builder{}
			args := append(strings.Fields(path), "--help")
			if code := Run(&Env{Args: args, Stdout: stdout, Stderr: stderr}); code != ExitOK {
				t.Fatalf("help = %d, %s", code, stderr)
			}
			for _, fragment := range []string{"\nUsage\n", "rootform " + path, "\nExamples\n", "--format", "\nExit status\n"} {
				if !strings.Contains(stdout.String(), fragment) {
					t.Fatalf("help missing %q:\n%s", fragment, stdout)
				}
			}
		})
	}
}
