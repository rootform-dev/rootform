package app

import (
	"encoding/json"
	"reflect"
	"strings"
	"testing"

	"github.com/rootform-dev/rootform/cli/form"
	cli "github.com/rootform-dev/rootform/cli/internal/command"
)

func producerDisplayInput(tool form.ToolIdentity) form.InputForm {
	return form.InputForm{
		Kind: form.KindState,
		Evidence: form.Evidence{
			Producer: form.Producer{Tool: tool, ReportedVersion: "1.16.4", Hints: []string{"registry.terraform.io", "registry.opentofu.org"}},
		},
		DefaultStage: form.StageRecorded,
		Stages:       map[form.Stage]*form.Architecture{form.StageRecorded: {Stage: form.StageRecorded}},
	}
}

func TestProducerDisplayUsesOnlyEstablishedIdentity(t *testing.T) {
	for _, tc := range []struct {
		tool form.ToolIdentity
		want string
	}{
		{form.ToolTerraform, "Terraform"},
		{form.ToolOpenTofu, "OpenTofu"},
		{form.ToolUnestablished, ""},
	} {
		for _, version := range []string{"", "1.16.4", "1.10.7"} {
			for _, source := range []string{"", form.ToolSourceAttested} {
				if tc.tool == form.ToolUnestablished && source != "" {
					continue
				}
				t.Run(string(tc.tool)+"/"+version+"/"+source, func(t *testing.T) {
					input := producerDisplayInput(tc.tool)
					input.Evidence.Producer.ReportedVersion = version
					input.Evidence.Producer.ToolSource = source
					before, _ := json.Marshal(input)
					for _, details := range []bool{false, true} {
						rep := buildRunReport(runResult{decoded: form.Form{Input: &input}, operands: []operand{{name: "terraform.opentofu.json", compiled: true}}, focusStage: form.StageRecorded}, cli.Options{Details: details})
						var producerRows [][2]string
						for _, row := range rep.head {
							if row[0] == "Producer" {
								producerRows = append(producerRows, row)
							}
						}
						var want [][2]string
						if tc.want != "" {
							want = [][2]string{{"Producer", tc.want}}
						}
						if !reflect.DeepEqual(producerRows, want) {
							t.Fatalf("producer rows = %v, want %v", producerRows, want)
						}
						for _, output := range []string{reportText(rep), string(rep.markdown())} {
							if tc.want == "" && strings.Contains(output, "Producer") {
								t.Fatalf("unknown identity displayed:\n%s", output)
							}
							for _, forbidden := range []string{"Terraform or OpenTofu", "tool not established", "1.16.4", "1.10.7", "(attested)"} {
								if strings.Contains(output, forbidden) {
									t.Fatalf("display contains %q:\n%s", forbidden, output)
								}
							}
						}
					}
					after, _ := json.Marshal(input)
					if string(before) != string(after) {
						t.Fatal("human reports changed source metadata")
					}
				})
			}
		}
	}
}

func TestComparisonProducerDisplayKeepsOnlyKnownSides(t *testing.T) {
	for _, tools := range [][2]form.ToolIdentity{
		{form.ToolUnestablished, form.ToolUnestablished},
		{form.ToolTerraform, form.ToolOpenTofu},
		{form.ToolUnestablished, form.ToolOpenTofu},
		{form.ToolTerraform, form.ToolUnestablished},
	} {
		t.Run(string(tools[0])+"/"+string(tools[1]), func(t *testing.T) {
			before, after := producerDisplayInput(tools[0]), producerDisplayInput(tools[1])
			views := []stageView{{side: "Before", stage: form.StageRecorded, form: &before}, {side: "After", stage: form.StageRecorded, form: &after}}
			names := map[form.ToolIdentity]string{form.ToolTerraform: "Terraform", form.ToolOpenTofu: "OpenTofu"}
			known := names[tools[0]] != "" || names[tools[1]] != ""
			for _, details := range []bool{false, true} {
				table := sidesTable(views, details)
				var got []string
				for _, row := range table.rows {
					if row[0] == "Producer" {
						got = row
					}
				}
				var want []string
				if details && known {
					want = []string{"Producer", names[tools[0]], names[tools[1]]}
				}
				if !reflect.DeepEqual(got, want) {
					t.Fatalf("comparison producer row = %v, want %v", got, want)
				}
				markdown := string((runReport{views: views, sides: table}).markdown())
				if known && !strings.Contains(markdown, "| Producer | "+names[tools[0]]+" | "+names[tools[1]]+" |") {
					t.Fatalf("comparison provenance lost side identity:\n%s", markdown)
				}
				for _, output := range []string{reportText(runReport{sides: table}), markdown} {
					if tools[0] == form.ToolUnestablished && tools[1] == form.ToolUnestablished && strings.Contains(output, "Producer") {
						t.Fatalf("unknown comparison has producer row:\n%s", output)
					}
					for _, forbidden := range []string{"Terraform or OpenTofu", "1.16.4", "(attested)"} {
						if strings.Contains(output, forbidden) {
							t.Fatalf("comparison contains %q:\n%s", forbidden, output)
						}
					}
				}
			}
		})
	}
}
