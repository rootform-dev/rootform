package form

import (
	"strings"
	"testing"
)

func TestSelect(t *testing.T) {
	plan, state, comparison := planFixture(), snapshotFixture(), crossFixture()
	for _, tc := range []struct {
		name         string
		decoded      Form
		stage        Stage
		side         string
		want         Stage
		selectedFrom string
	}{
		{"a plan defaults to Planned", Form{Input: plan}, "", "", StagePlanned, SelectedFromInput},
		{"a state defaults to Recorded", Form{Input: state}, "", "", StageRecorded, SelectedFromInput},
		{"a named stage is selected", Form{Input: plan}, StageRefreshed, "", StageRefreshed, SelectedFromInput},
		{"a comparison defaults to its After side", Form{Comparison: comparison}, "", "", comparison.After.Stage, SelectedFromAfter},
		{"a comparison side keeps its recorded stage", Form{Comparison: comparison}, "", SideBefore, comparison.Before.Stage, SelectedFromBefore},
	} {
		t.Run(tc.name, func(t *testing.T) {
			selected, err := Select(tc.decoded, tc.stage, tc.side)
			if err != nil {
				t.Fatal(err)
			}
			if selected.Stage != tc.want || selected.SelectedFrom != tc.selectedFrom {
				t.Fatalf("selected %s from %s, want %s from %s", selected.Stage, selected.SelectedFrom, tc.want, tc.selectedFrom)
			}
		})
	}
	for _, tc := range []struct {
		name    string
		decoded Form
		stage   Stage
		side    string
		want    string
	}{
		{"a missing stage names the available ones", Form{Input: state}, StagePlanned, "", "STAGE_UNAVAILABLE: this input has no Planned stage; available: Recorded"},
		{"a side needs a comparison Form", Form{Input: plan}, "", SideBefore, `side "before" requires a comparison Form`},
		{"an unknown side is refused", Form{Comparison: comparison}, "", "middle", `unknown side "middle"; choose before or after`},
		{"an empty Form has nothing to select", Form{}, "", "", "no Form"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			if _, err := Select(tc.decoded, tc.stage, tc.side); err == nil || !strings.Contains(err.Error(), tc.want) {
				t.Fatalf("error = %v, want %q", err, tc.want)
			}
		})
	}
}
