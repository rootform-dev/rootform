#!/bin/sh
set -eu

rootform_bin=${ROOTFORM_BIN:-rootform}
project=${ROOTFORM_PROJECT:-./infra}
input=${ROOTFORM_INPUT:-}
plan_file=${ROOTFORM_PLAN_FILE:-}
pack=${ROOTFORM_POLICY_PACK:-}
output=${ROOTFORM_OUTPUT_DIR:-.rootform-ci}

if [ -z "$input" ] || [ ! -f "$input" ]; then
  printf '%s\n' 'ROOTFORM_INPUT must name an existing plan or state JSON file' >&2
  exit 2
fi
if [ ! -d "$project" ]; then
  printf '%s\n' 'ROOTFORM_PROJECT must name a directory' >&2
  exit 2
fi
if [ -e "$output" ] || [ -L "$output" ]; then
  printf '%s\n' 'ROOTFORM_OUTPUT_DIR must be a fresh directory' >&2
  exit 2
fi
if [ -n "$plan_file" ] && [ ! -f "$plan_file" ]; then
  printf '%s\n' 'ROOTFORM_PLAN_FILE must name an existing saved plan' >&2
  exit 2
fi

mkdir -p "$output"
output=$(cd "$output" && pwd -P)
input=$(cd "$(dirname "$input")" && pwd -P)/$(basename "$input")
if [ -n "$plan_file" ]; then
  plan_file=$(cd "$(dirname "$plan_file")" && pwd -P)/$(basename "$plan_file")
fi
if [ -n "$pack" ]; then
  pack=$(cd "$(dirname "$pack")" && pwd -P)/$(basename "$pack")
fi
case "$rootform_bin" in
  /*) ;;
  */*) rootform_bin=$(cd "$(dirname "$rootform_bin")" && pwd -P)/$(basename "$rootform_bin") ;;
esac

set -- run "$input" --project "$project" --no-serve -o "$output/analysis.json" -o "$output/report.md" -o "$output/results.sarif"
if [ -n "$plan_file" ]; then set -- "$@" --plan-file "$plan_file" --require-enrichment; fi
if [ -n "$pack" ]; then set -- "$@" --policy-pack "$pack"; fi
if [ -f "$project/rootform.lock" ]; then set -- "$@" --locked; fi

set +e
"$rootform_bin" "$@" >"$output/summary.txt" 2>"$output/run.stderr"
status=$?
set -e
printf '%s\n' "$status" >"$output/run.status"
exit "$status"
