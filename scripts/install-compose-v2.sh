#!/usr/bin/env bash
set -euo pipefail

# Installs Docker Compose v2 standalone binary into ./bin/docker-compose
# Needed on some Linux setups where:
# - `docker compose` plugin is not installed, AND
# - legacy `docker-compose` v1 is incompatible with newer Docker Engine (ContainerConfig errors)

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BIN_DIR="${ROOT_DIR}/bin"
COMPOSE_VERSION="${COMPOSE_VERSION:-v2.33.1}"

mkdir -p "${BIN_DIR}"

ARCH="$(uname -m)"
case "${ARCH}" in
  x86_64) COMPOSE_ARCH="x86_64" ;;
  aarch64|arm64) COMPOSE_ARCH="aarch64" ;;
  *)
    echo "Unsupported architecture: ${ARCH}" >&2
    exit 1
    ;;
esac

URL="https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-linux-${COMPOSE_ARCH}"

echo "[install-compose] Downloading ${URL}"
curl -fsSL "${URL}" -o "${BIN_DIR}/docker-compose"
chmod +x "${BIN_DIR}/docker-compose"

echo "[install-compose] Installed:"
"${BIN_DIR}/docker-compose" version
