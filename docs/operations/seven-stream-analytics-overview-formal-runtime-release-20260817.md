# Analytics Overview Formal Runtime Release

- 日期：2026-08-17
- 任务：`ANALYTICS_OVERVIEW_FORMAL_RUNTIME_RELEASE`
- 基线：`41d0df8ee690307bea25f825686d671e32ac0c6a`
- 页面：`/hospital/analytics`
- API：`/api/v1/institution/analytics`
- Capability：`page_analytics_overview`

## 结论

```text
ANALYTICS_FORMAL_FACT_MODEL=ready
ANALYTICS_FORMAL_SCOPE_READY=true
ANALYTICS_OPERATING_CONTEXT_READY=true
ANALYTICS_FORMAL_READ_AUTHORIZATION=ready
ANALYTICS_FORMAL_REPOSITORY=ready
ANALYTICS_FORMAL_READER=ready
ANALYTICS_V1_API=ready
ANALYTICS_CANONICAL_PAGE=ready
ANALYTICS_CAPABILITY_AUTHORITY=read_only/pilot_released
ANALYTICS_DATA_READINESS=ready_empty
```

## 时间口径

服务端固定 `preset=month`。本月为机构本地自然月首日至 `asOf` 当日结束；
上一周期为紧邻本月开始之前的等长本地日历周期。客户端不能提交 `custom`、
起止日期或其他时间筛选。

## 指标

仅发布五项确定性只读指标，按币种独立分区：

- 成功实付 `paidAmountMinor`
- 确认退款 `refundAmountMinor`
- 净额 `netAmountMinor`
- 付费客户 `paidCustomerCount`
- 客单价 `averageNetAmountPerPaidCustomer`

不跨币种求和；不可用值返回 `null/--`，不伪造 0。

## 权威空态

Fresh re-admission 确认当前正式 source/batch/fact 均为 0。页面发布可信 empty，
不使用 `tenant_commercial_records`、治疗摘要、预约、客户资料或 demo/seed 补数。

## 授权

只允许 `tenant_admin` 与 `tenant_operator`。`consultant`、`customer_service`
深链接 fail-closed。formal session → membership → scope/binding → analytics section
→ one-shot pair 后才允许读取 exact institution facts。

## 边界

```text
DATABASE_TRANSACTION_READ_ONLY=true
DATABASE_WRITE_EXECUTION=false
SCHEMA_CHANGE=false
MIGRATION_EXECUTION=false
DDL_EXECUTION=false
DML_EXECUTION=false
DATA_SEED=false
DATA_BACKFILL=false
CUSTOM_TIME_WINDOW=false
EXPORT=false
AI_REPORT=false
CONTROLLED_CREATE=false
STAGING_CHANGE=false
PRODUCTION_CHANGE=false
PRODUCTION_DEPLOYMENT=false
```
