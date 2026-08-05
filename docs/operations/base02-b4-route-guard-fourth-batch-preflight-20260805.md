# BASE-B4 第四批低风险正式 Route Guard 精确校准前置预检

> 日期：`2026-08-05`
>
> 审计 Base：`53314bfd753b861a15debe46c8cdbe0ea69e7a68`
>
> 任务性质：只读静态校准、影响面冻结与实施准入判定

## 1. 结论

```text
base02_b4_route_guard_fourth_batch_preflight=passed
route_count=81
formal_guarded_route_count=14
broad_capability_off_count=70
strict_eligible_count=1
fourth_batch_count=1
deferred_strict_eligible_count=0
direct_compatibility_test_count=1
transitive_compatibility_test_count=0
api_regression_test_count=2
production_reexport_count=0
runtime_caller_count=1
implementation_allowlist_count=3
shared_guard_change_required=false
production_change=false
database_connection=false
schema_change=false
migration_change=false
business_reader_release=false
business_capability_release=false
base_b4_complete=false
base_b5_started=false
eligible_for_independent_review=true
next_task_reason=strict_fourth_batch_candidates_found
next_task=BASE-B4 第四批低风险正式 Route Guard capability-off 接线实施
```

## 2. 精确候选标准

候选必须同时满足：

1. HTTP method 精确为 `GET`；
2. 非动态对象 Route；
3. 非 versioned re-export；
4. 当前未接 formal Guard；
5. 只导入 `next/server`，不装配业务服务或 Repository；
6. 不读取 Request；
7. 无数据库、外部调用、demo／fixture；
8. 非 legacy／retired；
9. 非凭证、HIS、上传下载、解析、索引、真实触达等高风险路径；
10. 固定 capability-off JSON 响应；
11. 明确状态码；
12. `Cache-Control: no-store`。

原 `52` 个宽口径结果没有被直接作为实施清单。

## 3. 第四批冻结候选

| # | Route | Section | 原状态码 | 原 code | 直接兼容测试 | 传递兼容测试 | 运行时调用者 |
|---|---|---|---|---|---:|---:|---:|
| 1 | `src/app/api/institution/ai-service-usage/route.ts` | `system` | `410` | `institution_ai_usage_capability_off` | 1 | 0 | 1 |

实施必须保持每个 Route 自己的原状态码、payload 和 no-store，
不得把 `410` 静默改成 `503`，也不得开放业务 Reader。

## 4. 排除统计

- `demo_or_fixture`：1
- `dynamic_object`：9
- `formal_guard_already_present`：14
- `legacy_or_retired`：3
- `not_get_only`：50
- `strict_candidate`：1
- `versioned_reexport`：3

完整逐 Route 证据：

`docs/operations/base02-b4-route-guard-fourth-batch-calibration-20260805.csv`

## 5. 兼容性与调用影响面

### 直接兼容性测试

1. `src/modules/institution/tests/InstitutionAiServiceUsageApiRoute.test.ts`

### 传递兼容性测试

无。

### API URL 回归测试（只做回归，不自动纳入修改范围）

1. `src/modules/institution/tests/InstitutionAiServiceUsageService.test.ts`
2. `src/modules/workspace/tests/WorkspaceEntryPages.test.tsx`

### 生产 re-export（默认禁止修改）

无。

### 生产调用者（只做回归，不自动纳入修改范围）

1. `src/modules/institution/client/institution-ai-service-usage-client.ts`

完整关系证据：

`docs/operations/base02-b4-route-guard-fourth-batch-impact-20260805.csv`

## 6. 精确 implementation allowlist

1. `src/app/api/institution/ai-service-usage/route.test.ts`
2. `src/app/api/institution/ai-service-usage/route.ts`
3. `src/modules/institution/tests/InstitutionAiServiceUsageApiRoute.test.ts`

共 `3` 个文件。

只有直接／传递 handler-contract 测试进入修改 allowlist；
仅通过 API URL 使用 Route 的 UI／client 测试只作为回归证据。

## 7. 固定实施要求

若第四批候选非空：

- 复用 `src/app/api/institution/_shared/institution-route-guard.ts`；
- 接入 Scope + 冻结 Section；
- Guard 拒绝保持 `403 / no-store`；
- Guard 通过后保持原 capability-off 状态码、payload 和 no-store；
- 共享 Guard 不修改；
- versioned re-export 不修改；
- 业务 Reader、对象事实 Adapter 和新 Capability不开放；
- 完整 `pnpm test`、typecheck、lint、build 与 Required Check 必须通过。

## 8. 禁止范围

- 本轮只新增校准 CSV、影响面 CSV 和 Markdown；
- 不修改生产 Runtime、Route、Guard 或业务模块；
- 不连接数据库，不执行 DDL、DML、Migration 或 Seed；
- 不处理 historical orphan，不验证 Scope FK；
- 不启动 BASE-B5～B6、业务 Writer、Audit／模板或 MIG-01B／C。
