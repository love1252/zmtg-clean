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

## 固定实现方式

- 复用 `src/app/api/institution/_shared/institution-route-guard.ts`；
- Guard 链：Scope + Section；
- Guard 拒绝：`403 / no-store`；
- Guard 通过：保持原 `503`、payload 和 no-store；
- 不修改共享 Guard；
- 不接 Action Guard 或 Object Guard；
- 不开放业务 Reader、对象事实 Adapter 或新 Capability。

## 兼容性测试

1. `src/modules/institution/tests/FollowUpOperationsDashboardApiRoutes.test.ts`
2. `src/modules/institution/tests/TreatmentSummaryDomain.test.ts`
3. `src/modules/institution/tests/WeComCustomerMappingCandidatesApiRoute.test.ts`
4. `src/modules/institution/tests/WeComOfficialDryRunApiRoute.test.ts`
5. `src/modules/institution/tests/V1WeComOfficialDryRunCompatibilityApiRoute.test.ts`

其中 v1 compatibility test 必须：

1. mock 共享 Guard 为 identity handler；
2. 对 legacyGET／versionedGET 调用使用 await；
3. 保持新旧入口函数引用相同；
4. 不修改 v1 re-export 生产文件。

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
11. `src/modules/institution/tests/WeComCustomerMappingCandidatesApiRoute.test.ts`
12. `src/modules/institution/tests/WeComOfficialDryRunApiRoute.test.ts`
13. `src/modules/institution/tests/V1WeComOfficialDryRunCompatibilityApiRoute.test.ts`

共 `13` 个文件。任何额外文件必须停止。

## 必须执行的门禁

1. 影响面测试；
2. typecheck；
3. 架构检查器自测；
4. 增量架构检查；
5. 完整 `pnpm test`；
6. lint；
7. production build；
8. GitHub Required Check；
9. 独立实施审查；
10. handoff。

## 禁止范围

- 不修改共享 Guard、v1 re-export 或 allowlist 外文件；
- 不开放业务 Reader、对象事实 Adapter 或新 Capability；
- 不修改 Schema、Migration、journal 或 snapshot；
- 不连接数据库，不执行 DDL、DML、Migration 或 Seed；
- 不处理 dynamic object、写 Route、凭证、HIS、上传下载、解析、索引或外部触达；
- 不启动 BASE-B5～B6、项目级 Writer、Audit／模板或 MIG-01B／C。
