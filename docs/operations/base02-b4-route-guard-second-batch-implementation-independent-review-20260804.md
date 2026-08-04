# BASE-B4 第二批正式 Route Guard 接线实施独立审查

> 日期：`2026-08-04`
>
> 被审查 PR：#970
>
> 被审查 Head：`edbdc4785ce5ba2c36a9d8fecba5dbb3cf4e02e8`
>
> 被审查 Merge Commit：`9fb9fb90b81bdae9a8195feab96ef302180546df`
>
> Required Check：Run `30905532792`／Job `91979613368`

## 1. 结论

```text
base02_b4_route_guard_second_batch_implementation_review=passed
second_batch_route_count=5
guard_chain=scope+section
guard_denial=403_no_store
authorized_handler_contract=preserved_503_capability_off
production_route_count=5
colocated_test_count=5
compatibility_test_count=5
changed_file_count=15
shared_guard_change_count=0
action_guard_connection_count=0
object_guard_connection_count=0
business_reader_release=false
business_capability_release=false
schema_change=false
migration_change=false
database_connection=false
eligible_for_second_batch_handoff=true
base_b4_complete=false
base_b5_started=false
```

## 2. 文件范围

PR #970 严格修改 15 个冻结文件：

- 5 个生产 Route；
- 5 个 colocated 接线测试；
- 5 个既有 handler-contract 兼容性测试。

共享 Guard `src/app/api/institution/_shared/institution-route-guard.ts` 的 blob 保持为：

`7cf91c13cec94e5e6bf659b4e0a9f7a8b980cebe`

未修改 Schema、Migration、journal、snapshot、业务 Reader、业务服务或数据库实现。

## 3. 第二批 Route

1. `audit-events` → `system`
2. `followup-message-templates` → `care`
3. `followup-paths/templates` → `care`
4. `knowledge-management/qa/audits` → `knowledge`
5. `wecom/external-contacts` → `conversations`

每个 Route 均执行：

```text
Request
→ genuine InstitutionRequestAuthorization
→ Scope Guard
→ Section Guard
→ existing capability-off handler
```

## 4. 行为核对

- 无 genuine authorization、Scope／Section 拒绝、错误 section 或异常：`403 / no-store`；
- 拒绝时原 handler 不执行；
- 允许时原 handler 执行一次；
- 原 `503 capability-off` payload 和 no-store contract 保持；
- 未接入 Action Guard 或 Object Guard；
- 未开放业务 Reader、对象事实 Adapter 或新 Capability；
- 5 个既有 handler-contract 测试只 mock 共享 Guard 边界，没有绕过生产接线。

## 5. 验证

实施阶段已确认：

- 架构检查器自测：148／148；
- 完整测试：446 files／6409 tests；
- lint：0 errors，4 个既有 `<img>` warning；
- typecheck：通过；
- production build：通过；
- Required Check：成功。

本次独立审查重新执行完整测试、架构门禁、lint、typecheck 和 build。

## 6. 持续阻断

- 原校准中仍有 4 个低风险候选需要重新确认；
- 动态对象、写 Route、凭证、HIS、上传下载、解析、索引和外部触达仍未准入；
- 业务 Reader／Capability 仍关闭；
- historical orphan 与 Scope FK 未处理；
- BASE-B4 尚未完成；
- BASE-B5 尚未启动。
