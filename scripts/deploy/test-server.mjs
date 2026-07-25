import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { basename, join } from 'node:path';

const config = {
  appRoot: process.env.ZMTG_DEPLOY_APP_ROOT ?? '/www/wwwroot/zmtg-clean',
  host: process.env.ZMTG_DEPLOY_HOST ?? '43.142.91.19',
  keyPath: expandHome(process.env.ZMTG_DEPLOY_KEY ?? '~/Documents/Codex/secrets/zmtg_test_deploy_ed25519'),
  port: process.env.ZMTG_DEPLOY_PORT ?? '5010',
  publicVersionUrl: process.env.ZMTG_DEPLOY_VERSION_URL ?? 'https://43.142.91.19/api/version',
  remoteUser: process.env.ZMTG_DEPLOY_USER ?? 'root',
};

function expandHome(value) {
  if (value === '~') return homedir();
  if (value.startsWith('~/')) return join(homedir(), value.slice(2));
  return value;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    input: options.input,
    stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : options.input ? ['pipe', 'inherit', 'inherit'] : 'inherit',
    ...options,
  });

  if (result.status !== 0) {
    const detail = options.capture ? `\n${result.stderr || result.stdout}` : '';
    throw new Error(`${command} ${args.join(' ')} failed${detail}`);
  }

  return result.stdout?.trim() ?? '';
}

function sshArgs(extra = []) {
  return [
    '-i',
    config.keyPath,
    '-o',
    'BatchMode=yes',
    '-o',
    'ConnectTimeout=10',
    '-o',
    'StrictHostKeyChecking=no',
    ...extra,
  ];
}

function assertReady() {
  if (!existsSync(config.keyPath)) {
    throw new Error(`deploy key not found: ${config.keyPath}`);
  }

  const status = run('git', ['status', '--short'], { capture: true });
  if (status && process.env.ZMTG_DEPLOY_ALLOW_DIRTY !== '1') {
    throw new Error('working tree is not clean; commit or stash changes before deploying');
  }
}

function remoteDeployScript() {
  return String.raw`
set -Eeuo pipefail

APP_ROOT="$1"
ARCHIVE_PATH="$2"
COMMIT="$3"
PORT="$4"
PUBLIC_VERSION_URL="$5"

log() { printf '\n[%s] %s\n' "$(date '+%F %T')" "$*"; }
fail() { printf '\n[ERROR] %s\n' "$*" >&2; exit 1; }

command -v node >/dev/null || fail "node 未安装"
command -v curl >/dev/null || fail "curl 未安装"
command -v tar >/dev/null || fail "tar 未安装"

mkdir -p "$APP_ROOT/releases" "$APP_ROOT/backups" "$APP_ROOT/logs"
RELEASE_DIR="$APP_ROOT/releases/$(date '+%Y%m%d%H%M%S')-${'${'}COMMIT:0:7}"

log "创建 release: $RELEASE_DIR"
mkdir -p "$RELEASE_DIR"
tar -xzf "$ARCHIVE_PATH" -C "$RELEASE_DIR"
printf '%s\n' "$COMMIT" > "$RELEASE_DIR/.deploy-commit"

log "复制生产环境配置文件"
for env_file in .env.local .env.production .env; do
  if [ -f "$APP_ROOT/current/$env_file" ]; then
    cp -p "$APP_ROOT/current/$env_file" "$RELEASE_DIR/$env_file"
    printf 'copied current/%s\n' "$env_file"
  elif [ -f "$APP_ROOT/$env_file" ]; then
    cp -p "$APP_ROOT/$env_file" "$RELEASE_DIR/$env_file"
    printf 'copied root/%s\n' "$env_file"
  fi
done

cd "$RELEASE_DIR"

log "准备 pnpm"
if ! command -v pnpm >/dev/null; then
  command -v corepack >/dev/null || fail "pnpm 不存在且 corepack 不可用"
  corepack enable
  corepack prepare pnpm@9.0.0 --activate
fi
node -v
pnpm -v

log "安装依赖"
pnpm install --frozen-lockfile

log "构建生产包"
ZMTG_DEPLOY_COMMIT="$COMMIT" \
ZMTG_DEPLOY_BUILT_AT="$(date -u '+%Y-%m-%dT%H:%M:%SZ')" \
pnpm build

log "切换 current"
PREVIOUS_RELEASE="$(readlink -f "$APP_ROOT/current" 2>/dev/null || true)"
ln -sfn "$RELEASE_DIR" "$APP_ROOT/current"
printf 'previous=%s\nnew=%s\n' "$PREVIOUS_RELEASE" "$(readlink -f "$APP_ROOT/current")"

log "重启服务"
RESTARTED=0
cd "$APP_ROOT/current"

if command -v pm2 >/dev/null; then
  pm2 ls || true
  for name in zmtg-clean zmtg zmtg_clean; do
    if pm2 describe "$name" >/dev/null 2>&1; then
      pm2 restart "$name" --update-env
      RESTARTED=1
      break
    fi
  done

  if [ "$RESTARTED" = "0" ]; then
    PM2_ID="$(pm2 jlist 2>/dev/null | node -e '
let s = "";
process.stdin.on("data", (d) => s += d);
process.stdin.on("end", () => {
  try {
    const list = JSON.parse(s || "[]");
    const item = list.find((entry) => {
      const env = entry.pm2_env || {};
      return String(entry.name || "").includes("zmtg") ||
        String(env.cwd || "").includes("/www/wwwroot/zmtg-clean") ||
        String(env.pm_exec_path || "").includes("/www/wwwroot/zmtg-clean");
    });
    if (item) console.log(item.pm_id);
  } catch {}
});
')"
    if [ -n "$PM2_ID" ]; then
      pm2 restart "$PM2_ID" --update-env
      RESTARTED=1
    fi
  fi
fi

if [ "$RESTARTED" = "0" ]; then
  PID="$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | head -n 1 || true)"
  if [ -n "$PID" ]; then
    PID_CWD="$(readlink -f "/proc/$PID/cwd" 2>/dev/null || true)"
    printf 'port %s pid=%s cwd=%s\n' "$PORT" "$PID" "$PID_CWD"
    if printf '%s' "$PID_CWD" | grep -q "$APP_ROOT"; then
      kill "$PID"
      sleep 2
    else
      fail "端口 $PORT 被非本项目进程占用：pid=$PID cwd=$PID_CWD"
    fi
  fi

  if command -v pm2 >/dev/null; then
    pm2 start pnpm --name zmtg-clean --cwd "$APP_ROOT/current" -- start
  else
    nohup bash -lc "cd '$APP_ROOT/current' && pnpm start" > "$APP_ROOT/logs/zmtg-clean.log" 2>&1 &
  fi
fi

sleep 5

log "验证本机版本"
LOCAL_JSON="$(curl -fsS "http://127.0.0.1:$PORT/api/version" || true)"
printf '%s\n' "$LOCAL_JSON"
printf '%s' "$LOCAL_JSON" | grep -q "$COMMIT" || fail "本机 /api/version 未返回 $COMMIT"

log "验证公网版本"
PUBLIC_JSON="$(curl -kfsS "$PUBLIC_VERSION_URL" || true)"
printf '%s\n' "$PUBLIC_JSON"
printf '%s' "$PUBLIC_JSON" | grep -q "$COMMIT" || fail "公网 /api/version 未返回 $COMMIT"

log "清理旧 release，只保留最近 5 个"
find "$APP_ROOT/releases" -mindepth 1 -maxdepth 1 -type d | sort | head -n -5 | xargs -r rm -rf
rm -f "$ARCHIVE_PATH"

log "部署完成"
printf 'deployed commit=%s\n' "$COMMIT"
printf 'version=%s\n' "$PUBLIC_JSON"
`;
}

function main() {
  if (process.argv.includes('--help')) {
    console.log(`Usage: pnpm deploy:test-server

Environment:
  ZMTG_DEPLOY_KEY          SSH private key path. Default: ${config.keyPath}
  ZMTG_DEPLOY_HOST         Server host. Default: ${config.host}
  ZMTG_DEPLOY_USER         Server user. Default: ${config.remoteUser}
  ZMTG_DEPLOY_APP_ROOT     App root. Default: ${config.appRoot}
  ZMTG_DEPLOY_ALLOW_DIRTY  Set to 1 to deploy a dirty working tree.
`);
    return;
  }

  assertReady();

  const commit = run('git', ['rev-parse', 'HEAD'], { capture: true });
  const tempDir = mkdtempSync(join(tmpdir(), 'zmtg-deploy-'));
  const archivePath = join(tempDir, `${commit}.tar.gz`);
  const remoteArchivePath = `/tmp/${basename(archivePath)}`;
  const destination = `${config.remoteUser}@${config.host}`;

  try {
    console.log(`[deploy] commit ${commit}`);
    run('git', ['archive', '--format=tar.gz', '--output', archivePath, commit]);
    run('ssh', [...sshArgs(), destination, 'echo SSH_OK']);
    run('scp', ['-i', config.keyPath, '-o', 'StrictHostKeyChecking=no', archivePath, `${destination}:${remoteArchivePath}`]);
    run('ssh', [
      ...sshArgs(),
      destination,
      'bash',
      '-s',
      '--',
      config.appRoot,
      remoteArchivePath,
      commit,
      config.port,
      config.publicVersionUrl,
    ], { input: remoteDeployScript() });
  } finally {
    rmSync(tempDir, { force: true, recursive: true });
  }
}

main();
