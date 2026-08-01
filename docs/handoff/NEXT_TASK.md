# 智美天工唯一下一任务

## 当前交接状态

BASE-02 Membership Revision 的硬停止证据、架构决策包和独立审查已经依次进入 `main`：

- PR #857：Head `6eb2fb4e26371904be063463968d5744fd8edc65`，Merge Commit
  `1edb71ca6a87df15b284c710ef80d0442ef97fe2`，Run `30688242614`／Job
  `91338121169` 成功；
- PR #858：Head `95109315b0366f9a7f2b6bb45dd7498e4e2dbfa6`，Merge Commit
  `1712b357cea3ef8147e87e7812c67a39e07c13f0`，Run `30689389362`／Job
  `91341284170` 成功；
- PR #859：Head `e6a5e403bb8ea1f85ba763d4251ad1ed010b1e38`，Merge Commit
  `aa7c8d53b9605a900dac461b1859084f2219ab8f`，Run `30689872741`／Job
  `91342595113` 成功；
- 独立审查结论：`base02_membership_revision_architecture_review=passed`；
- A-full 仍为 `proposed` 推荐，`membership_revision_decision_accepted=false`；
- BASE-B1 Runtime 继续阻断，Schema／Migration 预检和实施均未启动。

上述材料进入 `main` 只证明决策证据完整、独立审查通过，不构成用户已经接受推荐，也不构成
Schema、Migration、Runtime、数据修复或数据库操作授权。

## 唯一下一任务

```text
BASE-02 Membership Revision 架构决策接受
```

仓库当前没有该任务的正式 `V2-*` 编号，本 handoff 不自行创造编号。

当前状态：**尚未启动、尚未授权**。

本任务只允许用户明确接受、拒绝或调整 proposed 推荐，并把选择记录为独立 accepted decision。
它不是 Schema／Migration 预检，不是 BASE-B1 Runtime，也不允许顺手修改代码或数据库。

## 一、必须决定的内容

### 1. canonical current 与推荐方向

用户必须明确选择是否接受 A-full：

- `tenant_members` 继续作为 Access Control 唯一 canonical Membership current；
- 建立显式、稳定、严格单调且可 CAS 的 Membership revision；
- 建立 lifecycle envelope、tombstone／current provenance；
- canonical current 与 immutable transition evidence 必须在同一事务内形成；
- revoke／refresh／rebind、终止态、重新建立关系和新 incarnation 必须具备明确 ABA 语义。

A-full 当前仅为推荐，不能因 Decision Pack 与审查合并而视为 accepted。

### 2. 不足或排除方案

- A-literal：只增加显式 revision，仅可作为 BASE-B1 interim carrier，不能关闭 B2 lifecycle；
- B：永久 sidecar 会形成第二套 current 事实源，不可接受；若要求 canonical replacement，必须先建
  立独立 ADR，明确唯一 current、旧表退出、读写切换、历史迁移和回退；
- C：`updated_at`、Binding version、hash／HMAC 或现有字段组合无法证明单调性、CAS、ABA 和并发
  一致性，已淘汰，不属于合法选择。

### 3. 决策组必须绑定

以下内容不能拆成互相矛盾的选择：

1. canonical current Owner；
2. revision 单调性与 expected-revision CAS；
3. revoke／refresh／rebind 和终止态语义；
4. tombstone、incarnation identity 与 ABA 防护；
5. current provenance 与 immutable transition evidence；
6. canonical current 与 transition evidence 的同事务原子性；
7. Writer 只能通过 Access Control 唯一命令边界变更 Membership。

若用户只接受显式 revision、但拒绝或遗漏生命周期与 ABA 语义，结果只能是 A-literal interim，
BASE-B1 Runtime 仍不得启动。

## 二、已冻结且不得重开的 Owner 边界

- Identity：用户、账号和正式 Session；
- Access Control：Membership、Binding 生命周期、Authorization Provenance、Fresh Membership、Anchor 授权证据、
  机构／对象 Guard 和 Action Policy；
- Tenancy：Scope、Context Version、Context Head、Manifest、Scope Revision 与 Provisioning
  Provenance 原始事实；
- Security：密钥、低敏输出、安全开关与通用安全能力；
- Operating Context Head／Version：不进入本轮 BASE-02 授权组合，也不成为新的持久化 Owner；
- Binding version：Binding 事实版本，不是 Membership revision。

本任务不得通过“接受 Membership revision 方案”重开上述 Owner，也不得让 Repository、数据库、
Migration、Session claim 或 HMAC 成为第二事实源。

## 三、接受后的后续顺序

即使用户接受 A-full，也只能由独立 handoff 冻结下一任务：

```text
BASE-02 Membership Revision 架构决策接受
→ 独立 handoff
→ Membership Revision Schema／Migration 前置预检
→ 独立 Schema／Migration 实施与验证
→ BASE-B1 Runtime 重新准入
→ BASE-B2 Membership／Binding lifecycle
→ BASE-B3 Session／上下文刷新
→ BASE-B4 Guard／绕过闭环
→ BASE-B5 historical orphan 独立处置
→ BASE-B6 完成证明
→ Writer
→ Audit／模板
→ MIG-01B
→ MIG-01C
→ Reader 独立复核与放行
```

接受决策不得直接跳到 Schema／Migration 或 BASE-B1 Runtime。后续预检必须另行冻结精确字段、
约束、transition evidence 载体、Writer allowlist、Migration 编号／Lease、数据校准、测试、恢复点、
回滚和 forward-fix。

## 四、继续保持的阻断

- BASE-B1 Runtime：缺少 accepted Membership revision，继续阻断；
- BASE-B2～B4：lifecycle、Session 刷新、Guard 与绕过闭环均未启动；
- BASE-B5：active historical orphan 与 Scope 关系 orphan 仍为 `1／1`，修复未授权；
- BASE-B6：完成证明不具备；
- A2-P2 外键：继续 `NOT VALID`／`convalidated=false`，不得执行 `VALIDATE`；
- Writer、Audit／模板、MIG-01B、MIG-01C、Reader：继续阻断；
- 正式平台服务端授权根仍为独立缺口，七线正式发布仍为 `0/7`。

环境计数是既有审计窗口的低敏证据，不是永久状态；任何未来数据库任务都必须重新冻结环境。

## 五、允许范围

未来“架构决策接受”任务只允许：

- 读取 PR #857～#859 及其三份证据文档；
- 记录用户对 A-full 的接受、拒绝或调整；
- 形成单一 accepted decision 文档；
- 更新必要的 handoff 状态；
- 通过独立 Draft PR、Required Check、Ready／Merge 授权链交付。

若用户调整方向与既有 target 或 Owner 冲突，必须先停止并明确是否需要独立 ADR，不能在 accepted
decision 中静默改写架构目标。

## 六、当前禁止范围

当前不授权：

- 修改 `src/**`、`drizzle/**`、scripts、tests、CI、package、lock；
- 创建或修改 Schema、Migration、journal、snapshot、Migration Lease；
- 数据库连接、DDL、DML、Migration、Seed、回填或数据校准；
- BASE-B1～B6 Runtime；
- orphan UPDATE、DELETE、INSERT、重绑、撤销或补 Scope；
- 外键 `VALIDATE`、`SET NOT NULL`；
- Writer、Audit／模板、MIG-01B、MIG-01C 或 Reader；
- 把 proposed 推荐写成已接受，或自动启动后续任务。

## 七、停止条件

出现以下任一情况时停止决策接受：

- 用户没有明确接受、拒绝或调整 A-full；
- 选择只覆盖 revision 字段而未覆盖 lifecycle、ABA 与 transition evidence；
- 要求永久 sidecar 同时承担 current，但没有 ADR 与旧表退出计划；
- 要求恢复方案 C；
- 需要修改 Schema、Migration、Runtime、数据库或超出 docs-only 文件范围；
- Owner、current 事实或已接受 target 出现无法解释冲突；
- baseline、PR 证据或工作树发生漂移。

## 八、交付判定

```text
next_task=BASE-02 Membership Revision 架构决策接受
next_task_started=false
next_task_authorized=false
membership_revision_recommendation=A-full_same_table_lifecycle
membership_revision_recommendation_status=proposed
membership_revision_decision_accepted=false
eligible_for_membership_revision_acceptance=true
eligible_for_schema_migration_preflight=false
eligible_for_base_b1_runtime=false
base_b1_runtime=blocked
base_b2_started=false
writer_started=false
reader_started=false
```
