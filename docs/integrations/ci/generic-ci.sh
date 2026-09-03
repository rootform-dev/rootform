#!/bin/sh
set -eu

# Provision one checksum-verified Rootform 0.1.0 binary on PATH first.
exec ./ci/rootform-ci.sh
