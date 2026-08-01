# BASE-02 Membership Revision 物理模型接受独立审查

> 状态：`current evidence`
>
> 审查日期：2026-08-01
>
> 审查基线：`64d4b72d6e3ccd2f0b1afd41f05788650fb3240d`
>
> 冻结交付：PR #867
>
> 冻结 Head：`cc85aada6f087e755ea06497cfb24e2c9eac7a7c`
>
> Required Check：Run `30698918831`／Job `91366363952`
>
> Merge Commit：`64d4b72d6e3ccd2f0b1afd41f05788650fb3240d`

## 1. 审查定位

本审查独立核对用户对 P01～P12 与 M0→M7 的正式接受是否完整、内部一致且没有越过当前项目级
授权边界。审查不修改被审查决策，不创建 Schema、Migration、Migration Lease、数据库对象或 Runtime。

审查对象：

| 文件 | 合并后 blob |
|---|---|
| `docs/decisions/base02-membership-revision-physical-model-accepted-decision.md` | `0c91fce013c6c53b28d60fa2b64c5a06fff1826f` |

上表已核对为合并后的真实 Git blob；正文不依赖工作树路径或仓库外信息。

## 2. PR 与质量证据

| 检查 | 结果 |
|---|---|
| PR #867 状态 | 已使用 Merge Commit 合并 |
| 提交／文件数 | 1 个提交／1 个新 Markdown |
| 最终 Head | `cc85aada6f087e755ea06497cfb24e2c9eac7a7c` |
| Required Check | Run `30698918831`／Job `91366363952`，`success` |
| 完整测试／build | 均实际执行并成功，0 skipped、无 continue-on-error |
| Runtime／Schema／Migration／journal／snapshot | 修改均为 0 |
| 数据库／Lease／DDL／DML | 均未发生 |

## 3. A-full 与 Owner 边界

审查确认 accepted decision 没有重开或缩减：

- `tenant_members` 仍是 Access Control 唯一 canonical Membership current；
- Identity 仍拥有用户、账号与正式 Session；
- Access Control 仍唯一拥有 Membership 与 Binding 生命周期；
- Tenancy 仍拥有 Scope、Context 与 Scope revision 原始事实；
- Security 仍只提供通用安全与受控 evidence／Guard 能力；
- Membership revision、Binding version 与 Scope revision 仍是三个独立版本域；
- Operating Context Head／Version 没有进入本轮授权组合；
- 永久第二套 Membership current、`updated_at`／Binding／Scope revision 授权替代方案继续排除。

## 4. P01～P12 完整性

| 编号 | 审查结果 |
|---|---|
| P01 | 接受 `tenant_members` 同表规范化 envelope；M1 legacy all-null／new all-complete，partial fail-closed |
| P02 | 接受 `integer` revision、初值 1、严格 `+1`、上限 `2147483647`、无 default、溢出 fail-closed |
| P03 | 接受 `active／revoked／deleted`，revoked 可 reactivate，deleted 为终态 |
| P04 | 接受现有 `id` 为不可变 incarnation identity，初版不支持新 incarnation |
| P05 | 接受规范化 current provenance，不使用 JSONB current |
| P06 | 接受 `tenant_membership_transitions` append-only immutable evidence，不成为第二 current |
| P07 | 接受六种 transition，current 与 evidence 同事务 |
| P08 | 接受 legacy revision 1、`legacy_calibration／legacy_unknown`，不伪造 actor／occurredAt |
| P09 | 接受严格 M0→M7 和独立 Migration 回退域 |
| P10 | 接受 Owner Writer 先行、旧 Writer封堵后校准、最后切 Reader |
| P11 | 接受 identity 与 `display_name` 初版不可变，只有 role 可变并推进 revision |
| P12 | 接受 Membership／Binding 同一外层事务编排、两个版本域独立推进 |

P01～P12 全部存在且作为绑定组合接受，没有只接受 revision 字段而遗漏 lifecycle、CAS、ABA、
provenance、transition evidence 或 Binding 联动。

## 5. current envelope 与 lifecycle Shape

accepted current envelope 精确包含 10 列：

1. `revision`；
2. `lifecycle_status`；
3. `current_provenance_source`；
4. `current_provenance_actor_id`；
5. `current_provenance_reason_code`；
6. `current_provenance_command_id`；
7. `current_provenance_occurred_at`；
8. `current_provenance_recorded_at`；
9. `revoked_at`；
10. `deleted_at`。

M1 全部 nullable 且无 default。all-complete 指核心 revision、status、source、reason、command、recorded
非空，并按 source／lifecycle 条件约束 actor、occurred、revoked、deleted；它不意味着十列机械全部非空。
M7 才 Enforce 核心 NOT NULL 与最终 Shape。

状态机完整冻结：

- create：expected-absence→active revision 1；
- role refresh：active→active，`n→n+1`；纯观察 refresh 不写；
- revoke：active→revoked；
- reactivate：revoked→active，不自动恢复 Binding；
- delete：active／revoked→deleted，终态；
- legacy calibration：未知历史→active revision 1，不伪造历史。

## 6. transition evidence 物理审查

`tenant_membership_transitions` 的 16 个 accepted 列、PK、tenant＋membership 复合 FK、
`(tenant_id,command_id)` UNIQUE、`(membership_id,to_revision)` UNIQUE、确定性排序索引、revision／
provenance／state CHECK 均已冻结。

append-only 由以下绑定机制提供：

- Runtime 目标权限只允许 `SELECT／INSERT`；
- `reject_tenant_membership_transition_mutation` trigger function；
- `tenant_membership_transitions_reject_row_mutation` 拒绝 UPDATE／DELETE；
- `tenant_membership_transitions_reject_truncate` 拒绝 TRUNCATE；
- 共享环境消费后禁止改写历史，只能审计化 forward-fix。

当前仓库尚无稳定 Runtime 数据库角色契约，因此后续 M1 可以落实 trigger，但不得虚报 Runtime ACL
已经关闭；ACL 必须由具备稳定角色名和独立权限证据的后续受控阶段关闭。

## 7. command identity、CAS 与原子性

- Runtime command／evidence 分别使用 `mcmd1_`／`mtr1_` 加随机 32-byte base64url；
- legacy command／evidence 分别使用 `mcal1_`／`mtcl1_`、固定 domain tag、单字节 NUL、UTF-8、
  SHA-256 与 64 个 lowercase hex；
- 任一重复 command 都返回 `command_replay_rejected`，不比较 payload、不返回历史成功；
- current CAS 使用 identity＋expected revision＋expected lifecycle，affected rows 必须精确为 1；
- 同一旧 revision 并发命令最多一个成功；不自动重试；
- 固定锁序为 Membership current→相关 active Binding→transition append；
- onboarding 必须传入 transaction-bound UoW，Owner command 不得另开事务；
- current、Binding 与 evidence 任一步失败，外层事务整批回滚。

## 8. Membership／Binding 独立版本域

- create 不猜 institution；composition root 可在同一外层事务分别创建 Membership 与 Binding；
- role refresh 不改 Binding；
- revoke／delete 同一外层事务撤销 active Binding，但两个版本域分别推进；
- reactivate 不复活旧 Binding；
- rebind 只推进 Binding version，不推进 Membership revision；
- 现有 `(tenant_id,user_id)` 自然键下，deleted 只能保留同一行 tombstone，不得物理删除或新建同自然键 incarnation。

## 9. legacy calibration 审查

accepted baseline 使用 revision 1、active、`legacy_calibration／legacy_unknown`、actor／occurredAt NULL、
实际 `recordedAt` 与确定性 command／evidence identity。M4／M5 不得修改 role、display_name、tenant/user
归属、Binding、Scope 或 historical orphan，也不得用 Migration 时间伪装历史发生时间。是否在 M4／M5
兼容窗口保留原 `updated_at`，属于后续实施冻结与测试必须明确的建议，不是本审查新增的 accepted decision。

## 10. M0～M7 顺序审查

```text
M0 metadata current 校准
→ M1 Expand
→ M2 Access Control Owner Writer／CAS
→ M3 旧 Writer／Deleter 委托或封堵
→ M4 deterministic legacy calibration
→ M5 高水位追赶与冲突清零
→ M6 authoritative Reader／Session／Guard 切换
→ M7 Enforce 与旧路径退出
```

- M0 不分配编号、不创建 Lease；
- M1 不夹带 legacy DML；
- M2／M3 先建立 transaction-bound Owner Writer 并使 Owner 外 direct mutation=0；
- M4／M5 分别使用独立手写数据 Migration、编号、Lease、恢复点、审查与 handoff；
- M6 禁止 `updated_at` fallback，Formal Session 继续只持有 selector／provenance；
- M7 只在 M1～M6 全证据通过后执行；不得夹带 orphan、A2-P2 FK `VALIDATE` 或业务 Reader。

未发现预留 Migration 编号、允许 `db:generate`、修改 snapshot、共享长期 Lease或跳过独立审查的内容。

## 11. 未实施与项目级禁止范围

本审查冻结的当前事实：

- Accepted Decision PR 的 Schema、Migration、journal、snapshot、Runtime、数据库修改为 0；
- `migration_lease_created=false`；
- `database_connected=false`；
- `base_b1_runtime_started=false`；
- historical orphan 未修改，A2-P2 Scope FK 未 `VALIDATE`；
- 项目级 Writer、Audit／模板、MIG-01B、MIG-01C 与业务 Reader未启动；
- M6 查询优化索引仍后置到真实 Reader 查询冻结，未因 accepted decision 自动创建。

用户当前 Ultra 任务提供后续阶段授权，但不免除各阶段实时基线、文件 allowlist、Lease、恢复点、
Required Check、独立审查、执行证据和停止条件。

## 12. 审查结论

```text
membership_revision_physical_model_acceptance_review=passed
p01_to_p12_bound_acceptance_complete=true
membership_revision_physical_model_accepted=true
membership_revision_migration_sequence=M0_to_M7_accepted
membership_revision_reader_index_candidates_deferred_to_M6=true
membership_new_incarnation_initial_support=false
eligible_for_m0_metadata_freeze=true
eligible_for_m1_schema_migration_implementation=false
migration_lease_created=false
database_connected=false
base_b1_runtime_started=false
historical_orphan_modified=false
a2_p2_scope_fk_validated=false
project_writer_started=false
audit_template_started=false
mig01b_started=false
mig01c_started=false
business_reader_started=false
```

`eligible_for_m1_schema_migration_implementation=false` 只表示必须先完成 M0 实时冻结；M0 无漂移且执行
前硬门通过后，当前用户任务才允许进入独立 M1 实施链。

## 13. 后续停止条件

- M0 journal／SQL／snapshot 出现无法解释漂移；
- M1 无法精确实现 accepted 字段、Shape、FK、UNIQUE、CHECK 与 append-only trigger；
- 需要重开 A-full、引入第二 current 或支持新 incarnation；
- 需要在 M1 夹带 DML、在 M6 前放行 Reader、或在 M7 夹带 orphan／FK `VALIDATE`；
- Migration 编号、Lease、恢复点、事务、执行结果或共享环境 forward-fix 不能证明；
- 需要生产／非 localhost 环境；
- 出现敏感信息泄漏或 Git 状态无法安全恢复。
