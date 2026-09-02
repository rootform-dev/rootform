# Rootform official container image.
#
# The build context is produced by scripts/build-image.ts from an assembled
# release directory. It never compiles Rootform or checks out producer source.
# No build instruction downloads packages or remote payloads. The Alpine base
# remains one external input and is pinned below by multi-platform index digest.
#
# The base image is pinned to a multi-platform index digest so linux/amd64 and
# linux/arm64 resolve to the exact same Alpine release.
FROM alpine:3.24@sha256:28bd5fe8b56d1bd048e5babf5b10710ebe0bae67db86916198a6eec434943f8b

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

# Alpine already provides the shell, grep, and CA bundle required by CI and
# Rootform's embedded OCI client. The fixed user owns only its persistent home
# and the image-owned workspace; bind mounts retain host-side ownership.
RUN set -eu; \
    test -n "${ROOTFORM_CREATED}"; \
    test -n "${ROOTFORM_REVISION}"; \
    test -n "${ROOTFORM_VERSION}"; \
    case "${TARGETARCH}" in amd64|arm64) ;; *) exit 1 ;; esac; \
    command -v sh >/dev/null; \
    command -v grep >/dev/null; \
    test -s /etc/ssl/cert.pem || test -s /etc/ssl/certs/ca-certificates.crt; \
    rm -f /usr/bin/wget; \
    ! command -v wget >/dev/null 2>&1; \
    mkdir -p /home/rootform/.rootform /usr/local/share/rootform /workspace; \
    chown -R 65532:65532 /home/rootform /workspace; \
    chmod 0700 /home/rootform/.rootform; \
    chmod 0755 /workspace

COPY --chmod=0755 binaries/${TARGETARCH}/rootform /usr/local/bin/rootform
COPY --chmod=0644 share/ROOTFORM-BINARY-LICENSE.txt /usr/local/share/rootform/
COPY --chmod=0644 share/THIRD_PARTY_NOTICES.txt /usr/local/share/rootform/
COPY --chmod=0644 share/rootform_${ROOTFORM_VERSION}_sbom.spdx.json /usr/local/share/rootform/

ENV HOME=/home/rootform \
    ROOTFORM_HOME=/home/rootform/.rootform

WORKDIR /workspace

USER 65532:65532

# No ENTRYPOINT: CI runners can replace the command with their shell script.
CMD ["rootform", "--help"]
