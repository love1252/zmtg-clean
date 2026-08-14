# POST-V2-R1C `page_system_audit` exact 5-file Runtime release 闭环

> 日期：2026-08-14（Asia/Shanghai）
>
> 阶段：S14
>
> 基线：`c89cecaf5e3551f5497f1aac5bbfb093aefd180d`
>
> Runtime PR：#1202
>
> Runtime Head：`8a95401d8d2668062059f239db20a33e689173b8`
>
> Runtime Merge：`c1eabd4051f7fafb75abd44bd6636503c89f43a4`
>
> Final Handoff PR：#1203

## 1. 唯一结论

```text
STAGE=S14
TASK=POST_V2_R1C_PAGE_SYSTEM_AUDIT_EXACT_5_FILE_RUNTIME_RELEASE
COMPLETION_MODE=COMPLETE
S14_COMPLETE=true

PAGE_SYSTEM_AUDIT_STATE=read_only/pilot_released
PAGE_SYSTEM_AUDIT_RELEASE=true
PAGE_SYSTEM_AUDIT_ACCESS_MODE=read_only
PAGE_SYSTEM_AUDIT_DATA_READINESS=partial
PAGE_SYSTEM_AUDIT_PRODUCTION_RELEASE=pilot_released

REVIEW_ACCEPTED_GOVERNED_PAGE_RELEASE_COUNT=2
RELEASED_GOVERNED_PAGES=page_workbench,page_system_audit
CONTROLLED_CREATE_RELEASE_COUNT=0

POST_MERGE_REVIEW_DEBT=0
NEXT_TASK_AUTHORIZED=false
NEXT_TASK_SELECTION_REQUIRED=true
```

S14 严格按 S13 唯一 canonical Admission 的 exact 5-file allowlist 实施。Repository 内 code-owned Capability Authority 现已将 `page_system_audit` 标记为只读 pilot，并新增请求级动态的 canonical Route `/hospital/system/audit`。这不代表 Staging 或 Production deployment。

## 2. Exact Runtime scope

| 路径 | 文件类型 | 变更 | 职责 |
| --- | --- | --- | --- |
| `src/server/orchestration/institution-capability-authority.ts` | production | existing update | 更新 Authority revision，放行 exact audit readonly partial pilot shape |
| `src/server/orchestration/institution-capability-authority.test.ts` | test | existing update | 锁定 2 个 released governed pages、34 个 hidden capability 与 0 个 controlled create |
| `src/app/hospital/system/audit/page.tsx` | production | new | 组合 formal request authorization、genuine system navigation、exact Authority 与既有 Audit Shell |
| `src/modules/institution/tests/InstitutionRouteShell.test.tsx` | test | existing update | 锁定 direct Route、角色边界、fail-closed、GET-only 与 coverage disclosure |
| `src/modules/institution-workbench/tests/HospitalWorkbenchEntry.test.tsx` | test | existing update | 用真实 future audit release fixture 复验 Workbench multi-capability 隔离 |

```text
EXACT_RUNTIME_FILE_COUNT=5
ACTUAL_RUNTIME_TEST_CHANGED_FILE_COUNT=5
EXACT_RUNTIME_EXISTING_FILE_COUNT=4
EXACT_RUNTIME_NEW_FILE_COUNT=1
EXACT_PRODUCTION_FILE_COUNT=2
EXACT_TEST_FILE_COUNT=3
EXACT_SCOPE_MATCH=true
SHARED_CATCH_ALL_CHANGE=false
```

Runtime PR #1202 恰好修改上述 5 个文件；没有第 6 个 Runtime/Test 文件，没有修改 `src/app/hospital/[...slug]/**`。

## 3. Authority release 结果

`page_system_audit` 在真实 institution authorization 成立时的 exact authoritative output：

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

- Authority revision 更新为 `r1c-page-system-audit-readonly-pilot-v1`；
- `page_workbench` 既有 `read_only / not_required / pilot_released` shape 完全保持；
- 其余 34 个 capabilities 保持 `hidden/not_released`；
- 3 个 controlled-create actions 保持 `hidden/not_released`；
- 没有新增 capability、角色、system section 权限或 public registry 变更。

## 4. Canonical Route 与 fail-closed

`/hospital/system/audit` 是 dedicated static path，但 Server Component 显式使用 `force-dynamic`，确保每个请求重新消费当前授权，不会把 build-time 结果预渲染为共享页面。

成功链路：

1. formal Institution Request Authorization；
2. `authorizeCurrentInstitutionNavigationV1({ targetSectionId: 'system' })`；
3. genuine exact navigation decision；
4. current Capability Authority；
5. exact `page_system_audit` release shape；
6. 渲染既有 `InstitutionAuditEventsShell`。

以下情况全部 fail closed：formal request 失败、navigation rejected/mismatch/non-genuine、consultant/customer_service 被 system Section Guard 阻断、Authority null/reject/hidden/duplicate/key mismatch/dimension mismatch。已区分使用既有 forbidden、capability-off 与 unavailable 语义，不读取 Audit data，不存在 fallback 绕过 Authority。

## 5. Reader 与只读边界

S14 没有修改 Audit Reader、API、client、Repository、Writer、attribution contract、coverage DTO 或 `InstitutionAuditEventsShell`。页面继承既有：

```text
AUDIT_READER_SAFE_DATA_AVAILABLE=true
AUDIT_READER_COVERAGE_STATE=partial_verified_only
AUDIT_READER_HISTORICAL_COVERAGE_COMPLETE=false
AUDIT_READER_PARTIAL_COVERAGE_SAFE=true
AUDIT_READER_COVERAGE_DISCLOSURE_SAFE=true
```

页面只展示当前 formal tenant + institution 的 `verified` subset，明确披露历史覆盖不完整、不可分类旧记录未被猜测归属，页内数量不是完整历史总量。`partial_verified_only + zero rows` 不会被表达为 authoritative empty。

```text
MUTATION_METHOD_COUNT=0
EXPORT_ACTION_COUNT=0
DOWNLOAD_ACTION_COUNT=0
REPLAY_ACTION_COUNT=0
BULK_OPERATION_COUNT=0
```

Audit Shell 只继续使用 GET 请求提供 filter、refresh/reset 与 pagination；S14 没有新增任何写入交互。

## 6. Workbench multi-capability

回归 fixture 已使用真实 future shape：

```text
page_system_audit
decision=read_only
dataReadiness=partial
productionRelease=pilot_released
```

`page_workbench + page_system_audit` 时，`/hospital` 仍只按 `page_workbench` key 选择并缩小自身投影；Audit summary 在 Workbench 前或后均不进入 Workbench DOM，duplicate/missing Workbench 继续 fail closed。

```text
WORKBENCH_MULTI_CAPABILITY_SAFE=true
WORKBENCH_PAGE_WORKBENCH_PROJECTION_STABLE=true
```

## 7. 验证证据

```text
FINAL_DIRECT_TARGETED_TEST_FILES=3
FINAL_DIRECT_TARGETED_TESTS=110
FULL_TEST_FILES=495
FULL_TESTS=6806
POST_MERGE_INDEPENDENT_TEST_FILES=11
POST_MERGE_INDEPENDENT_TESTS=368

TYPECHECK=passed
ARCHITECTURE_UNIT=148/148 passed
ARCHITECTURE_INCREMENTAL=passed
LINT=passed_with_4_existing_warnings
BUILD=passed
PRODUCTION_READINESS_DOCS=8/8 passed
GIT_DIFF_CHECK=passed
RUNTIME_REQUIRED_CHECK=passed
RUNTIME_ACTIONABLE_P0_P1_P2_P3=0
POST_MERGE_REVIEW_DEBT=0
```

最终 build 路由表确认 `/hospital/system/audit` 为动态服务端路由。PR #1202 在 frozen Head 上通过 Required Check，合并前与两次 post-merge sweep 均为 0 Review thread / 0 actionable review。

## 8. 数据库、环境与发布边界

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

`productionRelease=pilot_released` 是 repository code-owned Capability Authority 决策字段，不是对真实线上环境的 deployment 证据。

## 9. Rollback

若需回滚，revert Runtime merge `c1eabd4051f7fafb75abd44bd6636503c89f43a4`：

- 恢复 `page_system_audit` 为 `hidden/not_released`；
- 删除 dedicated `/hospital/system/audit` Route；
- 恢复 3 个 regression files；
- 受治理只读页面数恢复为 1。

回滚不需要数据库连接、DML、Schema 或 Migration。

## 10. 下一任务边界

```text
NEXT_TASK_AUTHORIZED=false
NEXT_TASK_SELECTION_REQUIRED=true
```

S14 不从 backlog 自动选择下一页面或后续工作。由 ChatGPT 项目总控在审查当前 2 / 26 受治理只读页面状态后，另行确定唯一下一任务并显式授权。
