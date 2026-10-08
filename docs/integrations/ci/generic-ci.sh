#!/bin/sh
set -eu

# Run this reviewed script from the trusted checkout. Export completed evidence
# paths and a fresh output directory; the producer is a separate pipeline step.
umask 077
tools=$(mktemp -d "${TMPDIR:-/tmp}/rootform-ci-tools.XXXXXXXX")
trap 'rm -rf -- "$tools"' 0
version=${ROOTFORM_VERSION:-0.1.0}
if [ -z "${ROOTFORM_BIN:-}" ]; then
  curl --fail --silent --show-error --location --proto '=https' --proto-redir '=https' \
    https://rootform.dev/install > "$tools/install.sh"
  ROOTFORM_VERSION="$version" ROOTFORM_INSTALL_DIR="$tools/bin" sh "$tools/install.sh"
  ROOTFORM_BIN="$tools/bin/rootform"
fi
if [ "$("$ROOTFORM_BIN" version)" != "rootform $version" ]; then
  printf '%s\n' 'ROOTFORM_BIN does not match ROOTFORM_VERSION' >&2
  exit 2
fi
ROOTFORM_PROJECT=${ROOTFORM_PROJECT:-./infra}
ROOTFORM_HOME=${ROOTFORM_HOME:-$tools/home}
export ROOTFORM_PROJECT ROOTFORM_HOME ROOTFORM_BIN
if [ -f "$ROOTFORM_PROJECT/rootform.lock" ]; then
  "$ROOTFORM_BIN" init "$ROOTFORM_PROJECT" --locked --no-input
fi
set +e
sh ./ci/rootform-ci.sh
status=$?
set -e
exit "$status"
