#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   scripts/split_backend_repo.sh <new-backend-repo-url>
# Example:
#   scripts/split_backend_repo.sh git@github.com:your-org/deep-agent-backend.git

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <new-backend-repo-url>"
  exit 1
fi

TARGET_REMOTE_URL="$1"

# Ensure we are at repository root
REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

if [[ ! -d backend ]]; then
  echo "backend/ directory not found at $REPO_ROOT"
  exit 1
fi

SPLIT_BRANCH="backend-split-temp"

echo "[1/4] Creating split branch from backend/ history..."
git subtree split --prefix=backend -b "$SPLIT_BRANCH"

echo "[2/4] Initializing temporary export repo..."
TMP_DIR="$(mktemp -d)"
git init "$TMP_DIR" >/dev/null

pushd "$TMP_DIR" >/dev/null
  git remote add origin "$TARGET_REMOTE_URL"
  echo "[3/4] Pulling split branch commit from source repo..."
  git pull "$REPO_ROOT" "$SPLIT_BRANCH"

  echo "[4/4] Pushing backend history to target remote..."
  git push -u origin HEAD:main
popd >/dev/null

rm -rf "$TMP_DIR"
git branch -D "$SPLIT_BRANCH" >/dev/null

echo "Done. Backend history pushed to: $TARGET_REMOTE_URL"
