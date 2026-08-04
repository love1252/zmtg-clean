# BASE-B4 第三批低风险正式 Route Guard 前置预检

> 日期：`2026-08-04`
>
> 审计 Base：`92a8f20c2e85b75d97fed808aaf777e32f33f2dc`
>
> 状态：`current preflight evidence`

## 1. 结论

```text
base02_b4_route_guard_third_batch_preflight=passed
current_route_count=81
completed_guarded_route_count=10
third_batch_count=4
third_batch_guard_chain=scope+section
third_batch_write_method_count=0
third_batch_dynamic_object_count=0
third_batch_direct_db_count=0
third_batch_demo_signal_count=0
third_batch_external_touch_count=0
third_batch_high_risk_count=0
third_batch_request_read_count=0
shared_guard_change_required=false
new_colocated_test_count=4
existing_colocated_test_count=0
compatibility_test_count=4
runtime_caller_count=3
implementation_allowlist_count=12
business_reader_release=false
business_capability_release=false
schema_change=false
migration_change=false
database_connection=false
eligible_for_independent_review=true
base_b4_complete=false
base_b5_started=false
```

## 2. 再校准方法

本轮从第二批实施与 handoff 合并后的 `main` 重新扫描：

- `src/app/api/institution/**/route.ts`
- `src/app/api/v1/institution/**/route.ts`

逐 Route 重新识别：

- 直接导出与别名导出的 HTTP method；
- 现有 formal Guard；
- 动态对象路径；
- 数据库依赖；
- demo context；
- 外部调用；
- 高风险路径；
- legacy／retired 标记；
- capability-off 状态；
- Request 解引用；
- import 边界；
- 原响应状态与 code。

同时扫描：

- 全部测试对候选 Route 的静态 import 和源码路径引用；
- 生产代码中的静态 import、re-export 与 API URL 字面量调用者。

## 3. 第三批冻结范围

| # | Route | Section | 原状态 | 原 code | async | 兼容测试 | 运行时调用者 |
|---|---|---|---:|---|---|---:|---:|
| 1 | `src/app/api/institution/followup-operations/dashboard/route.ts` | `care` | `503` | `follow_up_operations_dashboard_capability_disabled` | true | 1 | 1 |
| 2 | `src/app/api/institution/treatment-summaries/route.ts` | `care` | `503` | `treatment_summary_list_capability_disabled` | true | 1 | 1 |
| 3 | `src/app/api/institution/wecom-official-dry-run/route.ts` | `conversations` | `503` | `capability_disabled` | false | 1 | 1 |
| 4 | `src/app/api/institution/wecom/customer-mapping-candidates/route.ts` | `conversations` | `503` | `capability_disabled` | false | 1 | 1 |

共同条件：

1. GET-only；
2. 非动态对象；
3. 无数据库、demo、外部调用或高风险依赖；
4. 当前只导入 `NextResponse`；
5. 不读取 Request；
6. 固定 capability-off 响应；
7. 尚未接入 formal Guard；
8. 不需要业务对象事实 Reader。

## 4. 固定接线契约

实施必须复用：

`src/app/api/institution/_shared/institution-route-guard.ts`

调用链：

```text
Request
→ resolveInstitutionServerAuthorizationV1
→ genuine InstitutionRequestAuthorization
→ authorizeCurrentInstitutionSectionV1
→ genuine Section Allow
→ existing capability-off handler
```

固定结果：

- Guard 拒绝：`403 / no-store`；
- Guard 通过：保持原 `503`、payload 和 no-store；
- 不接 Action Guard 或 Object Guard；
- 不修改共享 Guard；
- 不开放业务 Reader、对象事实 Adapter 或新 Capability。

## 5. 兼容性测试影响面

1. `src/modules/institution/tests/FollowUpOperationsDashboardApiRoutes.test.ts`
2. `src/modules/institution/tests/TreatmentSummaryDomain.test.ts`
3. `src/modules/institution/tests/WeComCustomerMappingCandidatesApiRoute.test.ts`
4. `src/modules/institution/tests/WeComOfficialDryRunApiRoute.test.ts`

实施时：

- 既有 handler-contract 测试只允许 mock 共享 Guard；
- Guard 行为由共享 Guard 测试和新增 colocated 测试覆盖；
- Guard 包装后的公开 GET 可能返回 `Promise<Response>`，测试调用必须 `await`；
- 自动替换不得修改源码字符串断言中的 `function GET`；
- 必须执行完整 `pnpm test`、typecheck 和 build。

## 6. 生产调用面

以下文件只作为调用影响面证据，不自动纳入修改范围：

1. `src/app/api/v1/institution/wecom-official-dry-run/route.ts`
2. `src/modules/institution/client/tenant-business-client.ts`
3. `src/modules/institution/components/WeComCustomerMappingCandidatesReadonlyPanel.tsx`

实施不得为了调用方便利修改成功响应、共享 Guard 或业务服务。

## 7. 精确实施 allowlist

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

共 `12` 个文件：

- 生产 Route：4；
- colocated Route 测试：4；
- 既有兼容性测试：4。

任何额外生产文件、共享 Guard 修改或业务模块修改都必须停止并拆分独立任务。

## 8. 禁止范围

- 本 PR 只新增本预检 Markdown 与校准 CSV；
- 不修改生产 Route、共享 Guard、业务 Reader、业务服务、Schema 或 Migration；
- 不连接数据库，不执行 DDL、DML、Migration 或 Seed；
- 不处理动态对象、写 Route、凭证、HIS、上传下载、解析、索引或外部触达；
- 不处理 historical orphan，不执行 Scope FK VALIDATE；
- 不启动 BASE-B5～B6、项目级 Writer、Audit／模板或 MIG-01B／C。
