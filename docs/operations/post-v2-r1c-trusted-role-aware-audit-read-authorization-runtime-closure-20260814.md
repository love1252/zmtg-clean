# POST-V2-R1C 可信角色感知 Audit 读取授权 Runtime 闭环

> 日期：2026-08-14（Asia/Shanghai）
>
> 阶段：S16
>
> 基线：`d0a886d4be5d391ad044acf990fdd1d44a7e0a74`
>
> Runtime PR：#1210 / Head `7bbb72d527245c9ca26b2d29cc5ccda19228d670` / Merge `dc73994246f300b38a823fcb8f5f330eac05f7e5`
>
> Final Handoff PR：#1211

## 1. 终态结论

```text
STAGE=S16
TASK=POST_V2_R1C_TRUSTED_ROLE_AWARE_AUDIT_READ_AUTHORIZATION_EXACT_RUNTIME_IMPLEMENTATION
COMPLETION_MODE=COMPLETE
BASELINE=d0a886d4be5d391ad044acf990fdd1d44a7e0a74
RUNTIME_PR=1210
RUNTIME_HEAD=7bbb72d527245c9ca26b2d29cc5ccda19228d670
RUNTIME_MERGE=dc73994246f300b38a823fcb8f5f330eac05f7e5
FINAL_HANDOFF_PR=1211

S16_RUNTIME_IMPLEMENTED=true
EXACT_RUNTIME_FILE_COUNT=6
ACTUAL_RUNTIME_TEST_CHANGED_FILE_COUNT=6
EXACT_SCOPE_MATCH=true
EXACT_RUNTIME_EXISTING_FILE_COUNT=4
EXACT_RUNTIME_NEW_FILE_COUNT=2
EXACT_PRODUCTION_FILE_COUNT=3
EXACT_TEST_FILE_COUNT=3

SELECTED_AUTHORIZATION_STRATEGY=admin_only_v1
TRUSTED_ROLE_AWARE_AUDIT_READ_AUTHORIZATION_SAFE=true
CURRENT_AUDIT_READ_ROLE_AUTHORIZATION_SAFE=true
AUDIT_API_ROLE_AWARE_AUTHORIZATION_SAFE=true
TENANT_ADMIN_AUDIT_READ_ALLOWED=true
TENANT_OPERATOR_AUDIT_READ_ALLOWED=false
CONSULTANT_AUDIT_READ_ALLOWED=false
CUSTOMER_SERVICE_AUDIT_READ_ALLOWED=false
ROLE_DENIED_HTTP_STATUS=403
READER_UNAVAILABLE_HTTP_STATUS=503
AUDIT_API_SECURITY_BLOCKER_CLOSED=true
S14_SECURITY_BLOCKER_RESOLVED_BY_S16=true

AUDIT_REPOSITORY_CHANGE=false
GENERIC_SECTION_GUARD_CHANGE=false
INSTITUTION_SERVER_RUNTIME_CHANGE=false
PUBLIC_CONTRACT_CHANGE=false
ARCHITECTURE_EXCEPTION_REQUIRED=false

AUDIT_READER_COVERAGE_STATE=partial_verified_only
AUDIT_READER_HISTORICAL_COVERAGE_COMPLETE=false
AUDIT_READER_PARTIAL_COVERAGE_SAFE=true

PAGE_SYSTEM_AUDIT_STATE=hidden/not_released
PAGE_SYSTEM_AUDIT_RELEASE=false
PAGE_SYSTEM_AUDIT_RELEASE_ELIGIBLE=false
PAGE_SYSTEM_AUDIT_RUNTIME_READMISSION_READY=false
REVIEW_ACCEPTED_GOVERNED_PAGE_RELEASE_COUNT=1

S16_RUNTIME_REQUIRED_CHECK=passed
S16_RUNTIME_ACTIONABLE_P0_P1=0
S16_RUNTIME_ACTIONABLE_P0_P1_P2_P3=0
S16_RUNTIME_POST_MERGE_REVIEW_DEBT=0
S16_HANDOFF_REQUIRED_CHECK=passed
S16_PR_COUNT=2
S16_PRS=1210,1211
S16_REQUIRED_CHECKS=passed
S16_ACTIONABLE_P0_P1=0
S16_ACTIONABLE_P0_P1_P2_P3=0
POST_MERGE_REVIEW_DEBT=0

S16_COMPLETE=true
NEXT_STAGE=S17
NEXT_TASK=POST-V2-R1C page_system_audit fresh release re-audit + exact Runtime re-admission
NEXT_TASK_AUTHORIZED=false
S17_AUTHORIZED=false
```

S16 已在 exact 6-file Runtime 范围内实现角色感知机构 Audit 读取授权。只有来自签名 formal session、并经 authoritative Identity、Membership/Binding 与 Institution Scope 交叉确认的 current `tenant_admin` 才能获得 genuine、frozen、opaque、one-shot 读取 handle；其他可信机构角色固定拒绝，invalid、stale、mismatch、missing 与 owner unavailable 继续 fail-closed。

Final Handoff PR #1211 只在冻结 Head 的 Required Check 成功、Review sweep 为 0 debt 且完成合并后，使本文的 `S16_COMPLETE=true` 成为仓库终态事实。

## 2. Runtime exact scope

| 路径 | 类型 | 变更 |
| --- | --- | --- |
| `src/server/orchestration/institution-audit-read-authorization.ts` | new production | 新增 Audit-specific trusted role-aware authorization owner |
| `src/server/orchestration/institution-audit-read-authorization.test.ts` | new test | 锁定 role provenance、one-shot handle 与 fail-closed 边界 |
| `src/server/orchestration/institution-audit-reader.ts` | existing production | 消费 Audit-specific handle，并发布 `forbidden` / `unavailable` / `ready` |
| `src/server/orchestration/institution-audit-reader.test.ts` | existing test | 锁定 scope、coverage、filters、pagination 与 caller input 不扩权 |
| `src/app/api/institution/audit-events/route.ts` | existing production | 固定映射低敏 403 与既有 503，保留 system Section Guard |
| `src/modules/audit/tests/InstitutionAuditEventsApiRoute.test.ts` | existing test | 锁定 200/400/403/503、no-store 与低敏 response |

```text
EXACT_RUNTIME_FILE_COUNT=6
ACTUAL_RUNTIME_TEST_CHANGED_FILE_COUNT=6
EXACT_SCOPE_MATCH=true
SEVENTH_RUNTIME_TEST_FILE_TOUCHED=false
AUDIT_REPOSITORY_CHANGE=false
GENERIC_SECTION_GUARD_CHANGE=false
INSTITUTION_SERVER_RUNTIME_CHANGE=false
PUBLIC_CONTRACT_CHANGE=false
CAPABILITY_AUTHORITY_CHANGE=false
PAGE_ROUTE_CHANGE=false
```

## 3. 授权与 HTTP 语义

授权链固定为：

```text
signed formal session claims
-> authoritative Identity current fact
-> authoritative Membership/Binding current fact
-> authoritative Institution Scope current fact
-> Formal Institution Session Context 二次一致性检查
-> Audit-specific role owner
-> tenant_admin-only one-shot handle
-> Institution Audit Reader
-> tenant + institution + verified Repository query
```

- `tenant_admin`：授权成功，Reader 可返回 `ready`，Route 返回 200；
- `tenant_operator`：外层 system Section Guard 可通过，但 Audit owner 返回 `forbidden`，Route 返回低敏 403；
- `consultant` / `customer_service`：由外层 Guard 或 Audit owner 拒绝，最终均为低敏 403；
- invalid、stale、forged、missing、pair mismatch、owner unavailable：Reader 返回 `unavailable`，Route 返回低敏 503；
- caller `actorId`、resource、action、reason、dates 只缩小 query，不能建立或扩大授权，也不能改变 formal tenant/institution pair。

成功 consumption 仅发布 `tenantId + institutionId + observedAt`，不发布 role、cookie、Membership evidence、provenance、secret 或 capability；plain object、clone、spread、JSON、Proxy 与二次消费均不能伪造 genuine handle。

## 4. Reader coverage 与未改变边界

Repository 继续按 formal `tenantId + institutionId + institutionAttribution='verified'` 查询；7 条安全可读 `verified` 与 267 条历史 `UNCLASSIFIABLE` 的 coverage 语义不变：

```text
AUDIT_READER_COVERAGE_STATE=partial_verified_only
AUDIT_READER_HISTORICAL_COVERAGE_COMPLETE=false
AUDIT_READER_PARTIAL_COVERAGE_SAFE=true
```

本阶段没有修改 Audit Repository、generic Institution Section Guard、Institution Server Runtime、Capability Authority、Workbench、public contract、AQ rules、Schema 或历史数据。`page_system_audit` 仍为 `hidden/not_released`；S13 old exact-5 Admission 不能直接重放，下一阶段必须以 S16 merged Runtime 为新基线 fresh re-audit。

## 5. 验证证据

```text
CHANGED_TEST_FILES=3
CHANGED_TESTS=72/72 passed
TARGETED_TEST_FILES=13
TARGETED_TESTS=457/457 passed
FULL_TEST_FILES=496
FULL_TESTS=6836/6836 passed
POST_MERGE_INDEPENDENT_TEST_FILES=3
POST_MERGE_INDEPENDENT_TESTS=72/72 passed

TYPECHECK=passed
ARCHITECTURE_UNIT=148/148 passed
ARCHITECTURE_INCREMENTAL=passed
LINT=passed_with_4_existing_warnings
BUILD=passed
PRODUCTION_READINESS_DOCS=8/8 passed
GIT_DIFF_CHECK=passed

S16_RUNTIME_REQUIRED_CHECK=passed
S16_RUNTIME_ACTIONABLE_P0_P1=0
S16_RUNTIME_ACTIONABLE_P0_P1_P2_P3=0
S16_RUNTIME_POST_MERGE_REVIEW_DEBT=0
```

Targeted closure 包含三个变更测试文件，以及 unchanged Institution Scope Guard、Institution Section Guard、Formal Institution Session Context、Institution Server Runtime、Audit Repository、static Audit API Route wiring、Platform Audit API、Capability Authority、Institution Route Shell 与 Hospital Workbench regression。lint 的 4 个 warning 位于范围外既有图片组件，本次没有新增 lint error 或 warning。

## 6. 数据库、页面与生产边界

```text
DATABASE_CONNECTION=false
DATABASE_WRITE_EXECUTION=false
SCHEMA_CHANGE=false
MIGRATION=false
DDL_EXECUTION=false
DML_EXECUTION=false
STAGING_CHANGE=false
PRODUCTION_CHANGE=false
PRODUCTION_DEPLOYMENT=false

PAGE_SYSTEM_AUDIT_STATE=hidden/not_released
PAGE_SYSTEM_AUDIT_RELEASE=false
PAGE_SYSTEM_AUDIT_RELEASE_ELIGIBLE=false
PAGE_SYSTEM_AUDIT_RUNTIME_READMISSION_READY=false
REVIEW_ACCEPTED_GOVERNED_PAGE_RELEASE_COUNT=1
```

## 7. Rollback

若 merged Runtime 出现不可接受的角色 provenance、403/503、Reader scope 或 coverage 问题，回滚单一 Runtime merge `dc73994246f300b38a823fcb8f5f330eac05f7e5`：删除两个新增 owner 文件，恢复 Reader、Reader test、Route 与 API test。回滚不连接数据库，不执行 DB write、Schema、Migration、DDL 或 DML；回滚后 Audit API blocker 恢复 open，页面继续 hidden。

## 8. 下一任务

```text
NEXT_STAGE=S17
NEXT_TASK=POST-V2-R1C page_system_audit fresh release re-audit + exact Runtime re-admission
NEXT_TASK_AUTHORIZED=false
S17_AUTHORIZED=false
```

S16 不执行 S17，不重新准入或发布 `page_system_audit`。
