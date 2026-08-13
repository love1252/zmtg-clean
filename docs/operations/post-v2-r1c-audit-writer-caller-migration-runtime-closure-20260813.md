# POST-V2-R1C Audit Writer caller migration Runtime closure 修正报告

## 结论

```text
STAGE=S10
TASK=POST_V2_R1C_AUDIT_WRITER_CALLER_MIGRATION_RUNTIME
COMPLETION_MODE=COMPLETE

BASELINE=ed211a5e2f236c13cab3fecba8d0831acd5218ee
PRE_CORRECTIVE_MAIN=1b723a731005e8203b1800043e2846a2c345515f
RUNTIME_FINAL_MAIN=cc8f0551e6e098e60b4d01028184729c0cf3cb56

PRODUCTION_AUDIT_WRITER_CALLER_FILE_COUNT=19
PRODUCTION_LEGACY_WRITER_CALLER_FILE_COUNT=0
PRODUCTION_ATTRIBUTED_WRITER_CALLER_FILE_COUNT=19
TARGET_VERIFIED_MIGRATED=5
TARGET_NOT_APPLICABLE_MIGRATED=12
ATTEMPTED_DENIAL_MIGRATED=2
BLOCKED_UNCLASSIFIED_CALLER_FILE_COUNT=0

S10_RUNTIME_CHANGED_FILE_COUNT=34
S10_TEST_CHANGED_FILE_COUNT=31
S10_DOC_CHANGED_FILE_COUNT=4

AUDIT_CALLER_MIGRATION_CLOSED=true
AUDIT_WRITER_ATTRIBUTION_CLOSED=true
S10_CALLER_MIGRATION_COMPLETE=true
S10_CORRECTIVE_RUNTIME_PR=1188
S10_CORRECTIVE_RUNTIME_CHANGED_FILE_COUNT=4
S10_CORRECTIVE_TEST_CHANGED_FILE_COUNT=1
S10_CORRECTIVE_DOC_CHANGED_FILE_COUNT=4
S10_ACTIONABLE_P0_P1=0
POST_MERGE_REVIEW_DEBT=0
PR1186_P1_THREAD_RESOLVED=true
```

S10 从 S9 的 canonical 19-row inventory 出发，把所有 production caller 从 legacy persistence 迁移到 attributed contract。PR #1188 已修复 PR #1186 post-merge P1，并补齐 verified Audit 写入的同类绑定：legacy residual=0、business/Audit pair fail-closed、全 S10 Review sweep 与 merged-main 独立复核均已通过，caller migration 与 Audit Writer attribution 正式闭环。

## 19-row 最终处置

| # | Production caller | S9 target | 最终处置 | Persistence 证据 |
|---:|---|---|---|---|
| 1 | `src/modules/institution/server/followup-message-draft-api.ts` | `BLOCKED_UNCLASSIFIED` | `MIGRATED_VALID_DENIAL_ATTRIBUTION` | allowed 分支使用 verified handle；pre-scope institution denial 使用 attempted-denial contract |
| 2 | `src/modules/institution/server/followup-message-draft-service.ts` | `VERIFIED` | `MIGRATED_VERIFIED` | Care composition 一次解析 formal scope，事务内复用 handle 并调用 `recordAttributed()` |
| 3 | `src/modules/institution/server/his-connection-credential-service.ts` | `NOT_APPLICABLE` | `MIGRATED_NOT_APPLICABLE` | tenant-wide HIS credential 事件使用 `not_applicable` |
| 4 | `src/modules/institution/server/his-connection-status-service.ts` | `NOT_APPLICABLE` | `MIGRATED_NOT_APPLICABLE` | tenant-wide HIS status 事件使用 `not_applicable` |
| 5 | `src/modules/institution/server/his-connection-test-connection-service.ts` | `NOT_APPLICABLE` | `MIGRATED_NOT_APPLICABLE` | tenant-wide test-connection 事件使用 `not_applicable` |
| 6 | `src/modules/institution/server/his-connection-write-service.ts` | `NOT_APPLICABLE` | `MIGRATED_NOT_APPLICABLE` | tenant-wide HIS lifecycle 事件使用 `not_applicable` |
| 7 | `src/modules/institution/server/tenant-business-api.ts` | `BLOCKED_UNCLASSIFIED` | `MIGRATED_VALID_DENIAL_ATTRIBUTION` | allowed 分支使用 verified handle；可信 signed-session attempted pair 的拒绝事件使用 attempted-denial contract |
| 8 | `src/modules/institution/server/trusted-reachout-safety-service.ts` | `VERIFIED` | `MIGRATED_VERIFIED` | WeCom composition handle 与 customer scope pair 一致，事务内 `recordAttributed()` |
| 9 | `src/modules/institution/server/wecom-customer-mapping-service.ts` | `VERIFIED` | `MIGRATED_VERIFIED` | mapping business pair 与 formal pair fail-closed 后写 attributed Audit |
| 10 | `src/modules/institution/server/wecom-dry-run-snapshot-service.ts` | `VERIFIED` | `MIGRATED_VERIFIED` | institution dry-run scope 使用 verified attribution |
| 11 | `src/modules/institution/server/wecom-real-send-proof-service.ts` | `VERIFIED` | `MIGRATED_VERIFIED` | 每次 top-level proof transaction 复用一个 verified handle，全部 Audit event 同事务写入 |
| 12 | `src/app/api/v1/open-platform/ai-model-config/route.ts` | `NOT_APPLICABLE` | `MIGRATED_NOT_APPLICABLE` | Platform control-plane read/write Audit 使用 `not_applicable` |
| 13 | `src/app/api/v1/open-platform/ai-model-config/sync/route.ts` | `NOT_APPLICABLE` | `MIGRATED_NOT_APPLICABLE` | Platform vendor sync Audit 使用 `not_applicable` |
| 14 | `src/app/api/v1/open-platform/ai-model-config/test/route.ts` | `NOT_APPLICABLE` | `MIGRATED_NOT_APPLICABLE` | Platform vendor test Audit 使用 `not_applicable` |
| 15 | `src/modules/open-platform/server/platform-knowledge-management-service.ts` | `NOT_APPLICABLE` | `MIGRATED_NOT_APPLICABLE` | tenant selector 属于 Platform control-plane，不归属单一 institution |
| 16 | `src/modules/open-platform/server/tenant-account-management-service.ts` | `NOT_APPLICABLE` | `MIGRATED_NOT_APPLICABLE` | tenant lifecycle event 使用 attributed mapper |
| 17 | `src/modules/open-platform/server/tenant-plan-binding-service.ts` | `NOT_APPLICABLE` | `MIGRATED_NOT_APPLICABLE` | tenant plan binding 双事件均使用 attributed mapper |
| 18 | `src/modules/open-platform/server/tenant-plan-change-service.ts` | `NOT_APPLICABLE` | `MIGRATED_NOT_APPLICABLE` | tenant plan change 两个事务分支均使用 attributed mapper |
| 19 | `src/app/api/auth/login/route.ts` | `NOT_APPLICABLE` | `MIGRATED_NOT_APPLICABLE` | formal login success / failure 使用 `not_applicable + recordAttributed()` |

最终每一行均属于 S10 允许的合法处置；没有 `LEGACY_UNATTRIBUTED`、`UNKNOWN`、`TEMPORARY`、`TODO` 或 `BLOCKED_UNCLASSIFIED`。

## Formal scope 与 transaction 语义

```text
FORMAL_SCOPE_RESOLUTION_CARDINALITY=exactly_once_per_top_level_operation
FORMAL_SCOPE_REUSE_WITHIN_OPERATION_SAFE=true
PAIR_REVALIDATION_REQUIRED=false
NEW_BUSINESS_QUERY_COUNT=0
NEW_DATABASE_TRANSACTION_COUNT=0
ARCHITECTURE_EXCEPTION_REQUIRED=false
```

- Care 与 WeCom orchestration 在进入 caller-provided transaction 前调用 `resolveInstitutionAuditWriterVerifiedAttributionV1()`；该入口内部只 resolve / consume 一次 S6 formal scope。
- PR #1188 将 callback 可见的 customer repository 收窄为必要只读方法，并把 Safety 4 个写方法、Mapping 2 个写方法、Care metadata 写方法、verified Audit 写入及 real-send repository 手工绑定到 formal/business `tenantId + institutionId`；任一 candidate pair 不一致时在触达底层 repository 前 fail closed。
- 锁定 A/B 回归：business pair 为 `tenant-a/inst-a`、callback 尝试 `tenant-a/inst-b` 时，业务 writer=0、verified Audit writer=0、transaction callback 失败并回滚。
- 一个 top-level operation 产生多个 Audit event 时复用同一个 opaque handle，不重复查询 Membership、Binding、Tenancy、customer ownership、appointment 或 mapping。
- 原本同事务的 business mutation 与 Audit insert 继续使用 transaction database；Repository 不自行调用 `getDatabase()`、不开第二个 transaction。
- 原本 best-effort 的 Auth、Platform 与 HIS path 保持原结果、HTTP、Cookie、低敏错误和 Audit failure isolation。

## Attempted-institution denial contract

S10 只为 S9 已知两个 mixed pre-scope caller 扩展 Audit Owner：

- orchestration 从已验证 signed session 取得可信 attempted `tenantId + institutionId`；
- attempted denial event 保留 attempted pair，但 `institutionAttribution=null`，不会冒充 `verified` 或 `not_applicable`；
- factory、validator、mapper 与 `recordAttemptedInstitutionDenial()` 均 fail closed；
- Institution Reader 继续只读取 `institutionAttribution='verified'`，因此 attempted denial 不会进入受治理页面结果；
- 没有新增 Schema、enum、业务 Owner 查询或通用 attribution framework。

## PR 与 Review 证据

| PR | Scope | Final Head | Merge |
|---|---|---|---|
| #1183 | Auth + Platform `not_applicable` | `f08d9d27f70cb5047b77b95f59500bb3f7002d64` | `67685985ce1d5980aafdc345713e0a9331d8c53d` |
| #1184 | HIS `not_applicable` | `d09ec9d609aa02d6554f9e87d1a5d823b4647c32` | `a349d3a74e29742905c63d26a7f1605f2a6ec5ed` |
| #1185 | two mixed attempted-denial callers | `89b95c5e0e10a30fe2246cbf45517ac12dfa0d88` | `25048c19c527dfe6f1d5b4b559802268c00a0cf0` |
| #1186 | five verified Institution callers | `70a716ffc1d1dcc302dc06549b4f26a98fd5f6c0` | `124c79a3b121fa9d67dc7fc86847f244acc43ef2` |
| #1188 | verified attribution business-pair corrective Runtime | `f9611e95b5ca62f6f2cc95d7395ccd54e2a415e6` | `cc8f0551e6e098e60b4d01028184729c0cf3cb56` |

```text
S10_RUNTIME_PR_COUNT=5
S10_REQUIRED_CHECKS=passed
S10_ACTIONABLE_P0_P1=0
S10_RUNTIME_POST_MERGE_REVIEW_DEBT=0
S10_INITIAL_HANDOFF_PR=1187
S10_FINAL_HANDOFF_PR=1189
S10_PR_COUNT=7
S10_CORRECTIVE_RUNTIME_PR=1188
PR1186_P1_THREAD=PRRT_kwDOSrGMn86Y6gdv
PR1186_P1_THREAD_RESOLVED=true
PR1188_P1_THREAD=PRRT_kwDOSrGMn86Y7fvl
PR1188_P1_THREAD_RESOLVED=true
```

PR #1184 的 canonical tenant/user normalization Review、PR #1185 的 attempted-denial classification Review、PR #1186 的 business-pair P1 与 PR #1188 的 Audit-pair P1 均已通过实际 commit 修复并解决。PR #1183—#1188 thread-aware post-merge sweep 的 actionable non-outdated P0/P1/P2 debt 为 0。

## 验证

```text
TARGETED_TEST_FILES=31
TARGETED_TESTS=484
FULL_TEST_FILES=493
FULL_TESTS=6709

TYPECHECK=passed
ARCHITECTURE_UNIT=148/148 passed
ARCHITECTURE_INCREMENTAL=passed
LINT=passed_with_4_existing_warnings
BUILD=passed
PRODUCTION_READINESS_DOCS=8/8 passed
GIT_DIFF_CHECK=passed

POST_MERGE_INDEPENDENT_TEST_FILES=2
POST_MERGE_INDEPENDENT_TESTS=17
POST_MERGE_INDEPENDENT_TYPECHECK=passed
POST_MERGE_INDEPENDENT_ARCHITECTURE_INCREMENTAL=passed
```

全量回归与构建均在未连接数据库的本地代码验证环境完成。lint 的 4 条 warning 是本任务未修改文件中的既有 `<img>` 提示，不包含 error。

## 保持的边界

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

S10 corrective 只修正新写入路径的 verified attribution/business pair 绑定；旧记录仍未 backfill，因此不能据此放行 `page_system_audit`。下一任务只能在新的明确授权下执行 `POST-V2-R1C Audit Writer Historical Backfill`，不得自动连接数据库或执行回填。
