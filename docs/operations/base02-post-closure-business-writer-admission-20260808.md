# BASE-02 post-closure business Writer dual-write / old Writer blockade admission

> 日期：`2026-08-08`
>
> Base：`f1f461e43f4156ad50a21411ddf7091b54056da6`
>
> 状态：`admission_passed`

## 前置

`BASE02_COMPLETE=true`；Reader/Capability 继续关闭。

## 本轮静态盘点

```text
TOTAL_MUTATION_CANDIDATE_FILES=75
BUSINESS_WRITER_SURFACE_FILES=27
BYPASS_SURFACE_REVIEW_FILES=3
EXCLUDED_FOUNDATION_OWNER_FILES=9
LATER_OR_OUTSIDE_PHASE_FILES=36
TENANT_PLUS_INSTITUTION_SHAPE_FILES=16
TENANT_ONLY_SHAPE_REVIEW_FILES=4
MIXED_ATTRIBUTION_SHAPE_REVIEW_FILES=11
UNRESOLVED_TABLE_REFERENCE_FILES=33
FIRST_RECOMMENDED_SLICE=W1_CUSTOMERS_MESSAGING
```

逐文件证据：

- `docs/operations/base02-post-closure-business-writer-inventory-20260808.csv`
- `docs/operations/base02-post-closure-business-writer-slice-matrix-20260808.csv`

静态命中是准入候选，不等于逐文件缺陷结论。

## dual-write 定义

本阶段不是第二数据库/第二事实源。对 institution-scoped business fact，canonical Writer 必须同时持有并持久化：

```text
tenantId + institutionId
```

tenant/institution 只能来自 server-side verified context；禁止客户端声明、默认机构、first-institution fallback。create 必须同时归属；update/delete 必须同时按 tenant+institution 约束；attribution 不完整必须 fail-closed。

## slice

```text
W1 Customers / Customer-Messaging
W2 Care
W3 Knowledge
W4 Conversations / Messaging
W5 Analytics
W6 Institution System
W7 Legacy Institution Aggregate residual review
W8 Platform review
W9 Audit later
W10 Workspace projection review
```

Access Control / Identity / Tenancy foundation Writer 排除，不重复改造 BASE-02。

`slice-matrix` 冻结的是**当前 mutation surface 精确路径**，不是 Runtime 实现授权。未来如需新增 Owner service/repository/test，必须在独立 slice 中逐文件冻结；范围外第 N 个文件必须停止并重新准入。

## old Writer / bypass terminal policy

只允许：

```text
delegate_to_canonical_owner
or
fail_closed_disabled
```

Seed / import / reset / maintenance / raw SQL / legacy aggregate / shared generic mutation sink 不得保留第三条并行 Writer。

## 本轮禁止

Runtime 修改、数据库连接、DDL/DML/Migration/Seed/FK VALIDATE、Reader/Capability、physical FK ADR、生产变更均为 0。

## 结论

```text
business_writer_admission=passed
writer_static_inventory=complete
vertical_slice_matrix=frozen
existing_writer_surface_exact_paths=frozen
business_writer_implementation_authorized=false
reader_release=false
capability_release=false
physical_fk_strategy_resolved=false
fk_validate=false
```

下一任务：`W1_CUSTOMERS_MESSAGING` 逐符号复核、implementation exact allowlist 冻结与代码授权决策。
