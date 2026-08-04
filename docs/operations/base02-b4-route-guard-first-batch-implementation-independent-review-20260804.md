# BASE-B4 第一批正式 Route Guard 接线实施独立审查

> 日期：`2026-08-04`
>
> 被审查 PR：#964
>
> 被审查 Head：`4f574652f1e833e6a73e0f47496bfd34391416e1`
>
> 被审查 Merge Commit：`7798926a8f81475de9ba8f9155fab74972c01892`
>
> Required Check：Run `30864616988`／Job `91853655436`

## 1. 结论

```text
base02_b4_route_guard_first_batch_implementation_review=passed
first_batch_route_count=5
guard_chain=scope+section
guard_denial=403_no_store
authorized_handler_contract=preserved
production_file_count=6
test_file_count=14
changed_file_count=20
legacy_handler_test_isolation_count=8
frozen_institution_module_production_additions=0
cross_module_server_dependency_violations=0
business_reader_release=false
business_capability_release=false
schema_change=false
migration_change=false
database_connection=false
eligible_for_first_batch_handoff=true
base_b4_complete=false
base_b5_started=false
```

## 2. 范围校正审查

前置预检最初冻结 12 个文件。实施过程中，统一 Guard 最终落在
`src/app/api/institution/_shared`，避免冻结的 Institution 模块新增生产文件和
跨模块 server 实现依赖。

最终范围为 20 个文件：

- 6 个生产文件：5 个 GET-only Route 与 1 个共享 Route Guard；
- 6 个 colocated／共享 Guard 测试；
- 8 个既有 handler-contract 回归测试。

新增的 8 个测试文件修改只用于隔离“共享 Guard 组合行为”与“原 capability-off handler
契约”，没有绕过生产 Guard，也没有扩大生产实现范围。

## 3. Guard 契约

每个第一批 Route 均执行：

```text
Request
→ resolveInstitutionServerAuthorizationV1
→ genuine InstitutionRequestAuthorization
→ authorizeCurrentInstitutionSectionV1
→ genuine Section Allow
→ existing handler
```

独立核对结果：

- 无 genuine authorization、Section 拒绝、错误 section 或异常均返回 `403`；
- 拒绝响应固定为 `no-store`；
- 拒绝时原 handler 不执行；
- 通过时原 handler 精确执行一次，原 Response 对象保持不变；
- 5 个 Route 均没有 action／object Guard 伪接线；
- 未增加业务 Reader、对象事实 Adapter 或新业务 Capability。

## 4. 第一批 Route

1. `src/app/api/institution/entitlement-usage/route.ts` → `system`
2. `src/app/api/institution/knowledge-management/ai-call/usage/route.ts` → `knowledge`
3. `src/app/api/institution/knowledge-management/retrieval/route.ts` → `knowledge`
4. `src/app/api/institution/knowledge-management/search/route.ts` → `knowledge`
5. `src/app/api/institution/knowledge-management/vector-search/route.ts` → `knowledge`

均为 GET-only、非动态对象、无直接数据库接线的 capability-off Route。

## 5. 验证

实施证据与本次独立复核确认：

- 架构检查器自测：148／148；
- 完整测试：441 files／6404 tests；
- lint：0 errors，4 个既有 `<img>` warning；
- typecheck：通过；
- production build：通过；
- Required Check：成功。

## 6. 持续阻断

- 业务 Reader／Capability 仍关闭；
- 动态对象 Route、写 Route、凭证、HIS、上传下载和外部触达未进入本批；
- historical orphan 与 Scope FK 未处理；
- BASE-B4 尚未完成；
- BASE-B5 尚未启动。
