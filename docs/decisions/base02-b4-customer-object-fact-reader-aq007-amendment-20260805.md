# BASE-B4 客户对象事实 Reader AQ007 架构修正

## 结论

```text
base02_b4_customer_object_fact_reader_aq007_amendment=approved
trigger=AQ007_CROSS_MODULE_SERVER_REPOSITORY
forbidden_edge=customers/application->security/server
approved_edge=customers/application->security/application
security_same_module_edge=security/application->security/server
implementation_allowlist_count=8
architecture_exception_count=0
route_wiring_in_scope=false
security_policy_change=false
schema_change=false
migration_change=false
database_connection=false
dml_execution=false
next_task=BASE-B4 客户对象事实 Reader 核心实施
```

## 修正

新增 Security-owned Application façade：
`src/modules/security/application/institution-object-fact-reader.ts`。
Customers 只依赖该 façade；Security Application 在同模块内调用 Security Server。
不修改架构规则配置。

## 持续边界

- 不修改 Route、Object Guard、Action Policy、Schema、Migration 或 Seed；
- 不连接数据库，不执行 DDL、DML 或 Migration；
- 不开放业务 Capability。
