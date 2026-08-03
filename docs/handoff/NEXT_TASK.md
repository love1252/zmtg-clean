# 智美天工唯一下一任务

## 唯一下一任务

```text
BASE-B2 AQ008 Binding writer gate 扩展实施
```

## 精确 allowlist

1. `scripts/verify/architecture-quality.mjs`
2. `scripts/verify/architecture-quality.test.mjs`

## 实施目标

- 保持现有 AQ008 rule identity 与 Membership 保护；
- 将 `auth_account_institution_bindings` 纳入 direct-writer gate；
- 将 `auth_account_institution_binding_transitions` 纳入 direct-writer gate；
- 唯一 Owner allowlist 继续为 `src/modules/access-control/server/membership-command-repository.ts`；
- 覆盖 Drizzle、raw SQL、alias、barrel、helper、reverse caller、copy／rename 与 commit blob；
- rules.json 不允许 AQ008 例外。

## 禁止范围

- 不修改 Runtime／Schema／Migration；
- 不连接数据库；
- 不执行 legacy calibration；
- 不处理 historical orphan；
- 不执行 Scope FK `VALIDATE`；
- 不启动 BASE-B3～B6。
