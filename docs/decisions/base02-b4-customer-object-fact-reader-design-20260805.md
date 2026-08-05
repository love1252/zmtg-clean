# BASE-B4 客户对象事实 Reader 前置设计与准入

## 结论

```text
base02_b4_customer_object_fact_reader_design=approved
admission=approved_with_exact_allowlist
semantic_owner=src/modules/customers
customer_route_count=3
production_object_fact_reader_adapter_count=0
institution_runtime_object_fact_reader_null=true
customer_summary_updated_at_exposed=false
customer_summary_revision_exposed=false
schema_change_required=false
migration_required=false
implementation_allowlist_count=8
route_wiring_in_scope=false
business_capability_release=false
production_change=false
database_connection=false
migration_execution=false
dml_execution=false
base_b4_complete=false
base_b5_started=false
next_task=BASE-B4 客户对象事实 Reader 核心实施
```

## 所有权

权威架构将当前 `src/modules/customer-center` 迁移至
`src/modules/customers`，Customers 是客户稳定引用与责任归属的语义所有者。
`src/modules/institution` 继续作为 compatibility layer，并受
`freeze_new_business` 约束。

## 冻结契约

- scoped lookup：tenantId + institutionId + customerId；
- source projection：id、tenantId、institutionId、updatedAt；
- object type/action：customer/read；
- exact row：active；
- not-found 与 cross-scope：object_denied；
- revision：updatedAt epoch milliseconds 的正安全整数；
- observedAt：注入 clock 的 canonical UTC；
- source exception：object_unavailable；
- invalid timestamp/shape：object_invalid；
- freshness：沿用 Object Guard 60 秒窗口；
- 输出不含姓名、手机号、病历号、标签、备注或原始 row。

## 准入

核心实施获准严格修改 8 个文件。不得修改 Route、Schema、Migration、
journal、snapshot、Seed、package、lock、CI 或 Security 核心。
核心 Reader 实施完成后，业务 Capability 仍保持关闭。

## AQ007 架构修正

首次核心实施命中 `AQ007_CROSS_MODULE_SERVER_REPOSITORY`。Customers Application
不得直接依赖 Security Server implementation。修正后的依赖链为：

```text
Customers Application → Security Application façade → Security Server
```

新增 `src/modules/security/application/institution-object-fact-reader.ts`。
allowlist 由 7 修正为 8；不新增架构规则例外。

## 唯一下一任务

`BASE-B4 客户对象事实 Reader 核心实施`
