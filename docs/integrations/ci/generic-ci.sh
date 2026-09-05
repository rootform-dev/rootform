#!/bin/sh
set -eu

# Provision one checksum-verified Rootform 0.1.1 binary on PATH first.
exec ./ci/rootform-ci.sh
