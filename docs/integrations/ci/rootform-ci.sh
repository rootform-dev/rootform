#!/bin/sh
set -eu

rootform_bin=${ROOTFORM_BIN:-rootform}
project=${ROOTFORM_PROJECT:-.}
output=${ROOTFORM_OUTPUT_DIR:-.rootform-ci}
policy_pack=${ROOTFORM_POLICY_PACK:-}
check=${ROOTFORM_CHECK:-0}
plan=${ROOTFORM_PLAN:-}

case "$output" in
  -*) printf '%s\n' 'ROOTFORM_OUTPUT_DIR must not start with -' >&2; exit 2 ;;
esac

# Refuse symlink traversal before creating or cleaning any result file.
remaining=$output
case "$output" in
  /*)
    if [ -L "$output" ]; then
      printf '%s\n' 'ROOTFORM_OUTPUT_DIR must not be a symbolic link' >&2
      exit 2
    fi
    walked=/
    remaining=${remaining#/}
    ;;
  *) walked=. ;;
esac
while [ -n "$remaining" ]; do
  part=${remaining%%/*}
  if [ "$part" = "$remaining" ]; then
    remaining=
  else
    remaining=${remaining#*/}
  fi
  if [ -n "$part" ] && [ "$part" != . ]; then
    if [ "$walked" = / ]; then
      walked=/$part
    else
      walked=$walked/$part
    fi
    if [ -L "$walked" ]; then
      parent=${walked%/*}
      [ -n "$parent" ] || parent=/
      if [ -w "$parent" ]; then
        printf '%s\n' 'ROOTFORM_OUTPUT_DIR must not traverse a writable symbolic link' >&2
        exit 2
      fi
    fi
  fi
done

mkdir -p "$output"
output_dir=$(cd "$output" && pwd -P)
work_dir=$(pwd -P)
case "$output_dir" in
  /|/tmp|/private/tmp|/var/tmp)
    printf '%s\n' 'ROOTFORM_OUTPUT_DIR must be a dedicated directory' >&2
    exit 2
    ;;
esac
case "$work_dir/" in
  "$output_dir/"*) printf '%s\n' 'ROOTFORM_OUTPUT_DIR must not contain the working directory' >&2; exit 2 ;;
esac
if [ -d "$project" ]; then
  project_dir=$(cd "$project" && pwd -P)
  case "$project_dir/" in
    "$output_dir/"*) printf '%s\n' 'ROOTFORM_OUTPUT_DIR must not contain the project' >&2; exit 2 ;;
  esac
fi

# This script owns only these names. Clear them before validating run options,
# so rejected configurations cannot expose results from a previous invocation.
for name in init.json init.stderr architecture.json build.stderr diff.json diff.md diff.stderr check.json check.stderr check.status; do
  if [ -d "$output/$name" ] && [ ! -L "$output/$name" ]; then
    printf 'Result path is a directory: %s\n' "$output/$name" >&2
    exit 2
  fi
done
for name in init.json init.stderr architecture.json build.stderr diff.json diff.md diff.stderr check.json check.stderr check.status; do
  rm -f "$output/$name"
done

case "$check" in
  0|1) ;;
  *) printf '%s\n' 'ROOTFORM_CHECK must be 0 or 1' >&2; exit 2 ;;
esac
if [ "$check" = 0 ] && [ -n "$policy_pack" ]; then
  printf '%s\n' 'ROOTFORM_POLICY_PACK requires ROOTFORM_CHECK=1' >&2
  exit 2
fi

# Plan mode reads a completed JSON plan export. Rootform reads the project
# selection from its working directory, so every plan command runs inside the
# project directory through a subshell. The script's own directory never
# changes; relative plan, pack, and binary paths are resolved first.
plan_file=
pack_path=$policy_pack
if [ -n "$plan" ]; then
  case "$plan" in
    -*) printf '%s\n' 'ROOTFORM_PLAN must name a JSON plan file, not standard input' >&2; exit 2 ;;
  esac
  if [ ! -f "$plan" ]; then
    printf 'ROOTFORM_PLAN is not a file: %s\n' "$plan" >&2
    exit 2
  fi
  if [ ! -d "$project" ]; then
    printf 'ROOTFORM_PROJECT must be a directory when ROOTFORM_PLAN is set: %s\n' "$project" >&2
    exit 2
  fi
  plan_file=$(cd "$(dirname "$plan")" && pwd -P)/$(basename "$plan")
  case "$rootform_bin" in
    /*) ;;
    */*) rootform_bin=$(cd "$(dirname "$rootform_bin")" && pwd -P)/$(basename "$rootform_bin") ;;
  esac
  if [ -d "$policy_pack" ]; then
    pack_path=$(cd "$policy_pack" && pwd -P)
  elif [ -f "$policy_pack" ]; then
    pack_path=$(cd "$(dirname "$policy_pack")" && pwd -P)/$(basename "$policy_pack")
  fi
fi

locked=0
if [ -f "$project/rootform.lock" ]; then
  locked=1
fi

if [ "$locked" = 1 ]; then
  if [ "${ROOTFORM_OFFLINE:-0}" = "1" ]; then
    "$rootform_bin" init "$project" --locked --no-input --offline --format json >"$output/init.json" 2>"$output/init.stderr"
  else
    "$rootform_bin" init "$project" --locked --no-input --format json >"$output/init.json" 2>"$output/init.stderr"
  fi
fi

if [ -n "$plan" ]; then
  if [ "$locked" = 1 ]; then
    (cd "$project" && "$rootform_bin" build --plan "$plan_file" --locked --format json) >"$output/architecture.json" 2>"$output/build.stderr"
  else
    (cd "$project" && "$rootform_bin" build --plan "$plan_file" --format json) >"$output/architecture.json" 2>"$output/build.stderr"
  fi
  (cd "$project" && "$rootform_bin" diff --plan "$plan_file" --format json) >"$output/diff.json" 2>"$output/diff.stderr"
  (cd "$project" && "$rootform_bin" diff --plan "$plan_file" --format markdown) >"$output/diff.md" 2>>"$output/diff.stderr"
elif [ "$locked" = 1 ]; then
  "$rootform_bin" build "$project" --locked --format json >"$output/architecture.json" 2>"$output/build.stderr"
else
  "$rootform_bin" build "$project" --format json >"$output/architecture.json" 2>"$output/build.stderr"
fi

if [ "$check" = 0 ]; then
  exit 0
fi

set +e
if [ -n "$plan" ] && [ -n "$policy_pack" ]; then
  (cd "$project" && "$rootform_bin" check --plan "$plan_file" --policy-pack "$pack_path" --format json) >"$output/check.json" 2>"$output/check.stderr"
elif [ -n "$plan" ] && [ "$locked" = 1 ]; then
  (cd "$project" && "$rootform_bin" check --plan "$plan_file" --locked --format json) >"$output/check.json" 2>"$output/check.stderr"
elif [ -n "$plan" ]; then
  (cd "$project" && "$rootform_bin" check --plan "$plan_file" --format json) >"$output/check.json" 2>"$output/check.stderr"
elif [ -n "$policy_pack" ]; then
  "$rootform_bin" check "$project" --policy-pack "$policy_pack" --format json >"$output/check.json" 2>"$output/check.stderr"
elif [ "$locked" = 1 ]; then
  "$rootform_bin" check "$project" --locked --format json >"$output/check.json" 2>"$output/check.stderr"
else
  "$rootform_bin" check "$project" --format json >"$output/check.json" 2>"$output/check.stderr"
fi
check_status=$?
set -e

printf '%s\n' "$check_status" >"$output/check.status"
exit "$check_status"
