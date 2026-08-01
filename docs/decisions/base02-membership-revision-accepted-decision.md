# BASE-02 Membership Revision A-full 已接受架构决策

> 状态：`accepted`
>
> 接受方向：`A-full_same_table_lifecycle`
>
> 接受日期：2026-08-01
>
> 记录基线：`8f3b0a3550a23ac13824fe2c3a1773d0b643a87a`
>
> 授权来源：用户对当前任务的明确接受
>
> 本文只接受 Membership revision 与生命周期的架构语义，不是 Schema、Migration、Runtime、数据库或 BASE-B1 实施授权。

## 1. 决策定位

用户在当前任务中正式接受 A-full。该方向保持 `tenant_members` 为 Access Control 唯一 canonical
Membership current，并把显式 revision、生命周期、CAS、ABA 防护、provenance 与不可变 transition
evidence 作为不可拆分的架构组合。

本文是独立的 accepted decision 记录，不改写或回填以下历史 proposed 材料：

- `docs/decisions/base02-membership-revision-lifecycle-decision-pack-20260801.md`；
- `docs/decisions/base02-membership-revision-architecture-decision-pack.md`。

上述材料仍负责保留方案比较、证据与未冻结的物理选项；其历史 `proposed` 状态不因本文合并而改变。
本文也不把 proposed 决策包中的具体字段、枚举、表结构、Migration 编号、SQL、回填或环境方案自动
升级为 accepted。

## 2. 已接受的 canonical current 与 Owner 边界

### 2.1 唯一 canonical Membership current

`tenant_members` 继续作为 Access Control 所有的唯一 canonical Membership current：

- Membership 是否存在、当前授权状态、当前 revision 与 current provenance 只能由该 canonical current
  回答；
- immutable transition evidence 只记录历史变化，不得成为第二套 current 事实源；
- Repository、共享数据库、Migration、Session claim、HMAC、缓存或兼容投影均不得成为 Membership
  Owner。

### 2.2 已冻结且不得重开的 Owner

| 事实域 | 唯一 Owner | 本决策的边界 |
|---|---|---|
| 用户、账号、正式 Session | Identity | Session 只提供 selector／provenance，不能单独授权 |
| Membership 与 Binding 生命周期 | Access Control | 包括 authoritative current、命令边界、Authorization Provenance、Fresh Membership、Guard 与 Action Policy |
| Scope、Context 与 Scope revision 原始事实 | Tenancy | Access Control 只能通过受控 Port 消费，不复制为第二事实源 |
| 通用安全能力 | Security | 提供密钥、codec、低敏输出和安全开关，不拥有 Membership、Binding 或 Scope |

Operating Context Head／Version 不进入本轮 BASE-02 授权组合，也不因本决策获得新的持久化 Owner。

## 3. 三个独立版本域

Membership revision、Binding version 与 Scope revision 是三个独立版本域：

1. Membership revision 只表达 Access Control Membership 生命周期的成功变化；
2. Binding version 只表达 Access Control Binding 生命周期的变化；
3. Scope revision 只表达 Tenancy Scope 原始事实的变化。

三者互不替代，也不得为了掩盖另一个版本域的变化而人为推进。特别是：

- Binding rebind 必须通过 Binding identity／version 表达；Membership 事实未变化时不得推进 Membership
  revision；
- `tenant_members.updated_at`、Binding version、Scope revision、Session claim、hash／HMAC、随机 token
  或现有字段组合都不能替代 Membership revision。

## 4. 已接受的 Membership revision 不变量

Membership 必须具备显式、持久、稳定且严格单调的 revision：

- 每个授权相关成功变化都必须从当前 revision 严格前进，不能复用、重置或倒退；
- 命令必须携带 `expectedRevision`，并由数据库条件写形成 CAS；
- 同一旧 revision 上的并发命令最多一个成功；
- stale、future、非法 revision 或 CAS 不命中必须 fail-closed；
- CAS 冲突不得通过自动重试变成未经调用方重新确认的新命令；
- revision 的 SQL 类型、列名、初值、上限与溢出策略仍由后续前置预检冻结。

该不变量排除了用墙钟、`updated_at`、哈希或其他版本域模拟 revision 的方案。

## 5. 已接受的生命周期语义

### 5.1 create

create 必须建立新的 canonical Membership identity、明确的初始 revision、current provenance 与对应的
immutable transition evidence。是否采用何种唯一键、字段与约束由后续 Schema／Migration 前置预检
决定；本决策只冻结“新 identity、无复用、原子形成”的语义。

### 5.2 授权相关 refresh

- 纯观察性 refresh 只重读 current，不写入也不推进 revision；
- 改变已接受授权事实的 refresh 必须经 `expectedRevision` CAS，并严格推进 revision；
- 哪些具体业务字段属于授权事实，必须在后续前置预检中逐项冻结，本文不提前决定字段 allowlist。

### 5.3 revoke

revoke 必须形成可识别的非 active current、推进 revision，并使旧 Membership evidence 失效。它不能
被折叠为丢失身份与历史的无证物理删除。

### 5.4 delete、tombstone 与 incarnation

- delete 必须保留 tombstone 语义；deleted tombstone 默认不得复活；
- Membership identity 与 revision 不得复用或重置；
- 旧 evidence 必须永久失效，不能因物理删除后以相同 identity 和初值重建而重新有效；
- 若未来确需新 incarnation，必须使用新的 identity，并由独立预检冻结其精确模型；
- tombstone 的物理字段、保留期与最终清理政策未在本任务中接受。

### 5.5 Binding rebind

Binding rebind 由 Binding 生命周期独立表达。它不得通过推进 Membership revision 掩盖，亦不得把
Binding version 反向当作 Membership revision。Membership 与 Binding 的跨聚合一致性、锁序和具体
事务编排仍须在后续预检中冻结。

## 6. provenance 与不可变 transition evidence

每次 canonical Membership current 的成功变化必须同时形成：

1. 可解释当前状态的 current provenance；
2. 记录该次变化的 immutable transition evidence。

两者必须与 canonical current 在同一事务中原子形成：current 成功而 evidence 缺失、evidence 成功而
current 失败，均不可接受。transition evidence 只能是 append-only 历史证据，不能回答 current，也
不能形成永久 sidecar current。

本决策接受上述语义，但不决定 transition evidence 的表名、字段、主键、索引、外键、物理表数量、
存储期限或 Migration 切片。

## 7. 唯一 Writer 边界

所有 Membership 生命周期写入最终只能经过 Access Control 唯一命令／Writer 边界：

- create、授权相关 refresh、revoke 与 delete 必须遵守同一 CAS、生命周期和 evidence 协议；
- onboarding、reset、seed、脚本或其他 direct writer 必须在未来实施中迁移到该边界，或保持禁用；
- 旧 Writer 不得在失败回退时重新获得“不推进 revision”的写权限；
- 本决策只接受目标边界，不表示任何 Writer 已迁移、封堵或获得执行授权。

## 8. 方案裁定

### 8.1 A-full：accepted

A-full 作为不可拆分组合被正式接受：

- `tenant_members` 同表 canonical current；
- 显式严格单调 revision；
- `expectedRevision` CAS；
- create／授权相关 refresh／revoke／delete 生命周期；
- tombstone、incarnation identity 与 ABA 防护；
- current provenance；
- 同事务 immutable transition evidence；
- Access Control 唯一 Writer。

### 8.2 A-literal：interim only

只增加 revision 字段最多可以作为未来明确标记的临时载体，不能关闭完整 Membership 生命周期，
不能把 BASE-B1～B2 或 BASE-02 描述为完成。

### 8.3 永久 sidecar：排除

永久 sidecar current 会形成第二套 Membership current 事实源，继续排除。若未来要把新资产改为
canonical replacement，必须先通过独立 ADR 明确唯一 current、旧表退出、读写切换、历史迁移和
回退；本文不预先接受该方向。

### 8.4 方案 C：淘汰

`updated_at`、Binding version、hash／HMAC 或现有字段组合无法证明严格单调、CAS、ABA 与并发一致性，
正式淘汰，不得作为过渡、fallback 或应急实现。

## 9. Schema／Migration 与实施边界

A-full 需要未来 Schema 与 Migration 承载，但本次只接受架构方向，不接受任何物理设计或执行授权。
以下内容全部后置到独立的 Schema／Migration 前置预检：

- revision、lifecycle、tombstone、provenance 与 transition evidence 的具体字段名、类型、枚举、约束、
  默认值和物理载体；
- 初始 revision、状态机、授权字段 allowlist、新 incarnation 键形和 tombstone 保留政策；
- 现有数据校准、deterministic backfill、高水位、冲突清零与 provenance 规则；
- Writer 完整影响面、Reader 切换、兼容窗口与 Enforce 门禁；
- Migration 编号、Lease、journal、snapshot、SQL、锁序、超时、恢复点、环境与回滚／forward-fix；
- 任何 DDL、DML、数据库连接或部署安排。

接受的项目级顺序只到方向层：

```text
accepted decision
→ 独立接受审查
→ handoff
→ Membership Revision Schema／Migration 前置预检
→ 后续每个实施阶段另行授权
```

不得因本文合并而跳过独立审查、handoff 或前置预检。

## 10. 对 BASE-B1～B6、Writer 与 Reader 的影响

| 范围 | 本决策后的状态 | 仍需满足的门禁 |
|---|---|---|
| BASE-B1 | 架构选择已关闭，Runtime 继续 `blocked` | 前置预检、Schema／Migration 实施、显式 revision 可用及 Owner Adapter／Port 收口 |
| BASE-B2 | 未启动 | Membership／Binding 生命周期、CAS、provenance 与 evidence 实施 |
| BASE-B3 | 未启动 | 正式 Session 每请求重读 Membership／Binding／Scope 三个版本域 |
| BASE-B4 | 未启动 | Guard、Action Policy 与所有绕过路径闭环 |
| BASE-B5 | 未启动 | historical orphan 独立权威依据、数据授权与恢复点 |
| BASE-B6 | 完成证明不具备 | B1～B5 全部具证，Writer／orphan／Reader 门禁另行关闭 |
| 项目级 Writer | 未启动 | 独立实施与双写／旧 Writer 封堵授权 |
| Reader | 继续阻断 | BASE-02、Writer、Audit／模板、MIG-01B、MIG-01C 与独立放行 |

当前 active historical orphan／Scope relation orphan 的既有低敏审计值仍为 `1／1`；本决策不修改、
解释或授权修复任何 orphan。A2-P2 Scope FK 继续保持 `NOT VALID`／`convalidated=false`，不得因 A-full
接受而执行 `VALIDATE`。

## 11. 明确未授权

本文及其合并不授权：

- 修改 `src/**`、`drizzle/**`、scripts、tests、CI、package 或 lock；
- 具体 Schema、Migration、journal、snapshot、Migration Lease 或数据库操作；
- DDL、DML、Migration、Seed、回填、orphan 修复或 FK `VALIDATE`；
- BASE-B1～B6 Runtime；
- Writer、Audit／模板、MIG-01B、MIG-01C 或 Reader；
- 自动启动 Schema／Migration 前置预检。

## 12. 后续停止条件

后续任务出现以下任一情况必须停止：

- 只实现 revision 字段，却把 lifecycle、ABA、provenance 或 transition evidence 宣称为已关闭；
- 建立永久第二套 Membership current，或重开 Identity／Access Control／Tenancy／Security Owner；
- 复用或重置 Membership identity／revision，或允许 deleted tombstone 默认复活；
- 用 Binding version、Scope revision、`updated_at`、Session claim 或 HMAC 替代 Membership revision；
- canonical current 与 immutable transition evidence 不能同事务原子形成；
- 具体 Schema、Migration、Runtime 或数据库操作未获得独立授权；
- 夹带 orphan 修复、FK `VALIDATE`、Writer／Reader 放行或 BASE-B1～B6 实施。

## 13. 证据链

- `docs/decisions/base02-membership-revision-lifecycle-decision-pack-20260801.md`；
- `docs/decisions/base02-membership-revision-architecture-decision-pack.md`；
- `docs/operations/base02-membership-revision-architecture-independent-review-20260801.md`；
- `docs/handoff/NEXT_TASK.md`；
- `src/server/db/schema.ts`；
- `src/modules/auth/server/auth-account-repository.ts`；
- `src/modules/security/server/institution-membership-provider.ts`。

以上路径只作为本次已合并仓库证据；本文未修改其内容，也未连接数据库或外部环境。

## 14. 冻结状态

```text
membership_revision_architecture_decision=A-full_same_table_lifecycle
membership_revision_architecture_decision_status=accepted
membership_revision_decision_accepted=true
membership_canonical_current=tenant_members
membership_canonical_owner=Access_Control
membership_revision_explicit_required=true
membership_revision_strict_monotonic_required=true
membership_revision_cas_required=true
membership_revision_aba_protection_required=true
membership_transition_evidence_required=true
membership_transition_evidence_atomic_with_current=true
membership_revision_schema_required=true
membership_revision_migration_required=true
eligible_for_membership_revision_acceptance_review=true
eligible_for_schema_migration_preflight=false
eligible_for_schema_migration_implementation=false
eligible_for_base_b1_runtime=false
base_b1_runtime=blocked
base_b2_started=false
base_b3_started=false
base_b4_started=false
base_b5_started=false
base_b6_complete=false
historical_orphan_modified=false
a2_p2_scope_fk_validated=false
writer_started=false
reader_started=false
eligible_for_reader=false
```
