# POST-V2-R1C Audit Writer Historical Backfill 完整闭环

## 结论

```text
STAGE=S11
TASK=POST_V2_R1C_AUDIT_WRITER_HISTORICAL_BACKFILL
COMPLETION_MODE=COMPLETE

BASELINE=5dedc54da98ee5a028216980049e245807630150
TOOLING_HEAD=5220cab1892b3c89ecda0283e3c16929709e317e
TOOLING_MERGE=54c191ec06b6d3766d990d8b8a12d44d5fd22516
TOOLING_PR=1190
INITIAL_HANDOFF_PR=1191
INITIAL_HANDOFF_HEAD=542293d3c85950b5e667f594d4a7e4a0bdf62a13
INITIAL_HANDOFF_MERGE=e2c9e32d7df8bba51a48c397beefa4ff02a55869
PRE_CORRECTIVE_MAIN=e2c9e32d7df8bba51a48c397beefa4ff02a55869
CORRECTIVE_RUNTIME_PR=1192
CORRECTIVE_RUNTIME_HEAD=6661daac0b93848c58b995c2232fe8cbfb971464
CORRECTIVE_RUNTIME_MERGE=82c2c6e24dd7a8463a77e8270040d7536dd9ad1a
SECOND_CORRECTIVE_RUNTIME_PR=1194
SECOND_CORRECTIVE_RUNTIME_HEAD=1d34c83c1f3d4af2bb66c2fbcacf41f833925c03
SECOND_CORRECTIVE_RUNTIME_MERGE=bdd74e8957efb8e14b46905e911ed8b32ee14298
FINAL_HANDOFF_PR=1193
S11_PRS=1190,1191,1192,1193,1194
S11_PR_COUNT=5
S11_REQUIRED_CHECKS=passed

FRESH_DATABASE_AUDIT=passed
CLASSIFICATION_MANIFEST=passed
HISTORICAL_CUTOFF_KIND=EXACT_EVENT_ID_SNAPSHOT

HISTORICAL_TOTAL_ROW_COUNT=275
PRE_BACKFILL_VERIFIED_COUNT=0
PRE_BACKFILL_NOT_APPLICABLE_COUNT=0
PRE_BACKFILL_ATTEMPTED_DENIAL_COUNT=0
PRE_BACKFILL_UNATTRIBUTED_COUNT=275

HISTORICAL_VERIFIED_ROW_COUNT=7
HISTORICAL_NOT_APPLICABLE_ROW_COUNT=1
HISTORICAL_ATTEMPTED_DENIAL_ROW_COUNT=0
HISTORICAL_UNCLASSIFIABLE_ROW_COUNT=267

RULE_COUNT=10
RULE_OVERLAP_COUNT=0
UNSAFE_GUESSED_ATTRIBUTION_COUNT=0

BACKFILL_DRY_RUN=passed
DRY_RUN_VERIFIED_UPDATE_COUNT=7
DRY_RUN_NOT_APPLICABLE_UPDATE_COUNT=1
DRY_RUN_ATTEMPTED_DENIAL_UPDATE_COUNT=0
DRY_RUN_TOTAL_UPDATE_COUNT=8

ROLLBACK_RECOVERY=passed
BACKFILL_EXECUTION=passed
BACKFILL_EXPECTED_UPDATE_COUNT=8
BACKFILL_ACTUAL_UPDATE_COUNT=8
BACKFILL_POSTCHECK=passed
BACKFILL_IDEMPOTENCY=passed
SECOND_RUN_UPDATE_COUNT=0

HISTORICAL_BACKFILL_CLOSED=true
AUDIT_READER_DATA_READINESS=false
```

S11 已对首次稳定快照中的全部 275 行建立穷尽、互斥分类，只更新 7 条具有同一历史 operation 持久化 pair 证据的 `verified` 行和 1 条业务语义明确不属于单一机构的 Auth login `not_applicable` 行。其余 267 行保留 `UNCLASSIFIABLE` 原状态，没有为了页面 readiness 猜测 institution attribution。

## 数据库与 cutoff 边界

本次只连接仓库既有的本机 loopback PostgreSQL local-development evidence instance；host publish 只绑定 `127.0.0.1`，未输出连接串、密码或数据库名，未连接 Staging、Production 或任何外部系统。

`audit_events` 没有 `created_at`、Writer epoch 或 coverage metadata，因此不能用 PR merge 时间或 `occurred_at` 猜测写入边界。S11 采用以下可证明 cutoff：

```text
HISTORICAL_CUTOFF_KIND=EXACT_EVENT_ID_SNAPSHOT
SNAPSHOT_CODE_SHA=54c191ec06b6d3766d990d8b8a12d44d5fd22516
SNAPSHOT_ROW_COUNT=275
IMMUTABLE_COHORT_DIGEST=7947f6b92ba3eb53b0b102a3e0dbd48436d6f986da4445cf539450682eecb4a0
RECOVERY_MANIFEST_MODE=0600
RECOVERY_MANIFEST_LOCATION=repo_outside_local_only
```

manifest 冻结 exact `event_id` cohort、每行回填前 attribution 两列、目标分类及非 attribution 字段 digest；row-level 内容只保存在 repo 外的当前用户私有文件中。后续新 Writer 行不属于该 cohort，DML 也只能命中 manifest identity set。

## Fresh aggregate

| 维度 | Fresh aggregate |
|---|---|
| tenant | 3 个 tenant；行数分布 `268 / 6 / 1`，不记录 tenant ID |
| resource | `follow_up=158`、`customer=64`、`appointment=35`、`real_channel=12`、`safety_switch=5`、`tenant_member=1` |
| action | `read_own_tenant=214`、`update=31`、`review=12`、`create=10`、`approve=5`、`import=2`、`read=1` |
| result | `allowed=216`、`denied=36`、`transitioned=23` |
| source | `demo_session=274`、`server_session=1` |
| time range | `2026-07-05T09:34:53.641Z` 至 `2026-07-22T02:40:50.571Z` |

reason aggregate：`allowed_by_policy=204`、`not_found_or_not_owned=18`、两类 dry-run 各 6、`customer_import_sensitive_field_blocked=5`、consent recorded 4、frequency reserved 4、opt-out 3、mapping confirmed 2、safety-switch updated 2、real-channel blocked 2；其余 19 个 reason 各 1。以上合计精确等于 275。完整低敏 reason count 已由 repo 外 manifest 与 runner 输出冻结，未提交 event row、actor、resource ID 或 tenant ID。

## Classification Rule Manifest

| RULE_ID | Target | Count | 历史证据 | DML |
|---|---:|---:|---|---:|
| `R-PRESERVE-VERIFIED` | `VERIFIED` | 0 | canonical `verified` shape | 0 |
| `R-PRESERVE-NOT-APPLICABLE` | `NOT_APPLICABLE` | 0 | canonical `not_applicable` shape | 0 |
| `R-VERIFIED-MAPPING-OPERATION` | `VERIFIED` | 1 | tenant/customer + `decided_at` + `decided_by` + reason/status 唯一 operation | 1 |
| `R-VERIFIED-CONSENT-OPERATION` | `VERIFIED` | 1 | tenant/customer + `recorded_at` + `recorded_by` + reason/status 唯一 operation | 1 |
| `R-VERIFIED-FREQUENCY-OPERATION` | `VERIFIED` | 1 | tenant/customer + immutable window start 唯一 operation | 1 |
| `R-VERIFIED-DRY-RUN-OPERATION` | `VERIFIED` | 1 | `evaluated_at` + `evaluated_by` + result/status 唯一 operation | 1 |
| `R-VERIFIED-DRAFT-CREATION` | `VERIFIED` | 1 | stable draft ID + exact `created_at` 唯一 operation | 1 |
| `R-VERIFIED-DELIVERY-TIMELINE` | `VERIFIED` | 2 | delivery ID/suffix + timestamp + reason + actor role 唯一 timeline evidence | 2 |
| `R-NOT-APPLICABLE-AUTH-LOGIN` | `NOT_APPLICABLE` | 1 | tenant membership login exact tuple；语义明确不属于单一 institution | 1 |
| `R-UNCLASSIFIABLE-FALLBACK` | `UNCLASSIFIABLE` | 267 | 未达到 Grade A/B 历史 operation 证据 | 0 |

规则总计 `275`，overlap 为 `0`。旧 safety-switch 5 行同时涉及 tenant 与 institution 开关，但只持久化 tenant、没有可信历史 institution provenance，因此全部进入 fallback；current customer、current Membership、tenant 当前只有一个 institution、目录位置或今天的 Runtime 逻辑均未用于推断历史归属。`legacy_unattributed` 也没有被写作新 final class。

## DML、Postcheck 与 Recovery

正式 DML 只修改：

```text
audit_events.institution_id
audit_events.institution_attribution
```

执行路径使用 merged tooling SHA、clean main、repo 外 0600 manifest、`SERIALIZABLE` transaction、exact cohort、当前 attribution precondition 与 `RETURNING event_id` count。首次 before-state execute 会重新计算同一 classification evidence；immutable 字段、Schema fingerprint、rule result、expected/actual count 任一漂移都会抛错并 rollback。final-state execute、postcheck 与 recovery 只依赖 manifest 中已冻结的 exact identity、immutable Audit digest 和 before/final attribution state，不会因后续正常业务操作改变可变 evidence 而失去恢复能力。

PR #1192 将跨 corrective SHA 兼容限制到原 tooling SHA 与原 manifest exact digest，并让 manifest target 同时按 lexical path 与 `realpath(parent) + basename` 做仓库包含检查，父目录 symlink 指回仓库时 fail-closed。PR #1194 进一步把该兼容项绑定到已审查 runner 的 normalized full-source digest；module load 时捕获的实际执行文件 realpath/source 还必须精确匹配仓库 runner 路径与 clean HEAD blob。future runner drift，以及被 `assume-unchanged` / `skip-worktree` 隐藏的 filesystem drift，都会 fail-closed。

执行证据：

1. dry-run：`verified=7`、`not_applicable=1`、总预计更新 `8`；
2. 首次 execute：expected `8`、actual `8`，总行数 `275 → 275`；
3. postcheck：7 verified、1 not-applicable、267 residual，immutable digest 守恒；
4. actual recover：只在 expected-new-state 匹配时恢复 exact 8 行，recovered `8`；
5. final re-apply：expected `8`、actual `8`；
6. final postcheck：总行数仍为 `275`，non-attribution fields 与 unclassifiable 行未变化；
7. 同一 `--execute` command 再运行：actual `0`，证明实际 DML no-op 幂等；
8. PR #1192 corrective merge 后在 clean main 上使用原 manifest 再次 postcheck 通过，随后 actual execute 仍为 `0`；
9. PR #1194 tool-identity corrective merge 后再次使用原 manifest postcheck 通过，actual execute 仍为 `0`，证明 exact runner identity 门禁到达同一 final state 且没有重复写入。

未执行 `INSERT`、`DELETE`、Schema、Migration、DDL、Seed 或 historical guess update。

## Audit Reader Data Readiness

回填后只读复核为：

```text
POST_BACKFILL_TOTAL_ROW_COUNT=275
POST_BACKFILL_VERIFIED_COUNT=7
POST_BACKFILL_NOT_APPLICABLE_COUNT=1
POST_BACKFILL_ATTEMPTED_DENIAL_COUNT=0
POST_BACKFILL_UNCLASSIFIABLE_COUNT=267

VERIFIED_PAIR_COUNT=1
VERIFIED_PAIR_ROW_COUNTS=7
TARGET_SCOPE_ACTIVE=true
READER_QUERY_RETURNED_ROW_COUNT=7
AUDIT_READER_DATA_READINESS=false
```

机构 Reader 的正式 `tenantId + institutionId + institutionAttribution='verified'` 查询能够返回该 active target pair 的 7 条安全历史记录；但 267 条旧记录因缺少历史时点 provenance 必须保持不可分类，页面若把 7 条结果当作完整历史会形成不真实的 coverage 语义。因此 Historical Backfill 治理闭环为 true，Reader data readiness 仍为 false，二者不互相推导。

## 验证与 PR

```text
TOOLING_EXACT_FILE_COUNT=2
TOOLING_PR=1190
TOOLING_REQUIRED_CHECK=passed
TOOLING_ACTIONABLE_P0_P1=0

CORRECTIVE_EXACT_FILE_COUNT=2
CORRECTIVE_RUNTIME_PR=1192
CORRECTIVE_RUNTIME_HEAD=6661daac0b93848c58b995c2232fe8cbfb971464
CORRECTIVE_RUNTIME_MERGE=82c2c6e24dd7a8463a77e8270040d7536dd9ad1a
CORRECTIVE_REQUIRED_CHECK=passed
RUNNER_TEST_FILES=1
RUNNER_TESTS=36

SECOND_CORRECTIVE_EXACT_FILE_COUNT=2
SECOND_CORRECTIVE_RUNTIME_PR=1194
SECOND_CORRECTIVE_RUNTIME_HEAD=1d34c83c1f3d4af2bb66c2fbcacf41f833925c03
SECOND_CORRECTIVE_RUNTIME_MERGE=bdd74e8957efb8e14b46905e911ed8b32ee14298
SECOND_CORRECTIVE_REQUIRED_CHECK=passed

TARGETED_TEST_FILES=10
TARGETED_TESTS=128
FULL_TEST_FILES=494
FULL_TESTS=6745
TYPECHECK=passed
ARCHITECTURE_UNIT=148/148 passed
ARCHITECTURE_INCREMENTAL=passed
LINT=passed_with_4_existing_warnings
BUILD=passed
PRODUCTION_READINESS_DOCS=8/8 passed
GIT_DIFF_CHECK=passed

S11_POST_MERGE_P2_DETECTED=5
PR1190_RECOVERY_P2_THREAD=PRRT_kwDOSrGMn86Y9qqF
PR1190_RECOVERY_P2_THREAD_RESOLVED=true
PR1190_MANIFEST_PATH_P2_THREAD=PRRT_kwDOSrGMn86Y9qqL
PR1190_MANIFEST_PATH_P2_THREAD_RESOLVED=true
PR1191_REASON_AGGREGATE_P2_THREAD=PRRT_kwDOSrGMn86Y998t
PR1191_REASON_AGGREGATE_P2_THREAD_RESOLVED=true
PR1191_BACKFILL_PREREQUISITE_P2_THREAD=PRRT_kwDOSrGMn86Y998y
PR1191_BACKFILL_PREREQUISITE_P2_THREAD_RESOLVED=true
PR1192_TOOL_IDENTITY_P2_THREAD=PRRT_kwDOSrGMn86Y-m7M
PR1192_TOOL_IDENTITY_P2_THREAD_RESOLVED=true
S11_ACTIONABLE_P0_P1=0
POST_MERGE_REVIEW_DEBT=0
```

4 条 lint warning 均为本任务未修改文件中的既有 `<img>` 提示，没有 error。`ProductionReadinessDocs` 是既有 8-test regression；S11 manifest、输出低敏与 DML safety 由新增 runner tests 独立锁定，未错误声称该 docs regression 会扫描本报告。

## 保持的边界

```text
AUDIT_CALLER_MIGRATION_CLOSED=true
AUDIT_WRITER_ATTRIBUTION_CLOSED=true
HISTORICAL_BACKFILL_CLOSED=true
AUDIT_READER_DATA_READINESS=false
HISTORICAL_BACKFILL_REQUIRED_FOR_PAGE_RELEASE=true

DATABASE_ENVIRONMENT=local_development_only
DATABASE_HOST_CLASS=loopback
DATABASE_CONNECTION=true
DATABASE_WRITE_EXECUTION=true
SCHEMA_CHANGE=false
MIGRATION=false
DDL_EXECUTION=false

WORKBENCH_MULTI_CAPABILITY_SAFE=false
PAGE_SYSTEM_AUDIT_STATE=hidden/not_released
PAGE_SYSTEM_AUDIT_RELEASE=false
REVIEW_ACCEPTED_GOVERNED_PAGE_RELEASE_COUNT=1

PRODUCTION_CHANGE=false
PRODUCTION_DEPLOYMENT=false
```

下一任务只能是 `POST-V2-R1C Audit Reader Data Readiness / Workbench Multi-Capability prerequisite explicit authorization`。S11 不授权并且没有实施 Workbench、Capability Authority、`page_system_audit`、Staging 或 Production。
