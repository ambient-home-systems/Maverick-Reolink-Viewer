#!/usr/bin/env bash
# Create the development environment: Python 3.14 venv with the pinned HA test
# stack, and the frontend's node_modules. Requires uv and Node 22.12+.
set -euo pipefail
cd "$(dirname "$0")/.."

uv venv -p 3.14 .venv
uv pip install --python .venv/bin/python -r requirements_test.txt
(cd frontend && npm ci)

cat <<'MSG'
Done. Run the checks with:
  source .venv/bin/activate
  ruff check . && ruff format --check . && mypy && pytest
  (cd frontend && npm run lint && npm run typecheck && npm test && npm run build)
MSG
