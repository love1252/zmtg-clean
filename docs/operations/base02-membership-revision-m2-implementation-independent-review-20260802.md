# BASE-02 Membership Revision M2 Owner Writer／CAS 实施独立审查

> 状态：`current independent review evidence`
>
> 审查日期与时区：2026-08-02，Asia/Shanghai
>
> 审查基线：`e6add6403a7a502192c450615397304a74c4b8e7`
>
> 被审查 PR：#877
>
> 实施 Base：`809b0e836fd5decea364726ca0ec44fdaa5b3e56`
>
> 被审查 Head：`828ebb69e62267a67dff2d8cc21d7ddafb1d454b`
>
> Required Check：Run `30708477043`／Job `91391614603`，成功
>
> 被审查 Merge Commit：`e6add6403a7a502192c450615397304a74c4b8e7`

## 1. 审查定位

本审查独立核对 Membership Revision M2 是否只建立 Access Control 唯一 Membership Owner
Writer、`expectedRevision` CAS、transaction-bound Unit of Work（UoW）以及 current／Binding／
transition evidence 的原子事务边界，并确认实现没有提前进入旧 Writer 委托、legacy calibration、
Reader 切换、Schema／Migration 或真实数据库执行。

审查只读取 PR #877、已接受 A-full 与 P01～P12 决策、M1 handoff、实现、测试和 GitHub 证据；
不修改被审查实现，不连接数据库，不执行 DDL、DML、Migration、Seed，不签发 Lease，也不启动
M3～M7 或 BASE-B1～B6。

## 2. 冻结范围与合并一致性

PR #877 相对实施 Base 精确为 1 个提交、7 个文件：

1. `src/modules/access-control/domain/membership-lifecycle.ts`；
2. `src/modules/access-control/ports/membership-command-unit-of-work.ts`；
3. `src/modules/access-control/application/membership-command-service.ts`；
4. `src/modules/access-control/server/membership-command-repository.ts`；
5. `src/modules/access-control/tests/MembershipLifecycle.test.ts`；
6. `src/modules/access-control/tests/MembershipCommandService.test.ts`；
7. `src/modules/access-control/tests/MembershipCommandRepository.test.ts`。

冻结核对结果：

- Runtime 实现 4 个文件、测试 3 个文件，共新增 3002 行；
- Schema、Migration、journal、snapshot、scripts、CI、package 与 lock 修改均为 0；
- 现有 Auth／Security Reader、旧 Writer、组合根和 Route 修改均为 0；
- PR 评论、Review 与阻断项为 0；冻结 Head 技术上可合并；
- Merge Commit 的两个父提交分别为实施 Base 与冻结 Head；
- Merge Commit tree 与冻结 Head tree 完全一致；
- 本地 `main` 与 `origin/main` 已同步到 Merge Commit，实施工作分支已清理；
- 全部 `backup/*` 保留。

## 3. A-full 与 Owner 边界

独立审查确认实现没有重开已接受的 Owner 与事实层：

- `tenant_members` 继续是 Access Control 唯一 canonical Membership current；
- `tenant_membership_transitions` 只承担 immutable transition evidence，不成为第二套 current；
- Identity 仍拥有用户、账号和正式 Session；Tenancy 仍拥有 Scope、Context 与 Scope revision；
- Membership revision、Binding version 与 Scope revision 是三个独立版本域，互不替代；
- current provenance 与 transition evidence 在同一已接受命令中使用一致的低敏来源、原因、
  actor、command 和时间字段；
- legacy all-null Membership 在 M4 前固定返回 `legacy_membership_not_calibrated`，没有被 M2
  静默补齐；
- revoked／deleted 的同角色 refresh 仍 fail-closed，deleted tombstone 不复活；
- M2 没有修改现有 Reader，也没有把 Owner Writer 写成项目级 Writer 已启动。

## 4. 命令、CAS 与重放语义

M2 固定提供 create／refresh／revoke／reactivate／delete 五类 Owner command：

- create 以 `(tenantId, userId)` expected-absence 为自然键，在事务内先取得 advisory lock，再读取
  current；并发 create 最多一个提交；
- 非 create 先锁定 current，再使用调用方提供的 `expectedRevision`；状态、旧 revision 或载荷不匹配
  均 fail-closed；
- current 更新使用 tenant、membership、user、revision 与 lifecycle 的 CAS 条件，affected rows
  必须精确为 1；不自动重试；
- 同一旧 revision 的并发命令最多一个成功，其他命令稳定返回 stale；
- command replay 在最小路由身份校验后、完整 payload 与 Binding 决策前查询；已持久化 command
  一律返回 `command_replay_rejected`，恶意或畸形重复载荷不能借后续错误遮蔽重放拒绝；
- refresh 只允许 active Membership；同角色 refresh 是 observed no-write，不推进 revision、
  不写 evidence，也不持久化 command ID；
- revoke 与 delete 只在存在 active Binding 时执行独立 Binding version CAS；reactivate 不恢复
  Binding；
- Membership revision 与 Binding version 分别检查上限，任一版本域不能借另一版本域推进。

## 5. 事务、锁序与 Repository 边界

实现以单次外层 read-write serializable 事务承载完整命令：

1. create advisory lock 或 current `FOR UPDATE`；
2. replay 查询与完整 lifecycle decision；
3. 仅在 apply 且涉及 active Binding 时按稳定顺序锁定 Binding；
4. current CAS 或 create；
5. 必要的 Binding version CAS；
6. append immutable transition evidence；
7. 由外层事务统一提交。

Repository 同时设置 `statement_timeout='5s'`、`lock_timeout='1s'` 与
`idle_in_transaction_session_timeout='5s'`。transaction-bound UoW 只能由事务回调中的品牌化
database 创建，事务结束后 active guard 使 UoW 失效；普通 `TenantDatabase` 在类型层不能直接
冒充事务 database。

所有 create／CAS／Binding／evidence 写入都要求精确一行返回；数据库错误只映射到固定低敏错误码，
未保留原始异常、SQL 或连接信息。实现没有 `upsert`、`IF NOT EXISTS`、duplicate catch、自动重试、
DDL、DML 脚本或事务外 evidence append。

## 6. 状态机与原子回滚证据

领域与服务测试覆盖：

- create、active refresh、同角色 no-write、revoke、reactivate、delete；
- legacy all-null、完整 current 与 partial envelope 的严格分类；
- stale／future／max revision、Binding 独立版本上限和 deleted terminal；
- command ID、transition ID、canonical time、低敏 provenance reason 与原型属性恶意 kind；
- current provenance 与 transition evidence 的字段一致性；
- create expected-absence 并发：同 tenant／user、不同 membership ID 的两个命令最多一个提交且
  只形成一个 transition；
- 同一旧 revision 并发：最多一个提交，另一命令返回 stale；
- evidence append 失败：staged current、Binding version 与 transition 全部不提交，事务净状态
  保持不变；
- 各类 affected-row 非 1、约束冲突、重放和锁序错误路径。

这些是合成／事务模型证据，不是固定 local_acceptance 或生产数据库的执行证据；M2 按任务边界
不连接真实数据库。M3 在接入旧 Writer 前仍必须只通过集中 composition root 创建 transaction-bound
UoW，禁止以显式类型断言在任意调用方绕过品牌边界。

## 7. 质量门禁

冻结 Head 的验证结果：

| 门禁 | 结果 |
|---|---|
| 定向测试 | 3 文件、41 项全部通过 |
| 架构检查器自测 | 67／67 |
| 增量架构检查 | 通过 |
| lint | 0 error；4 条既有图片优化 warning |
| typecheck | 通过 |
| 完整测试 | 425 文件、6235 项全部通过 |
| build | 101／101 静态页面生成并通过 |
| `git diff --check` | 通过 |
| Required Check | Run `30708477043`／Job `91391614603`，成功 |

真实 GitHub Actions 中环境核对、依赖安装、架构检查器自测、增量架构检查、lint、typecheck、
完整测试和 build 均实际执行并成功；build 未跳过，没有 `continue-on-error`。

## 8. 未执行范围与风险

当前冻结事实：

- `m2_owner_writer_implemented=true`；
- `m2_database_execution=false`；
- `schema_or_migration_changed=false`；
- `legacy_calibration_executed=false`；
- `m3_legacy_writer_delegation_started=false`；
- `runtime_reader_changed=false`；
- `historical_orphan_modified=false`；
- `a2_p2_scope_fk_validated=false`；
- `base_b1_to_b6_started=false`。

M2 Owner command 目前没有被旧 onboarding／reset／Seed／CLI Writer 调用；这正是 M3 的独立范围，
不构成 M2 实现缺失，也不能虚报 direct Writer 已归零。M3 必须逐个冻结旧 Writer 调用点、集中
composition root、委托或封堵方式与回归测试，并继续保持 Reader、legacy calibration、orphan 和
FK `VALIDATE` 边界。

一条已合并 Repository 测试标题仍保留 `current→Binding→replay` 的旧文字顺序；实际实现与断言均为
`current→replay→lifecycle decision→必要 Binding`。该命名漂移不改变测试覆盖或执行语义，后续只可
在触及同一测试的独立范围内校准，不得借此重排已审查锁序。

## 9. 独立审查结论

```text
base02_membership_revision_m2_implementation_review=passed
m2_owner_writer_implemented=true
m2_transactional_cas_verified=true
m2_replay_fail_closed=true
m2_required_check_passed=true
m2_database_execution=false
eligible_for_m2_handoff=true
eligible_for_m3=false
eligible_for_base_b1=false
```

PR #877 的实现、测试、Git／GitHub 证据与已接受 A-full／P01～P12 一致，能够证明 M2 已建立
Access Control 唯一 Membership Owner Writer／CAS 与同事务 evidence 边界。该结论只准入独立
M2 handoff；在 handoff 合并前不授权 M3，且不构成任何数据库、Schema、Migration、Reader、
historical orphan 修复或 FK `VALIDATE` 授权。
