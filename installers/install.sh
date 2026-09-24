#!/bin/sh
set -eu

fail() { printf 'rootform installer: %s\n' "$*" >&2; exit 1; }

version=${ROOTFORM_VERSION:-@ROOTFORM_VERSION@}
printf '%s\n' "$version" | grep -Eq '^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(-[0-9A-Za-z]+([.-][0-9A-Za-z]+)*)?$' || fail "invalid release version: $version"

os=${ROOTFORM_TEST_OS:-$(uname -s)}
arch=${ROOTFORM_TEST_ARCH:-$(uname -m)}
case "$os" in Darwin) os=darwin ;; Linux) os=linux ;; *) fail "unsupported operating system: $os" ;; esac
case "$arch" in x86_64|amd64) arch=amd64 ;; arm64|aarch64) arch=arm64 ;; *) fail "unsupported architecture: $arch" ;; esac
asset="rootform_${version}_${os}_${arch}.tar.gz"
base=${ROOTFORM_RELEASE_BASE_URL:-https://github.com/rootform-dev/rootform/releases/download/v${version}}
case "$base" in
  https://*) curl_protocol=https; redirects=5 ;;
  http://localhost:*|http://127.0.0.1:*|http://\[::1\]:*) curl_protocol=http; redirects=0 ;;
  *) fail "release URL must use HTTPS or localhost HTTP" ;;
esac
base=${base%/}

umask 077
work=$(mktemp -d "${TMPDIR:-/tmp}/rootform-install.XXXXXXXX") || fail "cannot create temporary directory"
trap 'rm -rf -- "$work"' 0
fetch() {
  curl --fail --silent --show-error --location --max-redirs "$redirects" --proto "=$curl_protocol" --proto-redir "=$curl_protocol" \
    --output "$2" "$base/$1" || fail "download failed: $1"
}
fetch SHA256SUMS "$work/SHA256SUMS"
fetch "rootform_${version}_manifest.json" "$work/manifest.json"
fetch "$asset" "$work/archive.tar.gz"

expected=$(awk -v name="$asset" '$2 == name && NF == 2 { print $1 }' "$work/SHA256SUMS")
manifest_expected=$(awk -v name="rootform_${version}_manifest.json" '$2 == name && NF == 2 { print $1 }' "$work/SHA256SUMS")
case "$expected:$manifest_expected" in
  *[!0-9a-f:]*|'') fail "invalid release checksum metadata" ;;
esac
[ "${#expected}" -eq 64 ] && [ "${#manifest_expected}" -eq 64 ] || fail "missing release checksum metadata"
digest() {
  if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1" | awk '{print $1}'
  elif command -v shasum >/dev/null 2>&1; then shasum -a 256 "$1" | awk '{print $1}'
  else fail "SHA-256 tool required (sha256sum or shasum)"
  fi
}
[ "$(digest "$work/manifest.json")" = "$manifest_expected" ] || fail "release manifest checksum mismatch"
[ "$(digest "$work/archive.tar.gz")" = "$expected" ] || fail "archive checksum mismatch"
grep -F '"name": "rootform"' "$work/manifest.json" >/dev/null || fail "invalid release version metadata"
grep -F "\"tag\": \"v$version\"" "$work/manifest.json" >/dev/null || fail "invalid release version metadata"
grep -F "\"version\": \"$version\"" "$work/manifest.json" >/dev/null || fail "invalid release version metadata"

# Final archives contain exactly these flat entries. Extract only executable to stdout.
actual=$(tar -tzf "$work/archive.tar.gz" | LC_ALL=C sort) || fail "corrupted archive"
required=$(printf '%s\n' ROOTFORM-BINARY-LICENSE.txt SHA256SUMS THIRD_PARTY_NOTICES.txt \
  rootform "rootform_${version}_sbom.spdx.json" | LC_ALL=C sort)
[ "$actual" = "$required" ] || fail "unexpected archive contents"
tar -xOzf "$work/archive.tar.gz" rootform > "$work/rootform" || fail "cannot extract executable"
[ -s "$work/rootform" ] || fail "archive executable is empty"
chmod 755 "$work/rootform"
"$work/rootform" version >/dev/null || fail "downloaded executable cannot run"

destination=${ROOTFORM_INSTALL_DIR:-$HOME/.local/bin}
case "$destination" in /*) ;; *) fail "installation directory must be absolute" ;; esac
mkdir -p "$destination" || fail "cannot create installation directory: $destination"
[ -d "$destination" ] && [ -w "$destination" ] || fail "installation directory is not writable: $destination"
staged=$(mktemp "$destination/.rootform.XXXXXXXX") || fail "cannot stage executable"
trap 'rm -f -- "$staged"; rm -rf -- "$work"' 0
cp "$work/rootform" "$staged" || fail "cannot stage executable"
chmod 755 "$staged"
mv -f "$staged" "$destination/rootform" || fail "cannot install executable"
trap 'rm -rf -- "$work"' 0
printf 'Installed Rootform %s to %s/rootform\n' "$version" "$destination"
case ":$PATH:" in
  *":$destination:"*) ;;
  *) printf 'Add %s to PATH, then run rootform version.\n' "$destination" ;;
esac
