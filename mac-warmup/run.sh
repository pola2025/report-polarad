#!/bin/bash
# Polarad Meta API Warmup — iMac launchd 실행 래퍼
# 실행: ./mac-warmup/run.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPT_PATH="$REPO_ROOT/scripts/meta-api-warmup.js"
ENV_PATH="$REPO_ROOT/dashboard/.env.local"

cd "$REPO_ROOT"

# ── nvm 또는 시스템 Node 22+ 사용 ────────────────────────────
# nvm이 설치되어 있으면 그쪽 우선, 아니면 시스템 PATH의 node
if [[ -s "$HOME/.nvm/nvm.sh" ]]; then
    # shellcheck disable=SC1091
    source "$HOME/.nvm/nvm.sh"
    nvm use --silent 22 2>/dev/null || nvm use --silent default
fi

NODE_BIN="$(command -v node || true)"
if [[ -z "$NODE_BIN" ]]; then
    echo "[$(date -u +%FT%TZ)] ERROR: node not found in PATH" >&2
    exit 127
fi

NODE_VERSION="$($NODE_BIN -v)"
echo "[$(date -u +%FT%TZ)] Node: $NODE_VERSION ($NODE_BIN)"

# Node 20 미만이면 Supabase realtime이 깨짐 — 명시적으로 거절
NODE_MAJOR="$(echo "$NODE_VERSION" | sed -E 's/^v([0-9]+).*/\1/')"
if (( NODE_MAJOR < 22 )); then
    echo "[$(date -u +%FT%TZ)] ERROR: Node 22+ required, got $NODE_VERSION" >&2
    # 실패 텔레그램 알림 (스크립트 내장 알림은 Node 시작 전에 깨지므로 여기서 별도 호출)
    if [[ -f "$ENV_PATH" ]]; then
        # shellcheck disable=SC1090
        TELEGRAM_BOT_TOKEN=$(grep '^TELEGRAM_BOT_TOKEN=' "$ENV_PATH" | cut -d'=' -f2- | tr -d '"')
        if [[ -n "${TELEGRAM_BOT_TOKEN:-}" ]]; then
            curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
                -d "chat_id=-1003394139746" \
                -d "text=[polarad-meta/mac-warmup] Node 22+ required, got $NODE_VERSION on iMac" >/dev/null || true
        fi
    fi
    exit 1
fi

# 의존성 설치 (최초 1회용 - 이미 있으면 스킵)
if [[ ! -d "$REPO_ROOT/scripts/node_modules/@supabase/supabase-js" ]]; then
    echo "[$(date -u +%FT%TZ)] Installing scripts/ dependencies..."
    cd "$REPO_ROOT/scripts"
    npm install --no-audit --no-fund @supabase/supabase-js dotenv
    cd "$REPO_ROOT"
fi

# ── 실행 ──────────────────────────────────────────────────
echo "[$(date -u +%FT%TZ)] Running meta-api-warmup..."
"$NODE_BIN" "$SCRIPT_PATH"
EXIT=$?
echo "[$(date -u +%FT%TZ)] meta-api-warmup exited with $EXIT"
exit $EXIT
