#!/bin/sh
set -eu

rootform_bin=${ROOTFORM_BIN:-rootform}
project=${ROOTFORM_PROJECT:-.}
output=${ROOTFORM_OUTPUT_DIR:-.rootform-ci}
policy_pack=${ROOTFORM_POLICY_PACK:-}

mkdir -p "$output"

locked=0
if [ -f "$project/rootform.lock" ]; then
  locked=1
fi

if [ "$locked" = 1 ]; then
  if [ "${ROOTFORM_OFFLINE:-0}" = "1" ]; then
    "$rootform_bin" init "$project" --locked --no-input --offline --format json >"$output/init.json"
  else
    "$rootform_bin" init "$project" --locked --no-input --format json >"$output/init.json"
  fi
  "$rootform_bin" build "$project" --locked --format json >"$output/architecture.json"
else
  "$rootform_bin" build "$project" --format json >"$output/architecture.json"
fi

if [ "$locked" != 1 ] && [ -z "$policy_pack" ]; then
  exit 0
fi

set +e
if [ -n "$policy_pack" ]; then
  "$rootform_bin" check "$project" --policy-pack "$policy_pack" --format json >"$output/check.json" 2>"$output/check.stderr"
else
  "$rootform_bin" check "$project" --locked --format json >"$output/check.json" 2>"$output/check.stderr"
fi
check_status=$?
set -e

printf '%s\n' "$check_status" >"$output/check.status"
exit "$check_status"
