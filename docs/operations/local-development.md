# Local Development

## Requirements

- Node.js 20 or newer
- pnpm 9 or newer

## Start

```bash
pnpm install
pnpm dev
```

Open:

```text
http://localhost:5010
```

## Demo Accounts

本地 demo auth 默认在 `development` 和 `test` 环境启用：

```text
机构端：admin / admin123
平台端：platform / admin123
```

生产环境默认禁用 demo auth。若仅用于临时演示，需要显式设置：

```text
ZMTG_ENABLE_DEMO_AUTH=true
```

## Verification

```bash
pnpm typecheck
pnpm test
pnpm build
```

## Rules

- Do not store business data in localStorage.
- Do not add production fallback accounts.
- Do not trust tenant IDs sent from the browser.
- Keep mock providers limited to development and tests.
