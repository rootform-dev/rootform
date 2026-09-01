# Rootform official container image.
#
# The build context is produced by scripts/build-image.ts from an assembled
# release directory. It never compiles Rootform, never checks out producer
# source, and never reaches the network: every payload byte is copied from a
# release archive whose checksums were verified before staging.
#
# The base image is pinned to a multi-platform index digest so linux/amd64 and
# linux/arm64 resolve to the exact same Alpine release.
FROM alpine:3.22@sha256:14358309a308569c32bdc37e2e0e9694be33a9d99e68afb0f5ff33cc1f695dce

ARG TARGETARCH
ARG ROOTFORM_CREATED
ARG ROOTFORM_REVISION
ARG ROOTFORM_VERSION

LABEL org.opencontainers.image.created="${ROOTFORM_CREATED}" \
      org.opencontainers.image.description="Rootform analyzes Terraform and OpenTofu source into a deterministic architecture model." \
      org.opencontainers.image.documentation="https://github.com/rootform-dev/rootform/blob/main/docs/integrations/oci-image.md" \
      org.opencontainers.image.licenses="Elastic-2.0" \
      org.opencontainers.image.revision="${ROOTFORM_REVISION}" \
      org.opencontainers.image.source="https://github.com/rootform-dev/rootform" \
      org.opencontainers.image.title="Rootform" \
      org.opencontainers.image.url="https://github.com/rootform-dev/rootform" \
      org.opencontainers.image.vendor="Rootform" \
      org.opencontainers.image.version="${ROOTFORM_VERSION}"

# CI runners bind-mount workspaces with arbitrary host UIDs and GIDs. Both the
# working directory and the Rootform home are world-writable with the sticky
# bit so the image behaves identically under the default root user and under an
# explicit `--user`. Alpine already ships the CA bundle Rootform needs, so no
# package installation and therefore no network access happens here.
RUN mkdir -p /workspace /var/cache/rootform /usr/local/share/rootform \
 && chmod 1777 /workspace /var/cache/rootform

COPY --chmod=0755 binaries/${TARGETARCH}/rootform /usr/local/bin/rootform
COPY --chmod=0644 share/ /usr/local/share/rootform/

ENV ROOTFORM_HOME=/var/cache/rootform
WORKDIR /workspace

# No ENTRYPOINT: GitLab, CircleCI, Buildkite, and Jenkins container jobs replace
# the command with their own shell script. Callers name the command explicitly,
# for example `rootform check .`.
