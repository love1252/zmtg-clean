# BASE-B4 剩余正式 Route 再校准与第二批低风险 Route Guard 前置预检

> 日期：`2026-08-04`
>
> 审计 Base：`9b60a16648958040c64fadfe7ede0e55a68b3c11`
>
> 状态：`current preflight evidence`

## 1. 结论

```text
base02_b4_route_guard_second_batch_preflight=passed
prior_calibration_count=73
current_route_count=81
prior_calibration_gap_count=8
current_formal_guard_count=5
first_batch_completed_count=5
eligible_remaining_count=9
second_batch_count=5
second_batch_guard_chain=scope+section
second_batch_write_method_count=0
second_batch_dynamic_object_count=0
second_batch_direct_db_count=0
second_batch_demo_signal_count=0
second_batch_high_risk_count=0
second_batch_request_read_count=0
shared_guard_change_required=false
compatibility_test_count=5
new_colocated_test_count=5
implementation_production_file_count=5
implementation_test_file_count=10
implementation_allowlist_count=15
business_reader_release=false
business_capability_release=false
schema_change=false
migration_change=false
database_connection=false
eligible_for_independent_review=true
base_b4_complete=false
base_b5_started=false
```

## 2. 重新校准范围

本轮不直接沿用 2026-08-03 的 73 项校准结果，而是重新扫描：

- `src/app/api/institution/**/route.ts`
- `src/app/api/v1/institution/**/route.ts`

扫描重新识别：

- HTTP method，包括函数、变量与别名导出；
- 当前 formal Guard；
- 动态对象路径；
- 数据库直读；
- demo access context；
- capability-off 状态；
- legacy／retired 状态；
- request 解引用；
- 凭证、上传下载、解析、索引、HIS 和外部触达等高风险路径。

旧校准未覆盖但当前扫描发现的 Route：

1. `src/app/api/institution/ai-service-usage/route.ts`
2. `src/app/api/institution/audit-events/route.ts`
3. `src/app/api/institution/customers/[customerId]/followup-overview/route.ts`
4. `src/app/api/institution/customers/[customerId]/followup-timeline/route.ts`
5. `src/app/api/institution/customers/[customerId]/timeline/route.ts`
6. `src/app/api/institution/followup-operations/dashboard/route.ts`
7. `src/app/api/institution/treatment-summaries/[summaryId]/follow-up-suggestions/route.ts`
8. `src/app/api/institution/treatment-summaries/route.ts`

完整逐 Route 结果见：

`docs/operations/base02-b4-route-guard-second-batch-calibration-20260804.csv`

## 3. 第二批冻结 Route

第二批严格冻结为：

1. `src/app/api/institution/audit-events/route.ts` → `system`
2. `src/app/api/institution/followup-message-templates/route.ts` → `care`
3. `src/app/api/institution/followup-paths/templates/route.ts` → `care`
4. `src/app/api/institution/knowledge-management/qa/audits/route.ts` → `knowledge`
5. `src/app/api/institution/wecom/external-contacts/route.ts` → `conversations`

共同条件：

1. 只导出 `GET`；
2. 非动态对象路径；
3. 无直接数据库依赖；
4. 无 demo access context；
5. 无高风险路径；
6. 不是 legacy／retired Route；
7. 当前为 capability-off；
8. 不读取 Request；
9. 尚未接入 formal Guard；
10. 不需要业务对象事实 Reader。

## 4. 接线契约

每个 Route 后续实施必须复用现有共享 Guard：

`src/app/api/institution/_shared/institution-route-guard.ts`

固定调用链：

```text
Request
→ resolveInstitutionServerAuthorizationV1
→ genuine InstitutionRequestAuthorization
→ authorizeCurrentInstitutionSectionV1
→ genuine Section Allow
→ existing capability-off handler
```

固定行为：

- 无 genuine authorization 或 Section Allow：`403 / no-store`；
- Guard 拒绝时，原 handler 不执行；
- Guard 通过时，原 handler只执行一次；
- 原 handler 的 `503 capability_disabled` 响应保持不变；
- 不接 Action Guard 或 Object Guard；
- 不开放业务 Reader、对象事实 Adapter 或新 Capability；
- 不修改共享 Guard 实现。

## 5. 既有测试影响面

本轮扫描到需纳入实施影响面的既有测试：

1. `src/modules/audit/tests/InstitutionAuditEventsApiRoute.test.ts`
2. `src/modules/institution/tests/FollowUpMessageDraftApiRoutes.test.ts`
3. `src/modules/institution/tests/FollowUpPathEnrollmentApiRoutes.test.ts`
4. `src/modules/institution/tests/WeComExternalContactReadonlyApiRoute.test.ts`
5. `src/modules/open-platform/tests/PlatformKnowledgeQaApiRoute.test.ts`

实施时：

- 新增 5 个 colocated Route 接线测试；
- 既有 handler-contract 测试只允许 mock 共享 Guard 边界；
- 共享 Guard 行为继续由共享 Guard 测试覆盖；
- 必须执行完整 `pnpm test`，不得只跑新增定向测试。

## 6. 精确实施 allowlist

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

共 `15` 个文件：

- 生产文件：5；
- 新 colocated 测试：5；
- 既有兼容性测试：5。

任何额外文件都必须停止并拆分独立任务。

## 7. 验证范围

前置预检与后续实施必须覆盖：

- 架构检查器自测；
- 增量架构检查；
- 完整测试；
- lint；
- typecheck；
- production build；
- GitHub Required Check；
- Guard 403／no-store；
- 授权通过后原 handler contract；
- 既有 handler 测试与 Guard 组合测试隔离；
- 相邻未授权 Route 不得自动继承接线。

## 8. 禁止范围

- 本 PR 只新增本 Markdown 与校准 CSV；
- 不修改 Runtime、业务 Route、共享 Guard、业务 Reader、Schema 或 Migration；
- 不连接数据库，不执行 DDL、DML、Migration 或 Seed；
- 不开放真实业务 Capability；
- 不处理动态对象 Route、写 Route、凭证、HIS、上传下载、解析、索引或外部触达；
- 不处理 historical orphan，不执行 Scope FK VALIDATE；
- 不启动 BASE-B5～B6、项目级 Writer、Audit／模板或 MIG-01B／C。
