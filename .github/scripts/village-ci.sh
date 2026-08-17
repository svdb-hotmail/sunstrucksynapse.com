#!/usr/bin/env bash
set -euo pipefail

# Sunstruck Synapse Radio comprehensive quality gate.
# Pull-request execution is suppressed while the PR is Draft.

npm ci --no-audit --no-fund
npm audit --audit-level=high
npx playwright install --with-deps chromium firefox webkit
DATABASE_URL="${DATABASE_URL:-postgresql://ci:ci@127.0.0.1:5432/unused}" npm run ci
