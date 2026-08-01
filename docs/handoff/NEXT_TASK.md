# 智美天工唯一下一任务

## 当前交接状态

BASE-02 Membership Revision 的 accepted 架构方向、Schema／Migration 前置预检、proposed 物理模型与独立审查已经进入 `main`：

- PR #861：A-full Accepted Decision，Merge Commit `b74cad648a46421b0a04f5f6b868f2f7a2240319`；
- PR #862：A-full 接受独立审查，Merge Commit `1478c2693d6a21216169babad5ff9d4147e3afb0`；
- PR #863：A-full 接受 handoff，Merge Commit `e4f6a822fc52dd46d52c7d6accb0bae5c2a428a5`；
- PR #864：Schema／Migration 前置预检与 proposed 物理模型决策包，Head `3e9f2f8992e9923dc5261be8f40c8e8f9f9b18a0`，Merge Commit `59e5ef94fe9a462b29e0792f2b661a84e3d10de2`，Run `30696216677`／Job `91359466603` 成功；
- PR #865：独立审查，Head `9e20fcef4756eae0c9cec273fe5ec7e7039236c2`，Merge Commit `511de2c22000ae3494e7745a2dac7cfe82f21042`，Run `30696574699`／Job `91360387951` 成功；
- 独立审查结论：`membership_revision_schema_preflight_review=passed`；
- 接受方向：`A-full_same_table_lifecycle`；
- 精确物理模型状态：`proposed_not_accepted`；
- `eligible_for_schema_migration_implementation=false`；
- `eligible_for_base_b1_runtime=false`。

本轮只完成 docs-only 静态预检、候选冻结与独立审查。它没有接受 P01～P12，没有实施 Schema、Migration、Runtime 或数据库，也不构成下一任务的自动启动授权。

## 唯一下一任务

```text
BASE-02 Membership Revision 物理模型与 Migration 切片接受
```

仓库当前没有该任务的正式 `V2-*` 编号，本 handoff 不自行创造编号。

当前状态：**尚未启动、尚未授权**。

下一任务只允许对 P01～P12 和 M0～M7 proposed 组合进行明确接受、拒绝或调整，并形成独立 accepted decision、独立审查与 handoff。它不得直接创建 Schema、Migration、Migration Lease、Runtime 或数据库变更。

## 一、不得重开的 accepted 约束

下一任务必须以 A-full accepted decision 为上位约束，不得重新选择架构方向：

1. `tenant_members` 继续作为 Access Control 唯一 canonical Membership current；
2. Identity 继续拥有用户、账号和正式 Session；
3. Access Control 唯一拥有 Membership 与 Binding 生命周期；
4. Tenancy 继续拥有 Scope、Context 与 Scope revision 原始事实；
5. Membership revision、Binding version 与 Scope revision 是三个独立版本域，互不替代；
6. Membership revision 必须显式、稳定、严格单调，并使用 `expectedRevision` CAS；
7. create、授权相关 refresh、revoke、delete、tombstone、incarnation identity 与 ABA 防护组成完整生命周期；
8. current provenance 与 immutable transition evidence 必须和 canonical current 在同一事务原子形成；
9. transition evidence 不得成为第二套 current；
10. Membership 只能经 Access Control 唯一命令／Writer 边界修改；
11. A-literal 只可能是明确标记的 interim carrier；永久 sidecar current 继续排除；
12. Operating Context Head／Version 不进入本轮 BASE-02 授权组合。

## 二、必须由用户明确决定的 proposed 绑定组合

P01～P12 当前全部为空白、未接受。建议作为一个绑定组合审议，避免 revision、状态机、provenance、evidence、Binding 联动与 Migration 顺序相互失配：

| 编号 | 主题 | 当前 proposed 推荐 | 接受状态 |
| --- | --- | --- | --- |
| P01 | canonical current 字段 envelope | `tenant_members` 同表规范化列、legacy all-null／new all-complete | 未接受 |
| P02 | revision | `integer`，初值 `1`、正值、严格 `+1`、上限 `2147483647`、无隐式 default | 未接受 |
| P03 | lifecycle | `active／revoked／deleted`；revoked 可 reactivate，deleted 为终态 | 未接受 |
| P04 | incarnation | 初版复用现有 `tenant_members.id` 作为不可变 identity，不支持同 tenant/user 新 incarnation | 未接受 |
| P05 | current provenance | 规范化低敏列，不使用 JSONB current；冻结 source／actor／reason／command／时间语义 | 未接受 |
| P06 | immutable transition evidence | 新建 `tenant_membership_transitions` append-only evidence，不成为第二 current | 未接受 |
| P07 | transition 状态机 | 六种 transition，冻结 from／to revision、status 与 current 同事务 Shape | 未接受 |
| P08 | legacy calibration | revision `1`＋`legacy_calibration` baseline，不伪造历史 actor 或发生时间 | 未接受 |
| P09 | Migration 串行 | M0→M7；每个数据／DDL 切片独立编号、Lease、审查与 handoff | 未接受 |
| P10 | Reader／Writer cutover | Owner Writer 先行，旧 Writer 封堵后校准，再切 Reader | 未接受 |
| P11 | mutable Membership 字段 | identity 字段不可变；初版只允许 `role` 推进 revision，`display_name` 不可变 | 未接受 |
| P12 | Membership／Binding 联动 | 同一 Access Control 外层事务、独立版本域；冻结 lifecycle 对应 Binding 动作 | 未接受 |

用户可以要求调整任一项，但调整必须继续满足 A-full、唯一 canonical current、同事务 evidence、CAS／ABA 与 Owner 边界。若调整导致这些 accepted 约束失效，必须停止当前接受流程并另立 ADR，不能由本任务静默改写 target。

## 三、必须一并确认的串行切片

```text
M0 metadata 校准
→ M1 Expand current envelope 与 transition evidence
→ M2 Access Control Owner Writer／CAS
→ M3 旧 Writer 委托／封堵
→ M4 deterministic legacy calibration
→ M5 高水位追赶与冲突清零
→ M6 Reader 从 updated_at 切换到显式 revision
→ M7 Enforce 与旧路径退出
```

- M0 只实时核对 journal、SQL 与 snapshot，不分配编号、不创建 Lease；
- M1 只做 Expand，不夹带 legacy DML；
- M2／M3 先建立唯一 Owner Writer 与旧 Writer=0，legacy all-null row 继续 fail-closed；
- M4／M5 必须是独立手写数据 Migration，稳定排序、行数守恒、冲突清零，不以 Migration 时间伪造历史事实；
- M6 才允许 compatibility Reader 切到显式 revision，Formal Session 继续不承载授权事实；
- M7 只有数据与 Writer／Reader 切换全部完成后才可 Enforce；不得夹带 BASE-B1、orphan 修复或 FK `VALIDATE`；
- 每个未来切片都需要独立任务、精确文件范围、必要的 Migration Lease／恢复点、测试、审查、handoff 与用户授权。

## 四、接受任务的交付边界

未来接受任务应只新增独立 accepted decision，并在其合并后另建独立审查与 handoff。accepted decision 至少必须：

- 逐项记录 P01～P12 的用户选择，并说明是否作为绑定组合接受；
- 记录 M0～M7 的顺序及任何获准调整；
- 明确字段名、状态机、transition evidence、CAS、legacy calibration、Writer／Reader cutover 与 Binding 联动的接受边界；
- 保留 Migration 编号实时分配、`db:generate` 禁止、snapshot 不修改与共享环境 forward-fix 规则；
- 明确接受不等于实施授权，不得取得 Migration Lease或启动 M0～M7；
- 继续记录 BASE-B1 Runtime、orphan、FK `VALIDATE`、Writer 与 Reader 的阻断状态。

建议 accepted decision 候选路径为：

```text
docs/decisions/base02-membership-revision-physical-model-accepted-decision.md
```

实际文件范围仍须由用户在下一任务中明确授权，本 handoff 不预先创建文件或分支。

## 五、持续阻断

- BASE-B1 Runtime：继续 `blocked`；
- BASE-B2～B4：lifecycle Runtime、Session／上下文刷新、Guard 与绕过闭环未启动；
- BASE-B5：active historical orphan 与 Scope relation orphan 仍为 `1／1`，修复未授权；
- BASE-B6：完成证明不具备；
- A2-P2 Scope FK：继续 `NOT VALID`／`convalidated=false`，不得执行 `VALIDATE`；
- Membership lifecycle Writer 与项目级 Writer：未启动；
- Audit／模板、MIG-01B、MIG-01C、Reader：继续阻断；
- 正式平台服务端授权根仍为独立缺口，七线正式发布仍为 `0/7`。

环境计数是既有审计窗口的低敏证据，不是永久状态；任何未来数据库或实施任务都必须重新冻结环境。

## 六、当前禁止范围

当前不授权：

- 修改 `src/**`、`drizzle/**`、scripts、tests、CI、package 或 lock；
- 创建或修改 Schema、Migration、journal、snapshot 或 Migration Lease；
- 数据库连接、DDL、DML、Migration、Seed、回填、校准或环境操作；
- 预留、批准或占用下一 Migration 编号，或运行 `db:generate`；
- BASE-B1～B6 Runtime；
- orphan UPDATE、DELETE、INSERT、重绑、撤销或补 Scope；
- FK `VALIDATE`、`SET NOT NULL`；
- Writer、Audit／模板、MIG-01B、MIG-01C 或 Reader；
- 自动开始本文冻结的接受任务或后续实施切片。

## 七、停止条件

出现以下任一情况必须停止：

- 需要重开 A-full、Owner 或三个独立版本域；
- 只接受 revision 字段，却遗漏 lifecycle、ABA、provenance 或 transition evidence；
- 无法保持 canonical current 与 transition evidence 同事务原子形成；
- 需要永久第二套 Membership current；
- P01～P12 或 M0～M7 的调整相互矛盾，且无法在 accepted 约束下解释；
- 必须读取环境、凭证、真实数据或扩大明确文件范围才能继续；
- 需要在接受任务中创建 Migration、分配 Lease、连接数据库或实施 Runtime；
- 需要夹带 orphan 修复、FK `VALIDATE`、Writer／Reader 放行或 BASE-B1～B6 实施；
- current、accepted target、Owner、基线或工作树出现无法解释的漂移。

## 八、交付判定

```text
next_task=BASE-02 Membership Revision 物理模型与 Migration 切片接受
next_task_started=false
next_task_authorized=false
membership_revision_direction=A-full_same_table_lifecycle
membership_revision_decision_accepted=true
membership_revision_schema_preflight=completed
membership_revision_schema_preflight_review=passed
membership_revision_physical_model_status=proposed_not_accepted
membership_revision_physical_model_accepted=false
membership_revision_migration_sequence=M0_to_M7_proposed
eligible_for_physical_model_acceptance_handoff=true
physical_model_acceptance_started=false
physical_model_acceptance_authorized=false
eligible_for_schema_migration_implementation=false
schema_migration_implementation_authorized=false
eligible_for_base_b1_runtime=false
base_b1_runtime=blocked
orphan_remediation_authorized=false
a2_p2_scope_fk_validated=false
writer_started=false
reader_started=false
eligible_for_reader=false
```
