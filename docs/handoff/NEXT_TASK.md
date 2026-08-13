# 下一任务

## 唯一技术任务

```text
NEXT_TASK=POST-V2-R1C Audit Writer formal institution scope port fresh audit + exact Runtime admission
AUDIT_WRITER_ATTRIBUTION_RUNTIME_AUTHORIZED=false
PAGE_SYSTEM_AUDIT_RUNTIME_AUTHORIZED=false
```

## 继承状态

```text
PR1171_POST_MERGE_P1_RESOLVED=true
PR1171_POST_MERGE_P2_RESOLVED=true
PHASE0_FIX_PR=1172
PHASE0_FIX_MERGE=44b2f3653fbfd5cc4dd02f33e5c2c8fc80f292cb

AUDIT_WRITER_ATTRIBUTION_FRESH_AUDIT=passed
AUDIT_WRITER_ATTRIBUTION_RUNTIME_ELIGIBLE=false
ADMISSION_MODE=SPLIT_REQUIRED

CALLER_INVENTORY_REAUDIT=passed
PRODUCTION_AUDIT_WRITER_CALLER_FILE_COUNT=19
PRODUCTION_INSTITUTION_AUDIT_WRITER_CALLER_FILE_COUNT=11
PRODUCTION_PLATFORM_AUDIT_WRITER_CALLER_FILE_COUNT=7
PRODUCTION_NON_INSTITUTION_AUDIT_WRITER_CALLER_FILE_COUNT=1
TRANSACTIONAL_AUDIT_WRITER_CALLER_FILE_COUNT=10

CANONICAL_AUDIT_WRITER_BOUNDARY=Audit domain event contract and AuditEventRepository mapper; institution composition belongs in src/server/orchestration
CANONICAL_WRITER_INSTITUTION_SCOPE_SOURCE=one-shot opaque formal server-session institution scope resolved from authoritative Identity + Membership/Binding + Institution Scope and passed through an orchestration-owned port
TENANT_INSTITUTION_PAIR_PROVENANCE=formal current pair first; transaction-bound business object pair is corroborating evidence and must exactly match
PAIR_REVALIDATION_REQUIRED=false

BLOCKING_PREREQUISITE_COUNT=3
PRIMARY_BLOCKING_PREREQUISITE=formal institution Audit Writer scope port

HISTORICAL_BACKFILL_DECISION=required_under_current_page_release_contract
HISTORICAL_BACKFILL_REQUIRED_FOR_PAGE_RELEASE=true

DATABASE_ENVIRONMENT=local_development
DATABASE_READONLY_CONNECTION=passed
VERIFIED_ATTRIBUTED_ROW_COUNT=0
DATABASE_WRITE_EXECUTION=false

SCHEMA_CHANGE_REQUIRED=false
MIGRATION_REQUIRED=false
DDL_REQUIRED=false
DML_REQUIRED=false
ARCHITECTURE_EXCEPTION_REQUIRED=false

AUDIT_READER_API_AUTHORIZATION_SAFE=true
PAGE_SYSTEM_AUDIT_AUTHORIZATION_VERIFIED=false
WORKBENCH_MULTI_CAPABILITY_SAFE=false
PAGE_SYSTEM_AUDIT_STATE=hidden/not_released
PAGE_SYSTEM_AUDIT_RELEASE=false
REVIEW_ACCEPTED_GOVERNED_PAGE_RELEASE_COUNT=1
PRODUCTION_CHANGE=false
PRODUCTION_DEPLOYMENT=false
```

## Fresh audit 必须回答

1. 如何复用现有 formal server session、authoritative Membership/Binding 与 Institution Scope 链，而不创建第二套 authorization framework；
2. one-shot opaque pair 的 Owner、消费次数、失败关闭与不可重放语义；
3. port 是否只提供 attribution provenance，不替代具体 Route 的 section/object/action authorization；
4. 如何让后续 transaction-bound Writer 比较 formal pair 与业务对象 pair，而不重复发起 ownership query；
5. exact Runtime / test allowlist、AQ004～AQ008 影响与 rollback 边界；
6. 是否能以单一小范围 Runtime 关闭该 port；若仍需跨 Owner 巨型改动则继续拆分。

## 停止边界

- 本 Handoff 仅定义并建议下一原子任务；实际执行必须取得用户当前明确授权，Handoff 本身不构成任何 Runtime、数据库、GitHub 写入或后续任务授权；
- 不得实施 Audit Writer attribution contract、caller migration 或 `page_system_audit` Runtime；
- 不得执行历史 backfill、数据库写入、Schema、Migration、DDL、DML 或 Seed；
- 不得修改 Workbench、Capability Authority、Platform Audit semantics、Architecture exception 或 AQ004；
- 不得连接 Staging / Production；
- 不得把普通 `AccessContext`、body、query、header、cookie、当前账号绑定或单机构假设提升为 `verified`；
- formal scope port 合并后仍须独立准入 Audit Owner contract 与 caller migration，不能直接宣布 Writer closure 或页面放行。
