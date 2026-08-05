# BASE-B4 客户对象事实 Reader 核心实施独立审查

> 日期：`2026-08-06`
>
> AQ007 修正规范 PR：#1009
>
> AQ007 修正规范 Merge Commit：`f30ce93ae33503ae809fa9a7bdd31c9fe9958a7e`
>
> 被审查实施 PR：#1010
>
> 被审查 Head：`72833a8107fa12f5b97be82ac96cd22e3ccd8f9e`
>
> 被审查 Merge Commit：`d1608b0898689b2fb9fd0ef135719b44f41024c7`
>
> Required Check：Run `31026758287`

## 结论

```text
base02_b4_customer_object_fact_reader_core_review=passed
implementation_file_count=8
security_application_facade=implemented
architecture_exception_count=0
customer_object_fact_reader=implemented
customer_object_fact_reader_genuine=true
customer_scoped_bridge=tenant+institution+customer
revision_source=customers.updatedAt
not_found_cross_scope=object_denied
source_exception=object_unavailable
invalid_source=object_invalid
runtime_object_fact_reader_wired=true
runtime_object_fact_reader_lazy=true
production_object_fact_reader_adapter_count=1
customer_route_wiring_count=0
business_capability_release=false
schema_change=false
migration_change=false
seed_change=false
database_connection=false
dml_execution=false
eligible_for_handoff=true
base_b4_complete=false
base_b5_started=false
```

## 核对

- PR #1010 严格修改 8 个获准文件；
- Customers Application 不直接依赖 Security Server；
- Security Application façade 在 Security 模块内封装 genuine factory；
- 未新增 AQ007 架构规则例外；
- legacy repository 只输出 id、tenantId、institutionId、updatedAt；
- Reader 不暴露客户画像或原始 row；
- not-found、cross-scope、异常与非法 timestamp 均 fail-closed；
- Runtime 仅在真实 Object 授权时读取客户对象；
- Section 授权不会读取客户对象；
- customer Route wiring 仍为 0，业务 Capability 继续关闭。

## 元数据修正

首次 PR 创建时，shell heredoc 中的反引号被错误解释，导致 PR #1010
“唯一下一任务”正文缺失。该问题不影响提交、Actions 或 Merge Commit；
恢复流程已尝试修复 PR 正文，权威下一任务仍由 handoff 文档发布。

## 验证

独立审查重新执行定向测试、架构检查、全量测试、lint、typecheck 与 build。
