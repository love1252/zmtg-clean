# 下一任务

## 唯一技术任务

```text
NEXT_TASK=POST-V2-R1C Audit Writer Historical Backfill explicit authorization
HISTORICAL_BACKFILL_AUTHORIZED=false
DATABASE_CONNECTION_AUTHORIZED=false
DATABASE_WRITE_EXECUTION_AUTHORIZED=false
PAGE_SYSTEM_AUDIT_RUNTIME_AUTHORIZED=false
```

## S10 最终闭环状态

```text
S10_CALLER_MIGRATION_COMPLETE=true
AUDIT_CALLER_MIGRATION_CLOSED=true
AUDIT_WRITER_ATTRIBUTION_CLOSED=true
S10_CORRECTIVE_RUNTIME_PR=1188
S10_CORRECTIVE_RUNTIME_HEAD=f9611e95b5ca62f6f2cc95d7395ccd54e2a415e6
S10_CORRECTIVE_RUNTIME_MERGE=cc8f0551e6e098e60b4d01028184729c0cf3cb56
S10_ACTIONABLE_P0_P1=0
POST_MERGE_REVIEW_DEBT=0
PR1186_P1_THREAD_RESOLVED=true
PR1188_P1_THREAD_RESOLVED=true

PRODUCTION_AUDIT_WRITER_CALLER_FILE_COUNT=19
PRODUCTION_LEGACY_WRITER_CALLER_FILE_COUNT=0
PRODUCTION_ATTRIBUTED_WRITER_CALLER_FILE_COUNT=19
TARGET_VERIFIED_MIGRATED=5
TARGET_NOT_APPLICABLE_MIGRATED=12
ATTEMPTED_DENIAL_MIGRATED=2
BLOCKED_UNCLASSIFIED_CALLER_FILE_COUNT=0

FORMAL_SCOPE_RESOLUTION_CARDINALITY=exactly_once_per_top_level_operation
FORMAL_SCOPE_REUSE_WITHIN_OPERATION_SAFE=true
```

19 个 production caller 的 attributed persistence 与 legacy residual=0 均保持成立。corrective Runtime PR #1188 已把 callback 可见的业务与 Audit 写 capability 绑定到 verified business pair；PR #1186 与 #1188 的相关 P1 均在实际修复合并后解决，全 S10 Review sweep 与 merged-main 独立复核已通过。

## Corrective 完成证据

1. PR #1188 Final Head `f9611e95b5ca62f6f2cc95d7395ccd54e2a415e6`、Merge `cc8f0551e6e098e60b4d01028184729c0cf3cb56`，Required Check 通过；
2. `PRRT_kwDOSrGMn86Y6gdv` 与 `PRRT_kwDOSrGMn86Y7fvl` 均在实际修复后回复并解决；
3. PR #1183—#1188 post-merge Review sweep 的 actionable non-outdated P0/P1/P2 debt 为 0；
4. merged main 独立复核为 2 files / 17 tests、typecheck 与 Architecture incremental 全部通过；
5. 最终同属 S10 的 docs-only Handoff PR 记录 closure=true，不授权自动开始 Historical Backfill。

## 后续 Historical Backfill 重新授权要求

corrective closure 完成后的后续任务涉及独立数据治理与数据库写权限，必须由用户重新明确授权；当前 S10 corrective 不授权连接数据库、读取当前历史分布或执行任何回填。

新阶段开始时必须 fresh 决定：

1. 允许连接的环境与只读审计范围；
2. 历史记录的可证明分类规则、不可分类处理和审计证据；
3. exact Schema / Migration / DDL / DML 边界；
4. backfill dry-run、批次、幂等、回滚与 postcheck；
5. `page_system_audit` release eligibility 是否需要在 backfill 后重新审计。

继承的旧快照仅用于说明缺口，不构成当前数据库事实：此前 local-development readonly 观察到 275 条旧记录均未设置 institution attribution。下一阶段如获授权，必须重新读取并核验，不能直接以 275 作为执行输入。

## 当前停止边界

- 不得自动执行 Historical Backfill；
- 不得连接任何数据库，不得执行 `SELECT`、`INSERT`、`UPDATE`、`DELETE`、DDL、DML、Migration 或 Seed；
- 不得修改 Workbench、Capability Authority、`page_system_audit` 或 Audit Reader page shell；
- 不得进入 Staging 或 Production；
- 不得把 caller migration closure 推导为页面 release。

```text
HISTORICAL_BACKFILL_CLOSED=false
WORKBENCH_MULTI_CAPABILITY_SAFE=false
PAGE_SYSTEM_AUDIT_STATE=hidden/not_released
PAGE_SYSTEM_AUDIT_RELEASE=false
REVIEW_ACCEPTED_GOVERNED_PAGE_RELEASE_COUNT=1

DATABASE_CONNECTION=false
DATABASE_WRITE_EXECUTION=false
SCHEMA_CHANGE=false
MIGRATION=false
DDL_EXECUTION=false
DML_EXECUTION=false

PRODUCTION_CHANGE=false
PRODUCTION_DEPLOYMENT=false
```
