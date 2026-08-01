# 智美天工唯一下一任务

## 当前交接状态

BASE-02 Membership Revision 的 P01～P12、M0→M7、M1 Expand 与执行证据已经进入 `main`：

- PR #867／#868：物理模型与切片绑定接受及独立审查，Merge Commit 分别为 `64d4b72d6e3ccd2f0b1afd41f05788650fb3240d`／`734f0df0c5715134cf5d2d2c03833b4cb3fb7127`；
- PR #869：M1 四文件 Expand，Head `2b57222beb0c8734853bbef184f8566bbd032074`，Merge Commit `314af071bb180ce0a1095c5d21f31baa3cc15e4a`，Run `30701389089`／Job `91372887624` 成功；
- PR #870：独立质量修复，不属于 M1 文件范围；M1 在其合并后无冲突重放；
- PR #871：M1 实施独立审查，Merge Commit `eb71d2ab628032ef39182a96ea0b82f89b6dd49e`；
- 首轮实际 Migration 尝试因枚举聚合类型错误失败并完整回滚，环境 journal 保持 40、Catalog `all_missing`、业务数据净变化 0；
- PR #872／#873：仅在旧 `0040` 未被允许环境消费时完成三处显式类型纠错与独立审查，Merge Commit 分别为 `75f3c6663e7decce63634b1ee05579a454fb97ac`／`781fde457c38a28dc9fd8f4d8e05bd16198f46db`；
- PR #874：第二次授权执行低敏证据，Head `5f7a5f64dfb48768193ca8510392d8a9146a1b7b`，Run `30705415873`／Job `91383565350`，Merge Commit `17e1a1d04691878809d0caf533960b99705529dd`；
- PR #875：执行独立审查，Head `2d15e1540527dc95f71f34f3b6ecc91200ec5a32`，Run `30705922589`／Job `91384912500`，Merge Commit `7dde569cdb8d512a978dc04e63c2008f6a74d583`；
- 当前仓库／环境 journal 为 `41／41`，最新为已消费且不可改写的 `0040`，snapshot 仍为 0026；
- M1 Catalog `all_exact`，完整 current envelope／transition 行仍为 `0／0`，业务 DML 为 0；
- `base02_membership_revision_m1_execution_review=passed`，`eligible_for_m1_handoff=true`。

M1 只完成 Expand，没有建立 Runtime Owner Writer、没有校准 legacy row，也没有切换 Reader。当前 ULTRA 用户指令已授权在本 handoff 合并后继续 M2；M2 在此刻尚未启动。

## 唯一下一任务

```text
BASE-02 Membership Revision M2 Access Control Owner Writer／CAS
```

仓库当前没有该任务的正式 `V2-*` 编号，本 handoff 不自行创造编号。

当前状态：**尚未启动；已由当前 ULTRA 用户指令授权在本 handoff 合并后启动**。

下一任务只实现 Access Control 唯一 Membership／Binding 生命周期命令边界、transaction-bound Unit of Work（UoW）、`expectedRevision` CAS、同事务 current／Binding／transition evidence 和合成／事务测试。它不得修改 Schema／Migration，不得连接数据库，也不得提前启动 M3、legacy calibration、Reader 切换或 BASE-B1。

## 一、不得重开的 accepted 约束

M2 必须以 A-full、P01～P12 accepted decision 和已经执行的 M1 物理 Shape 为上位约束：

1. `tenant_members` 继续作为 Access Control 唯一 canonical Membership current；`tenant_membership_transitions` 只保存 immutable evidence；
2. Identity 继续拥有用户、账号和正式 Session；Tenancy 继续拥有 Scope、Context 与 Scope revision 原始事实；Security 继续拥有通用安全能力；
3. Access Control 唯一拥有 Membership 与 Binding 生命周期；不得创建第二套 Membership／Binding current；
4. Membership revision、Binding version 与 Scope revision 是三个独立版本域，互不替代；
5. `id／tenant_id／user_id／created_at／display_name` 初版不可变，只有 `role` 可通过 refresh 推进 revision；
6. lifecycle 固定为 active／revoked／deleted；revoked 可 reactivate，deleted 为终态且不支持新 incarnation；
7. Runtime command identity 为 `mcmd1_`＋随机 32 字节 base64url 无填充，evidence identity 为 `mtr1_`＋随机 32 字节 base64url 无填充；
8. 重复 command identity 一律返回 `command_replay_rejected`，不得比较 payload、返回历史成功或自动重试；
9. 每个非 create 命令必须携带 `expectedRevision`，current CAS 使用 identity＋expected revision＋expected lifecycle，成功 affected rows 精确为 1；
10. current provenance、Membership current、必要的 Binding 动作与 transition evidence 必须由同一 Access Control 外层事务原子形成；
11. 固定锁序为 current Membership → active Binding（仅涉及时）→ transition append；Owner command 接收 transaction-bound UoW，不得开启嵌套事务；
12. Operating Context Head／Version、historical orphan、A2-P2 FK `VALIDATE`、项目级 Writer 和业务 Reader 不进入 M2。

## 二、M2 命令与状态机契约

M2 必须提供 create／refresh／revoke／reactivate／delete 五类 Owner command：

| command | Membership 前置与结果 | Binding 联动 | revision／version |
|---|---|---|---|
| create | expected-absence → active revision 1；同 tenant/user 以事务级 advisory lock 或等价机制串行 | 不猜 institution；由调用方显式请求时才在同一外层事务创建 | 两个版本域独立创建 |
| refresh | 仅 active 且 role 实际变化；纯观察 refresh 不写入 | 不变 | Membership `n→n+1` |
| revoke | active→revoked，设置 `revoked_at` | 同一外层事务撤销 active Binding（若存在） | 分别推进 revision／version |
| reactivate | revoked→active，清空 `revoked_at` | 不自动恢复旧 Binding | 只推进 Membership revision |
| delete | active／revoked→deleted tombstone | 有 active Binding 时先在同一事务撤销；历史 Binding 保留 | 分别推进 revision／version |

统一 fail-closed 结果至少包括：

- legacy all-null 非 create：`legacy_membership_not_calibrated`；
- 重放：`command_replay_rejected`；
- revision 上限：`revision_exhausted`；
- stale／future revision、非法 lifecycle、identity／role 不允许变化、affected rows 不是 1、并发 CAS 失败：固定低敏错误且整批回滚；
- deleted row 的 reactivate／新 incarnation：拒绝；
- 任一步骤失败不得自动重试，不得回退到 `updated_at` 或旧 Writer。

## 三、M2 实施层次与候选文件范围

M2 以一个清晰回退域实现，不为微小文件创建无意义 PR。初始候选范围为：

1. `src/modules/access-control/domain/membership-lifecycle.ts`；
2. `src/modules/access-control/ports/membership-command-unit-of-work.ts`；
3. `src/modules/access-control/application/membership-command-service.ts`；
4. `src/modules/access-control/server/membership-command-repository.ts`；
5. `src/modules/access-control/tests/MembershipLifecycle.test.ts`；
6. `src/modules/access-control/tests/MembershipCommandService.test.ts`；
7. `src/modules/access-control/tests/MembershipCommandRepository.test.ts`。

若仓库证据证明单 PR 超出可审查范围，可拆成 M2a 纯 domain／port／application 与 M2b transaction repository；两个 PR 必须保持同一 accepted contract，不能让任一半成品成为正式调用入口。新增现有组合根／调用方文件前必须先证明它属于 M2，而不是 M3 onboarding 委托。

固定层次为：

```text
Domain lifecycle state machine
→ Application Owner command service
→ transaction-bound UoW Port
→ PostgreSQL Repository／Adapter
→ synthetic + transaction tests
```

M2 不修改现有 Auth／Security 的 `updated_at` compatibility Reader；该切换只属于 M6。

## 四、M2 验证与交付边界

M2 至少必须验证：

- 五类 command 的合法状态转换与全部非法状态拒绝；
- create expected-absence 并发串行化；
- 同一旧 revision 的并发命令最多一个成功；
- stale／future revision、revision 溢出、command replay 和 partial legacy envelope 全部 fail-closed；
- current CAS、可选 Binding mutation 与 transition append 同一事务，任一步骤失败整批回滚；
- current provenance 与 transition evidence 字段一致；
- revoke／delete 的 Binding 撤销、reactivate 不恢复 Binding、refresh 不改 Binding；
- Membership revision 与 Binding version 独立推进；
- Repository affected rows 精确为 1，固定锁序和无自动重试；
- M2 后 Owner command 可供 M3 onboarding 委托，但本轮不修改 M3 direct Writer。

交付必须包括：实现 PR、独立审查 PR 和 M2 handoff PR；每个 PR 都绑定冻结 Head、真实 Required Check、Merge Commit 与同步后的 `main`。M2 只运行合成与事务测试，不连接真实数据库，不签发 Lease。

## 五、持续阻断

- M2 handoff 合并前 Access Control authoritative Membership Writer 仍为 `0`；
- M3 direct Writer 委托／封堵：未启动，Owner 外 4 文件／6 符号现状不得在 M2 中虚报归零；
- M4／M5 legacy calibration 与追赶：未启动，完整 envelope／transition 行保持 `0／0`；
- M6／M7 Reader 切换与 Enforce：未启动，`updated_at` compatibility fallback 仍待 M6；
- BASE-B1 Runtime：继续 `blocked`，必须等待 M7；
- BASE-B2～B4：lifecycle Runtime、Session／上下文刷新、Guard 与绕过闭环未启动；
- BASE-B5：active historical orphan 与 Scope relation orphan 仍为 `1／1`，修复未授权；
- BASE-B6：完成证明不具备；
- A2-P2 Scope FK：继续 `NOT VALID`／`convalidated=false`，不得执行 `VALIDATE`；
- 项目级 Writer：未启动；M2 的 Access Control Owner Writer 不等于项目级双写已启动；
- Audit／模板、MIG-01B、MIG-01C、Reader：继续阻断；
- 正式平台服务端授权根仍为独立缺口，七线正式发布仍为 `0/7`。

环境计数是既有审计窗口的低敏证据，不是永久状态；任何未来数据库或实施任务都必须重新冻结环境。

## 六、当前禁止范围

M2 当前授权不包括：

- 修改 `drizzle/**`、Schema、Migration、journal、snapshot、scripts、CI、package 或 lock；
- 连接数据库，创建 Migration／Execution Lease，执行 DDL、DML、Migration、Seed、回填、校准或环境操作；
- 预留、批准或占用下一 Migration 编号，或运行 `db:generate`；
- 修改 M1 已消费 `0040`；
- M3 onboarding／reset／Seed／CLI direct Writer 委托或封堵；
- M4／M5 legacy 数据 Migration；
- M6 Reader、Session 或 Guard 切换；
- M7 NOT NULL／Enforce；
- BASE-B1～B6 Runtime；
- orphan UPDATE、DELETE、INSERT、重绑、撤销或补 Scope；
- FK `VALIDATE`、项目级 Writer、Audit／模板、MIG-01B、MIG-01C 或业务 Reader；
- 输出凭证、连接参数、真实双键、自由文本 reason 或 PII。

## 七、停止条件

出现以下任一情况必须停止：

- accepted P01～P12 无法在当前 PostgreSQL／Drizzle 与 TypeScript 栈中实现，且必须重开 A-full；
- 无法维持 Access Control 单一 Owner、唯一 canonical current 或三个独立版本域；
- 无法让 current、Binding 联动与 transition evidence 在同一外层事务原子形成；
- transaction-bound UoW 必须退化为嵌套事务或跨事务补偿；
- CAS 无法证明 affected rows 精确为 1、同一旧 revision 最多一个成功或无自动重试；
- 必须让 legacy all-null row 在 M4 前通过、使用 `updated_at` fallback 或修改 Auth Reader；
- 需要 Schema、Migration、数据库、Lease、M3～M7、orphan 或 FK `VALIDATE` 才能完成 M2；
- 需要永久第二套 Membership current；
- current、accepted target、Owner、基线、文件范围、工作树或并发 Agent 出现无法解释的漂移；
- 出现 Secret、Token、密码、私钥或 PII 泄漏，或 Git 状态无法安全恢复。

## 八、交付判定

```text
next_task=BASE-02 Membership Revision M2 Access Control Owner Writer／CAS
next_task_started=false
next_task_authorized_under_ultra=true
membership_revision_direction=A-full_same_table_lifecycle
membership_revision_decision_accepted=true
membership_revision_physical_model_accepted=true
membership_revision_migration_sequence=M0_to_M7_accepted
m0_complete=true
m1_expand_migration_executed=true
m1_execution_review=passed
m1_complete=true
m1_environment_journal_entries=41
m1_catalog_state=all_exact
m1_database_attempt_cumulative=2
m1_automatic_retry_count=0
eligible_for_m2_after_handoff=true
m2_started=false
m2_runtime_file_scope=access_control_only
m2_database_access_allowed=false
m2_schema_migration_allowed=false
m3_started=false
m4_started=false
m5_started=false
m6_started=false
m7_started=false
eligible_for_base_b1_runtime=false
base_b1_runtime=blocked
orphan_remediation_authorized=false
a2_p2_scope_fk_validated=false
writer_started=false
reader_started=false
eligible_for_reader=false
```
