# BASE-02 Membership Revision 架构决策包独立审查

> 状态：独立审查已通过；仅确认决策包具备进入决策 handoff 与用户接受流程的条件，不接受任何方案，也不授权 Schema、Migration 或 Runtime。

## 1. 审查定位

本审查冻结并复核以下交付：

- 决策包 PR：#858；
- 决策包 Head：`95109315b0366f9a7f2b6bb45dd7498e4e2dbfa6`；
- Merge Commit：`1712b357cea3ef8147e87e7812c67a39e07c13f0`；
- Required Check：Run `30689389362`／Job `91341284170`，结论为成功；
- 审查文件：`docs/decisions/base02-membership-revision-architecture-decision-pack.md`；
- 审查基线：`1712b357cea3ef8147e87e7812c67a39e07c13f0`。

审查目标是判断决策包是否完整、内部一致、符合既有 Owner 与阶段边界，并且是否可以进入独立 handoff 后的用户决策接受任务。审查不把推荐写成 accepted decision，不替用户选择方案。

## 2. 审查边界

本轮只读取仓库内代码、Schema、Migration、测试、已接受决策、BASE-02 准入材料和 PR #858 合并证据，未连接数据库，未读取环境变量、凭证或仓库外资产。

本轮修改范围只有本文档。以下修改或操作均为 0：

- Runtime、Schema、Migration、journal、snapshot；
- scripts、tests、CI、package、lock；
- 数据库 DDL、DML、Migration、Seed；
- historical orphan 修复、FK `VALIDATE`；
- BASE-B1～B6、Writer、Reader 实施。

## 3. 独立审查结论

| 审查项 | 结论 | 核对结果 |
| --- | --- | --- |
| 当前缺口 | 通过 | `tenant_members` 没有显式、单调、可 CAS 的 Membership revision；`updated_at` 不能承担该语义。 |
| 已冻结 Owner | 通过 | Membership 与 Authorization Provenance 继续由 Access Control 所有；Identity、Tenancy、Security 边界未被重开。 |
| Binding 边界 | 通过 | Binding version 只描述绑定投影，未被当成 Membership revision。 |
| 方案 A | 通过 | 已区分 A-literal 与 A-full；A-literal 仅可作为 B1 临时载体，A-full 才覆盖完整生命周期要求。 |
| 方案 B | 通过 | 永久 sidecar 被识别为第二套 current 事实源风险；只有 canonical replacement 且先有独立 ADR 与退出计划时才可重新考虑。 |
| 方案 C | 通过 | 现有字段组合无法证明单调性、CAS、ABA 与并发一致性，淘汰结论有仓库证据支持。 |
| 推荐状态 | 通过 | A-full 仅为 `proposed` 推荐，未写成用户已接受或已批准。 |
| Schema／Migration | 通过 | 文档如实确认推荐方向需要后续独立 Schema／Migration；未创建文件、编号或 Migration Lease。 |
| B1～B6 | 通过 | B1 Runtime 继续阻断；B2～B6 未启动，后续阶段没有被推荐自动授权。 |
| Reader／Writer | 通过 | Writer 必须进入统一 CAS 与 transition evidence 事务；Reader 继续阻断，未以 HMAC 或代码存在替代新鲜度证据。 |
| orphan／A2-P2 | 通过 | historical orphan 未修改，A2-P2 Scope FK 未执行 `VALIDATE`，未把二者纳入本决策包的隐式修复。 |
| 回滚与停止条件 | 通过 | 文档覆盖单调性、ABA、Owner、双事实源、Migration 边界和异常状态的 fail-closed 条件。 |

## 4. 三方案复审

### 4.1 方案 A

决策包对方案 A 的拆分是必要且成立的：

- A-literal 只在 `tenant_members` 增加显式 revision，能够为 B1 提供比时间戳更稳定的 CAS 载体，但不能单独证明 revoke／refresh／rebind 的完整生命周期，也不能独立解决 ABA；
- A-full 保持 `tenant_members` 为 Access Control 的 canonical current，增加显式 revision、生命周期 envelope、tombstone／current provenance，并要求在同一事务内形成不可变 transition evidence；
- transition evidence 是否需要独立表仍属于未来精确 Schema／Migration 预检，不影响 A-full 的单一 current 事实源定义。

因此，A-full 可作为用户决策时的推荐选项，但当前仍未被接受。

### 4.2 方案 B

若新增 Lifecycle／Revision 表与 `tenant_members` 同时承担 current 真相，会形成第二事实源，违反既有 Owner 与单一业务事实源边界。决策包已把该永久 sidecar 解释排除。

若未来选择 canonical replacement，必须先通过独立 ADR 明确新表成为唯一 current、旧表退出、读写切换、历史迁移和回退边界；这不是当前决策包可直接接受的普通变体。

### 4.3 方案 C

以下现有证据均不能替代稳定 revision：

- `tenant_members.updated_at` 没有证明严格单调、每次生命周期变更必然更新或 CAS 原子性；
- Binding version 属于不同事实域；
- hash／HMAC 可验证受控编码，却不能创造单调序列，也不能单独防止 ABA；
- 现有字段组合没有可证明的并发更新协议。

因此，方案 C 的淘汰结论成立，不应进入用户合法选择集。

## 5. 推荐与实施方向

独立审查支持将以下内容提交给用户集中决定：

1. 推荐 A-full：保持 `tenant_members` 为 Access Control 唯一 canonical current；
2. 引入显式、稳定、严格单调的 Membership revision，并以 expected revision 执行 CAS；
3. 明确 revoke／refresh／rebind、终止态、重新建立关系和新 incarnation 的 ABA 语义；
4. 在同一事务内写入 canonical current 与 immutable transition evidence；
5. 后续以独立 Schema／Migration 预检精确冻结列、约束、索引、transition evidence 载体、Writer allowlist、回滚和 forward-fix。

上述方向仍是 proposed recommendation。用户未明确接受前，不得创建 Schema／Migration 预检任务，更不得恢复 B1 Runtime。

## 6. 对 BASE-B1～B6 的复审结论

| 阶段 | 当前结论 |
| --- | --- |
| BASE-B1 | 继续阻断。缺少 accepted Membership revision 架构，不能实施 Runtime。 |
| BASE-B2 | 未启动。Membership／Binding lifecycle、CAS、tombstone、transition evidence 与原子联动均待后续接受和实施；不得建立第二套 Membership／Authorization Provenance。 |
| BASE-B3 | 未启动。正式 Session／上下文刷新必须等待 Owner Port 可实时重读 Membership／Binding／Scope 三类 revision，不得信任 Session claim。 |
| BASE-B4 | 未启动。入口、业务与对象 Guard 及绕过闭环尚未建立；旧入口必须委托正式授权根或保持关闭。 |
| BASE-B5 | 未启动。historical orphan 的 Owner 与修复授权保持独立。 |
| BASE-B6 | 完成证明不具备。B1～B5、两个 orphan、direct writer／deleter 等门未关闭，Reader 当前不得放行。 |

## 7. 非阻断观察

本轮未发现 P0 或 P1 问题。未来用户若接受 A-full，后续预检仍必须单独回答：

- revision 初始值、递增规则、溢出与不可回退约束；
- lifecycle status、tombstone、incarnation identity 与 provenance 的精确字段或关系；
- immutable transition evidence 的物理载体和唯一性；
- 现有 Membership Writer 的完整迁移清单与 CAS 失败语义；
- Reader 新鲜度验证、缓存失效和兼容窗口；
- Migration 编号、Lease、数据校准、恢复点和 forward-fix。

这些是后续预检必须冻结的实施细节，不构成本决策包审查失败，也不构成当前实施授权。

## 8. 审查判定

PR #858 已完整说明当前缺口、三个方案、推荐、Schema／Migration 方向、BASE-B1～B6 影响、Reader／Writer 边界、回滚与停止条件。A-full 推荐与既有单一业务 Owner 约束一致，且明确保持 proposed 状态。

因此，独立审查通过；允许进入决策 handoff，并由 handoff 将唯一下一任务冻结为 `BASE-02 Membership Revision 架构决策接受`。该资格只允许用户接受或拒绝推荐，不允许自动进入 Schema／Migration 或 Runtime。

```text
base02_membership_revision_architecture_review=passed
reviewed_pr=858
reviewed_head=95109315b0366f9a7f2b6bb45dd7498e4e2dbfa6
reviewed_merge_commit=1712b357cea3ef8147e87e7812c67a39e07c13f0
required_check_run=30689389362
required_check_job=91341284170
membership_revision_option_c=eliminated
decision_pack_recommendation=A-full_same_table_lifecycle
decision_pack_recommendation_status=proposed
membership_revision_decision_accepted=false
eligible_for_membership_revision_decision_handoff=true
eligible_for_membership_revision_acceptance=false
eligible_for_schema_migration_preflight=false
eligible_for_base_b1_runtime=false
eligible_for_reader=false
historical_orphan_modified=false
a2_p2_scope_fk_validated=false
base_b2_started=false
writer_started=false
reader_started=false
```
