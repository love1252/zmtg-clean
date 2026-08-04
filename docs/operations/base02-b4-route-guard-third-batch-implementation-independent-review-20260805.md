# BASE-B4 第三批正式 Route Guard 接线实施独立审查

> 日期：`2026-08-05`
>
> 被审查 PR：#982
>
> 被审查 Head：`0f40ef5f1880a18aabc2a70df5b5f37023f119cb`
>
> 被审查 Merge Commit：`772af8bd31bcf8e2a3998133bee996d419eed1f8`
>
> Required Check：Run `30932954393`／Job `92071902179`

## 1. 结论

```text
base02_b4_route_guard_third_batch_implementation_review=passed
third_batch_route_count=4
guard_chain=scope+section
guard_denial=403_no_store
authorized_handler_contract=preserved_503_capability_off
production_route_count=4
colocated_test_count=4
compatibility_test_count=7
changed_file_count=15
shared_guard_change_count=0
v1_reexport_change_count=0
action_guard_connection_count=0
object_guard_connection_count=0
business_reader_release=false
business_capability_release=false
schema_change=false
migration_change=false
database_connection=false
eligible_for_third_batch_handoff=true
base_b4_complete=false
base_b5_started=false
```

## 2. 范围与校正链

第三批正式实施前经过两轮影响面校正：

- PR #976～#978：补充 v1 re-export 传递兼容性测试；
- PR #979～#981：补充 TreatmentSummaryList 与
  WeComCustomerMappingReadWriteBridge 两个直接 handler-contract 测试；
- 最终实施 PR #982：严格 15 个文件。

最终范围：

- 4 个生产 Route；
- 4 个 colocated 接线测试；
- 7 个既有 handler／v1 re-export 兼容性测试。

共享 Guard 与 v1 re-export 均未修改。

## 3. 第三批 Route

1. `followup-operations/dashboard` → `care`
2. `treatment-summaries` → `care`
3. `wecom-official-dry-run` → `conversations`
4. `wecom/customer-mapping-candidates` → `conversations`

每个 Route 均执行：

```text
Request
→ genuine InstitutionRequestAuthorization
→ Scope Guard
→ Section Guard
→ existing capability-off handler
```

## 4. 行为核对

- 无 genuine authorization、Scope／Section 拒绝、错误 section 或异常：
  `403 / no-store`；
- 拒绝时原 handler 不执行；
- 允许时原 handler 执行一次；
- 原 `503 capability-off` payload 与 no-store contract 保持；
- 未接 Action Guard 或 Object Guard；
- 未开放业务 Reader、对象事实 Adapter 或新 Capability；
- v1 dry-run 入口继续精确 re-export canonical GET，并保持函数引用一致；
- 7 个兼容性测试只隔离共享 Guard 边界，不绕过生产接线。

## 5. 验证

实施与本次独立复核确认：

- 架构检查器自测：148／148；
- 完整测试：446 files／6409 tests；
- lint：0 errors，4 个既有 `<img>` warning；
- typecheck：通过；
- production build：通过；
- Required Check：成功。

## 6. 持续阻断

第三批 Route 接线完成不代表 BASE-B4 完成。BASE-B4 目标仍要求：

- 从最新 main 重建全量入口与绕过清单；
- 复核 onboarding、reset、Seed、fixture、导入、维护任务和旧 Route；
- 所有已证 Membership／Binding 生命周期入口必须委托 BASE-B2 唯一 Owner
  或保持禁用；
- 直接跨域 Writer／Deleter 必须继续为 0；
- 业务 Reader／Capability 继续关闭；
- BASE-B5 historical orphan 处置尚未启动。
