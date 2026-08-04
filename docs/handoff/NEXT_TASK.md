# 智美天工唯一下一任务

## 唯一下一任务

```text
BASE-B4 第二批低风险正式 Route Guard capability-off 接线实施
```

## 冻结 Route

1. `src/app/api/institution/audit-events/route.ts` → `system`
2. `src/app/api/institution/followup-message-templates/route.ts` → `care`
3. `src/app/api/institution/followup-paths/templates/route.ts` → `care`
4. `src/app/api/institution/knowledge-management/qa/audits/route.ts` → `knowledge`
5. `src/app/api/institution/wecom/external-contacts/route.ts` → `conversations`

## 固定实现方式

复用现有共享 Guard：

`src/app/api/institution/_shared/institution-route-guard.ts`

调用链：

```text
Request
→ genuine InstitutionRequestAuthorization
→ Scope Guard
→ Section Guard
→ existing capability-off handler
```

固定结果：

- Guard 拒绝：`403 / no-store`；
- Guard 通过：保持原 handler 的 `503 capability_disabled`；
- 不修改共享 Guard；
- 不接 Action Guard 或 Object Guard；
- 不开放业务 Reader、对象事实 Adapter 或新 Capability。

## 既有兼容性测试

1. `src/modules/audit/tests/InstitutionAuditEventsApiRoute.test.ts`
2. `src/modules/institution/tests/FollowUpMessageDraftApiRoutes.test.ts`
3. `src/modules/institution/tests/FollowUpPathEnrollmentApiRoutes.test.ts`
4. `src/modules/institution/tests/WeComExternalContactReadonlyApiRoute.test.ts`
5. `src/modules/open-platform/tests/PlatformKnowledgeQaApiRoute.test.ts`

既有 handler-contract 测试只允许 mock 共享 Guard 边界。共享 Guard 行为由共享 Guard 测试与新增 colocated 测试覆盖。

## 精确 implementation allowlist

1. `src/app/api/institution/audit-events/route.test.ts`
2. `src/app/api/institution/audit-events/route.ts`
3. `src/app/api/institution/followup-message-templates/route.test.ts`
4. `src/app/api/institution/followup-message-templates/route.ts`
5. `src/app/api/institution/followup-paths/templates/route.test.ts`
6. `src/app/api/institution/followup-paths/templates/route.ts`
7. `src/app/api/institution/knowledge-management/qa/audits/route.test.ts`
8. `src/app/api/institution/knowledge-management/qa/audits/route.ts`
9. `src/app/api/institution/wecom/external-contacts/route.test.ts`
10. `src/app/api/institution/wecom/external-contacts/route.ts`
11. `src/modules/audit/tests/InstitutionAuditEventsApiRoute.test.ts`
12. `src/modules/institution/tests/FollowUpMessageDraftApiRoutes.test.ts`
13. `src/modules/institution/tests/FollowUpPathEnrollmentApiRoutes.test.ts`
14. `src/modules/institution/tests/WeComExternalContactReadonlyApiRoute.test.ts`
15. `src/modules/open-platform/tests/PlatformKnowledgeQaApiRoute.test.ts`

共 `15` 个文件。任何额外文件必须停止。

## 必须执行的门禁

1. 架构检查器自测；
2. 增量架构检查；
3. 完整 `pnpm test`；
4. lint；
5. typecheck；
6. production build；
7. GitHub Required Check；
8. 独立实施审查；
9. handoff。

## 禁止范围

- 不修改共享 Guard、业务 Reader、业务服务或数据库实现；
- 不开放新业务 Capability；
- 不修改 Schema、Migration、journal 或 snapshot；
- 不连接数据库，不执行 DDL、DML、Migration 或 Seed；
- 不处理动态对象 Route、写 Route、凭证、HIS、上传下载、解析、索引或外部触达；
- 不处理 historical orphan，不执行 Scope FK VALIDATE；
- 不启动 BASE-B5～B6、项目级 Writer、Audit／模板或 MIG-01B／C。
