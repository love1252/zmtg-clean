# 机构端七条业务线重启基线

- 日期：2026-08-15
- 基线：`68d87b0d32c96966fe0fcf0ba2dc8091689f2bfe`
- 来源：S22 SYS-01 local-development schema parity Migration Admission
- POST-V2-R1C：正式收口
- 七线开发入口：ready
- 七线正式发布：0/7
- 已发布受治理页面切片：2/26（`page_workbench`、`page_system_audit`）
- 受控创建能力发布：0/3
- 首选业务线：`system`（SYS-01 当前因 existing all-pending migrator 无法承载 phased schema/data recovery 阻断）
- 第二候选：`customers`
- 本文性质：当前开发入口基线，不是 Runtime、数据库或 Migration 授权

## 零、S22 SYS-01 当前入口状态

```text
STAGE=S22
STREAM=system
SLICE=SYS_01_AI_USAGE_READONLY
COMPLETION_MODE=MIGRATION_ADMISSION_COMPLETE_BLOCKED
SYS01_FRESH_ADMISSION=passed
SYS01_DB_READINESS_REAUDIT=passed
SYS01_RUNTIME_ADMISSION_READY=false
SYS01_DATA_READINESS=blocked
SYS01_TENANT_ISOLATION_SAFE=true
SYS01_INSTITUTION_ISOLATION_SAFE=false
SYS01_SCHEMA_CHANGE_REQUIRED=false
SYS01_MIGRATION_REQUIRED=true
SYS01_DML_BACKFILL_REQUIRED=false
SYS01_EXACT_RUNTIME_ALLOWLIST_FROZEN=false
SYS01_EXACT_RUNTIME_FILE_COUNT=0

LOCAL_DB_APPLIED_MIGRATION_HEAD_TAG=0037_v08_05b_b3a_real_task_readiness_foundation
LOCAL_DB_JOURNAL_IS_REPOSITORY_PREFIX=true
M0038_OBJECT_STATE=all_missing
NORMAL_SCHEMA_LAG=true
PENDING_MIGRATION_CHAIN=0038,0039,0040,0041,0042,0043,0044,0045
PENDING_CHAIN_DATA_PRECONDITIONS_SAFE=false
MIGRATOR_TARGETED_EXECUTION_SUPPORTED=false
MIGRATION_EXECUTION_ADMISSION_READY=false
EXACT_MIGRATION_CHAIN_FROZEN=false

PRIMARY_BLOCKING_PREREQUISITE=formal_migrator_all_pending_only_cannot_pause_after_0038_for_required_provisioning_and_current_0039_0045_data_preconditions_mismatch
NEXT_TASK=SEVEN_STREAM_SYSTEM_SYS_01_LOCAL_DEVELOPMENT_PHASED_SCHEMA_RECOVERY_ENTRYPOINT_AND_DATA_PRECONDITION_ADMISSION
NEXT_TASK_AUTHORIZED=false
NEXT_STAGE_AUTO_EXECUTION=false
```

S20 frozen architecture 继续有效：AI usage facts、command 与正式 read source 由 `analytics` 持有，`institution-system` 持有低敏 read model 与 presentation，cross-owner composition 位于 `src/server/orchestration/**`；canonical API 为 `/api/v1/institution/ai-service-usage`，旧 `/api/institution/ai-service-usage` 保持 capability-off compatibility-only。

S21 安全启动既有 Colima/PostgreSQL 后，loopback transaction-read-only audit 成功，AI usage cohort 为 0，但缺失 `institution_scopes`。S22 进一步确认 actual journal 是 repository `0000..0037` 的严格前缀，`0038` objects 全部缺失；正式 migrator 却只能执行全部 pending，无法在 `0038` 后完成 `0039` 必需 Provisioning，current 数据也不满足后续 acceptance guards。因此 Migration execution 与 Runtime allowlist 均不冻结。Canonical evidence：`docs/operations/seven-stream-system-sys01-local-dev-schema-parity-migration-admission-20260815.md`。

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
| 1 | 管理中心 `system` | `institution-system` 36 files；Audit owner 已完成 Writer/Reader/role closure | `/hospital/system/audit` 与 `/api/institution/audit-events` 已 admin-only release；AI usage/entitlement 仍 off | SYS-01 static Reader/role/DTO 已冻结；journal strict-prefix 到 0037 | all-pending migrator 无 phased checkpoint；0039–0045 data guards 不匹配 | phased schema recovery entrypoint/data prerequisite Admission |
| 2 | 客户中心 `customers` | `customer-center` 14 + `customers` 7；command/object fact 存在 | `/api/institution/customers` 与 canonical 页面 off | `customers.institution_id` nullable；S19 未连接 DB | 正式 Reader、数据完整性、object guard 与 low-sensitive DTO | `CUS_01_READONLY_FRESH_ADMISSION`，排在 SYS-01 后 |
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
FIRST_STREAM_RUNTIME_ADMISSION_READY=false
FIRST_STREAM_EXACT_RUNTIME_ALLOWLIST_FROZEN=false
FIRST_STREAM_EXACT_RUNTIME_FILE_COUNT=0
FIRST_STREAM_DB_READ_PREREQUISITE=false
FIRST_STREAM_PHASED_RECOVERY_PREREQUISITE=true
FIRST_STREAM_NEXT_ATOMIC_TASK=SYS_01_LOCAL_DEVELOPMENT_PHASED_SCHEMA_RECOVERY_ENTRYPOINT_AND_DATA_PRECONDITION_ADMISSION
```

`system` 是唯一已有真实、持久化、角色感知并正式发布子页的业务线，复用 Foundation 的证据最强。S20 已冻结 SYS-01 的 owner、Reader、composition、API、角色与 DTO；S21 已连接 actual DB；S22 证明不是简单运行全部 pending 即可恢复。必须先形成受控 phased checkpoint 与实际数据前置，Runtime Admission 保持 blocked。

`customers` 无外部系统且是 Care/Workbench 上游，排第二；但主 Reader/API/data readiness 尚未闭环，不能先于当前证据更强的 `system`。

## 六、数据与 Migration 停止线

- S21 已完成 local-development loopback transaction-read-only SELECT audit；所有事务 ROLLBACK，数据库写入为 0。
- S22 已确认 journal/head/hash 无漂移且 `0038` all-missing；但 existing migrator 不支持 target，`0038` 后存在必须独立完成的 Provisioning checkpoint。
- `0039–0045` 使用冻结的 local-acceptance data guards，current `tenant_members=11`、Binding=0 不满足；不得把 continuous pending list 当作 executable chain。
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
NEXT_TASK=SEVEN_STREAM_SYSTEM_SYS_01_LOCAL_DEVELOPMENT_PHASED_SCHEMA_RECOVERY_ENTRYPOINT_AND_DATA_PRECONDITION_ADMISSION
NEXT_TASK_AUTHORIZED=false
NEXT_STAGE_AUTO_EXECUTION=false
SEVEN_STREAM_RUNTIME_IMPLEMENTED=false
DATABASE_WRITE_EXECUTION_AUTHORIZED=false
MIGRATION_EXECUTION_AUTHORIZED=false
```

S22 canonical evidence：`docs/operations/seven-stream-system-sys01-local-dev-schema-parity-migration-admission-20260815.md`。S21 readiness：`docs/operations/seven-stream-system-sys01-ai-usage-readonly-db-readiness-reaudit-20260815.md`。
