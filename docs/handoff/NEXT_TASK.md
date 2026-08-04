# 智美天工唯一下一任务

## 唯一下一任务

```text
BASE-B4 第三批低风险正式 Route Guard capability-off 接线实施
```

## 冻结 Route

1. `src/app/api/institution/followup-operations/dashboard/route.ts`
2. `src/app/api/institution/treatment-summaries/route.ts`
3. `src/app/api/institution/wecom-official-dry-run/route.ts`
4. `src/app/api/institution/wecom/customer-mapping-candidates/route.ts`

## 兼容性测试

1. `src/modules/institution/tests/FollowUpOperationsDashboardApiRoutes.test.ts`
2. `src/modules/institution/tests/TreatmentSummaryDomain.test.ts`
3. `src/modules/institution/tests/TreatmentSummaryListApiRoutes.test.ts`
4. `src/modules/institution/tests/WeComOfficialDryRunApiRoute.test.ts`
5. `src/modules/institution/tests/V1WeComOfficialDryRunCompatibilityApiRoute.test.ts`
6. `src/modules/institution/tests/WeComCustomerMappingCandidatesApiRoute.test.ts`
7. `src/modules/institution/tests/WeComCustomerMappingReadWriteBridge.test.ts`

## 精确 implementation allowlist

1. `src/app/api/institution/followup-operations/dashboard/route.test.ts`
2. `src/app/api/institution/followup-operations/dashboard/route.ts`
3. `src/app/api/institution/treatment-summaries/route.test.ts`
4. `src/app/api/institution/treatment-summaries/route.ts`
5. `src/app/api/institution/wecom-official-dry-run/route.test.ts`
6. `src/app/api/institution/wecom-official-dry-run/route.ts`
7. `src/app/api/institution/wecom/customer-mapping-candidates/route.test.ts`
8. `src/app/api/institution/wecom/customer-mapping-candidates/route.ts`
9. `src/modules/institution/tests/FollowUpOperationsDashboardApiRoutes.test.ts`
10. `src/modules/institution/tests/TreatmentSummaryDomain.test.ts`
11. `src/modules/institution/tests/TreatmentSummaryListApiRoutes.test.ts`
12. `src/modules/institution/tests/WeComOfficialDryRunApiRoute.test.ts`
13. `src/modules/institution/tests/V1WeComOfficialDryRunCompatibilityApiRoute.test.ts`
14. `src/modules/institution/tests/WeComCustomerMappingCandidatesApiRoute.test.ts`
15. `src/modules/institution/tests/WeComCustomerMappingReadWriteBridge.test.ts`

共 `15` 个文件。任何额外文件必须停止。

## 固定实现要求

- 复用共享 Scope + Section Guard；
- Guard 拒绝：403 / no-store；
- Guard 通过：保持原 503 capability-off contract；
- 两个新增测试均只 mock 共享 Guard identity 边界；
- `WeComCustomerMappingReadWriteBridge` 的两个公开 GET 调用必须 await；
- 不修改共享 Guard或 v1 re-export；
- 完整 test、typecheck、lint、build 和 Required Check 必须通过。

## 禁止范围

- 不修改 allowlist 外文件；
- 不开放业务 Reader、对象事实 Adapter 或新 Capability；
- 不修改 Schema、Migration、journal 或 snapshot；
- 不连接数据库，不执行 DDL、DML、Migration 或 Seed；
- 不启动 BASE-B5～B6、项目级 Writer、Audit／模板或 MIG-01B／C。
