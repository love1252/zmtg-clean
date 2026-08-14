# POST-V2-R1C `page_system_audit` exact 5-file Runtime release 安全回滚闭环

> 日期：2026-08-14（Asia/Shanghai）
>
> 阶段：S14
>
> 基线：`c89cecaf5e3551f5497f1aac5bbfb093aefd180d`
>
> Initial Runtime PR：#1202 / Head `8a95401d8d2668062059f239db20a33e689173b8` / Merge `c1eabd4051f7fafb75abd44bd6636503c89f43a4`
>
> Initial Handoff PR：#1203 / Merge `dfa60c54dedc4d325cad35c393a0f831c74441e6`
>
> Security Rollback PR：#1204 / Head `fef19d3591c0849f84d0618dd45272e707d31bc9` / Merge `a1a2baf13c5674e2795b65b37fad2ff89ddac104`
>
> Final Corrective Handoff PR：#1205
>
> Blocked Handoff Corrective PR：#TBD

## 1. 终态结论

```text
STAGE=S14
TASK=POST_V2_R1C_PAGE_SYSTEM_AUDIT_EXACT_5_FILE_RUNTIME_RELEASE
COMPLETION_MODE=BLOCKED_ROLLED_BACK
S14_COMPLETE=false
S14_RELEASE_ROLLBACK_COMPLETE=true
S14_FORMAL_CLOSURE=false
S14_BLOCKED_STATE_HANDOFF_CLOSED=true
S14_BLOCKER_FORMALLY_CLOSED=false
S14_SECURITY_BLOCKER_OPEN=true
PAGE_RELEASE_ROLLBACK_COMPLETE=true
AUDIT_READ_SECURITY_BLOCKER_CLOSED=false

PAGE_SYSTEM_AUDIT_STATE=hidden/not_released
PAGE_SYSTEM_AUDIT_RELEASE=false
PAGE_SYSTEM_AUDIT_ACCESS_MODE=hidden
PAGE_SYSTEM_AUDIT_DATA_READINESS=not_required
PAGE_SYSTEM_AUDIT_PRODUCTION_RELEASE=not_released

REVIEW_ACCEPTED_GOVERNED_PAGE_RELEASE_COUNT=1
RELEASED_GOVERNED_PAGES=page_workbench
CONTROLLED_CREATE_RELEASE_COUNT=0

S14_POST_MERGE_P1_DETECTED=2
PR1202_OPERATOR_SCOPE_P1_THREAD=PRRT_kwDOSrGMn86ZMXMW
PR1202_OPERATOR_SCOPE_P1_THREAD_RESOLVED=true
PR1204_DOCUMENTATION_P2_THREAD=PRRT_kwDOSrGMn86ZM8Cc
PR1204_DOCUMENTATION_P2_THREAD_RESOLVED=true
PR1205_API_SCOPE_P1_THREAD=PRRT_kwDOSrGMn86ZNNed
PR1205_API_SCOPE_P1_VALID=true
PR1205_API_SCOPE_P1_THREAD_RESOLVED=true
S14_ACTIONABLE_P0_P1=0
S14_ACTIONABLE_P0_P1_P2_P3=0
POST_MERGE_REVIEW_DEBT=0

BLOCKED_HANDOFF_CORRECTIVE_PR=TBD
NEXT_TASK_AUTHORIZED=false
NEXT_TASK_SELECTION_REQUIRED=false
```

PR #1202 曾按 S13 canonical Admission 实施 exact 5-file release，但 post-merge Review 证明 `tenant_operator` 会在 Reader 缺少角色/本人/授权模块过滤时读取本机构全部可信审计记录。S14 frozen Authority context 只提供 tenant、institution 与 navigation sections；`tenant_admin` 和 `tenant_operator` 的 system navigation shape 相同，因此 canonical 5 files 内无法安全区分两个角色。

任何保持 admin 放行同时隐藏 operator 的正确修复，都需要角色感知 Reader/Repository、可信角色信号或 public policy/contract 变更，触发 S14 的第 6 个 Runtime 文件、Reader 或 public contract 硬停止条件。PR #1204 按已授权 rollback 撤销了新页面及其 exposure expansion，但没有关闭既有 Audit API 的角色授权缺口；S14 release 目标未完成，安全 blocker 继续开放。

## 2. Initial release 与 exact rollback scope

| 路径 | 文件类型 | Initial #1202 | Security rollback #1204 |
| --- | --- | --- | --- |
| `src/server/orchestration/institution-capability-authority.ts` | production | 放行 audit readonly pilot | 恢复仅 Workbench release |
| `src/server/orchestration/institution-capability-authority.test.ts` | test | 锁定 2 个 released pages | 恢复 1 个 released page |
| `src/app/hospital/system/audit/page.tsx` | production | 新增 dedicated Route | 删除 dedicated Route |
| `src/modules/institution/tests/InstitutionRouteShell.test.tsx` | test | 新增 audit Route regression | 恢复 release 前 Route regression |
| `src/modules/institution-workbench/tests/HospitalWorkbenchEntry.test.tsx` | test | 新增 future release fixture | 恢复 release 前 fixture |

```text
INITIAL_EXACT_RUNTIME_FILE_COUNT=5
INITIAL_ACTUAL_RUNTIME_TEST_CHANGED_FILE_COUNT=5
INITIAL_EXACT_SCOPE_MATCH=true

ROLLBACK_RUNTIME_TEST_CHANGED_FILE_COUNT=5
ROLLBACK_EXACT_SCOPE_MATCH=true
ROLLBACK_PRODUCTION_FILE_COUNT=2
ROLLBACK_TEST_FILE_COUNT=3
SIXTH_RUNTIME_FILE_TOUCHED=false
```

#1204 的 5 个 Runtime/Test 文件最终内容与 S14 baseline `c89cecaf5e3551f5497f1aac5bbfb093aefd180d` 对应文件完全一致；没有修改 Reader、API、client、Repository、Writer、public registry/navigation contract 或 shared catch-all。

## 3. P1 事实与 fail-closed 决策

Review thread `PRRT_kwDOSrGMn86ZMXMW` 指出：

1. `tenant_operator` 与 `tenant_admin` 均获得 `system` navigation；
2. S14 Authority 仅据 `availableSectionIds` 放行 audit；
3. 当前 Audit Reader/Repository 只按 tenant、institution 与 `verified` 过滤；
4. 没有当前操作者角色、本人或获授权模块过滤；
5. 因而 operator 可读取本机构其他人员及无权模块的可信审计记录。

PR #1204 合并后：

- `page_system_audit` 恢复 `hidden/not_released`；
- `/hospital/system/audit` dedicated Route 被删除；
- build route table 不再包含该路径；
- `page_system_audit` 页面读取面已撤销，S14 exact-5 rollback 消除了新发布页面造成的 exposure expansion；
- `GET /api/institution/audit-events` 仍然存在，且 `system` Section Guard 仍允许 `tenant_admin` 与 `tenant_operator`；
- 当前 Reader runtime context 没有可信 role，Repository 仍只按 tenant、institution 与 `verified` 过滤，因此 Audit API 读取面仍存在 trusted role-aware authorization blocker；
- `page_workbench` 既有 release 不变；
- `PRRT_kwDOSrGMn86ZMXMW` 在实际 rollback merge 与 merged-main 独立验证之后回复并解决。

PR #1205 post-merge P1 `PRRT_kwDOSrGMn86ZNNed` 进一步确认：页面 rollback 不等于 Audit API 安全 blocker 已关闭。该 P1 有效；本次 docs corrective 撤回错误的 `S14_BLOCKER_FORMALLY_CLOSED=true`，不在 S14 内实施 Reader/API Runtime 修复。

## 4. 当前 Reader 与 Workbench 基础状态

S14 rollback 没有撤销 S10-S13 已闭合的 Reader/Writer/Data Readiness foundation：

```text
AUDIT_WRITER_ATTRIBUTION_CLOSED=true
HISTORICAL_BACKFILL_CLOSED=true
AUDIT_READER_SAFE_DATA_AVAILABLE=true
AUDIT_READER_COVERAGE_STATE=partial_verified_only
AUDIT_READER_HISTORICAL_COVERAGE_COMPLETE=false
AUDIT_READER_PARTIAL_COVERAGE_SAFE=true
AUDIT_READER_COVERAGE_DISCLOSURE_SAFE=true
AUDIT_READER_ROLE_AWARE_AUTHORIZATION_SAFE=false
WORKBENCH_MULTI_CAPABILITY_SAFE=true
WORKBENCH_PAGE_WORKBENCH_PROJECTION_STABLE=true
```

这些 foundation 不构成页面 release。当前 Authority 只接受 `page_workbench` 为受治理 readonly pilot，其他 35 capabilities 均保持 hidden/not_released。

## 5. Security rollback 验证

```text
ROLLBACK_TARGETED_TEST_FILES=3
ROLLBACK_TARGETED_TESTS=93
ROLLBACK_FULL_TEST_FILES=495
ROLLBACK_FULL_TESTS=6789
ROLLBACK_POST_MERGE_INDEPENDENT_TEST_FILES=3
ROLLBACK_POST_MERGE_INDEPENDENT_TESTS=93

ROLLBACK_TYPECHECK=passed
ROLLBACK_ARCHITECTURE_UNIT=148/148 passed
ROLLBACK_ARCHITECTURE_INCREMENTAL=passed
ROLLBACK_LINT=passed_with_4_existing_warnings
ROLLBACK_BUILD=passed
ROLLBACK_PRODUCTION_READINESS_DOCS=8/8 passed
ROLLBACK_GIT_DIFF_CHECK=passed
ROLLBACK_REQUIRED_CHECK=passed
```

首次 typecheck 只命中旧 `.next` 中已删除 Route 的生成类型；正式 build 重建生成产物后，typecheck 通过。正式 build route table 明确不含 `/hospital/system/audit`。

## 6. 边界

```text
DATABASE_CONNECTION=false
DATABASE_WRITE_EXECUTION=false
SCHEMA_CHANGE=false
MIGRATION=false
DDL_EXECUTION=false
DML_EXECUTION=false
SEED_EXECUTION=false

STAGING_CHANGE=false
PRODUCTION_CHANGE=false
PRODUCTION_DEPLOYMENT=false
EXTERNAL_SYSTEM_CONNECTION=false
SECRET_ACCESS=false
```

## 7. 阻断前置条件

```text
PRIMARY_BLOCKING_PREREQUISITE=trusted_role_aware_audit_read_authorization
BLOCKED_READ_SURFACE=GET /api/institution/audit-events
BLOCKER_SCOPE=tenant_operator_can_reach_system_guard_but_reader_lacks_trusted_role_aware_scope
REQUIRED_NEW_AUTHORIZATION=fresh_admission_beyond_S14_exact_5_runtime_allowlist
PAGE_SYSTEM_AUDIT_RUNTIME_READMISSION_READY=false
PAGE_SYSTEM_AUDIT_RELEASE_ELIGIBLE=false
S13_EXACT_5_RELEASE_ADMISSION_REUSABLE_WITHOUT_FRESH_READMISSION=false
```

下一次 release re-admission 必须 fresh 决定以下任一结构正确的方案，并冻结新的 exact allowlist：

- Reader/Repository 对当前角色、本人及获授权模块进行可信、fail-closed 过滤；或
- Capability Authority 消费不可伪造的当前角色信号，并在 Reader 过滤闭合前仅允许满足完整读取权限的角色。

不得在 S14 exact 5 files 中伪造 role、从 client/query 取得 role、增加 ownership query，或用当前 navigation shape 冒充 admin-only 授权。

## 8. 下一任务边界

```text
NEXT_TASK=POST-V2-R1C Trusted Role-Aware Audit Read Authorization fresh audit + exact Runtime admission
NEXT_STAGE=S15
NEXT_TASK_AUTHORIZED=false
NEXT_TASK_SELECTION_REQUIRED=false
S15_RUNTIME_AUTHORIZED=false
DATABASE_CONNECTION_AUTHORIZED=false
DATABASE_WRITE_EXECUTION_AUTHORIZED=false
PAGE_SYSTEM_AUDIT_RELEASE_AUTHORIZED=false
```

S14 不自动扩展 Runtime allowlist，也不实现下一任务。S15 仅被定义为 fresh audit + exact Runtime Admission，必须重新回答：可信 current-role 信号来源、既有 formal server authorization 能否携带 role、admin/operator 的可靠区分、Route/Reader/Repository 的授权 owner、admin-only 与 operator-limited 的最小安全路线、operator 是否只可读取本人 actorId 及获授权模块、public contract 或 Reader/Repository 是否需要变化，以及 fresh exact Runtime allowlist。caller/query role 与 caller-provided actorId 均不得作为授权信号。

`S14_BLOCKED_STATE_HANDOFF_CLOSED=true` 只表示 release 已安全回滚、阻断事实和唯一下一任务已准确交接、Review debt 已处理；它不表示 `S14_FORMAL_CLOSURE` 或安全 blocker 已关闭。
