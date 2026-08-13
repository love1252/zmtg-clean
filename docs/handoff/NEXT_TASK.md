# 下一任务

## 唯一技术任务

```text
NEXT_TASK=POST-V2-R1C page_system_audit readonly release fresh re-audit + exact Runtime admission
PAGE_SYSTEM_AUDIT_RUNTIME_AUTHORIZED=false
```

## 继承状态

```text
POST_V2_R1C_AUDIT_READER_RUNTIME=passed
AUDIT_READER_RUNTIME_IMPLEMENTED=true
AUDIT_READER_RUNTIME_VERIFIED=true
AUDIT_READER_RUNTIME_INDEPENDENT_VERIFICATION=passed
AUDIT_READER_RUNTIME_HANDOFF_COMPLETE=true

RUNTIME_EXACT_FILE_COUNT=8
RUNTIME_PR=1169
RUNTIME_HEAD=c927fdfc9a37a865d3df2082ec350b7e01806c45
RUNTIME_MERGE=2a45b74999784bdcf1a4777c9017ba15d2cef546
RUNTIME_REQUIRED_CHECK=passed
RUNTIME_ACTIONABLE_P0_P1=0

DATABASE_CONNECTION_USED=true
DATABASE_CONNECTION_SCOPE=local_development_only
DATABASE_READONLY_VERIFICATION=passed
DATABASE_WRITE_EXECUTION=false

SCHEMA_CHANGE=false
MIGRATION=false
DDL_EXECUTION=false
DML_EXECUTION=false
ARCHITECTURE_EXCEPTION_REQUIRED=false

AUDIT_WRITER_ATTRIBUTION_CLOSED=false
HISTORICAL_BACKFILL_CLOSED=false
AUDIT_READER_DATA_READINESS=false

PAGE_WORKBENCH_STATE=read_only/pilot_released
PAGE_SYSTEM_AUDIT_STATE=hidden/not_released
PAGE_SYSTEM_AUDIT_RELEASE=false

REVIEW_ACCEPTED_GOVERNED_PAGE_RELEASE_COUNT=1
REVIEW_ACCEPTED_REMAINING_UNRELEASED_PAGE_COUNT=25
CONTROLLED_CREATE_RELEASE_COUNT=0

PRODUCTION_READY_INFERRED=false
PRODUCTION_DEPLOYMENT=false
PRODUCTION_CHANGE=false
```

## Fresh re-audit 必须重新确认

1. 机构 Audit Reader 的成功读取路径仍然成立；
2. `verified` institution attribution 的 data readiness 是否已有独立正式证据；
3. capability authority 是否可以安全新增 `page_system_audit` 投影；
4. Workbench 在多 capability 投影下是否仍保持稳定，不重现历史单摘要回归；
5. canonical Route 是否仍应为 `/hospital/system/audit`；
6. 页面 Runtime 的精确生产与测试闭包；
7. 是否仍无需 Schema、Migration、DDL、DML 或 Architecture exception。

## 停止边界

- 本 Handoff 只授权下一步 fresh re-audit + exact Runtime admission，不授权 `page_system_audit` Runtime implementation；
- 不得仅凭 Reader Foundation 成功推导页面 release、data readiness 或生产就绪；
- 不得修 Audit Writer attribution 或做历史 backfill；
- 不得修改 Platform Audit 语义；
- 不得新增第二个 capability；
- 不得修改 Architecture exception 或删除 AQ004；
- 不得执行 Schema、Migration、DDL、DML、Seed、Staging、Production 或真实外部系统动作；
- fresh re-audit 如无法形成精确 Runtime allowlist，必须停止，不得自行扩大范围。
