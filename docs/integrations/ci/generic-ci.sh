#!/bin/sh
set -eu

# Install a checksum-verified Rootform binary first. Export ROOTFORM_INPUT.
ROOTFORM_PROJECT=${ROOTFORM_PROJECT:-./infra}
export ROOTFORM_PROJECT
exec sh ./ci/rootform-ci.sh
