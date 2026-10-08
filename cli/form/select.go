package form

import (
	"fmt"
	"sort"
	"strings"
)

// StageUnavailableError names the requested stage and the stages a Form has.
type StageUnavailableError struct {
	Subject   string
	Stage     Stage
	Available []string
}

func (e StageUnavailableError) Error() string {
	return fmt.Sprintf("STAGE_UNAVAILABLE: %s has no %s stage; available: %s",
		e.Subject, titleStage(e.Stage), strings.Join(e.Available, ", "))
}

// Select chooses one stage of an input Form, or of one embedded side of a
// comparison Form.
func Select(decoded Form, stage Stage, side string) (Side, error) {
	var analysis *InputForm
	selectedFrom := SelectedFromInput
	if decoded.Comparison != nil {
		switch side {
		case "", SideAfter:
			analysis = &decoded.Comparison.After.Form
			selectedFrom = SelectedFromAfter
		case SideBefore:
			analysis = &decoded.Comparison.Before.Form
			selectedFrom = SelectedFromBefore
		default:
			return Side{}, fmt.Errorf("unknown side %q; choose before or after", side)
		}
	} else if decoded.Input != nil {
		analysis = decoded.Input
		if side != "" {
			return Side{}, fmt.Errorf("side %q requires a comparison Form", side)
		}
	} else {
		return Side{}, fmt.Errorf("no Form")
	}
	if stage == "" {
		if decoded.Comparison != nil {
			if selectedFrom == SelectedFromBefore {
				stage = decoded.Comparison.Before.Stage
			} else {
				stage = decoded.Comparison.After.Stage
			}
		} else if analysis.Kind == KindState {
			stage = StageRecorded
		} else {
			stage = StagePlanned
		}
	}
	if analysis.Stages[stage] == nil {
		available := make([]string, 0, len(analysis.Stages))
		for candidate, value := range analysis.Stages {
			if value != nil {
				available = append(available, string(candidate))
			}
		}
		sort.Strings(available)
		for i, candidate := range available {
			available[i] = titleStage(Stage(candidate))
		}
		subject := "this input"
		switch selectedFrom {
		case SelectedFromBefore:
			subject = "the Before side"
		case SelectedFromAfter:
			subject = "the After side"
		}
		return Side{}, StageUnavailableError{Subject: subject, Stage: stage, Available: available}
	}
	return Side{Form: *analysis, Stage: stage, SelectedFrom: selectedFrom}, nil
}

func titleStage(stage Stage) string {
	value := string(stage)
	if value == "" {
		return value
	}
	return strings.ToUpper(value[:1]) + value[1:]
}
