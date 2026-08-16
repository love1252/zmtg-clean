# SYS-01 AI 使用只读 post-Wave01 Runtime Release

> 日期：2026-08-16
> 基线：`ac6506edaf2d97fabe59b132ca6ea6f119f6b19d`
> 业务线：`system`
> 切片：`SYS_01_AI_USAGE_READONLY`
> 性质：正式 institution-scoped read-only Runtime pilot release

## 1. Fresh Admission 事实

2026-08-16 Fresh Re-admission 已在：

`127.0.0.1:55434/zmtg_clean_local_dev_candidate`

通过 transaction-read-only 审计证明：

```text
SYS01_REQUIRED_SCHEMA_SHAPE=ready

AI_USAGE_TOTAL_ROW_COUNT=0
NULL_TENANT_SCOPE_ROW_COUNT=0
NULL_INSTITUTION_SCOPE_ROW_COUNT=0
ORPHAN_TENANT_ROW_COUNT=0
ORPHAN_INSTITUTION_ROW_COUNT=0

TARGET_TENANT=growth-tenant-chengxing
TARGET_INSTITUTION=growth-inst-chengxing
TARGET_PAIR_AI_USAGE_ROW_COUNT=0
TARGET_ACTIVE_FORMAL_SCOPE_COUNT=1

SYS01_DATA_READINESS=ready_empty
SYS01_FORMAL_SCOPE_READY=true
SYS01_RUNTIME_ADMISSION_READY=true
```

0-row cohort 是可信空状态，不通过 Seed、DML backfill 或伪造 AI usage 数据补齐。

## 2. 正式 Runtime

Canonical API：

`GET /api/v1/institution/ai-service-usage`

Canonical Page：

`/hospital/system/ai-usage`

Capability：

`page_system_ai_usage`

正式链：

```text
formal signed server session
→ authoritative Identity
→ active Membership + Account→Institution Binding
→ active formal Institution Scope
→ system management audience
→ dedicated one-shot AI usage read authorization
→ exact tenant/institution pair
→ Analytics owner-specific source
→ institution-system authoritative metrics Reader
→ low-sensitive DTO
```

角色：

```text
tenant_admin=allowed
tenant_operator=allowed
consultant=forbidden
customer_service=forbidden
```

## 3. Ownership

```text
AI_USAGE_FACT_OWNER=src/modules/analytics
AI_USAGE_READ_SOURCE_OWNER=src/modules/analytics/server
AI_USAGE_READ_MODEL_OWNER=src/modules/institution-system
AI_USAGE_COMPOSITION_OWNER=src/server/orchestration
AI_USAGE_PRESENTATION_OWNER=src/modules/institution-system + src/app
```

Legacy：

`/api/institution/ai-service-usage`

保持原 410 capability-off compatibility surface，不转发到 V1。

## 4. 数据与输出边界

Source 只投影：

```text
tenantId
institutionId
status
serviceCategory
serviceAction
createdAt
```

正式输出只包含：

```text
totalCallCount
serviceUnits
failureCount
rejectionCount
incompleteCount
successRate
byServiceKey
```

当前正式 Source 不读取 `aiCreditsConsumed`。因此任何无法被正式 Reader 证明的 service unit 继续为 `null`。

特别冻结：

```text
EMPTY_COHORT_TOTAL_CALL_COUNT=0
EMPTY_COHORT_SERVICE_UNITS=null
```

## 5. Time window

只允许 server-owned fixed presets：

```text
today
last7days
currentMonth
lastMonth
```

默认：

`currentMonth`

禁止：

```text
custom
from
to
arbitrary epoch
client tenantId
client institutionId
unknown query
duplicate preset
```

业务时区复用现有 Product Operating Context 默认：

`Asia/Shanghai`

若该正式 product-default 未来改变，当前实现 fail-closed，不自造 timezone authority。

## 6. Capability Authority

最终 governed readonly pilot pages：

```text
page_workbench
page_customer_list
page_care_appointments
page_system_ai_usage
page_system_audit
```

`page_system_ai_usage`：

```text
decision=read_only
codeMaturity=verified
institutionAuthorization=authorized
connectionAvailability=not_required
dataReadiness=ready
productionRelease=pilot_released
safeSummary=AI 使用统计仅供查看
```

Controlled Create 继续：

```text
CONTROLLED_CREATE_RELEASE_COUNT=0
```

## 7. 边界

```text
DATABASE_CONNECTION=false
DATABASE_WRITE_EXECUTION=false
SCHEMA_CHANGE=false
MIGRATION_EXECUTION=false
DDL_EXECUTION=false
DML_EXECUTION=false
SEED_EXECUTION=false
STAGING_CHANGE=false
PRODUCTION_CHANGE=false
PRODUCTION_DEPLOYMENT=false
```

本 Release 是 repository/code-owned readonly pilot release，不代表生产部署。


## 8. Same-task corrective：empty serviceUnits 边界

Targeted test 首轮发现，既有 authoritative metrics snapshot 对内部空聚合
保持历史契约 `serviceUnits=0`。SYS-01 不扩大到
`ai-usage-metrics-snapshot.ts`，也不修改既有 domain/snapshot 语义。

最终边界调整为：

```text
AUTHORITATIVE_EMPTY_METRICS_INTERNAL_SERVICE_UNITS=0
SYS01_EXTERNAL_EMPTY_SERVICE_UNITS=null
SYS01_EMPTY_PAGE_METRIC_CARD_RENDERED=false
SYS01_NONEMPTY_UNMETERED_SERVICE_UNITS=null
```

即：authoritative Reader 内部继续满足既有快照契约；SYS-01 orchestration
只在 `totalCallCount=0` 时把对外低敏 DTO 的 `serviceUnits` 归一化为
`null`。页面在 empty cohort 下只显示“暂无正式 AI 使用记录”，不展示
任何“0 个额度/0 个服务单位”指标卡。

本 corrective 没有新增文件、没有扩张 Owner、没有 Schema/Migration/DB write。
原计划中的 `ai-usage-metrics.ts` 与 `AiUsageMetricsDomain.test.ts`
恢复为基线，因此最终 exact scope 从 20 收紧为 18。


## 9. Same-task corrective：TSX type assertion parser

第二轮 Targeted test 仅剩一个 TSX transform error：
`AiUsageReadonlyShell.tsx` 中 `item.serviceKey as keyof typeof serviceLabels`
被换行拆分，esbuild 在 computed property 内无法解析。

本 corrective 仅在既有 exact-18 文件
`src/modules/institution-system/components/AiUsageReadonlyShell.tsx`
内把 type assertion 收拢为单个合法 TypeScript 表达式；不改变 Runtime
业务语义、不新增文件、不扩大 allowlist。


## 10. Same-task corrective：page safety test false positive

第三轮 Targeted test 的唯一失败并非 Runtime 泄漏，而是页面源码安全测试中的
`append\(` 规则误命中合法的 `URLSearchParams.append()`。

本 corrective 仅收窄测试规则：继续禁止 legacy client、AI usage command
repository、create mutation、高敏技术字段与 create query，但不再把
`URLSearchParams.append()` 视为业务写入。

```text
RUNTIME_PRODUCTION_CHANGE_FOR_THIS_CORRECTIVE=false
TEST_FALSE_POSITIVE_CORRECTED=true
EXACT_SCOPE_EXPANSION=false
```


## 11. Same-task corrective：preset TypeScript narrowing

第四轮验证中 Targeted tests 已达到 `8/8 files, 88/88 tests`，
随后 TypeScript 在 `parseQuery()` 对 `rawPresets[0]` 的返回值收窄上报
`TS2322`。业务逻辑本身已由 Targeted tests 通过。

本 corrective 将 `Array.some()` 后直接返回原始 `string` 的写法改为
从冻结 `presets` tuple 使用 `find()` 返回已收窄的
`InstitutionAiUsagePresetV1 | undefined`，再以 `?? null` 收口。

```text
TARGETED_TESTS_BEFORE_CORRECTIVE=88/88_passed
TYPECHECK_BLOCKER=TS2322_preset_narrowing
RUNTIME_SEMANTICS_CHANGED=false
EXACT_SCOPE_EXPANSION=false
```
