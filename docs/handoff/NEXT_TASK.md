# 智美天工唯一下一任务

## 唯一下一任务

```text
BASE-B4 第四批低风险正式 Route Guard capability-off 接线实施
```

## 冻结 Route

1. `src/app/api/institution/ai-service-usage/route.ts`

## 冻结 Section

1. `system`

## 精确 implementation allowlist

1. `src/app/api/institution/ai-service-usage/route.test.ts`
2. `src/app/api/institution/ai-service-usage/route.ts`
3. `src/modules/institution/tests/InstitutionAiServiceUsageApiRoute.test.ts`

共 `3` 个文件。

## 直接兼容性测试

1. `src/modules/institution/tests/InstitutionAiServiceUsageApiRoute.test.ts`

## 传递兼容性测试

无。

## 回归证据但默认不修改

### API URL 测试

1. `src/modules/institution/tests/InstitutionAiServiceUsageService.test.ts`
2. `src/modules/workspace/tests/WorkspaceEntryPages.test.tsx`

### production re-export

无。

### Runtime callers

1. `src/modules/institution/client/institution-ai-service-usage-client.ts`

## 固定实施要求

- 复用共享 Scope + Section Guard；
- Guard 拒绝：403 / no-store；
- Guard 通过：逐 Route 保持原 capability-off 状态码、payload 和 no-store；
- 不把 410 改写为 503；
- 不修改共享 Guard或 production re-export；
- 不开放业务 Reader、对象事实 Adapter 或新 Capability；
- 完整 test、lint、typecheck、build 与 Required Check 全部通过。

## 禁止范围

- 不修改 allowlist 外文件；
- 不连接数据库，不执行 DDL、DML、Migration 或 Seed；
- 不处理 historical orphan，不验证 Scope FK；
- 不启动 BASE-B5～B6、业务 Writer、Audit／模板或 MIG-01B／C。
