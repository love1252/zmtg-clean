#!/usr/bin/env bash
set -euo pipefail

CONTAINER_NAME="${ZMTG_LOCAL_ACCEPTANCE_CONTAINER:-zmtg-local-acceptance-pg}"
DB_NAME="${ZMTG_LOCAL_ACCEPTANCE_DB:-zmtg_clean_local_acceptance}"
DB_PORT="${ZMTG_LOCAL_ACCEPTANCE_PORT:-55432}"
DB_USER="postgres"
DB_PASSWORD="postgres"
IMAGE="${ZMTG_LOCAL_ACCEPTANCE_IMAGE:-postgres:16-alpine}"
LABEL_KEY="com.zmtg.local-acceptance"
LABEL_VALUE="true"

LOCAL_DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@127.0.0.1:${DB_PORT}/${DB_NAME}"

usage() {
  cat <<'USAGE'
Usage: scripts/dev/local-acceptance-db.sh <command>

Commands:
  ensure    Start a localhost-only PostgreSQL container for local acceptance.
  migrate   Run existing Drizzle migrations against the local acceptance DB.
  verify    Verify the 03C failure_reason_code column exists.
  dev       Start Next dev on port 5010 using the local acceptance DB.
  stop      Stop the local acceptance container created by this script.

The script never reads or prints .env.local, never seeds or resets data, and
refuses to run when DATABASE_URL in the current shell looks non-local.
USAGE
}

is_local_database_url() {
  local value="${1:-}"
  [[ "$value" =~ ^postgres(ql)?://[^[:space:]]*(@localhost|@127\.0\.0\.1|@\[::1\]|@0\.0\.0\.0|localhost:|127\.0\.0\.1:|\[::1\]:) ]]
}

assert_safe_shell_database_url() {
  if [[ -z "${DATABASE_URL:-}" ]]; then
    return 0
  fi

  if is_local_database_url "$DATABASE_URL"; then
    return 0
  fi

  cat >&2 <<'ERROR'
Refusing to continue: DATABASE_URL is present in the current shell and does not look localhost-only.
Unset DATABASE_URL or run in a clean shell before using the local acceptance DB helper.
ERROR
  exit 2
}

ensure_docker() {
  if ! command -v docker >/dev/null 2>&1; then
    echo "Docker CLI is not installed." >&2
    exit 2
  fi

  if docker info >/dev/null 2>&1; then
    return 0
  fi

  if command -v colima >/dev/null 2>&1; then
    colima start >/dev/null
  fi

  if ! docker info >/dev/null 2>&1; then
    echo "Docker daemon is not available." >&2
    exit 2
  fi
}

container_exists() {
  docker ps -a --format '{{.Names}}' | grep -qx "$CONTAINER_NAME"
}

container_is_owned() {
  local label
  label="$(docker inspect --format "{{ index .Config.Labels \"$LABEL_KEY\" }}" "$CONTAINER_NAME" 2>/dev/null || true)"
  [[ "$label" == "$LABEL_VALUE" ]]
}

ensure_container() {
  assert_safe_shell_database_url
  ensure_docker

  if container_exists; then
    if ! container_is_owned; then
      echo "Refusing to reuse container '$CONTAINER_NAME': missing local acceptance label." >&2
      exit 2
    fi
    docker start "$CONTAINER_NAME" >/dev/null
  else
    docker run \
      --name "$CONTAINER_NAME" \
      --label "$LABEL_KEY=$LABEL_VALUE" \
      -e POSTGRES_PASSWORD="$DB_PASSWORD" \
      -e POSTGRES_DB="$DB_NAME" \
      -p "127.0.0.1:${DB_PORT}:5432" \
      -d "$IMAGE" >/dev/null
  fi

  for _ in $(seq 1 60); do
    if docker exec "$CONTAINER_NAME" pg_isready -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1; then
      echo "Local acceptance DB is ready: ${DB_NAME} on 127.0.0.1:${DB_PORT}"
      return 0
    fi
    sleep 1
  done

  echo "Timed out waiting for local acceptance DB." >&2
  exit 1
}

run_migrate() {
  ensure_container
  DATABASE_URL="$LOCAL_DATABASE_URL" ./node_modules/.bin/drizzle-kit migrate
}

verify_schema() {
  ensure_container
  local result
  result="$(
    docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" -Atc \
      "select column_name from information_schema.columns where table_schema='public' and table_name='knowledge_document_file_parse_chunk_embeddings' and column_name='failure_reason_code';"
  )"
  if [[ "$result" != "failure_reason_code" ]]; then
    echo "failure_reason_code column is missing." >&2
    exit 1
  fi
  echo "failure_reason_code column exists."
}

run_dev() {
  ensure_container
  DATABASE_URL="$LOCAL_DATABASE_URL" node scripts/run-next.mjs dev --webpack --port 5010
}

stop_container() {
  ensure_docker
  if ! container_exists; then
    echo "Local acceptance container does not exist."
    return 0
  fi
  if ! container_is_owned; then
    echo "Refusing to stop container '$CONTAINER_NAME': missing local acceptance label." >&2
    exit 2
  fi
  docker stop "$CONTAINER_NAME" >/dev/null
  echo "Stopped local acceptance container: $CONTAINER_NAME"
}

case "${1:-}" in
  ensure)
    ensure_container
    ;;
  migrate)
    run_migrate
    ;;
  verify)
    verify_schema
    ;;
  dev)
    run_dev
    ;;
  stop)
    stop_container
    ;;
  -h|--help|help|"")
    usage
    ;;
  *)
    usage >&2
    exit 2
    ;;
esac
