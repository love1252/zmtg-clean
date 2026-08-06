# BASE-B4 全量入口 Guard／绕过闭环终检复算

> 日期：`2026-08-06`
>
> 审计基线：`5b85f1cd629fb2566b4bf0d2a6b36dbea07f67b9`
>
> 任务性质：全量静态复算、治理覆盖核验与完成候选判定
>
> 本任务不修改生产 Route、Guard、Reader、Runtime、Schema 或 Migration。

## 结论

```text
base02_b4_full_entry_bypass_final_recompute=passed
api_route_count=81
formal_page_count=2
formal_guarded_route_count=18
governed_fail_closed_route_count=63
ungoverned_route_count=0
high_risk_matrix_row_count=66
matrix_routes_now_formal_count=3
governance_digest_drift_count=0
customer_section_guard_wiring_count=3
customer_object_guard_wiring_count=3
remaining_unwired_customer_route_count=0
owner_outside_direct_writer_count=0
lifecycle_unresolved_count=0
base_b4_completion_candidate=true
base_b4_complete=false
base_b5_started=false
business_reader_release=false
business_capability_release=false
database_connection=false
migration_execution=false
dml_execution=false
production_change=false
next_task=BASE-B4 完成审计与 BASE-B5 historical orphan 处置分支决策前置规划
```

## 入口复算

- 机构 API Route：`81`；
- 当前正式 Guard Route：`18`；
- 已有明确 fail-closed 治理决策、尚未进入本轮实施的 Route：`63`；
- 未治理 Route：`0`；
- 高风险治理矩阵：`66` 条；
- 其中 `3` 条客户动态 Route 已从治理矩阵状态转为正式 Object Guard；
- 其余 `63` 条当前源码 SHA-256 与治理矩阵保持一致；
- `/hospital` 两个 Page 继续具备正式授权边界。

### 已转为正式 Object Guard 的治理矩阵入口

- `src/app/api/institution/customers/[customerId]/followup-overview/route.ts`
- `src/app/api/institution/customers/[customerId]/followup-timeline/route.ts`
- `src/app/api/institution/customers/[customerId]/timeline/route.ts`

## 客户对象 Route 收口

三条客户动态 Route 均满足：

- `sectionId=customers`；
- `objectType=customer`；
- `action=read`；
- `objectId=context.params.customerId`；
- Guard 失败统一低敏 `no-store 403`；
- genuine allow 后继续调用原 `no-store 503` capability-disabled Handler；
- 未开放客户业务读取。

## Membership／Binding 生命周期复算

- 前序误报校准仍有效；
- corrected Owner 外直接 Writer／Deleter：`0`；
- corrected lifecycle unresolved：`0`；
- 唯一 canonical Owner Repository 继续由 Access Control 持有；
- AQ008 继续覆盖 Drizzle、raw SQL、alias、barrel、generic sink 与 reverse caller；
- Trial Data Reset 继续固定关闭；
- Auth service 仍仅使用语义错误码，不接触受保护表。

## 完成候选判定

本轮静态证据满足 `base_b4_completion_candidate=true`。

该状态只表示 BASE-B4 已具备进入独立完成审计的候选条件，不得直接写成：

- BASE-B4 已完成；
- Reader 已放行；
- Capability 已发布；
- historical orphan 已处置；
- FK 已验证；
- BASE-B5 已启动。

## 唯一下一任务

`BASE-B4 完成审计与 BASE-B5 historical orphan 处置分支决策前置规划`
