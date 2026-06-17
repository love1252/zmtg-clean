---
name: zmtg-secret-migration-guard
description: Secret / Migration / Smoke 门禁 — .env.local、数据库类型、secret 输出控制。
---

# zmtg-secret-migration-guard

## 使用场景

执行涉及数据库、环境变量或真实环境验收的任务前使用此 Skill。

## 必须执行的检查

1. 任务是否获授权执行 migration / smoke / 读取环境变量。
2. `.env.local` 是否存在（只报存在/缺失）。
3. `DATABASE_URL` 是否存在（只报存在/缺失）。
4. 是否能确认数据库为开发/测试库（只通过 host 标识判断，不输出完整值）。
5. 如无法确认 → 停止。
6. 日志、PR body、测试输出中是否包含 secret 值。

## 禁止事项

- 不得在未授权时执行 migration。
- 不得输出 `DATABASE_URL`、密码、`ZMTG_SECRET_ENCRYPTION_KEY`、API Key 的具体值。
- 不得在未确认数据库类型时执行 migration。
- 不得绕过权限 guard。

## 停止条件

- 需要 migration 但未授权 → 停止。
- 无法确认数据库类型 → 停止。
- 发现 secret 可能泄漏 → 停止并报告。

## 回报模板

```
- .env.local:
- DATABASE_URL:
- 数据库类型确认:
- ZMTG_SECRET_ENCRYPTION_KEY:
- migration 授权:
- smoke 授权:
- secret 泄漏:
- 结论:
```
