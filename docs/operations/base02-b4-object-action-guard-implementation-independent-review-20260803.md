# BASE-B4 Action Policy／Object Guard 核心实施独立审查

> 日期：`2026-08-03`
>
> 被审查 PR：#958
>
> 被审查 Head：`76c71a7cc7019c9730bb916305c710fdc1d091f7`
>
> 被审查 Merge Commit：`79f2a028b3173d14f5cb9be67d9c5b5ba1a2f380`
>
> Required Check：Run `30818605588`／Job `91702507633`

## 1. 结论

```text
base02_b4_object_action_guard_implementation_review=passed
implementation_path=B4_G1_capability_off_object_action_guard
changed_file_count=10
object_fact_port=implemented
action_policy=implemented
object_guard=implemented
request_authorization_object_action_methods=2
institution_runtime_object_fact_reader=null
business_reader_release=false
business_capability_release=false
unknown_action_object_fail_closed=true
cross_scope_object_fail_closed=true
stale_object_fact_fail_closed=true
fake_handle_fail_closed=true
schema_change=false
migration_change=false
database_connection=false
eligible_for_base_b4_object_action_handoff=true
base_b4_complete=false
base_b5_started=false
```

## 2. 文件范围

PR #958 严格修改 10 个冻结文件：

1. `src/modules/security/ports/institution-object-fact.ts`
2. `src/modules/security/server/institution-action-policy.ts`
3. `src/modules/security/server/institution-object-guard.ts`
4. `src/modules/security/server/institution-request-authorization.ts`
5. `src/modules/institution/server/institution-server-runtime.ts`
6. `src/modules/security/tests/InstitutionActionPolicy.test.ts`
7. `src/modules/security/tests/InstitutionObjectGuard.test.ts`
8. `src/modules/security/tests/InstitutionRequestAuthorization.test.ts`
9. `src/modules/institution/tests/InstitutionServerRuntime.test.ts`
10. `src/modules/security/tests/InstitutionSectionGuard.test.ts`

未修改业务 Owner 模块、业务 Route、Schema、Migration、journal、snapshot、Seed、script、CI、package 或 lock。

## 3. 契约核对

- 对象事实 Port 只定义低敏 current fact、revision 与拒绝结果；
- Action Policy 使用固定注册表，未知 pair 与角色不匹配均拒绝；
- Object Guard 只接受 genuine Scope Guard、genuine object reader 和 genuine policy；
- 每次 object/action 授权先消费 current Scope，再读取对象事实；
- object type、id、tenant、institution、status、revision 与 freshness 均严格核对；
- allow 只暴露 object type、action、object revision 与有效期，不暴露 objectId、tenantId、institutionId 或原始事实；
- request authorization 新增 action／object 两个方法，并保持 opaque genuine handle；
- institution runtime 显式传入 `objectFactReader: null`，因此当前业务 capability 保持关闭；
- Security 核心未直接依赖 Customers、Care、Knowledge、Conversations Repository 或数据库实现；
- Section Guard 未吸收 Object Guard 或 Action Policy 职责。

## 4. 验证

本审查重新执行：

- 8 个定向测试文件；
- 架构检查器 148 项自测；
- 增量架构检查；
- lint；
- typecheck；
- production build。

全部通过。既有 4 个 `<img>` lint warning 不属于本轮新增错误。

## 5. 持续阻断

- 104 个待分类入口尚未完成校准和正式 Guard 接线；
- 业务 Owner object fact Adapter／Reader 尚未实施；
- 真实业务 Capability 尚未开放；
- historical orphan 与 Scope FK 尚未处理；
- BASE-B4 尚未完成，BASE-B5 尚未启动。
