#!/usr/bin/env bash
# Runs every browser test against a local copy of the app. Nothing here touches a real
# library: each test uses a fresh browser profile, stand-in book data and fake covers.
# Usage: tests/run-all.sh            (all)      tests/run-all.sh data-safety   (one)
set -uo pipefail
cd "$(dirname "$0")"
[ -f .fixtures/barcode.y4m ] || ./make-fixtures.sh
SERVER_BIN="${HTTP_SERVER_BIN:-$(command -v http-server || echo /opt/node-tools/node_modules/http-server/bin/http-server)}"
if ! curl -s -o /dev/null http://localhost:8123/; then
  node "$SERVER_BIN" .. -p 8123 -c-1 -s >/dev/null 2>&1 &
  SERVER_PID=$!
  trap 'kill $SERVER_PID 2>/dev/null' EXIT
  sleep 1.5
fi
TESTS=(data-safety scan-and-covers genres-and-celebration milestones home-and-feedback book-status games-and-profile no-camera start-screen cover-reading offline)
[ $# -gt 0 ] && TESTS=("$@")
failed=()
for t in "${TESTS[@]}"; do
  echo "=== $t"
  out=$(timeout 600 node "$t.mjs" 2>&1); code=$?
  echo "$out" | tail -n 25
  if [ $code -ne 0 ] || ! echo "$out" | grep -q "^errors: \[\]$"; then failed+=("$t"); fi
done
echo
if [ ${#failed[@]} -eq 0 ]; then echo "ALL PASSED (${#TESTS[@]} tests)"; else echo "FAILED: ${failed[*]}"; exit 1; fi
