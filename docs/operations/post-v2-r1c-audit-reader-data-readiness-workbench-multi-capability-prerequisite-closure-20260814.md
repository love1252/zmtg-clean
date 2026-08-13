# POST-V2-R1C Audit Reader Data Readiness / Workbench Multi-Capability 前置条件闭环

## 结论

S12 已完成 Audit Reader 覆盖诚实性与 Workbench 多 capability composition 两项前置条件。当前 Reader 有安全可读的 7 条 `verified` 记录，但 267 条历史记录无法恢复可信机构归因，因此正式状态不是“完整历史就绪”，而是 `partial_verified_only`。Workbench 已改为按 `capabilityKey='page_workbench'` 精确选择自身投影，不再因未来第二条合法摘要丢弃 Workbench，也不会把第二 capability 内容渲染进 Workbench。

本阶段没有放行 `page_system_audit`，没有修改 production Capability Authority、导航或受治理页面计数。

```text
STAGE=S12
TASK=POST_V2_R1C_AUDIT_READER_DATA_READINESS_WORKBENCH_MULTI_CAPABILITY_PREREQUISITE
COMPLETION_MODE=COMPLETE

BASELINE=f44fe53b49418344e8157c92b6b8d4fa8c8a8853
RUNTIME_PR=1195
RUNTIME_HEAD=52914e1d4c81b9444878ed41553a4bd44864cdd6
RUNTIME_MERGE=9cf3ac78bbd0bafdcbf4c56afd4af8f2badf84df
RUNTIME_REQUIRED_CHECK=passed
RUNTIME_ACTIONABLE_P0_P1=0

DATABASE_ENVIRONMENT=local_development_only
DATABASE_HOST_CLASS=loopback
DATABASE_CONNECTION=true
DATABASE_WRITE_EXECUTION=false

CURRENT_AUDIT_TOTAL_ROW_COUNT=275
CURRENT_VERIFIED_ROW_COUNT=7
CURRENT_NOT_APPLICABLE_ROW_COUNT=1
CURRENT_ATTEMPTED_DENIAL_ROW_COUNT=0
CURRENT_UNCLASSIFIABLE_HISTORICAL_ROW_COUNT=267
CURRENT_VERIFIED_PAIR_COUNT=1
TARGET_VERIFIED_READABLE_ROW_COUNT=7

AUDIT_READER_SAFE_DATA_AVAILABLE=true
AUDIT_READER_COVERAGE_STATE=partial_verified_only
AUDIT_READER_HISTORICAL_COVERAGE_COMPLETE=false
AUDIT_READER_PARTIAL_COVERAGE_SAFE=true
AUDIT_READER_DATA_READINESS=partial_safe

WORKBENCH_MULTI_CAPABILITY_SAFE=true
WORKBENCH_PAGE_WORKBENCH_PROJECTION_STABLE=true

RUNTIME_CHANGED_FILE_COUNT=7
TEST_CHANGED_FILE_COUNT=7
DOC_CHANGED_FILE_COUNT=5

TARGETED_TEST_FILES=12
TARGETED_TESTS=231
FULL_TEST_FILES=494
FULL_TESTS=6769
POST_MERGE_INDEPENDENT_TEST_FILES=10
POST_MERGE_INDEPENDENT_TESTS=248

TYPECHECK=passed
ARCHITECTURE_UNIT=148/148 passed
ARCHITECTURE_INCREMENTAL=passed
LINT=passed_with_4_existing_warnings
BUILD=passed
PRODUCTION_READINESS_DOCS=8/8 passed

HISTORICAL_BACKFILL_CLOSED=true
HISTORICAL_BACKFILL_REQUIRED_FOR_PAGE_RELEASE=true

SCHEMA_CHANGE=false
MIGRATION=false
DDL_EXECUTION=false
DML_EXECUTION=false

PAGE_SYSTEM_AUDIT_STATE=hidden/not_released
PAGE_SYSTEM_AUDIT_RELEASE=false
REVIEW_ACCEPTED_GOVERNED_PAGE_RELEASE_COUNT=1

PRODUCTION_CHANGE=false
PRODUCTION_DEPLOYMENT=false
```

## Fresh Reader 数据证据

在 `main` 合并前后均只连接 local-development loopback PostgreSQL，并使用显式 `READ ONLY` transaction。最终只读 postcheck 为：

- 总行数 275；
- `verified=7`、`not_applicable=1`、attempted denial 0；
- `NULL/NULL` 不可分类历史记录 267；
- `verified` pair 只有 1 个，目标 pair 可读 7 行；
- 不输出 pair、事件 ID、数据库名、凭据或原始 provenance；
- 未执行任何写入。

S11 的 267 条 `UNCLASSIFIABLE` 是最终安全治理结果，不是遗漏 backfill。S12 不猜测归因，也不把这些记录当作不存在。

## Coverage contract

正式 response 只允许四个低敏字段：

```text
state
safeDataAvailable
historicalCoverageComplete
partialCoverageSafe
```

状态进入条件：

- `complete`：目标租户不存在不可分类历史 residual；`historicalCoverageComplete=true`、`partialCoverageSafe=false`。当 verified 行为 0 时，这才构成 authoritative empty；
- `partial_verified_only`：目标租户仍存在不可分类历史 residual；只展示可信 `verified` institution subset，未归因旧记录不被猜测纳入；
- `unavailable`：正式 scope、coverage facts、Reader query 或 response contract 任一不可验证时，沿用既有 503 fail-closed 边界，不伪装为空集合；
- `authoritative_empty` 不新增独立枚举；它由 `state=complete + safeDataAvailable=false + records=[]` 精确派生，避免与“当前筛选无 verified 记录”混淆。

`AUDIT_READER_DATA_READINESS` 不再作为真假不明的 boolean；正式值为 `partial_safe`，精确定义是“存在安全可读的 verified subset，但不能声明完整历史覆盖”。

Repository 只在正式 tenant scope 内聚合目标 institution 的 `verified` 数量与历史 residual 是否存在；API 不返回原始计数、tenant、institution、SQL、manifest 或 provenance。Client 要求 coverage 对象恰好包含四个字段；任何 extra key 或不一致状态均失败关闭。Shell 明确显示可信 subset 与历史覆盖不完整，页内统计不再暗示完整历史总量。

## Workbench 多 capability 安全性

`/hospital` 不再要求整个 projection 恰好只有一条 summary。它会：

1. 只接受 `projected` 且没有 quick-create 的既有只读投影；
2. 按 key 查找 `page_workbench`，要求恰好一条；
3. 验证该条仍是既有 `page/read_only/工作台仅供查看` 契约；
4. 构造只含该 summary 的 scoped projection 交给 Workbench shell。

测试锁定了：仅 Workbench、Workbench 加第二 summary、顺序反转、duplicate、missing、hidden capability、无关第二 capability 与 `/hospital` 回归。duplicate/missing 均 fail-closed；第二 capability 的摘要绝不会进入 Workbench DOM。Production Authority 仍只放行 `page_workbench`，`page_system_audit` 只存在于测试输入模拟。

## 验证与边界

- 定向 Reader、Platform、Workbench、Capability Authority 与文档测试：12 files / 231 tests；
- 全量：494 files / 6769 tests；
- 合并后独立 Reader/Workbench 回归：10 files / 248 tests；
- typecheck、AQ unit 148/148、Architecture incremental、lint、build、ProductionReadinessDocs 与 `git diff --check` 均通过；
- lint 只有 4 条本阶段未触碰文件的既有 `no-img-element` warning；
- PR #1195 Required Check 成功，合并前与合并后均无 S12 Review thread。

未修改 Schema、Migration、DDL、DML、Seed、production Capability Authority、`page_system_audit` release、Staging 或 Production。

## 唯一下一任务

`POST-V2-R1C page_system_audit fresh release re-audit + exact Runtime re-admission explicit authorization`

S12 只闭合前置条件，不构成页面放行授权。
