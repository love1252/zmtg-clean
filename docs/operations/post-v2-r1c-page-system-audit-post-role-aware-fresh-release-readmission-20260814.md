# POST-V2-R1C `page_system_audit` post-role-aware fresh release re-audit 与精确 Runtime 重新准入

> 日期：2026-08-14（Asia/Shanghai）
>
> 阶段：S17
>
> 基线：`709ab04b4af0f469d6bd5631bc1596acb9c42d16`
>
> 类型：docs-only fresh re-audit / exact Runtime re-admission

## 1. Admission 结论

```text
STAGE=S17
TASK=POST_V2_R1C_PAGE_SYSTEM_AUDIT_POST_ROLE_AWARE_FRESH_RELEASE_READMISSION
COMPLETION_MODE=FINAL_HANDOFF_PENDING
BASELINE=709ab04b4af0f469d6bd5631bc1596acb9c42d16
ADMISSION_PR=1212
ADMISSION_HEAD=284653d98834c83f510a2c982a913c8f07288ac8
ADMISSION_MERGE=1a856d55bd6578eeccffa0d86ed18c2b1c37862a
ADMISSION_REQUIRED_CHECK=passed
ADMISSION_ACTIONABLE_P0_P1_P2_P3=0
ADMISSION_POST_MERGE_REVIEW_DEBT=0
FINAL_HANDOFF_PR=1213
FINAL_HANDOFF_REQUIRED_CHECK=pending
S17_COMPLETE=false

FRESH_RELEASE_REAUDIT=passed
ADMIN_ONLY_PAGE_AUDIENCE_VERIFIED=true
AUDIT_API_ROLE_AWARE_AUTHORIZATION_SAFE=true
PAGE_ROUTE_CAN_REUSE_AUDIT_READ_AUTHORIZATION_OWNER=true
PAGE_ROUTE_SHOULD_CONSUME_ONE_SHOT_HANDLE=false
PAGE_ROUTE_AUTHORIZATION_CHAIN_SAFE=true

SYSTEM_NAVIGATION_ALONE_AUTHORIZES_AUDIT_PAGE=false
CAPABILITY_AUTHORITY_IS_ROLE_SOURCE=false
AUDIT_AUTHORIZATION_HANDLE_CROSS_REQUEST_REUSE=false

EXACT_RUNTIME_ALLOWLIST_FROZEN=true
PAGE_SYSTEM_AUDIT_RELEASE_ELIGIBLE=true
PAGE_SYSTEM_AUDIT_RUNTIME_READMISSION_READY=true

S17_RUNTIME_IMPLEMENTED=false
PAGE_SYSTEM_AUDIT_STATE=hidden/not_released
PAGE_SYSTEM_AUDIT_RELEASE=false
REVIEW_ACCEPTED_GOVERNED_PAGE_RELEASE_COUNT=1
RELEASED_GOVERNED_PAGES=page_workbench

DATABASE_CONNECTION=false
DATABASE_WRITE_EXECUTION=false
SCHEMA_CHANGE=false
MIGRATION=false
DDL_EXECUTION=false
DML_EXECUTION=false
```

S17 以 S16 merged main 重新审计页面、API、角色 owner、Capability Authority、Workbench、coverage 与测试边界。结论是：下一阶段可以在一个可枚举的 exact 5-file Runtime 中发布 admin-only、只读、partial pilot 页面；本阶段只冻结该闭包，不实施 Runtime，也不改变当前页面计数。

S13 exact-5 只作为历史对照，不能直接复用：S13/S14 曾把共享 system navigation 的 `tenant_operator` 误当成页面 audience；S17 的新闭包必须在 dedicated Route 内额外复用 S16 Audit-specific owner，只有 `tenant_admin` 才能看到正常 Audit Shell。

## 2. S16 merged foundation fresh 核验

当前 `main` 的 S16 owner、Reader 与 Route 形成：

```text
signed formal session
-> authoritative Identity
-> authoritative Membership/Binding current role
-> authoritative Institution Scope
-> tenant_admin-only Audit authorization
-> one-shot opaque handle
-> Institution Audit Reader
-> tenant + institution + verified Repository query
```

当前行为由 merged-main tests 重新证明：

| 角色／状态 | Reader/API 结果 | 页面目标 |
| --- | --- | --- |
| `tenant_admin` | allowed / 200 | 允许继续检查 exact Capability Authority |
| `tenant_operator` | forbidden / 403 | 页面层 forbidden，不渲染 Shell |
| `consultant` | forbidden / 403 | system navigation blocked，页面层 forbidden |
| `customer_service` | forbidden / 403 | system navigation blocked，页面层 forbidden |
| invalid / stale / mismatch / unavailable | unavailable / 503 | 页面层 unavailable，不伪装为空页 |

```text
SELECTED_AUTHORIZATION_STRATEGY=admin_only_v1
TRUSTED_ROLE_AWARE_AUDIT_READ_AUTHORIZATION_SAFE=true
CURRENT_AUDIT_READ_ROLE_AUTHORIZATION_SAFE=true
PAGE_SYSTEM_AUDIT_TARGET_AUDIENCE=tenant_admin_only
PAGE_SYSTEM_AUDIT_TENANT_ADMIN_ALLOWED=true
PAGE_SYSTEM_AUDIT_TENANT_OPERATOR_ALLOWED=false
PAGE_SYSTEM_AUDIT_CONSULTANT_ALLOWED=false
PAGE_SYSTEM_AUDIT_CUSTOMER_SERVICE_ALLOWED=false
ROLE_DENIED_HTTP_STATUS=403
READER_UNAVAILABLE_HTTP_STATUS=503
AUDIT_API_SECURITY_BLOCKER_CLOSED=true
S13_EXACT_5_RELEASE_ADMISSION_REUSABLE=false
```

## 3. Dedicated Route 的 request-bound 授权设计

当前 `/hospital/system/audit` 仍由 shared catch-all 解析为 capability-off；dedicated static Route 不存在。下一阶段应新增 exact `src/app/hospital/system/audit/page.tsx`，不修改 `src/app/hospital/[...slug]/**`。

目标顺序固定为：

```text
formal Institution Request Authorization
-> genuine exact system Navigation Authorization
-> resolveInstitutionAuditReadAuthorizationV1()
-> exact page_system_audit Capability Authority
-> InstitutionAuditEventsShell
```

system navigation 只证明当前请求可进入管理中心，不能证明调用者是 `tenant_admin`。Capability Authority 只回答当前版本是否放行某 capability，也不能提供用户角色。两者都不能替代 Audit-specific current-request owner。

Route 只需要 owner 的三态结论，不需要 tenant/institution pair：

- `allowed`：继续检查 exact Authority；
- `forbidden`：渲染既有低敏 forbidden，Authority 与 Shell 均不执行；
- `unavailable`：渲染既有低敏 unavailable，不伪装为 capability-off 或空数据。

Route 不消费 allowed resolution 中的 one-shot handle。该 handle 不进入 props、DOM、cookie、header、query 或 client；本地 resolution 离开 request render 作用域后不可到达。后续浏览器 GET 是另一个请求，API 会独立重新解析 current facts、mint 并消费新的 handle。不得把 page handle 序列化或跨请求复用。

```text
CANONICAL_ROUTE=/hospital/system/audit
DEDICATED_STATIC_ROUTE_CURRENTLY_EXISTS=false
SHARED_CATCH_ALL_CHANGE_REQUIRED=false
PAGE_ROUTE_OWNER_CHANGE_REQUIRED=false
READER_CHANGE_REQUIRED=false
API_ROUTE_CHANGE_REQUIRED=false
AUDIT_REPOSITORY_CHANGE_REQUIRED=false
GENERIC_SECTION_GUARD_CHANGE_REQUIRED=false
PUBLIC_CONTRACT_CHANGE_REQUIRED=false
ARCHITECTURE_EXCEPTION_REQUIRED=false
```

## 4. 页面 fail-closed 状态

| 页面条件 | 目标状态 | 数据读取 |
| --- | --- | --- |
| genuine system allowed + Audit owner allowed + exact Authority | 正常 readonly Shell | client 才可发 GET |
| trusted non-admin | `forbidden` | 0 |
| formal/navigation/Audit owner unavailable | `unavailable` | 0 |
| admin allowed，但 Authority hidden、shape mismatch、duplicate/missing | `capability-off` | 0 |
| Authority resolver unavailable | `unavailable` | 0 |

正常 Shell 不得在 trusted non-admin、invalid/stale/mismatch、Authority mismatch 或 dependency unavailable 时出现。Route 不发布 role、scope、handle、Membership evidence 或 provenance。

## 5. API、coverage 与低敏边界

API 保持 current main，不进入下一阶段变更 allowlist：

```text
GET /api/institution/audit-events
-> system Section Guard
-> query parser
-> role-aware Audit Reader
-> tenant_admin-only authorization
-> formal tenant + institution + verified-only query
-> low-sensitive DTO
```

caller role、`actorId` 或任意筛选参数都不能建立或扩大权限。成功 record 只保留 `id/resource/resourceId/action/result/reason/actorId/actorRole/occurredAt`；API/client/Shell 不发布 tenant、institution、attribution、Membership evidence、role provenance、secret、raw session、SQL 或 stack。

Coverage 是结构性 contract，不依赖 S17 重新连接数据库：

| 状态 | 页面语义 |
| --- | --- |
| `complete` + zero | authoritative empty |
| `partial_verified_only` + zero | 当前筛选没有 verified row，但不能声明从未发生 |
| `partial_verified_only` + rows | 展示可信 subset，数量不是完整历史总量 |
| `unavailable` | fail closed，不伪装 empty |

S12/S13 的 275/7/1/267 是冻结历史证据，不是 S17 的 live database assertion。当前 Reader、coverage domain、client 与 Shell tests 已锁定 partial verified-only 语义，因此 release eligibility 不依赖重新读取 PostgreSQL。

```text
AUDIT_READER_COVERAGE_STATE=partial_verified_only
AUDIT_READER_HISTORICAL_COVERAGE_COMPLETE=false
AUDIT_READER_PARTIAL_COVERAGE_SAFE=true
AUDIT_READER_COVERAGE_DISCLOSURE_SAFE=true
PAGE_DISCLOSURE_HISTORICAL_COVERAGE_COMPLETE=false
DATA_FRESHNESS_RECHECK_REQUIRED=false
DATABASE_FRESH_RECHECK_REQUIRED=false
SHELL_READONLY_SAFE=true
LOW_SENSITIVE_OUTPUT_SAFE=true
```

## 6. Capability Authority 与导航

当前 Authority revision 只放行 `page_workbench`，`page_system_audit` 保持 hidden/not_released。下一阶段仅在 existing code-owned policy 中增加 exact target：

```text
capabilityKey=page_system_audit
decision=read_only
codeMaturity=verified
institutionAuthorization=authorized
connectionAvailability=not_required
dataReadiness=partial
productionRelease=pilot_released
safeSummary=审计与安全仅供查看
```

Authority revision 随 policy 更新；`page_workbench` 保持原 shape，其余 34 capabilities 保持 hidden/not_released，三个 controlled-create action 保持未放行。Authority 对 admin/operator 可返回相同 capability release shape，因为 role authorization 由 Route 的 Audit-specific owner 独立完成。

Public registry 已把 `page_system_audit` 精确绑定到 `system_audit` 与 `/hospital/system/audit`，system navigation 已提供管理中心父栏目；release 不需要新增 navigation config、registry 或 public contract。Workbench 继续只选择 `page_workbench`，不会用 audit summary 作为 Workbench 内导航入口。

```text
CAPABILITY_AUTHORITY_RELEASE_PATH_SAFE=true
NAVIGATION_RUNTIME_CHANGE_REQUIRED=false
FUTURE_REVIEW_ACCEPTED_GOVERNED_PAGE_RELEASE_COUNT=2
CONTROLLED_CREATE_RELEASE_COUNT=0
```

## 7. Workbench multi-capability

当前 `/hospital` 在完整 projection 后按 `capabilityKey='page_workbench'` 精确筛选，并向 Workbench Shell 只传一条 scoped summary。下一阶段 test fixture 必须使用真实 audit target shape，锁定：

- audit 在 Workbench 前后顺序均稳定；
- audit summary 不进入 Workbench DOM；
- duplicate 或 missing `page_workbench` fail closed；
- hidden/unrelated second capability 不改变 Workbench；
- `page_workbench` 的 read_only/pilot shape 不变。

```text
WORKBENCH_MULTI_CAPABILITY_SAFE=true
WORKBENCH_PAGE_WORKBENCH_PROJECTION_STABLE=true
```

## 8. Fresh exact Runtime allowlist

```text
EXACT_RUNTIME_ALLOWLIST_FROZEN=true
EXACT_RUNTIME_FILE_COUNT=5
EXACT_RUNTIME_EXISTING_FILE_COUNT=4
EXACT_RUNTIME_NEW_FILE_COUNT=1
EXACT_RUNTIME_DELETE_FILE_COUNT=0
EXACT_PRODUCTION_FILE_COUNT=2
EXACT_TEST_FILE_COUNT=3
```

| Path | Role | Why required | Existing/New | Production/Test |
| --- | --- | --- | --- | --- |
| `src/server/orchestration/institution-capability-authority.ts` | code-owned release policy | 增加 exact audit read_only/partial/pilot shape 并更新 revision，同时保持 Workbench、其余 capability 与 controlled-create 不变 | existing | production |
| `src/server/orchestration/institution-capability-authority.test.ts` | release-policy tests | 锁定两个 released governed pages、audit partial shape、Authority 非 role source与其余 34 hidden | existing | test |
| `src/app/hospital/system/audit/page.tsx` | dedicated canonical Route | 依次执行 formal request、genuine system navigation、S16 admin-only owner 与 exact Authority，只在全部成立时渲染 readonly Shell | new | production |
| `src/modules/institution/tests/InstitutionRouteShell.test.tsx` | Route integration tests | 锁定 admin allowed、operator/consultant/customer_service denied、owner/Authority fail-closed、no handle leakage、GET-only Shell 与 catch-all 不回归 | existing | test |
| `src/modules/institution-workbench/tests/HospitalWorkbenchEntry.test.tsx` | multi-capability regression | 用真实 audit partial pilot fixture锁定顺序稳定、Workbench-only DOM 与 duplicate/missing fail-closed | existing | test |

上表是唯一 canonical exact Runtime allowlist。没有 CSV、JSON、YAML、script 或 machine-readable mirror。任何第 6 个 Runtime/Test 文件、S16 owner 变更、Reader/API/Repository/generic Guard/public contract 变更都必须停止并重新准入。

## 9. 下一阶段冻结 test plan

1. `tenant_admin` page allowed；
2. `tenant_operator` page denied；
3. `consultant` page denied；
4. `customer_service` page denied；
5. admin API 200；
6. operator API 403；
7. Authority hidden fail closed；
8. Authority unavailable fail closed；
9. Authority mismatch fail closed；
10. Audit authorization unavailable fail closed；
11. exact direct URL；
12. shared catch-all unchanged；
13. partial coverage with rows；
14. partial filtered zero is not authoritative empty；
15. complete zero is authoritative empty；
16. unavailable fail closed；
17. Workbench + audit order stable；
18. duplicate Workbench fail closed；
19. missing Workbench fail closed；
20. page Shell remains filter/refresh/pagination and GET-only；
21. no role/handle/scope/evidence leakage；
22. other hidden pages unchanged；
23. `page_workbench` release unchanged；
24. controlled-create release count unchanged。

同时运行 unchanged S16 owner/Reader/API、Scope Guard、Section Guard、Formal Institution Session Context、client/Shell/coverage、Capability Authority、RouteShell、Workbench、typecheck、AQ unit 148/148、Architecture incremental、ProductionReadinessDocs、`git diff --check` 与 Required Check。

S17 Admission 当前本地证据：

```text
TARGETED_TEST_FILES=14
TARGETED_TESTS=531/531 passed
POST_MERGE_INDEPENDENT_TEST_FILES=14
POST_MERGE_INDEPENDENT_TESTS=531/531 passed
TYPECHECK=passed
ARCHITECTURE_UNIT=148/148 passed
ARCHITECTURE_INCREMENTAL=passed
PRODUCTION_READINESS_DOCS=8/8 passed
GIT_DIFF_CHECK=passed
```

## 10. Rollback 与边界

未来 Runtime 必须保持单一 exact-5 PR。若发布后出现页面角色、Authority、coverage、Route 或 Workbench 回归，revert 该单一 Runtime merge：删除 dedicated Route，恢复 Authority policy/revision 与 3 个 test files。回滚不连接数据库，不触碰 Reader、Repository、Schema 或历史记录，并恢复页面 hidden/count=1。

S17 自身不实施 Runtime、数据库、Schema、Migration、DDL/DML、Staging 或 Production。

## 11. 下一任务

```text
NEXT_STAGE=S18
NEXT_TASK=POST-V2-R1C page_system_audit exact 5-file Runtime release implementation explicit authorization
NEXT_TASK_AUTHORIZED=false
S18_RUNTIME_AUTHORIZED=false
```

Admission PR #1212 已合并且 post-merge Review debt 为 0；S17 final Handoff 尚待合并。任何 docs closure 都不构成 S18 Runtime 授权，不得自动开始。
