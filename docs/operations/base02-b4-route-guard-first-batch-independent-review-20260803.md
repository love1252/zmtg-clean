# BASE-B4 第一批 Route Guard 接线前置预检独立审查

> 日期：`2026-08-03`
>
> 被审查 PR：#961
>
> 被审查 Head：`ff57722e6534162581a1792be3272f3fe0bbd1d0`
>
> 被审查 Merge Commit：`e18dab5e96540a0ccd7b58fbd1110bdd652cedac`
>
> Required Check：Run `30823507423`／Job `91719099999`

## 1. 结论

```text
base02_b4_route_guard_first_batch_independent_review=passed
first_batch_count=5
first_batch_guard_chain=scope+section
first_batch_write_method_count=0
first_batch_dynamic_object_count=0
first_batch_direct_db_count=0
first_batch_demo_signal_count=0
business_reader_release=false
business_capability_release=false
implementation_allowlist_count=12
eligible_for_handoff=true
base_b4_complete=false
base_b5_started=false
```

## 2. 独立核对

- 原始清单 116 项已按平台、demo、维护、正式入口和机构 Route 重新分层；
- 第一批只包含 GET-only、非动态、无直接数据库、无 demo signal 的机构 Route；
- 第一批路径：`['src/app/api/institution/entitlement-usage/route.ts', 'src/app/api/institution/knowledge-management/ai-call/usage/route.ts', 'src/app/api/institution/knowledge-management/retrieval/route.ts', 'src/app/api/institution/knowledge-management/search/route.ts', 'src/app/api/institution/knowledge-management/vector-search/route.ts']`；
- 第一批 section：`['knowledge', 'system']`；
- 第一批不需要业务对象事实，因此不误用 Object Guard；
- 接线固定为 genuine Session → request authorization → Section Guard → 原 handler；
- 拒绝时原 handler、数据库和外部调用均不得执行；
- 成功响应 contract、业务查询与缓存语义不得改变；
- 精确 allowlist 为 12 个文件；
- 本审查不开放业务 Reader 或 Capability。

## 3. 准入

只准入：

`BASE-B4 第一批低风险正式 Route Guard capability-off 接线实施`

不得扩大至动态对象 Route、写 Route、凭证、上传下载、HIS 或外部触达。
