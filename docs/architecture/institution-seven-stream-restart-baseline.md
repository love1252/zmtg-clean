# 机构端七条业务线重启基线

- S30 基线：`707c378afffb3e3b96790a26a0de8a17a8364f3c`
- S29 Customers：PR #1227 已以 exact 11-file scope 合并，CUS-01 formal Reader 与 versioned API 已实现，page 继续隐藏
- S30 System：四类 deterministic issuer、key preflight 与六 adapter behavior closure 可由现有 runner/test exact 2 files 完成
- S30 key：repo-external raw 32-byte owner-only source 已创建并通过 metadata 校验；未读取、输出或记录 value/hash
- S30 性质：docs-only Admission；未执行 rebuild、backup、restore、candidate、baseline、transfer 或 cutover

```text
STAGE=S30
TASK=SEVEN_STREAM_SYSTEM_SYS_01_REBUILD_EXECUTION_PREREQUISITE_EXACT_IMPLEMENTATION_ADMISSION
BASELINE=707c378afffb3e3b96790a26a0de8a17a8364f3c

S29_PR=1227
S29_HEAD=d22ee7264d400d65905521a3718dc6be7efc55c4
S29_MERGE=707c378afffb3e3b96790a26a0de8a17a8364f3c
S29_REQUIRED_CHECKS=passed
S29_ACTIONABLE_P0_P1_P2_P3=0
S29_POST_MERGE_REVIEW_DEBT=0
S29_FORMAL_CLOSURE=true

SYSTEM_PREREQUISITE_IMPLEMENTATION_ADMISSION_READY=true
SYSTEM_PREREQUISITE_EXACT_ALLOWLIST_FROZEN=true
SYSTEM_PREREQUISITE_EXACT_FILE_COUNT=2
BACKUP_KEY_CONTRACT_FROZEN=true
BACKUP_KEY_SOURCE_CREATED=true
BACKUP_KEY_SOURCE_AVAILABLE=true
BACKUP_KEY_VALUE_READ_OR_LOGGED=false
LOW_LEVEL_ADAPTER_TEST_GAP_COUNT=6

NEXT_SYSTEM_TASK=SEVEN_STREAM_SYSTEM_SYS_01_REBUILD_EXECUTION_PREREQUISITE_EXACT_IMPLEMENTATION
NEXT_SYSTEM_TASK_AUTHORIZED=true_conditionally_by_current_ultra_goal
NEXT_CUSTOMERS_TASK=UNASSIGNED_AFTER_CUS01_READER_API_RUNTIME
NEXT_CARE_TASK=SEVEN_STREAM_CARE_FORMAL_FRESH_ADMISSION
NEXT_CARE_TASK_AUTHORIZED=true_by_current_ultra_goal_after_system_chain

DATABASE_REBUILD_EXECUTION=false
DATABASE_WRITE_ON_ORIGINAL_55433=false
REVIEW_ACCEPTED_GOVERNED_PAGE_RELEASE_COUNT=2
SEVEN_STREAM_FORMAL_RELEASE_COUNT=0
CONTROLLED_CREATE_RELEASE_COUNT=0
```

- 日期：2026-08-15
- 基线：`73edd17666426dd4aedf304fcc7f89dd2b075369`
- 来源：S28 Customers CUS-01 readonly Fresh Admission
- POST-V2-R1C：正式收口
- 七线开发入口：ready
- 七线正式发布：0/7
- 已发布受治理页面切片：2/26（`page_workbench`、`page_system_audit`）
- 受控创建能力发布：0/3
- 首选业务线：`system`（S26 baseline/rebuild tooling 已实现并经隔离 PostgreSQL 实证；S27 因 evidence issuer、backup key source 与 low-level adapter behavior tests 未闭合，rebuild execution 仍未准入）
- 第二候选：`customers`（CUS-01 Reader/API exact 11-file Admission ready；page 继续隐藏）
- 本文性质：当前开发入口基线，不是 Runtime、数据库或 Migration 授权

## 零、S28 七线当前入口状态

```text
STAGE=S28
STREAM=customers
SLICE=CUS_01_READONLY
COMPLETION_MODE=ADMISSION_READY_READER_API_PAGE_HIDDEN
BASELINE=73edd17666426dd4aedf304fcc7f89dd2b075369

S27_PR=1225
S27_HEAD=d9741603cff3639032fcfd8359874204dae973da
S27_MERGE=73edd17666426dd4aedf304fcc7f89dd2b075369
S27_REQUIRED_CHECKS=passed
S27_ACTIONABLE_P0_P1_P2_P3=0
S27_POST_MERGE_REVIEW_DEBT=0
S27_COMPLETE=true
S27_FORMAL_CLOSURE=true

S26_IMPLEMENTATION_WORK_COMPLETE=true
S26_RUNTIME_PR=1224
S26_RUNTIME_HEAD=b6cbc6ccf6e4c0429d955cec674f6cf42bbc2acf
S26_RUNTIME_MERGE=afea901fad078ae45bd9815d5d6513d833f3449d
S26_BASELINE_SQL_ISOLATED_POSTGRES_APPLY_VERIFIED=true
S26_CATALOG_FINGERPRINT_EQUAL=true
S26_REQUIRED_CHECKS=passed
S26_ACTIONABLE_P0_P1_P2_P3=0
S26_POST_MERGE_REVIEW_DEBT=0
S26_COMPLETE=true
S26_FORMAL_CLOSURE=true

CUS01_FACT_OWNER=public.customers
CUS01_COMMAND_OWNER=src/modules/customers
CUS01_REPOSITORY_OWNER=src/modules/customers
CUS01_READ_MODEL_OWNER=src/modules/customer-center
CUS01_PRESENTATION_OWNER=src/modules/customer-center
CUS01_FORMAL_LIST_READER_EXISTS=false
CUS01_CURRENT_API=/api/institution/customers
CUS01_VERSIONED_API_EXISTS=false
CUS01_TARGET_VERSIONED_API=/api/v1/institution/customers
CUS01_CANONICAL_PAGE=/hospital/customers
CUS01_CAPABILITY_KEY=page_customer_list

ORIGINAL_PUBLIC_TABLE_COUNT=55
ORIGINAL_INVENTORY_TABLE_COUNT=56
TABLE_CLASSIFICATION_COMPLETE=true
UNKNOWN_TABLE_CLASSIFICATION_COUNT=0

CUSTOMER_COUNT=9
CUSTOMER_NULL_INSTITUTION_COUNT=0
CUSTOMER_NULL_TENANT_COUNT=0
CUSTOMER_DISTINCT_TENANT_COUNT=2
CUSTOMER_DISTINCT_TENANT_INSTITUTION_PAIR_COUNT=2
CUSTOMER_TENANT_ORPHAN_COUNT=0
CUSTOMER_DUPLICATE_PRIMARY_KEY_COUNT=0
CUS01_DATA_READINESS=ready

CUS01_SCHEMA_CHANGE_REQUIRED=false
CUS01_MIGRATION_REQUIRED=false
CUS01_READER_ADMISSION_READY=true
CUS01_API_ADMISSION_READY=true
CUS01_PAGE_RELEASE_ADMISSION_READY=false
CUS01_EXACT_RUNTIME_ALLOWLIST_FROZEN=true
CUS01_EXACT_RUNTIME_FILE_COUNT=11
CUS01_EXACT_PRODUCTION_FILE_COUNT=6
CUS01_EXACT_TEST_FILE_COUNT=5
CUS01_RUNTIME_IMPLEMENTATION=false

REBUILD_EXECUTION_ADMISSION_READY=false

NEXT_SYSTEM_TASK=SEVEN_STREAM_SYSTEM_SYS_01_REBUILD_EXECUTION_PREREQUISITE_EXACT_IMPLEMENTATION_ADMISSION
NEXT_SYSTEM_TASK_AUTHORIZED=false
NEXT_CUSTOMERS_TASK=SEVEN_STREAM_CUSTOMERS_CUS_01_READONLY_EXACT_11_FILE_RUNTIME_IMPLEMENTATION
NEXT_CUSTOMERS_TASK_AUTHORIZED=false
NEXT_CARE_TASK=SEVEN_STREAM_CARE_FORMAL_FRESH_ADMISSION
NEXT_CARE_TASK_AUTHORIZED=false
CARE_FORMAL_RUNTIME_BLOCKED_UNTIL_CUSTOMERS_READINESS=true
NEXT_STAGE_AUTO_EXECUTION=false
```

S20 frozen architecture 继续有效：AI usage facts、command 与正式 read source 由 `analytics` 持有，`institution-system` 持有低敏 read model 与 presentation，cross-owner composition 位于 `src/server/orchestration/**`；canonical API 为 `/api/v1/institution/ai-service-usage`，旧 `/api/institution/ai-service-usage` 保持 capability-off compatibility-only。

S21—S27 已从 source audit 推进到 baseline/rebuild tooling 实现与隔离 PostgreSQL 实证；System execution 仍因 deterministic issuer、backup key source 与 low-level adapter tests 缺口禁止。S28 fresh 证明 9/9 customer facts 的 persisted tenant/institution pair 完整，四机构角色均具 customer read policy，现有 schema 足以实现正式 list Reader 与 versioned API；exact 11-file Runtime slice 已冻结，page 不在 allowlist并继续 hidden。Canonical evidence：`docs/operations/seven-stream-customers-cus01-readonly-fresh-admission-20260815.md`。

## 一、统一完成尺度

```text
领域
→ 持久化／权威 Reader
→ API
→ canonical 页面
→ 真实数据
→ 权限与审计
→ Capability 发布
→ 测试环境验收
→ 旧实现退出
```

公共契约、领域测试、安全 Foundation、capability-off 页面或单个 released page slice 都不能单独计为一条完整业务线正式发布。`SEVEN_STREAM_FORMAL_RELEASE_COUNT=0` 与 `REVIEW_ACCEPTED_GOVERNED_PAGE_RELEASE_COUNT=2` 是两个独立维度。

## 二、Foundation 与开发模式

S19 fresh regression 证明 formal session provenance、Scope Guard、Section Guard、Audit Writer attribution、Audit Reader、trusted role authorization、Capability Authority、Workbench exact projection 与 Architecture Quality 均安全，当前没有新的全局 P0/P1 Foundation blocker。

```text
FOUNDATION_READY=true
SEVEN_STREAM_ENTRY_GATE=passed
SEVEN_STREAM_DEVELOPMENT_READY=true
POST_R1C_DEFAULT_MODE=business_slice_delivery
NO_NEW_FOUNDATION_BY_DEFAULT=true
```

后续优先在现有 Foundation 内交付有限业务切片。只有具体业务切片证明存在真实 blocker，才可单独申请 Foundation、Schema 或 Migration；旧 MIG 名称与历史计划本身不构成执行授权。

## 三、七线 current-main 基线

| Rank | Stream | 当前 Runtime | 正式 API / 页面 | 权威数据与权限 | 当前 blocker | 下一有限切片 |
|---:|---|---|---|---|---|---|
| 1 | 管理中心 `system` | `institution-system` 36 files；Audit owner 已完成 Writer/Reader/role closure；baseline/rebuild tooling 已实现 | `/hospital/system/audit` 与 `/api/institution/audit-events` 已 admin-only release；AI usage/entitlement 仍 off | SYS-01 static Reader/role/DTO 已冻结；56-row data inventory 与 marker baseline contract 已冻结 | deterministic readiness/smoke issuers、backup key source、low-level adapter behavior tests | rebuild execution prerequisite exact Admission（未授权） |
| 2 | 客户中心 `customers` | `customer-center` 14 + `customers` 7；command/object fact 存在 | legacy API 503；versioned API 不存在；canonical page hidden | 9/9 persisted pair，null/orphan/duplicate=0；四角色 read policy成立 | formal list Reader 尚未实现；future candidate preservation待 System | CUS-01 exact 11-file Reader/API Runtime（未授权） |
| 3 | 预约与随访 `care` | `care` 30；domain/command/repository/transaction 较成熟 | appointments/followups 主 API 与页面 off | institution 历史形状 nullable；read model 未闭环 | Customer 稳定引用、正式 Reader/API/page | 人工随访只读/人工闭环 fresh Admission |
| 4 | 知识库 `knowledge` | `institution-knowledge` 8 + `knowledge` 8；旧/new runtime 并存 | items 根 API 与页面 off | 旧 preview/mock/demo 与正式事实边界未退出 | MIG-03、Reader、worker/OCR/index 与低敏授权 | 资料库只读 fresh Admission |
| 5 | 会话工作台 `conversations` | `institution-conversations` 24；domain 状态机较强 | 无正式 conversations API/page | 无正式 persistence、assignment/identity facts | MIG-04 与真实渠道后置审批 | domain/persistence Admission，不发布页面 |
| 6 | 经营分析 `analytics` | `institution-analytics` 18 + `analytics` 4；纯计算存在 | 无正式 analytics API/page | 无 authoritative facts/snapshots | MIG-05/MIG-06、统一口径与真实 Provider | facts/snapshot Admission |
| 7 | 工作台 `workbench` | `institution-workbench` 22；安全 release projection | `/hospital` 已发布状态投影；dashboard API off | 无独立数据，依赖多个正式 Provider | 至少三个真实上游 Provider 未形成 | 上游完成后再接线，不先做假聚合 |

## 四、七线精确边界

| Stream key | Primary routes | Primary APIs | Primary modules / data owner | Orchestration / authorization owner |
|---|---|---|---|---|
| `workbench` | `/hospital` | dashboard stats 当前 off；目标为 versioned providers | `src/modules/institution-workbench/**`；不拥有业务事实 | Workbench runtime + Capability Authority；Security formal scope |
| `customers` | `/hospital/customers/**` | `/api/institution/customers/**` | `src/modules/customers/**` + `customer-center/**` | future Customers composition；Security + object fact |
| `conversations` | `/hospital/conversations/**` | future `/api/institution/conversations/**` | `src/modules/institution-conversations/**` | future connector orchestration；Security + assignment/object guard |
| `care` | `/hospital/care/**` | appointments/followups/paths | `src/modules/care/**` | `care-follow-up-transaction.ts`；Security + Care preconditions |
| `knowledge` | `/hospital/knowledge/**` | knowledge-management family | `src/modules/knowledge/**` + `institution-knowledge/**` | knowledge transaction/quota writer；Security + knowledge guard |
| `analytics` | `/hospital/analytics/**` | future `/api/institution/analytics/**` | `src/modules/institution-analytics/**` | future snapshot composition；Security + analytics guard |
| `system` | `/hospital/system/**` | audit active；AI usage/entitlement off | `src/modules/institution-system/**`；Audit facts remain Audit-owned | Audit orchestration currently complete；Security + Audit-specific owner |

## 五、第一条线与首切片

```text
SELECTED_FIRST_STREAM=system
SECOND_CANDIDATE=customers
FIRST_STREAM_CAN_START=true
FIRST_STREAM_FIRST_SLICE=SYS_01_AI_USAGE_READONLY_FRESH_ADMISSION
FIRST_STREAM_FRESH_ADMISSION_COMPLETE=true
FIRST_STREAM_DB_READINESS_REAUDIT_COMPLETE=true
FIRST_STREAM_MIGRATION_ADMISSION_COMPLETE=true
FIRST_STREAM_PHASED_RECOVERY_ADMISSION_COMPLETE=true
FIRST_STREAM_CONTROLLED_REBUILD_ADMISSION_COMPLETE=true
FIRST_STREAM_BASELINE_GOVERNANCE_ADMISSION_COMPLETE=true
FIRST_STREAM_BASELINE_REBUILD_TOOL_IMPLEMENTATION_COMPLETE=true
FIRST_STREAM_REBUILD_EXECUTION_ADMISSION_COMPLETE=true
FIRST_STREAM_RUNTIME_ADMISSION_READY=false
FIRST_STREAM_EXACT_RUNTIME_ALLOWLIST_FROZEN=false
FIRST_STREAM_EXACT_RUNTIME_FILE_COUNT=0
FIRST_STREAM_DB_READ_PREREQUISITE=false
FIRST_STREAM_CONTROLLED_REBUILD_PREREQUISITE=true
FIRST_STREAM_NEXT_ATOMIC_TASK=SYS_01_REBUILD_EXECUTION_PREREQUISITE_EXACT_IMPLEMENTATION_ADMISSION
```

`system` 是唯一已有真实、持久化、角色感知并正式发布子页的业务线，复用 Foundation 的证据最强。S20 已冻结 SYS-01 的 owner、Reader、composition、API、角色与 DTO；S21 已连接 actual DB；S22 证明不是简单运行全部 pending 即可恢复；S23 排除了原地 replay。S24 已证明 6/11/11 数据、252 条 Audit 与全部 56 个 table inventory 可保留，并冻结 side-by-side safety contract；S25 已形成正式 baseline provenance 与 future lineage 表示；S26 已实现并隔离实证 baseline/rebuild tooling。S27 只读审计未发现 source drift，但 execution 因 issuer、key source 与 low-level tests 缺口保持 blocked。

`customers` 无外部系统且是 Care/Workbench 上游，排第二。S28 已闭合 data readiness、owner、角色、DTO、pagination 与 exact Reader/API allowlist；Runtime 尚未实施，page 继续隐藏。其 exact Runtime 可在下一轮显式授权后推进，但不得把 System rebuild 等待窗口或 Care backlog解释成当前授权。

## 六、数据与 Migration 停止线

- S21 已完成 local-development loopback transaction-read-only SELECT audit；所有事务 ROLLBACK，数据库写入为 0。
- S22 已确认 journal/head/hash 无漂移且 `0038` all-missing；但 existing migrator 不支持 target，`0038` 后存在必须独立完成的 Provisioning checkpoint。
- S23 已确认正式 Provisioning 只产生 Scope/Context 三表，不会产生 0039 所需 Binding；`0041/0043` 又把 historical acceptance Membership count 冻结为 1，current=11。
- 不得删除 Membership、伪造 Binding/Scope/Context、改 journal、改 consumed SQL、reset、seed 或换用 55432 acceptance DB；continuous pending list 不是 executable chain。
- S24 已冻结 repo 外加密 backup、独立 restore drill、side-by-side candidate、data-preserving mapping 与 unknown-outcome stop/no-retry；尚未执行任何一步。
- S25 已唯一冻结 current-schema candidate baseline artifact、canonical marker/journal semantics 与 future migration lineage；marker 只引用 `0045` parent 高水位，不得伪造 `0038..0045` 已执行。
- S26 exact 6-file tooling 已实现，且 baseline artifact 在隔离 PostgreSQL 上实际 apply、marker 与 catalog fingerprint 通过；这不构成 original rebuild 授权。
- S27 证明 source contract 未漂移；下一 system 原子任务只能准入 deterministic readiness/smoke issuers、repo 外 private key/directory preflight 与 low-level adapter behavior tests。正式 rebuild 仍需后续独立授权。
- `customers`、Care 与其他旧表中的 nullable institution 形状必须逐切片 fresh 证明，不能用旧 MIG 计划自动推导完整性。
- 如下一切片确需 Schema/Migration，必须拆为独立授权、独立 PR、升级/回退验证；业务线 PR 不得顺手修改 `src/server/db/schema.ts` 或 `drizzle/**`。
- 不允许以当前单机构、默认机构、membership 当前值、mock/seed/demo 或目录位置补推历史机构归属。

## 七、目录与依赖方向

- `src/modules/institution/**` 继续只允许修复、兼容和迁出，不新增业务 ownership。
- 新业务默认进入明确 owner module 与 `src/app/api/v1/institution/**`；旧 API 只允许逐路由薄兼容。
- cross-owner composition 位于 `src/server/orchestration/**`，业务 module 不反向依赖 orchestration。
- Workbench、System 或页面不得直接读取其他领域 Repository。
- Capability 只表达发布状态，不替代 formal request、role、object 或 action authorization。
- 七线不得新增 generic Adapter、generic Repository、generic Guard 或第二套 Audit/Foundation。

## 八、下一任务

```text
NEXT_SYSTEM_TASK=SEVEN_STREAM_SYSTEM_SYS_01_REBUILD_EXECUTION_PREREQUISITE_EXACT_IMPLEMENTATION_ADMISSION
NEXT_SYSTEM_TASK_AUTHORIZED=false
NEXT_CUSTOMERS_TASK=SEVEN_STREAM_CUSTOMERS_CUS_01_READONLY_EXACT_11_FILE_RUNTIME_IMPLEMENTATION
NEXT_CUSTOMERS_TASK_AUTHORIZED=false
NEXT_CARE_TASK=SEVEN_STREAM_CARE_FORMAL_FRESH_ADMISSION
NEXT_CARE_TASK_AUTHORIZED=false
NEXT_STAGE_AUTO_EXECUTION=false
SEVEN_STREAM_RUNTIME_IMPLEMENTED=false
DATABASE_WRITE_EXECUTION_AUTHORIZED=false
MIGRATION_EXECUTION_AUTHORIZED=false
PROVISIONING_WRITE_EXECUTION_AUTHORIZED=false
```

S28 canonical evidence：`docs/operations/seven-stream-customers-cus01-readonly-fresh-admission-20260815.md`。S27 System execution evidence：`docs/operations/seven-stream-system-sys01-controlled-local-dev-rebuild-execution-admission-20260815.md`。
