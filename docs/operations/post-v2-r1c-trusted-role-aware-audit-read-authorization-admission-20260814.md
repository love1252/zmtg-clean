# POST-V2-R1C 可信角色感知 Audit 读取授权 fresh audit 与精确 Runtime 准入

> 日期：2026-08-14（Asia/Shanghai）
>
> 基线：`7bbec7f7eaaf870063ecd12bf971d949c7a173fc`
>
> 类型：docs-only fresh audit / exact Runtime Admission

## 1. 唯一结论

```text
STAGE=S15
TASK=POST_V2_R1C_TRUSTED_ROLE_AWARE_AUDIT_READ_AUTHORIZATION_FRESH_AUDIT_EXACT_RUNTIME_ADMISSION
COMPLETION_MODE=ADMISSION_READY

FRESH_ROLE_AUTHORIZATION_AUDIT=passed
TRUSTED_ROLE_SOURCE_EXISTS=true
TRUSTED_ROLE_SOURCE_PROVENANCE_VERIFIED=true
TRUSTED_FORMAL_SESSION_ROLE_ALREADY_AVAILABLE=true
TRUSTED_ROLE_DROPPED_BEFORE_AUDIT_READER=true

CURRENT_AUDIT_READ_ROLE_AUTHORIZATION_SAFE=false
SELECTED_AUTHORIZATION_STRATEGY=admin_only_v1
ROLE_AWARE_AUDIT_READ_AUTHORIZATION_OWNER=src/server/orchestration/institution-audit-read-authorization.ts

ADMIN_ONLY_CAN_CLOSE_BLOCKER=true
OPERATOR_LIMITED_REQUIRED=false
OPERATOR_LIMITED_OVERDEVELOPMENT=true

EXACT_RUNTIME_ALLOWLIST_FROZEN=true
EXACT_RUNTIME_FILE_COUNT=6
EXACT_RUNTIME_EXISTING_FILE_COUNT=4
EXACT_RUNTIME_NEW_FILE_COUNT=2
EXACT_PRODUCTION_FILE_COUNT=3
EXACT_TEST_FILE_COUNT=3

TRUSTED_ROLE_AWARE_AUDIT_READ_AUTHORIZATION_ADMISSION_READY=true
S15_RUNTIME_IMPLEMENTED=false
S15_RUNTIME_AUTHORIZED=false

PAGE_SYSTEM_AUDIT_STATE=hidden/not_released
PAGE_SYSTEM_AUDIT_RELEASE=false
PAGE_SYSTEM_AUDIT_RELEASE_ELIGIBLE=false
PAGE_SYSTEM_AUDIT_RUNTIME_READMISSION_READY=false
REVIEW_ACCEPTED_GOVERNED_PAGE_RELEASE_COUNT=1
S14_SECURITY_BLOCKER_OPEN=true
S13_EXACT_5_RELEASE_ADMISSION_REUSABLE_WITHOUT_FRESH_READMISSION=false
```

Fresh audit 证明，当前仓库已经有可信的 current role，但角色在进入 Audit Reader 之前被通用 Capability Authority context 丢弃。最小安全闭包不是扩展通用 Guard 或把 operator 过滤下沉到 Repository，而是在 server orchestration 建立 Audit-specific、不可伪造、one-shot 的读取授权 owner：只允许 authoritative current `tenant_admin`，其余正式角色明确返回 403；Reader unavailable 继续返回 503。

S15 只冻结下一阶段 exact 6-file Runtime scope，不实施任何 Runtime，不连接数据库，也不放行 `page_system_audit`。

## 2. Fresh 审计范围与证据

本次逐项审计：

- `src/modules/security/server/institution-scope-guard.ts`；
- `src/modules/auth/application/formal-institution-session-context.ts`；
- Identity、Membership/Binding 与 Institution Scope authoritative readers；
- `src/server/orchestration/institution-audit-writer-scope.ts`；
- `src/modules/institution/server/institution-server-runtime.ts`；
- `src/app/api/institution/_shared/institution-route-guard.ts`；
- `src/server/orchestration/institution-audit-reader.ts`；
- `src/modules/audit/server/audit-event-repository.ts`；
- `GET /api/institution/audit-events` Route、调用面与对应测试；
- Git history、AQ004-AQ008 与 S14 rollback/blocked-state 证据。

没有连接数据库，没有读取凭据，没有执行 Runtime、Schema、Migration、DDL、DML、Seed、Staging 或 Production 操作。

## 3. 可信角色来源与 provenance chain

`InstitutionScopeAllowV1` 已包含：

```text
userReference
role
tenantId
institutionId
membershipRevision
bindingRevision
anchorRevision
provenanceValidUntil
membershipFreshUntil
anchorFreshUntil
decidedAt
validUntil
```

其 role 不来自 query、普通 cookie 字段、Route 参数或 UI state。正式链路是：

```text
签名 formal session claims
-> authoritative Identity current fact
-> authoritative Membership/Binding current fact（包含 role）
-> authoritative Institution Scope current fact
-> Membership、Scope、Identity 二次读取一致性检查
-> immutable FormalServerSessionUserSnapshotV1
-> sessionUser.role
```

`formal-institution-session-context` 对 `accountId + tenantId + institutionId` 做 exact shape、active lifecycle、membership/binding revision、scope revision 与 stale/mismatch fail-closed；`sessionUser.role` 取自第二次仍一致的 authoritative membership fact。`institution-audit-writer-scope.ts` 已证明该 context 能解析 `session user id + role + tenantId + institutionId`，只是 Writer formal pair 最终有意不携带 role。

```text
TRUSTED_ROLE_SOURCE_EXISTS=true
TRUSTED_ROLE_SOURCE_OWNER=Access Control authoritative Membership/Binding owner（经 Auth formal institution session context 交叉确认）
TRUSTED_ROLE_SOURCE_PROVENANCE=verified signed formal session claims + authoritative Identity + twice-current Membership/Binding role + twice-current Institution Scope
TRUSTED_ROLE_SOURCE_PROVENANCE_VERIFIED=true
TRUSTED_FORMAL_SESSION_ROLE_ALREADY_AVAILABLE=true
```

下一阶段必须复用这条现有链，不得新增第二套 role enum、role cookie、header 或 query role system。

## 4. 角色丢失点与当前不安全边界

`InstitutionCapabilityAuthorityRuntimeContextConsumptionV1` 当前只有：

```text
tenantId
institutionId
availableSectionIds
observedAt
```

它不携带 role 或 current actor identity。`tenant_admin` 与 `tenant_operator` 都能得到包含 `system` 的 management navigation；Audit Reader 当前只判断：

```text
availableSectionIds.includes('system')
```

成立后即以 formal tenant + institution 查询全部 `verified` subset。因此 current Reader 没有角色、本人或 Audit module authorization。

```text
TRUSTED_ROLE_DROPPED_BEFORE_AUDIT_READER=true
GENERIC_SECTION_GUARD_ROLE_AWARE_FOR_HANDLER=false
CURRENT_READER_ROLE_FILTER=false
CURRENT_READER_ACTOR_IDENTITY_FILTER=false
CURRENT_READER_MODULE_FILTER=false
CURRENT_AUDIT_READ_ROLE_AUTHORIZATION_SAFE=false
```

通用 `withInstitutionSectionRouteGuardV1` 只把 genuine section decision 收敛为 allowed/403，不把 scope allow 或 role 传给 handler。为单个 Audit endpoint 修改它会扩大所有机构 Route 的 blast radius，因此排除。

## 5. Repository 与 caller query 边界

Institution Repository query 已强制：

```text
tenantId = formal tenant
institutionId = formal institution
institutionAttribution = 'verified'
```

`actorId`、`resource`、`action`、`result`、`reason`、时间与 cursor 只属于 caller query filter。`actorId=<某人>` 不证明 caller 就是该人，也不能扩大或建立授权。

```text
CALLER_ROLE_IS_AUTHORIZATION_SIGNAL=false
CALLER_ACTOR_ID_IS_AUTHORIZATION_SIGNAL=false
AUDIT_REPOSITORY_ROLE_FILTER_REQUIRED=false
AUDIT_REPOSITORY_CHANGE_REQUIRED=false
```

Admin-only 在 Repository 之前完成授权，成功后继续复用现有 institution + verified scope；Repository、pagination、coverage 与 Platform query 无需改变。

## 6. Production Reader caller inventory

Fresh 全仓搜索 `readCurrentInstitutionAuditEventsV1`，排除测试、mock、client fetch、type-only 与 reader 自身定义后，只有一个 production caller：

| Production caller | 调用 | 当前作用 |
| --- | --- | --- |
| `src/app/api/institution/audit-events/route.ts` | `readCurrentInstitutionAuditEventsV1(parsedQuery.query)` | 解析机构 Audit GET query，映射 Reader ready/unavailable 为 HTTP 响应 |

```text
PRODUCTION_AUDIT_READER_CALLER_COUNT=1
PRODUCTION_AUDIT_READER_CALLERS=src/app/api/institution/audit-events/route.ts
```

`src/modules/audit/client/institution-audit-events-client.ts` 调用 HTTP endpoint，不直接调用 orchestration Reader，不计 production Reader caller。

## 7. 候选策略比较

| 方案 | 可信 role | 影响面 | Repository / contract | 结论 |
| --- | --- | --- | --- | --- |
| A `trusted_admin_only` | 复用现有 formal session authoritative role | Audit-specific orchestration + Reader + Route | Repository 与 public contract 不变 | **选择** |
| B `operator_limited` | current actor 可从 formal session 获得 | 仍缺 authoritative role→Audit module/resource 与历史 row→module mapping | 需要 Repository 条件、coverage/pagination 重审或新 mapping framework | 排除，过度开发 |
| C 扩展 generic institution runtime context | 可携带 role | 所有 Authority/Workbench 消费者与通用 context contract | 扩大 coupling 与回归面 | 排除 |
| D 修改 generic institution Route Guard | Guard 内有 scope role | 所有机构 API Guard/handler contract | 全站 blast radius | 排除 |
| E Reader 内直接复制 formal session resolution | 可得到 role | Security/Auth composition 复制进 Reader | owner 与测试边界混乱 | 排除 |

仓库不存在可直接复用的 authoritative `role -> authorized Audit modules/resources` 映射，也不存在所有历史 verified row 的可信 module attribution。若让 operator 读取本人或授权模块，必须同步冻结 current actor、resource mapping、coverage、pagination 与 Platform regression；这不是关闭当前 blocker 所需的最小方案。

```text
SELECTED_STRATEGY_CANDIDATE_A=trusted_admin_only
SELECTED_STRATEGY_CANDIDATE_B=operator_limited
SELECTED_AUTHORIZATION_STRATEGY=admin_only_v1

ADMIN_ONLY_CAN_CLOSE_BLOCKER=true
ADMIN_ONLY_PUBLIC_CONTRACT_CHANGE_REQUIRED=false
ADMIN_ONLY_REPOSITORY_CHANGE_REQUIRED=false
ADMIN_ONLY_GENERIC_ROUTE_GUARD_CHANGE_REQUIRED=false
ADMIN_ONLY_ARCHITECTURE_EXCEPTION_REQUIRED=false

OPERATOR_LIMITED_REQUIRED=false
OPERATOR_LIMITED_OVERDEVELOPMENT=true
```

## 8. 唯一授权 owner 与目标结构

下一阶段新增 server-only owner：

`src/server/orchestration/institution-audit-read-authorization.ts`

它负责：

1. 复用 signed formal session verification 与现有 authoritative Identity / Membership / Scope readers；
2. 从 genuine formal session snapshot 读取 `sessionUser.role`；
3. exact 验证 user、tenant、institution 与 role；
4. 只对 `tenant_admin` mint genuine、frozen、opaque、one-shot handle；
5. 对其他可信正式角色返回 `forbidden`，对 invalid/stale/mismatch/missing/unavailable 返回 `unavailable`；
6. consumption 只发布 Reader 所需的 `tenantId + institutionId + observedAt`，不发布 role、cookie、membership evidence、capability 或 caller input。

目标链路：

```text
formal signed session + authoritative Identity/Membership/Scope
-> Audit-specific trusted read authorization owner
-> tenant_admin-only one-shot opaque handle
-> Institution Audit Reader
-> Audit Repository
-> formal tenant + institution + verified subset
```

Reader 只调用 owner，不复制 Security/Auth 解析；owner 替换 Reader 当前 generic Capability Authority context resolution，不修改通用 context，也不新增 ownership query 类型或数据库 transaction。

```text
ROLE_AWARE_AUDIT_READ_AUTHORIZATION_OWNER=src/server/orchestration/institution-audit-read-authorization.ts
GENERIC_SECTION_GUARD_CHANGE_REQUIRED=false
INSTITUTION_SERVER_RUNTIME_CHANGE_REQUIRED=false
AUDIT_READER_CHANGE_REQUIRED=true
AUDIT_API_ROUTE_CHANGE_REQUIRED=true
AUDIT_REPOSITORY_CHANGE_REQUIRED=false
PUBLIC_CONTRACT_CHANGE_REQUIRED=false
ARCHITECTURE_EXCEPTION_REQUIRED=false
```

## 9. 403 / 503 语义

当前通用 Section Guard 已稳定使用 403 表达授权拒绝。下一阶段应保持：

| 场景 | Reader result | API status |
| --- | --- | --- |
| trusted `tenant_admin` + valid formal pair | `ready` | 200 |
| trusted `tenant_operator` / `consultant` / `customer_service` | `forbidden` | 403 |
| forged/missing role、invalid session、stale membership、pair mismatch、owner unavailable | `unavailable` | 503 |
| invalid query | 不进入 Reader | 400 |

`forbidden` 是 server-only Reader result kind；Route 返回固定低敏 403 body。它不新增 client DTO、query 字段、role enum、Capability registry 或 Security public API。

```text
ROLE_DENIED_IS_SERVICE_UNAVAILABLE=false
ROLE_DENIED_HTTP_STATUS=403
READER_UNAVAILABLE_HTTP_STATUS=503
```

## 10. 禁止的伪方案

以下全部明确拒绝：

- query/header/client 自报 role；
- caller `actorId` 作为 current identity 或授权；
- 由 `availableSectionIds.includes('system')` 推断 admin；
- 由 page release/capability 状态推断 role；
- 用 current single membership、目录位置或 UI state 猜 role；
- 只隐藏 operator 页面但继续开放 API；
- 只在页面 Route 或前端过滤；
- 临时把 `tenant_operator` 当 admin。

```text
UNSAFE_STRATEGY_REJECTED=true
CALLER_ROLE_IS_AUTHORIZATION_SIGNAL=false
CALLER_ACTOR_ID_IS_AUTHORIZATION_SIGNAL=false
```

## 11. Fresh exact Runtime allowlist

```text
EXACT_RUNTIME_ALLOWLIST_FROZEN=true
EXACT_RUNTIME_FILE_COUNT=6
EXACT_RUNTIME_EXISTING_FILE_COUNT=4
EXACT_RUNTIME_NEW_FILE_COUNT=2
EXACT_RUNTIME_DELETE_FILE_COUNT=0
EXACT_PRODUCTION_FILE_COUNT=3
EXACT_TEST_FILE_COUNT=3
```

| Path | Role | Why required | Existing/New | Production/Test |
| --- | --- | --- | --- | --- |
| `src/server/orchestration/institution-audit-read-authorization.ts` | Audit-specific trusted read authorization owner | 复用 formal session authoritative role，区分 admin allow、trusted-role forbidden 与 invalid/unavailable，并 mint one-shot handle | new | production |
| `src/server/orchestration/institution-audit-read-authorization.test.ts` | owner trust/fail-closed tests | 锁定 admin、operator/consultant/customer_service、forgery、stale/mismatch/missing 与 one-shot provenance | new | test |
| `src/server/orchestration/institution-audit-reader.ts` | current-institution Audit Reader | 用 Audit-specific handle 替换 generic capability context，增加 `forbidden` result，保持 verified scope/coverage/pagination | existing | production |
| `src/server/orchestration/institution-audit-reader.test.ts` | Reader authorization/isolation tests | 锁定 handle consumption、caller input 不扩权、tenant/institution/verified、coverage、pagination 与 fail-closed | existing | test |
| `src/app/api/institution/audit-events/route.ts` | HTTP adapter | 把 trusted role denial 映射为固定低敏 403，继续把 unavailable 映射为 503，并保留 query 400 与 system Section Guard | existing | production |
| `src/modules/audit/tests/InstitutionAuditEventsApiRoute.test.ts` | API behavior tests | 锁定 200/400/403/503、caller role/actor 不扩权、no-store、低敏 DTO 与 coverage contract | existing | test |

上表是唯一 canonical exact Runtime allowlist。不得使用 glob、目录授权、“相关 helper/测试”等模糊范围。任何第 7 个 Runtime/Test 文件、Repository 改动、generic Guard/runtime 改动或 public contract 改动都必须停止并重新准入。

`src/app/api/institution/audit-events/route.test.ts` 的静态 wiring 契约无需修改：Route 仍只连接 parser 与 orchestration Reader，并继续保留 system Section Guard。Formal session、Repository、Platform Audit、Capability Authority、Workbench 与 page hidden tests 作为 unchanged regression 运行，不计入变更 allowlist。

## 12. 下一阶段测试闭包

Exact 3 个变更测试文件必须覆盖：

1. `tenant_admin` allowed；
2. `tenant_operator` denied；
3. `consultant` denied；
4. `customer_service` denied；
5. forged role rejected；
6. caller role ignored；
7. caller `actorId` 不能扩大读取范围；
8. formal session invalid fail closed；
9. membership stale fail closed；
10. membership mismatch fail closed；
11. institution mismatch fail closed；
12. trusted role missing fail closed；
13. Reader tenant isolation；
14. Reader institution isolation；
15. verified-only；
16. coverage `partial_verified_only` 语义不变；
17. pagination 不变；
18. API 400/403/503 与 `no-store`；
19. one-shot handle 不可 clone、不可重放；
20. caller query role/scope/institution 注入不建立授权；
21. 低敏 DTO 不泄漏 tenant、institution、attribution、evidence 或 secret。

Unchanged regression 必须至少运行：

- Institution Scope Guard；
- Institution Section Guard；
- Formal Institution Session Context；
- Institution Server Runtime；
- Audit Repository；
- static Audit API Route wiring；
- Platform Audit API；
- Capability Authority；
- `page_system_audit` hidden 与 Workbench unaffected 相关测试；
- typecheck、AQ unit 148/148、Architecture incremental、ProductionReadinessDocs、`git diff --check` 与 Required Check。

## 13. Architecture 与边界判断

Audit read authorization 是 Auth/Security/Access Control/Institution/Audit 的 cross-owner composition，放在 `src/server/orchestration/**`；不会让任一业务 module 反向 import orchestration，也不会新增 module→其他 module server/Repository 边。因此 AQ004-AQ008 不需 exception，AQ rules 不修改。

```text
SCHEMA_CHANGE_REQUIRED=false
MIGRATION_REQUIRED=false
DDL_REQUIRED=false
DML_REQUIRED=false
DATABASE_CONNECTION_REQUIRED=false
PUBLIC_CONTRACT_CHANGE_REQUIRED=false
ARCHITECTURE_EXCEPTION_REQUIRED=false
```

本次和下一阶段均不得把 admin-only 预先扩展成 generic attribution context、operator module framework、Repository ACL、Capability Authority policy 或页面 release。

## 14. Rollback

未来 exact-6 Runtime 为单一 authorization slice。若发现 role provenance、403/503、Reader scope、coverage 或 Platform regression：

1. revert 该单一 Runtime merge；
2. 删除新 owner 与测试；
3. 恢复 Reader、Reader test、Route 与 API test；
4. Repository、Schema、历史数据、Capability Authority、Workbench 与页面 release 从未改变；
5. 恢复 S14 blocker 状态，继续 `hidden/not_released`。

Rollback 不需要数据库连接、DML、Schema 或 Migration。

## 15. S15 边界与下一任务

```text
S15_RUNTIME_IMPLEMENTED=false
S15_RUNTIME_AUTHORIZED=false

PAGE_SYSTEM_AUDIT_STATE=hidden/not_released
PAGE_SYSTEM_AUDIT_RELEASE=false
PAGE_SYSTEM_AUDIT_RELEASE_ELIGIBLE=false
PAGE_SYSTEM_AUDIT_RUNTIME_READMISSION_READY=false
REVIEW_ACCEPTED_GOVERNED_PAGE_RELEASE_COUNT=1
S14_SECURITY_BLOCKER_OPEN=true

DATABASE_CONNECTION=false
DATABASE_WRITE_EXECUTION=false
SCHEMA_CHANGE=false
MIGRATION=false
DDL_EXECUTION=false
DML_EXECUTION=false
PRODUCTION_CHANGE=false
PRODUCTION_DEPLOYMENT=false

NEXT_TASK=POST-V2-R1C Trusted Role-Aware Audit Read Authorization exact Runtime implementation explicit authorization
NEXT_STAGE=S16
NEXT_TASK_AUTHORIZED=false
S16_RUNTIME_AUTHORIZED=false
```

S15 Admission 不自动关闭 S14 security blocker；只有下一阶段 exact Runtime 实施、验证、合并并重新 fresh 审计页面 release 后，才能重新判断 `PAGE_SYSTEM_AUDIT_RELEASE_ELIGIBLE`。旧 S13 exact-5 release Admission 继续只作为历史证据，不得直接重放或追加文件。

## 16. S15 验证与 PR 证据

```text
TARGETED_TEST_FILES=10
TARGETED_TESTS=325/325 passed
TYPECHECK=passed
ARCHITECTURE_UNIT=148/148 passed
ARCHITECTURE_INCREMENTAL=passed
PRODUCTION_READINESS_DOCS=8/8 passed
GIT_DIFF_CHECK=passed

S15_ADMISSION_PR=1208
S15_PR_COUNT=1
S15_PRS=1208
S15_REQUIRED_CHECKS=pending
S15_ACTIONABLE_P0_P1=pending
POST_MERGE_REVIEW_DEBT=pending
```

最终 PR/Required Check/Review/Merge 证据只在对应事实实际成立后更新；不得以本 Admission 预先宣称 Runtime、页面 release 或 Production 完成。
