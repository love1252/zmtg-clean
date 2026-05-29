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
