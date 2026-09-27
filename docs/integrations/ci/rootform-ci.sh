#!/bin/sh
set -eu

rootform_bin=${ROOTFORM_BIN:-rootform}
project=${ROOTFORM_PROJECT:-./infra}
input=${ROOTFORM_INPUT:-}
plan_file=${ROOTFORM_PLAN_FILE:-}
pack=${ROOTFORM_POLICY_PACK:-}
policy=${ROOTFORM_POLICY:-}
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
if [ -n "$pack" ] && [ -f "$project/rootform.lock" ]; then
  printf '%s\n' 'ROOTFORM_POLICY_PACK cannot be combined with a project rootform.lock; select the Policy Pack in the lock' >&2
  exit 2
fi

# mkdir without -p fails if the directory appeared since the check above, so a
# concurrent writer can never hand this job a directory holding older files.
mkdir -p "$(dirname "$output")"
if ! mkdir "$output" 2>/dev/null; then
  printf '%s\n' 'ROOTFORM_OUTPUT_DIR must be a fresh directory' >&2
  exit 2
fi
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

set -- run "$input" --project "$project" --no-serve -o "$output/analysis.json" -o "$output/report.md"
if [ -n "$plan_file" ]; then set -- "$@" --plan-file "$plan_file" --require-enrichment; fi
if [ -f "$project/rootform.lock" ]; then set -- "$@" --locked; fi

set +e
"$rootform_bin" "$@" >"$output/summary.txt" 2>"$output/run.stderr"
status=$?
set -e
printf '%s\n' "$status" >"$output/run.status"
if [ "$status" -ne 0 ]; then exit "$status"; fi

run_gate=false
if [ -n "$pack" ] || [ -n "$policy" ]; then run_gate=true; fi
if [ -f "$project/rootform.lock" ] &&
  tr -d ' \t\r\n' <"$project/rootform.lock" | grep -q '"policy_packs":\[{'; then
  run_gate=true
fi
if [ "$run_gate" = false ]; then exit 0; fi

set -- check "$output/analysis.json" --project "$project" \
  -o "$output/policy.json" -o "$output/policy.md" -o "$output/results.sarif"
if [ -n "$pack" ]; then set -- "$@" --policy-pack "$pack"; fi
if [ -n "$policy" ]; then
  set -f
  for selector in $policy; do set -- "$@" --policy "$selector"; done
  set +f
fi
if [ -f "$project/rootform.lock" ]; then set -- "$@" --locked; fi

set +e
"$rootform_bin" "$@" >"$output/check.txt" 2>"$output/check.stderr"
status=$?
set -e
printf '%s\n' "$status" >"$output/check.status"
exit "$status"
