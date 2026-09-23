#!/bin/sh
set -eu

# Provision one checksum-verified Rootform 0.1.0 binary on PATH first.
# Run from repository root with a writable .rootform-ci directory.
ROOTFORM_PROJECT=${ROOTFORM_PROJECT:-./infra}
export ROOTFORM_PROJECT
exec sh ./ci/rootform-ci.sh
