# POST-V2-R1C `page_system_audit` fresh release re-audit 与 exact Runtime re-admission

> 日期：2026-08-14（Asia/Shanghai）
>
> 原始基线：`3f90a5f2eb227630152e5dacb2b895171e3a57a5`
>
> 前置校正合并基线：`638b69a2c66597d7a7ae0bd87e0c4f88dd8f8ec2`（PR #1197）
>
> Admission 合并：`f0bec7503932e8ad08272f3981935d6fbaa31bfc`（PR #1198）
>
> post-merge corrective 合并：`b0165a27958ca2d8093a15fe3ea3f040bb83af2a`（PR #1199）
>
> 类型：fresh release re-audit / docs-only exact Runtime re-admission

## 1. 唯一结论

```text
STAGE=S13
TASK=POST_V2_R1C_PAGE_SYSTEM_AUDIT_FRESH_RELEASE_REAUDIT_EXACT_RUNTIME_READMISSION
COMPLETION_MODE=COMPLETE

FRESH_RELEASE_REAUDIT=passed
PAGE_SYSTEM_AUDIT_RELEASE_ELIGIBLE=true
EXACT_RUNTIME_ALLOWLIST_FROZEN=true
PAGE_SYSTEM_AUDIT_RUNTIME_READMISSION_READY=true

PAGE_SYSTEM_AUDIT_STATE=hidden/not_released
PAGE_SYSTEM_AUDIT_RELEASE=false
PAGE_SYSTEM_AUDIT_RELEASE_RUNTIME_AUTHORIZED=false
PAGE_SYSTEM_AUDIT_RUNTIME_RELEASE_AUTHORIZED=false
PAGE_SYSTEM_AUDIT_PRODUCTION_AUTHORITY_GRANT_AUTHORIZED=false
REVIEW_ACCEPTED_GOVERNED_PAGE_RELEASE_COUNT=1
```

Fresh re-audit 证明 `page_system_audit` 已满足下一阶段只读页面放行的前置条件。安全结论不是“历史覆盖完整”，而是：Reader 只展示正式 tenant + institution scope 下的 `verified` subset，页面明确披露历史覆盖不完整，267 条不可分类历史记录既不被猜测归属，也不被冒充为不存在。

S13 只冻结下一阶段 exact Runtime 闭包，不修改 Capability Authority release decision，不新增 canonical page Route，不增加导航入口，也不把受治理页面计数改为 2。

## 2. S13 小范围前置校正

Fresh 审计发现旧机构 Audit client 只严格验证 coverage；成功 payload 的 top-level、record 与 pageInfo 仍通过类型断言进入客户端状态，无法独立证明 low-sensitive DTO boundary。S13 在授权的 prerequisite correction 范围内，通过 PR #1197 完成 exact 4-file 校正：

- 成功信封、record、pageInfo 采用 exact-key 与字段值严格解析；
- 任何 `tenantId`、`institutionId`、attribution、provenance、secret 或未知字段均在进入 UI state 前失败关闭；
- 解析后只发布重新构造的 9 字段低敏 record；
- 保持 GET-only、coverage、分页和错误语义不变；
- 两个旧集成夹具改为正式机构 Reader DTO，Platform Audit 的 tenant 语义不变。

```text
PREREQUISITE_CORRECTION_PR=1197
PREREQUISITE_CORRECTION_HEAD=1d11cb4d4ad863cc27a8e94227907c5c3a19c193
PREREQUISITE_CORRECTION_MERGE=638b69a2c66597d7a7ae0bd87e0c4f88dd8f8ec2
PREREQUISITE_CORRECTION_REQUIRED_CHECK=passed
PREREQUISITE_CORRECTION_ACTIONABLE_REVIEW_DEBT=0

ADMISSION_PR=1198
ADMISSION_HEAD=98b86e4d7886ffa5b7731c32fa7da9a946ff314d
ADMISSION_MERGE=f0bec7503932e8ad08272f3981935d6fbaa31bfc
ADMISSION_REQUIRED_CHECK=passed

CORRECTIVE_RUNTIME_PR=1199
CORRECTIVE_RUNTIME_HEAD=8fd5b138788cf6c998e850045c51c2f02f7ae4e8
CORRECTIVE_RUNTIME_MERGE=b0165a27958ca2d8093a15fe3ea3f040bb83af2a
CORRECTIVE_REQUIRED_CHECK=passed
PR1197_REASON_EXHAUSTIVENESS_P1_THREAD=PRRT_kwDOSrGMn86ZJAxk
PR1197_REASON_EXHAUSTIVENESS_P1_THREAD_RESOLVED=true
```

PR #1197 合并后，Review 指出客户端严格 record parser 复用了不完整的 query filter reason 列表，会拒绝部分合法 `AuditReason`。PR #1199 在客户端 record validator 内补齐 canonical reasons，并用类型级 exhaustiveness guard 锁定完整性；全局 query filter 没有扩大，包含内部敏感词的 reason 不会进入筛选 UI。该 corrective 及前置校正均没有实施 `page_system_audit` release Runtime。

## 3. Release eligibility matrix

| 门禁 | Fresh 结果 | 证据与约束 |
| --- | --- | --- |
| `AUDIT_WRITER_ATTRIBUTION_CLOSED` | `true` | production caller migration 已闭合；新机构事件使用 attributed writer |
| `HISTORICAL_BACKFILL_CLOSED` | `true` | 7 条强证据记录为 `verified`，1 条为 `not_applicable`；267 条保守保留不可分类 |
| `AUDIT_READER_SAFE_DATA_AVAILABLE` | `true` | 目标正式 pair 的 verified-only Reader 返回 7 条 |
| `AUDIT_READER_PARTIAL_COVERAGE_SAFE` | `true` | 不可分类历史记录不进入机构 Reader |
| `AUDIT_READER_COVERAGE_DISCLOSURE_SAFE` | `true` | Shell 明示可信 subset、历史覆盖不完整、页面数量不是完整历史总量 |
| `WORKBENCH_MULTI_CAPABILITY_SAFE` | `true` | `/hospital` 按 `page_workbench` key 精确选择；第二 summary 不进入 Workbench DOM |
| `PAGE_SYSTEM_AUDIT_AUTHORIZATION_VERIFIED` | `true` | system Section Guard + formal Request Authorization + Capability Authority 三层独立成立 |
| `CANONICAL_ROUTE_SAFE` | `true` | exact `/hospital/system/audit`；下一阶段新增 dedicated static Route，不改 shared catch-all |
| `SHELL_READONLY_SAFE` | `true` | 仅 filter / refresh / pagination；client 只发 GET |
| `LOW_SENSITIVE_OUTPUT_SAFE` | `true` | API 与 client 双边约束 9 字段 record + 4 字段 coverage |
| `CAPABILITY_AUTHORITY_RELEASE_PATH_SAFE` | `true` | registry 已有 canonical page；只需精确扩展 existing Authority policy |
| `NAVIGATION_RELEASE_PATH_SAFE` | `true` | 复用现有 system navigation authorization；不新增角色或栏目 |
| `SCHEMA_CHANGE_REQUIRED` | `false` | 使用既有 attribution columns 与 Reader |
| `MIGRATION_REQUIRED` | `false` | 无 migration |
| `DDL_REQUIRED` | `false` | 无 DDL |
| `DML_REQUIRED` | `false` | 页面 release 不需要 DML |

所有必要门禁均通过，因此 `PAGE_SYSTEM_AUDIT_RELEASE_ELIGIBLE=true`。这里的 eligible 只表示下一阶段 Runtime 可以按 exact allowlist 实施，不表示当前页面已开放。

## 4. 本地 PostgreSQL readonly recheck

只连接 repository local-development loopback PostgreSQL，在显式 `READ ONLY` transaction 中执行聚合查询和正式 Reader 等价查询；没有读取或输出 tenant ID、institution ID、event ID、数据库名、凭据或 raw provenance。

```text
DATABASE_ENVIRONMENT=local_development_only
DATABASE_HOST_CLASS=loopback
DATABASE_CONNECTION=true
DATABASE_TRANSACTION_READ_ONLY=on
DATABASE_WRITE_EXECUTION=false

CURRENT_AUDIT_TOTAL_ROW_COUNT=275
CURRENT_VERIFIED_ROW_COUNT=7
CURRENT_NOT_APPLICABLE_ROW_COUNT=1
CURRENT_ATTEMPTED_DENIAL_ROW_COUNT=0
CURRENT_NULL_ATTRIBUTION_ROW_COUNT=267
CURRENT_UNCLASSIFIABLE_HISTORICAL_ROW_COUNT=267
CURRENT_VERIFIED_PAIR_COUNT=1
TARGET_VERIFIED_READABLE_ROW_COUNT=7
```

目标 active pair 存在且 verified-only 正式查询可读 7 条。267 条 `NULL/NULL` 历史记录是保守治理结果，不属于 Reader 可见集合，也不能支持 complete 声明。

## 5. Reader / API / Shell 完整链

```text
/api/institution/audit-events
-> system Section Guard
-> Audit query parser
-> institution-audit-reader
-> formal institution context
-> Audit Repository
-> tenant + institution + institution_attribution='verified'
-> coverage contract
-> low-sensitive DTO
-> strict client
-> InstitutionAuditEventsShell
```

Fresh 结论：

```text
AUTHORIZATION_FROM_CALLER_INPUT=false
FORMAL_CONTEXT_REQUIRED=true
TENANT_SCOPE_ENFORCED=true
INSTITUTION_SCOPE_ENFORCED=true
VERIFIED_ONLY=true
LOW_SENSITIVE_OUTPUT=true
```

Caller query 只允许时间、资源、动作、结果、原因、操作者与 cursor/limit 等筛选字段；caller 不能提交 tenant、institution、scope 或 role 形成授权。Reader formal context、Repository scope 与 coverage facts 任一不可验证时均 fail closed。

机构 DTO record 只含：

```text
id
resource
resourceId
action
result
reason
actorId
actorRole
occurredAt
```

不含 tenant、institution、attribution、SQL、stack、manifest、原始 request/response、credential 或 provenance。Coverage 只含 `state`、`safeDataAvailable`、`historicalCoverageComplete`、`partialCoverageSafe`。

## 6. Coverage 与 authoritative empty

| 场景 | 正式语义 | 页面要求 |
| --- | --- | --- |
| A. `complete` + 0 verified | authoritative empty | 可以展示确认空态 |
| B. `partial_verified_only` + 0 verified | 不是 authoritative empty | 必须显示历史覆盖不完整，不得写“没有历史事件” |
| C. `partial_verified_only` + 7 verified | 安全 verified subset | 展示可信 subset，并声明数量不是完整历史总量 |
| D. `unavailable` | 不可形成可信结果 | existing 503 / fail-closed，不伪装 empty |

筛选、分页、loading 与局部空结果不会覆盖 coverage disclosure。Shell 的统计只描述当前安全可见记录，不声明完整历史总量。

因此正式页面允许在 `partial_verified_only` 下作为只读 pilot 放行，但必须把 Capability Authority 的 `dataReadiness` 设为 `partial`，不得沿用旧 Admission 的 `not_required`，也不得写成 `ready` 或 `complete`。

## 7. 页面授权与角色边界

Reader 成功不自动推导页面授权。下一阶段 dedicated Route 必须依次消费：

1. existing formal Institution Request Authorization；
2. `authorizeCurrentInstitutionNavigationV1({ targetSectionId: 'system' })`；
3. genuine exact navigation decision；
4. current Capability Authority；
5. exact `page_system_audit` release shape。

正式 system 角色 audience 维持现有契约：

- `tenant_admin`：候选允许；仍须 formal scope、genuine navigation 与 exact Authority 全部通过；
- `tenant_operator`：候选允许；同样受三层门禁；
- `consultant`：system Section Guard blocked；
- `customer_service`：system Section Guard blocked。

S13 不新增角色，不扩大 system section，不从 client input 取授权，也不改变 Platform 权限。

```text
PAGE_SYSTEM_AUDIT_AUTHORIZATION_VERIFIED=true
AUTHORIZATION_ROLE_EXPANSION=false
```

## 8. Capability Authority 与 navigation release path

Canonical registry 已存在：

```text
capability=page_system_audit
kind=page
section=system
route=/hospital/system/audit
target_release_access_mode=read_only
```

无需新增 capability 或修改 public registry。下一阶段只在 existing code-owned Authority policy 中把 exact `page_system_audit` 从：

```text
decision=hidden
productionRelease=not_released
```

切换为：

```text
decision=read_only
codeMaturity=verified
institutionAuthorization=authorized
connectionAvailability=not_required
dataReadiness=partial
productionRelease=pilot_released
safeSummary=审计与安全仅供查看
```

`page_workbench` 保持现状；其余 34 capabilities 继续 hidden/not_released。Authority revision 必须随 release policy 更新。Navigation projection 已能独立承载第二 capability，不需要修改 navigation contract 或新增导航框架。

## 9. Canonical Route

当前状态：

- `/hospital/system/audit` 没有 dedicated static Route；
- shared `/hospital/[...slug]` 将该 path 解析为已有 `system_audit` capability-off page；
- direct URL 已先执行 formal request authorization 与 system navigation authorization；
- capability-off、blocked 与 unavailable 均 fail closed。

下一阶段仍应新增 exact：

`src/app/hospital/system/audit/page.tsx`

而不修改 shared catch-all。Dedicated Route 与 navigation 必须使用同一 genuine system authorization contract；exact audit Authority 不成立时回退现有 capability-off/unavailable/forbidden 状态。此策略不会改变其他 hidden pages 的 Route 行为。

```text
CANONICAL_ROUTE=/hospital/system/audit
DEDICATED_STATIC_ROUTE_CURRENTLY_EXISTS=false
SHARED_CATCH_ALL_CHANGE_REQUIRED=false
OTHER_HIDDEN_PAGE_BEHAVIOR_CHANGE=false
PAGE_SYSTEM_AUDIT_CANONICAL_ROUTE_SAFE=true
```

## 10. Shell / client readonly closure

`InstitutionAuditEventsShell` 的交互面只有：

- filter；
- refresh；
- pagination。

Client 只调用 internal `/api/institution/audit-events` GET，未指定 mutation method/body；没有 create、update、delete、export、download、replay、retry write 或 bulk operation。Shell 不调用外部业务网络，不显示 secret 或 provenance。

```text
SHELL_READONLY_SAFE=true
CLIENT_STRICT_DTO=true
LOW_SENSITIVE_OUTPUT_SAFE=true
MUTATION_METHOD_COUNT=0
```

## 11. Workbench multi-capability revalidation

用未来 `page_system_audit` readonly summary 模拟：

```text
page_workbench + page_system_audit
-> /hospital only selects page_workbench by capabilityKey
-> page_system_audit summary is not passed into Workbench scoped projection
-> page_system_audit content does not enter Workbench DOM
-> ordering before/after page_workbench does not matter
-> duplicate or missing page_workbench fails closed
-> hidden second capability does not break Workbench
```

下一阶段需要把 existing Workbench fixture 调整为真实 future release shape：`page_system_audit / read_only / dataReadiness=partial / productionRelease=pilot_released`，以锁定 Authority 与 composition 一致性。

```text
WORKBENCH_MULTI_CAPABILITY_REVALIDATED=true
WORKBENCH_PAGE_WORKBENCH_PROJECTION_STABLE=true
```

## 12. Fresh exact Runtime allowlist

```text
EXACT_RUNTIME_FILE_COUNT=5
EXACT_RUNTIME_EXISTING_FILE_COUNT=4
EXACT_RUNTIME_NEW_FILE_COUNT=1
EXACT_PRODUCTION_FILE_COUNT=2
EXACT_TEST_FILE_COUNT=3
ARCHITECTURE_EXCEPTION_REQUIRED=false
```

| Path | Role | Existing/New | Runtime/Test | 为什么必须纳入 |
| --- | --- | --- | --- | --- |
| `src/server/orchestration/institution-capability-authority.ts` | code-owned release policy | existing | runtime | 只把 exact audit page 设为 readonly partial pilot，更新 revision，保持其余 capability 不变 |
| `src/server/orchestration/institution-capability-authority.test.ts` | Authority policy tests | existing | test | 锁定 exact 2 released pages、audit partial shape、system authorization 与其余 34 hidden |
| `src/app/hospital/system/audit/page.tsx` | dedicated canonical Route | new | runtime | 消费 genuine system navigation + exact Authority，渲染既有 readonly Shell并 fail closed |
| `src/modules/institution/tests/InstitutionRouteShell.test.tsx` | direct URL / Route integration | existing | test | 锁定 allowed/blocked/unavailable/authority mismatch、GET-only Shell 与 shared catch-all 不回归 |
| `src/modules/institution-workbench/tests/HospitalWorkbenchEntry.test.tsx` | Workbench multi-capability regression | existing | test | 用真实 audit partial pilot fixture 证明 `/hospital` 只呈现 Workbench 且异常输入 fail closed |

Machine-readable allowlist：

`docs/operations/post-v2-r1c-page-system-audit-exact-runtime-readmission-allowlist-20260814.csv`

任何第 6 个 Runtime/Test 文件均不在本次准入内，必须停止并重新判断授权。Docs 不计入 Runtime allowlist。

## 13. 下一阶段 test plan

最低闭包必须证明：

1. institution Audit Reader formal scope、tenant/institution isolation 与 verified-only；
2. institution Audit API Section Guard、query parser、coverage 与 low-sensitive DTO；
3. partial verified with rows；
4. partial verified empty filtered result 不是 authoritative empty；
5. complete + zero 是 authoritative empty；
6. unavailable 保持 503 fail closed；
7. client strict DTO 拒绝额外字段；
8. Shell 只有 filter/refresh/pagination 且 GET-only；
9. tenant_admin / tenant_operator exact system authorization；
10. consultant / customer_service blocked；
11. exact Capability Authority future fixture；
12. direct URL allowed、blocked、unavailable 与 Authority mismatch；
13. dedicated canonical Route 不改变 shared catch-all；
14. Workbench + audit summary 正反顺序稳定；
15. duplicate/missing Workbench summary fail closed；
16. Platform Audit、跨 tenant/institution、低敏输出不回归；
17. full regression、typecheck、AQ unit 148/148、Architecture incremental、lint、build、ProductionReadinessDocs、`git diff --check` 与 Required Check 全部通过。

## 14. Rollback

下一阶段 release Runtime 必须是单一 exact-5 PR。若 release 后发现授权、coverage disclosure、Route、Workbench 或低敏边界回归，rollback 为 revert 该单一 Runtime merge：

- 删除 new dedicated Route；
- 恢复 Authority revision 和 exact audit entry 为 hidden/not_released；
- 恢复 3 个 test files；
- shared catch-all、Reader、Repository、Schema 与历史数据从未改变。

Rollback 不需要 DML、Schema 或 Migration，且应恢复：

```text
PAGE_SYSTEM_AUDIT_STATE=hidden/not_released
PAGE_SYSTEM_AUDIT_RELEASE=false
REVIEW_ACCEPTED_GOVERNED_PAGE_RELEASE_COUNT=1
```

## 15. Stop conditions

下一阶段出现任一情况必须停止并重新准入：

- 需要第 6 个 Runtime/Test 文件；
- 需要修改 Reader、Audit client、Audit Repository、Writer 或 attributed contract；
- 需要修改 public capability/navigation contract；
- 需要修改 shared catch-all；
- 需要 Schema、Migration、DDL、DML、Seed 或历史数据重分类；
- 需要 Architecture exception 或 AQ rules 变更；
- 需要新增角色、扩大 system section 或 client-owned authorization；
- 需要 export/download/mutation/bulk operation；
- 需要 Staging、Production、外部集成或 secret。

## 16. Release invariants

S13 Admission 与下一阶段实现都必须保持：

```text
AUDIT_WRITER_ATTRIBUTION_CLOSED=true
HISTORICAL_BACKFILL_CLOSED=true
AUDIT_READER_COVERAGE_STATE=partial_verified_only
AUDIT_READER_HISTORICAL_COVERAGE_COMPLETE=false
AUDIT_READER_PARTIAL_COVERAGE_SAFE=true
WORKBENCH_MULTI_CAPABILITY_SAFE=true

SCHEMA_CHANGE=false
MIGRATION=false
DDL_EXECUTION=false
DML_EXECUTION=false

CONTROLLED_CREATE_RELEASE_COUNT=0
PRODUCTION_CHANGE=false
PRODUCTION_DEPLOYMENT=false
```

S13 当前还必须保持：

```text
PAGE_SYSTEM_AUDIT_STATE=hidden/not_released
PAGE_SYSTEM_AUDIT_RELEASE=false
REVIEW_ACCEPTED_GOVERNED_PAGE_RELEASE_COUNT=1
```

只有下一阶段 exact Runtime release 合并并完成独立验证后，才可把页面计数从 1 改为 2。

## 17. S13 re-audit 验证

```text
TARGETED_TEST_FILES=14
TARGETED_TESTS=388
TARGETED_TESTS_RESULT=passed

CORRECTIVE_TARGETED_TEST_FILES=5
CORRECTIVE_TARGETED_TESTS=208
CORRECTIVE_TARGETED_TESTS_RESULT=passed

POST_MERGE_INDEPENDENT_TEST_FILES=14
POST_MERGE_INDEPENDENT_TESTS=303
POST_MERGE_INDEPENDENT_TESTS_RESULT=passed

FULL_TEST_FILES=495
FULL_TESTS=6789
FULL_TESTS_RESULT=passed

TYPECHECK=passed
ARCHITECTURE_UNIT=148/148 passed
ARCHITECTURE_INCREMENTAL=passed
LINT=passed_with_4_existing_warnings
BUILD=passed
PRODUCTION_READINESS_DOCS=8/8 passed
GIT_DIFF_CHECK=passed

HANDOFF_PR=1200
S13_PRS=1197,1198,1199,1200
S13_PR_COUNT=4
EXACT_HANDOFF_DOC_FILE_COUNT=5
S13_REQUIRED_CHECKS=passed
S13_ACTIONABLE_P0_P1=0
POST_MERGE_REVIEW_DEBT=0
```

定向集合覆盖 Reader、Repository、parser、institution/API/client/Shell、Section Guard、Capability Authority、registry、direct URL/catch-all、Workbench composition 与 Platform Audit regression。Corrective frozen Head 又通过 5 files / 208 tests 与全量 495 files / 6789 tests；typecheck、Lint、build、AQ unit 148/148、incremental、ProductionReadinessDocs、Required Check 与最终 Review sweep 均通过。

## 18. 唯一下一任务

```text
POST-V2-R1C page_system_audit exact 5-file Runtime release implementation explicit authorization
```

本 Admission merge 不构成该 Runtime 授权，也不得自动执行下一任务。
