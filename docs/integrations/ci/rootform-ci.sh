#!/bin/sh
set -eu

rootform_bin=${ROOTFORM_BIN:-rootform}
project=${ROOTFORM_PROJECT:-.}
output=${ROOTFORM_OUTPUT_DIR:-.rootform-ci}

mkdir -p "$output"

run_rootform() {
  if [ "${ROOTFORM_OFFLINE:-0}" = "1" ]; then
    "$rootform_bin" "$@" --offline
  else
    "$rootform_bin" "$@"
  fi
}

run_rootform init "$project" --locked --no-input --format json >"$output/init.json"
run_rootform build "$project" --locked --no-input --format json >"$output/architecture.json"
run_rootform check "$project" --locked --no-input --format json >"$output/check.json"
