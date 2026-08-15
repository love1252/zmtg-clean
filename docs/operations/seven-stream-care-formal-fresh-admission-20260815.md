# Care formal Fresh Admission

- 日期：2026-08-15
- 阶段：S33
- 流：`care`
- 基线：`5b7023aa78a78ead98c25071cda99c2df978bb89`
- 性质：fresh repository / architecture / test audit + original `55433` aggregate/catalog read-only audit + docs-only Admission
- 结论：首切片选择 appointments list；数据 readiness 阻断于尚未执行的 SYS-01 controlled rebuild，不冻结 Runtime allowlist

## 一、结论

```text
STAGE=S33
STREAM=care
TASK=SEVEN_STREAM_CARE_FORMAL_FRESH_ADMISSION
COMPLETION_MODE=ADMISSION_COMPLETE_BLOCKED_PENDING_SYSTEM_REBUILD
BASELINE=5b7023aa78a78ead98c25071cda99c2df978bb89

S32_PR=1230
S32_HEAD=b5fed81fd9b976f94ac09156d1547ad94b09b9b8
S32_MERGE=5b7023aa78a78ead98c25071cda99c2df978bb89
S32_REQUIRED_CHECKS=passed
S32_ACTIONABLE_P0_P1_P2_P3=0
S32_POST_MERGE_REVIEW_DEBT=0
S32_COMPLETE=true
S32_FORMAL_CLOSURE=true

S29_CORRECTIVE_PR=1232
S29_CORRECTIVE_HEAD=1d1719f82afb9959c22e5ba6d5f8df0d65fae3c4
S29_CORRECTIVE_MERGE=00e9b91382538f29764853d9fdd67ae42a9872af
S30_CORRECTIVE_DOCS_PR=1234
S30_CORRECTIVE_DOCS_HEAD=357661bf1646296174de714deee47de8abf5aa0d
S30_CORRECTIVE_DOCS_MERGE=23b1784ca61c0cdbb950cc6291fc83302b8f83a2
S31_CORRECTIVE_RUNTIME_PR=1233
S31_CORRECTIVE_RUNTIME_HEAD=dc1524cc4b3d7656bf60b3aaf10be5ab7cf85ca5
S31_CORRECTIVE_RUNTIME_MERGE=f7eefd101d05b8c07468de677d5013658816972a
S31_EXIT_AWAIT_CORRECTIVE_PR=1237
S31_EXIT_AWAIT_CORRECTIVE_HEAD=3a2a45bbe20d51a7d2a15d702bb1da2f0c777584
S31_EXIT_AWAIT_CORRECTIVE_MERGE=ca6a32212ab19a0014cb353680e612480a500a1e
S32_CORRECTIVE_DOCS_PR=1235
S32_CORRECTIVE_DOCS_HEAD=a4f07114a97fece89312cfccc166daa179f6b345
S32_CORRECTIVE_DOCS_MERGE=f981c6c06448eed2fa63edd0a8a38f9cfc3b5b1d

S29_POST_MERGE_P2_RESOLVED=2
S30_POST_MERGE_P1_RESOLVED=2
S31_POST_MERGE_P1_RESOLVED=3
S31_POST_MERGE_P2_RESOLVED=1
S32_POST_MERGE_P2_RESOLVED=1
S33_POST_MERGE_P2_RESOLVED=1
S33_EXACT_SCOPE_GOVERNANCE_THREAD_RESOLVED=1
ULTRA_GOAL_CORRECTIVE_REVIEW_THREAD_COUNT=10
ULTRA_GOAL_REVIEW_THREAD_DISPOSITION_COUNT=11
ULTRA_GOAL_ACTIONABLE_P0_P1_P2_P3=0
ULTRA_GOAL_POST_MERGE_REVIEW_DEBT=0
S33_ACTIONABLE_P0_P1_P2_P3=0
POST_MERGE_REVIEW_DEBT=0
S33_FORMAL_CLOSURE=true

CARE_SELECTED_FIRST_SLICE=APPOINTMENTS_LIST_BY_CURRENT_INSTITUTION
CARE_DATA_READINESS=blocked_pending_system_rebuild
CARE_SCHEMA_CHANGE_REQUIRED=false
CARE_MIGRATION_REQUIRED=false
CARE_EXACT_RUNTIME_ALLOWLIST_FROZEN=false
CARE_EXACT_RUNTIME_FILE_COUNT=0
CARE_RUNTIME_IMPLEMENTATION=false
CARE_PAGE_RELEASE_ADMISSION_READY=false
```

旧 preaudit 只作为搜索线索。CUS-01 formal Reader/API 已在 S29 合并，但这不把 Customers repository 变成 Care 可直接读取的内部依赖；S33 从 current main、正式 policy 与 source database 重新得出结论。

### Post-merge corrective formal closure

最终 review sweep 共发现 10 条 actionable thread，均已通过各自原 stage/scope 的实际 commit、Required Check 与 merge 证据闭合：S29 修复完整 Cookie provenance 与 PostgreSQL 字符长度；S31 修复 build-time exact Head、直接 Next child cleanup，并由 PR #1237 锁定 `SIGKILL` 后继续等待真实 `close`；S30 校准 durable authorization 与 canonical probe 描述；S32 用真实 Node/Vitest 路径分别重跑 31+54 项；S33 PR #1236 的退出等待证据 P2 同样由 #1237 的已合并 Runtime 事实闭合。另 1 条 S33 exact-6 范围线程与用户显式冻结 allowlist 冲突，已按 AGENTS.md 权威顺序正式回复并 resolved。PR #1227/#1228/#1229/#1230/#1231/#1234/#1236 的对应线程均已处置。

```text
APPLICATION_SMOKE_EXPECTED_COMMIT_ENV_INJECTED=false
APPLICATION_SMOKE_VERSION_SOURCE_REQUIRED=build
APPLICATION_SMOKE_DIRECT_NEXT_CHILD=true
APPLICATION_SMOKE_CHILD_EXIT_AWAITED=true
APPLICATION_SMOKE_FORCE_KILL_CLOSE_AWAITED=true
S31_RUNNER_TESTS=1_file_31_tests_passed
S31_MIGRATION_GUARD_TESTS=1_file_54_tests_passed
S31_TARGETED_TESTS=2_files_85_tests_passed
S31_CORRECTIVE_FULL_TESTS=502_files_6976_tests_passed
SYSTEM_REBUILD_EXECUTION=false
CARE_RUNTIME_IMPLEMENTATION=false
```

## 二、first slice fresh 比较

| 候选 | Source facts | 复杂度与敏感性 | Fresh 决策 |
|---|---|---|---|
| appointments list by current institution | 5 rows；5/5 customer pair 唯一匹配；source 无 `institution_id` | 单一 list、状态与时间可形成低敏 DTO；无外部系统依赖 | selected；等待 rebuild 持久化 owner-reconstructed pair |
| follow-up tasks list | 4 rows；4/4 customer pair 唯一匹配；source 无 `institution_id` | assignment、due bucket、risk、source treatment link 与工作流状态更多 | 后续独立 slice；不因 row count 更少而优先 |
| treatment summaries list | 7 rows；7/7 customer pair 唯一匹配；source 无 `institution_id` | 治疗摘要、建议、风险、作废与 appointment link 更敏感 | 后续独立安全审计，不作为首切片 |

```text
CARE_SELECTED_FIRST_SLICE=APPOINTMENTS_LIST_BY_CURRENT_INSTITUTION
CARE_FIRST_SLICE_EXTERNAL_SYSTEM_DEPENDENCY=false
CARE_FIRST_SLICE_READONLY=true
CARE_FIRST_SLICE_MINIMAL_DELIVERABLE=true
```

## 三、ownership 与 dependency direction

```text
CARE_FACT_OWNER=public.appointments
CARE_COMMAND_OWNER=src/modules/care
CARE_REPOSITORY_OWNER=src/modules/care
CARE_READ_MODEL_OWNER=src/modules/care
CARE_PRESENTATION_OWNER=src/modules/care
CARE_CROSS_OWNER_COMPOSITION_OWNER=src/server/orchestration
INSTITUTION_MODULE_NEW_OWNERSHIP_ALLOWED=false
```

现有 `src/modules/care/**` 已拥有 appointment command/service/repository 与 transaction-safe customer-pair write validation；`src/modules/institution/components/AppointmentCenterShell.tsx`、legacy client/domain 与 workspace wiring 是 capability-off compatibility surface，不是 future fact/read/presentation ownership。正式 slice 不得继续向 `src/modules/institution/**` 添加业务 ownership。

original source 只能通过 `public.customers` 推导 appointment institution pair。S33 不允许 Care 新 Reader 直接 import Customers repository 或在 runtime 临时复制 Customer ownership；cross-owner composition 必须位于 orchestration。当前已冻结的 SYS-01 runner 会在受控 rebuild transfer 中以 exact-one customer match 写入 `appointments.institution_id`，该执行尚未授权、尚未发生。

## 四、Reader、API 与 page 分离

```text
CARE_FORMAL_READER_EXISTS=false
CARE_CURRENT_API=/api/institution/appointments
CARE_CURRENT_API_STATE=capability_off_compatibility_only_503
CARE_TARGET_VERSIONED_API=/api/v1/institution/appointments
CARE_CANONICAL_PAGE=/hospital/care/appointments
CARE_CAPABILITY_KEY=page_care_appointments
CARE_CAPABILITY_DECISION=hidden
CARE_PAGE_RELEASE_ADMISSION_READY=false
```

legacy route 的 GET/POST/PATCH 全部固定返回 `503 capability_disabled`；current main 没有 formal appointment list Reader，也没有 versioned API。catch-all page 只渲染 capability-off shell，Capability Authority 仅发布 `page_workbench` 与 `page_system_audit` 两个 readonly pilot；`page_care_appointments` 保持 hidden/not_released。Reader/API 与 page release 必须在后续分别准入。

## 五、original `55433` read-only data audit

连接 URL 只从本地 secret source 取得，先拒绝非 exact `127.0.0.1:55433`。client startup 固定 read-only；repeatable-read read-only transaction 的第一条 SELECT 验证 `transaction_read_only=on`，随后只执行 catalog 与 aggregate SELECT，并以 sentinel ROLLBACK。未输出 ID、PII、业务正文、username、password 或完整 URL。

```text
ORIGINAL_DATABASE_IDENTITY=127.0.0.1:55433
CLIENT_STARTUP_DEFAULT_TRANSACTION_READ_ONLY=on
TRANSACTION=BEGIN_TRANSACTION_READ_ONLY_REPEATABLE_READ
FIRST_SELECT_TRANSACTION_READ_ONLY=on
QUERY_CLASS=aggregate_and_catalog_select_only
TRANSACTION_END=ROLLBACK

APPOINTMENT_COUNT=5
APPOINTMENT_NULL_TENANT_COUNT=0
SOURCE_INSTITUTION_COLUMN_ABSENT=true
APPOINTMENT_CUSTOMER_ORPHAN_COUNT=0
APPOINTMENT_CUSTOMER_PAIR_UNIQUE_MATCH_COUNT=5
APPOINTMENT_CUSTOMER_PAIR_ZERO_MATCH_COUNT=0
APPOINTMENT_CUSTOMER_PAIR_MULTI_MATCH_COUNT=0

FOLLOW_UP_TASK_COUNT=4
FOLLOW_UP_TASK_SOURCE_INSTITUTION_COLUMN_ABSENT=true
FOLLOW_UP_TASK_CUSTOMER_PAIR_UNIQUE_MATCH_COUNT=4
FOLLOW_UP_TASK_CUSTOMER_PAIR_ZERO_MATCH_COUNT=0
FOLLOW_UP_TASK_CUSTOMER_PAIR_MULTI_MATCH_COUNT=0

TREATMENT_SUMMARY_COUNT=7
TREATMENT_SUMMARY_SOURCE_INSTITUTION_COLUMN_ABSENT=true
TREATMENT_SUMMARY_CUSTOMER_PAIR_UNIQUE_MATCH_COUNT=7
TREATMENT_SUMMARY_CUSTOMER_PAIR_ZERO_MATCH_COUNT=0
TREATMENT_SUMMARY_CUSTOMER_PAIR_MULTI_MATCH_COUNT=0

DATABASE_CONNECTION=true
DATABASE_TRANSACTION_READ_ONLY=true
DATABASE_WRITE_ON_ORIGINAL_55433=false
```

所有 pair 均 exact-one 只证明 rebuild owner reconstruction 有安全来源，不代表 legacy Care Reader 可绕过 ownership boundary。current repo schema/baseline 已包含 nullable `institution_id`，且 command repository 对 formal pair fail closed；因此不需要新的 Schema/Migration，实际 blocker 是 candidate rebuild 尚未执行。

## 六、正式角色授权

`care` section audience 与正式 Institution Action Policy 的 `care_task/read` 均 fresh 验证；四个机构角色全部允许 selected read action。该结论只授权 role/action 语义，不发布 capability，也不覆盖 source data blocker。

```text
TENANT_ADMIN_CARE_APPOINTMENT_READ_ALLOWED=true
TENANT_OPERATOR_CARE_APPOINTMENT_READ_ALLOWED=true
CONSULTANT_CARE_APPOINTMENT_READ_ALLOWED=true
CUSTOMER_SERVICE_CARE_APPOINTMENT_READ_ALLOWED=true
CARE_UNKNOWN_ROLE_FAILS_CLOSED=true
CARE_CROSS_INSTITUTION_FAILS_CLOSED_REQUIRED=true
```

## 七、future low-sensitive DTO

```text
CARE_LOW_SENSITIVE_DTO=contractVersion,appointmentId,scheduledAt,status,updatedAt
CARE_DTO_MEDICAL_NOTES_INCLUDED=false
CARE_DTO_TREATMENT_TEXT_INCLUDED=false
CARE_DTO_PHONE_EMAIL_INCLUDED=false
CARE_DTO_EXTERNAL_IDENTIFIERS_INCLUDED=false
CARE_DTO_TENANT_INSTITUTION_IDS_INCLUDED=false
CARE_DTO_CUSTOMER_DISPLAY_NAME_INCLUDED=false
CARE_DTO_PROJECT_INCLUDED=false
CARE_DTO_CONSULTANT_USER_ID_INCLUDED=false
```

`appointmentId` 是 opaque internal record reference，用于稳定 cursor/detail link，不是外部 provider identifier。首切片不暴露 note、project、customer display name、consultant identity 或任何 tenant/institution pair。

## 八、blocker 与下一原子任务

```text
BLOCKING_PREREQUISITE_COUNT=1
PRIMARY_BLOCKING_PREREQUISITE=SYS01_CONTROLLED_LOCAL_DEVELOPMENT_REBUILD_EXECUTION_NOT_COMPLETED
BLOCKING_FACT=original_appointments_has_no_institution_id_while_owner_safe_runtime_join_to_customers_is_not_admitted

CARE_EXACT_RUNTIME_ALLOWLIST_FROZEN=false
CARE_EXACT_RUNTIME_FILE_COUNT=0
CARE_EXACT_PRODUCTION_FILE_COUNT=0
CARE_EXACT_TEST_FILE_COUNT=0
CARE_RUNTIME_IMPLEMENTATION=false
CARE_PAGE_RELEASE=false

NEXT_SYSTEM_TASK=SEVEN_STREAM_SYSTEM_SYS_01_CONTROLLED_LOCAL_DEVELOPMENT_REBUILD_EXECUTION
NEXT_SYSTEM_TASK_AUTHORIZED=false
NEXT_CARE_TASK=SEVEN_STREAM_CARE_APPOINTMENTS_READONLY_FRESH_READMISSION_AFTER_SYSTEM_REBUILD
NEXT_CARE_TASK_AUTHORIZED=false
NEXT_STAGE_AUTO_EXECUTION=false

SCHEMA_CHANGE=false
MIGRATION_EXECUTION=false
DDL_EXECUTION=false
DML_EXECUTION=false
STAGING_CHANGE=false
PRODUCTION_CHANGE=false
PRODUCTION_DEPLOYMENT=false

REVIEW_ACCEPTED_GOVERNED_PAGE_RELEASE_COUNT=2
RELEASED_GOVERNED_PAGES=page_workbench,page_system_audit
SEVEN_STREAM_FORMAL_RELEASE_COUNT=0
CONTROLLED_CREATE_RELEASE_COUNT=0
```

S33 完成的是 fresh Admission 审计与 blocker closure，不是 Runtime Admission。只有 SYS-01 controlled rebuild 经独立明确授权、执行与验证后，才可 fresh 重审 appointments exact Runtime allowlist；不得沿用本报告预猜文件。
