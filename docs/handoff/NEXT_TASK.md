# 下一任务

## 唯一技术任务

```text
NEXT_TASK=POST-V2-R1C Audit Writer verified attribution business-pair corrective closure
HISTORICAL_BACKFILL_AUTHORIZED=false
DATABASE_CONNECTION_AUTHORIZED=false
DATABASE_WRITE_EXECUTION_AUTHORIZED=false
PAGE_SYSTEM_AUDIT_RUNTIME_AUTHORIZED=false
```

## 当前 S10 corrective 状态

```text
S10_CALLER_MIGRATION_COMPLETE=false
AUDIT_CALLER_MIGRATION_CLOSED=false
AUDIT_WRITER_ATTRIBUTION_CLOSED=false
S10_CORRECTIVE_RUNTIME_PR=1188
S10_ACTIONABLE_P0_P1=1
POST_MERGE_REVIEW_DEBT=1
PR1186_P1_THREAD_RESOLVED=false

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

19 个 production caller 的 persistence 迁移与 legacy residual=0 事实保持不变，但 PR #1186 post-merge P1 证明 WeCom verified transaction callback 仍可把机构 A 的 attribution handle 与机构 B 的业务写组合。corrective Runtime PR #1188 合并、指定 thread 解决并完成全 S10 Review sweep 前，不得宣称 caller migration 或 Audit Writer attribution 已闭环。

## Corrective 完成门禁

1. PR #1188 Required Check 与完整本地验证通过并合并；
2. `PRRT_kwDOSrGMn86Y6gdv` 只在实际修复合并后回复并解决；
3. 全部 S10 PR post-merge Review sweep 无 P0/P1/P2 debt；
4. merged main 独立复核通过；
5. 通过最终同属 S10 的 docs-only Handoff PR 重新记录 closure=true。

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
