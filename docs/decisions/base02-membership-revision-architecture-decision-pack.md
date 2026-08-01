# BASE-02 Membership Revision 架构决策包

> 状态：`proposed architecture decision pack`
>
> 决策状态：`not accepted`
>
> 审计基线：`1edb71ca6a87df15b284c710ef80d0442ef97fe2`
>
> 审计日期：2026-08-01
>
> 前置：PR #857 已以 Merge Commit 合并
>
> 本文不是 ADR，不是 Schema／Migration／Runtime／数据库执行授权，也不接受或启动 BASE-B1～B6。

## 1. 文档定位

PR #857 已记录 BASE-B1 静态硬停止、Membership 生命周期不变量和 M01～M12 待决项。本文不改写
该历史材料，只按本轮指定的 A／B／C 口径专项比较 Membership revision 的持久化方向，并冻结：

- current 为什么不能继续；
- 推荐方向及其适用边界；
- 是否需要 Schema／Migration；
- 对 BASE-B1～B6、Reader、Writer、回退和停止条件的影响；
- 用户接受推荐前唯一可进入的下一任务。

本轮要求形成“推荐方案”，但没有给出 A／B 或其子方案的明确选择。因此推荐保持 `proposed`；
三条 PR 的合并只表示决策材料与独立审查进入仓库，不等于用户已经接受推荐。

## 2. 已冻结且不得重开的 Owner 边界

1. Identity 拥有用户、账号和正式 Session；Session 只能提供 selector／provenance，不能单独授权。
2. Access Control 是 Membership、Binding 生命周期、Fresh Membership、Authorization Provenance、
   短生命周期授权 evidence、机构／对象 Guard 与 Action Policy 的目标 Owner。
3. Tenancy 是 Institution Scope、Scope revision 与 Operating Context 原始事实的唯一 Owner；
   Access Control 只能通过版本化 Port／Reader 消费。
4. Security 只拥有密钥、codec、低敏输出和通用安全能力，不拥有 Membership、Binding 或 Scope。
5. Operating Context Head／Version 不进入本轮 BASE-02 授权组合。组合固定为：

   ```text
   Formal Session
   → Fresh Membership／membership revision
   → active Binding／binding revision
   → active Scope／scope revision
   ```

6. Membership、Binding、Scope 的 revision 是三个独立版本域；任何一个版本都不能替代另一个。
7. historical orphan 不在本决策包处理；A2-P2 外键保持 `NOT VALID`，Reader 继续阻断。

## 3. 当前问题

### 3.1 `tenant_members` 没有稳定 revision

`src/server/db/schema.ts` 的 `tenant_members` 当前只有 `id`、`tenant_id`、`user_id`、`role`、
`display_name` 和通用时间戳。`updated_at` 只配置 `defaultNow()`；仓库 Migration 没有证明它由唯一
Owner 在每次授权相关变更时单调推进的 trigger。该表还没有 lifecycle status、CAS version、
revoke／delete tombstone、expiry 或 provenance。

`src/modules/auth/server/auth-account-repository.ts` 把 `tenant_members.updated_at` 读取为
`membershipUpdatedAt`；`src/modules/security/server/institution-membership-provider.ts` 再将其规范化为
`membershipRevisionAt` 并纳入 HMAC reference。HMAC／WeakSet／exact-shape 能证明 reference 来自受控
codec，却不能把墙钟时间升级为 Owner 控制的 revision。

### 3.2 现有字段不能补齐缺口

- `auth_account_institution_bindings.version` 只属于 Binding 生命周期；Binding 变化和 Membership 变化
  可以独立发生。
- `institution_scopes.revision` 只属于 Tenancy Scope。
- `role`、`id`、`updated_at` 的 hash／HMAC 只能检测部分输入变化，不能提供 CAS 或严格单调性。
- 物理删除后重建相同 Membership 身份时，现有字段不能证明旧 evidence 永久失效。
- onboarding、trial reset、demo seed 和低敏 seed 仍有直接 INSERT／DELETE `tenant_members` 的路径，
  没有 Access Control 唯一 lifecycle Writer。

因此当前结论保持：

```text
membership_revision_current=insufficient
base_b1_runtime=blocked
```

## 4. Membership revision 必须满足的需求

| 需求 | 必须满足的语义 | 不可接受的替代 |
|---|---|---|
| 唯一 Owner | 只有 Access Control lifecycle Writer 可以创建或推进 revision | Auth、Security、Seed 或共享数据库资产各自推进 |
| 显式单调 | 初始 revision 明确；每个授权相关成功变更严格递增 | 墙钟、hash、随机 token 或 Binding version |
| CAS | command 携带 `expectedRevision`；affected rows 必须精确为 1 | 先读后写、last-write-wins 或自动重试 |
| 并发一致 | 同一旧 revision 的并发命令最多一个成功 | 两个命令都成功或静默覆盖 |
| ABA 防护 | Membership identity 与 revision 不复用、不重置；旧 evidence 永久失效 | 物理删除后以相同身份和初值重建 |
| 生命周期 | create／授权相关 refresh／revoke／delete 的 revision 推进和终态明确 | 把 revoke 折叠为物理 delete |
| 版本域隔离 | Membership、Binding、Scope 分别推进和重读 | 为掩盖一个版本域变化而推进另一个版本 |
| 低敏证据 | reference 只暴露低敏不可逆引用；每次授权重读权威 current | Session claim、客户端字段或 Demo Context 单独授权 |

观察性 refresh 只重读事实，不写行、不推进 revision；只有改变角色、状态、expiry 或其他已接受
授权事实的 refresh 才能以 CAS 推进。Binding rebind 必须撤销旧 active Binding 并创建新 Binding，
由 Binding identity／version 使旧 evidence 失效；Membership 本身未变化时不得为掩盖 rebind 而推进
Membership revision。

## 5. 三方案总览

本任务的方案编号与 PR #857 的 M01 编号不同，必须显式映射：

| 本文方案 | 实质 | 与 PR #857 的关系 | 完整性 | 当前结论 |
|---|---|---|---|---|
| A-literal | 只在 `tenant_members` 增加显式 revision | M01-A | 只解决 B1 载体 | `interim only` |
| A-full | 保留 `tenant_members` 为 canonical current，并同表补齐 revision＋lifecycle envelope | M01-B | 与 #857 推荐一致 | **推荐，仍为 proposed** |
| B | 新增 Membership Lifecycle／Revision current 表 | M01-C | 只有 canonical replacement 才完整 | `ADR first／不推荐` |
| C | 继续使用现有字段组合 | #857 已排除伪方案 | 无法满足最低不变量 | **淘汰** |

A-full 不是凭空增加第四方案，而是方案 A 要从“临时 revision 列”成为完整生命周期架构必须满足的
完成条件。若只接受 A-literal，BASE-B1 可以在未来获得版本载体，但 BASE-B2 仍会立即再次被 Schema
缺口阻断。

## 6. 方案 A：在 `tenant_members` 建立稳定 revision

### 6.1 Schema 影响

最低变化是给 `tenant_members` 增加显式正 revision。完整推荐 A-full 还要求同一 canonical current
行能区分 active／revoked／deleted，并承载 tombstone 和 current lifecycle provenance；精确类型、
字段名、状态约束、是否有 expiry 以及 immutable transition evidence 的持久化 shape 仍须在接受任务
与后续预检中冻结。

最终状态不能依赖会掩盖旧 Writer 的隐式默认值。新 Membership 必须由唯一 Owner 显式写入初值；
现有行的初值和 `legacy_unknown` provenance 必须经独立回填决策，不得把 Migration 时间伪装成历史
create／refresh／revoke／delete 的发生时间。

### 6.2 Migration 影响

方案 A 需要新的 Schema／Migration，且至少按以下阶段拆分：

```text
决策接受
→ Schema／Migration 静态预检
→ 实时编号与唯一 Migration Lease
→ Expand（允许旧 Runtime 继续读取；不伪造历史 provenance）
→ Access Control Writer 接管或封堵全部旧 Writer
→ 确定性 backfill／高水位追赶／冲突清零
→ Reader 从 updated_at 切换到显式 revision
→ Enforce（独立授权）
```

本任务不批准 Migration 编号、SQL stem、列、枚举、约束、journal 修改、Lease、回填 DML 或执行环境。
snapshot 与 `db:generate` 也不在范围。

### 6.3 CAS 实现方向

- create：以 `(tenant_id, user_id)` expected-absence 和唯一约束创建，显式写入初始 revision；冲突即
  fail-closed。
- refresh／role／status 变化：使用 `WHERE id = ? AND revision = expectedRevision`，在一个短事务内
  写入授权事实并严格 `revision = revision + 1`，`RETURNING` 行数必须为 1。
- revoke／delete：必须在同一 canonical 行推进 revision；delete 只能落为 tombstone，不能先物理
  删除再丢失版本历史。
- stale／future／非法 revision、affected rows 为 0 或大于 1、revision 上限、并发冲突均拒绝，且
  不自动重试。
- Membership revoke／delete 与 active Binding 的撤销按 A-full 推荐、仍待用户接受的 M12 边界在
  同一事务中完成；固定锁序和短事务边界由后续预检冻结。

### 6.4 revoke／refresh／rebind

- 授权相关 refresh：若授权事实变化则 CAS `+1`；纯读取或重新签发短期 evidence 不推进。
- revoke：从 active 进入 revoked，推进 revision，并使所有旧 Membership evidence 失效。
- delete：进入 deleted tombstone 终态，推进 revision；存在 Binding／引用时不得物理删除。
- reactivation：只有未来接受的状态机允许时，才能从 revoked 在同一 identity 上 CAS 推进；deleted
  不得复活。
- rebind：只改变 Binding identity／version；若 Membership 授权事实未变化，不推进 Membership
  revision。旧 Binding 必须撤销，新 Binding 必须新建。

### 6.5 ABA 防护

Membership `id`、canonical identity 和 revision 均不得重用或重置。deleted tombstone 默认保留；
未来物理清理只有在零引用、独立保留政策和 ABA 证明均具备后才能另行申请。A-literal 若没有这些
生命周期约束，只能是临时 B1 载体，不能被描述为完整解决方案。

### 6.6 Reader／Writer 影响

- Reader：Access Control authoritative Reader 必须返回显式 revision；缺失、重复、非 active、非法
  revision 或 Provider 不可用全部 fail-closed，禁止回退到 `updated_at`。
- Fresh Membership／Guard：低敏 reference 改为绑定显式 revision，并与 Binding／Scope revision
  分别重读；旧 reference 在任一版本变化后拒绝。
- Writer：onboarding、trial reset、demo seed、低敏 seed 和其他 direct writer 必须委托唯一 Owner
  或保持禁用；Enforce 前 direct writer／deleter 必须为 0。
- 业务 Reader／Capability：仍保持关闭，不能因授权事实 Reader 改造而提前放行。

### 6.7 回退

- Migration 尚未执行：通过普通 PR revert 撤回。
- Expand 已执行但 Runtime 未切换：保留兼容列，不做破坏性 DROP；用独立 forward-fix 修正。
- Writer 已切换：不得回退到不推进 revision 的旧 Writer；失败时关闭入口并 forward-fix。
- 共享环境已消费 SQL／journal：禁止改写历史 Migration；只能使用批准的恢复点或新 Migration
  forward-fix。

## 7. 方案 B：新增 Membership Lifecycle／Revision 表

### 7.1 两种含义必须分开

1. **永久 sidecar**：`tenant_members` 仍可独立写 current，新表另存 current lifecycle／revision。
   这会形成两个可漂移的 current 事实源，属于 `target-incompatible／排除`。
2. **canonical replacement**：新表成为 Access Control 唯一 current Membership 事实，
   `tenant_members` 退为不可独立写的 identity anchor／兼容投影，并有完整退出计划。该方向只有先通过
   独立 ADR 才可选择。

仅存 immutable transition evidence 的 append-only 资产不是第二 current 事实源，也不属于本文方案 B；
它可以作为 A-full 的历史证据，但不能独立回答 current Membership revision。

### 7.2 Schema、生命周期与查询路径

canonical replacement 至少新增表、唯一 identity、revision／status／tombstone／provenance 约束，
并重构 Binding 关系、Auth 查询、Fresh Membership Provider 和所有 Writer。查询必须以新表为唯一
current 来源；禁止长期 join 两份 current 后“择一可信”。

### 7.3 迁移成本与 Binding 关系

- 需要双读／双写过渡、行数守恒、冲突清零和旧表退出证明；成本显著高于 A。
- 当前 Binding FK 指向 `tenant_members(tenant_id, user_id)`；若新表成为 canonical，外键和历史
  Binding identity 必须重新设计，不能静默借用旧关系。
- 失败恢复必须证明新旧 current 没有分叉；长期 sidecar 无法提供这一证明。

### 7.4 CAS、ABA、Reader 与回退

新 canonical 表可以实现严格 CAS、tombstone 和 ABA 防护，但前提是所有写入口和 Reader 已原子切换。
至少需要按固定顺序锁定 canonical membership head／anchor、比较 `expectedRevision`、只允许写入严格
`expectedRevision + 1`，并以 `(membership_id, revision)` 唯一约束或等价数据库约束保证并发命令
一胜一败。deleted 必须是终态；若另建新 incarnation，必须使用新 identity，不能重置或复用旧
revision。回退需要维持旧表只读投影、双写追赶和可验证 cutover；在独立 ADR、退出计划和关系迁移
获接受前，该复杂度没有相对于 A 的必要收益。

因此方案 B 当前不推荐；若用户要求采用，必须先停止本接受流程并创建 canonical replacement ADR。

## 8. 方案 C：继续使用现有字段组合

| 证明项 | `updated_at`／role／id／HMAC 的现状 | 结论 |
|---|---|---|
| 单调性 | `updated_at` 只有插入默认值；没有唯一 Owner trigger 或严格递增约束 | 无法证明 |
| CAS 安全 | current Writer 没有 `expectedRevision` 条件和 affected-row 唯一性 | 无法证明 |
| ABA 安全 | 物理删除／重建可重新出现相同 identity、role 和时间组合 | 无法证明 |
| 并发一致 | 同时间戳连续写、时钟回拨和 last-write-wins 没有冲突协议 | 无法证明 |
| 生命周期 | 没有 status、revoke／delete tombstone 或 provenance | 无法证明 |
| 版本域隔离 | 借用 Binding version 会把两个独立生命周期耦合 | 不允许 |

HMAC 只证明受控 codec 对给定输入生成了 reference，不证明输入具备 revision 语义。因此：

```text
membership_revision_option_c=eliminated
```

方案 C 不得作为过渡、fallback 或应急实现。

## 9. 推荐方案

推荐 **A-full：`tenant_members` 同表显式 revision＋完整 lifecycle envelope**：

- 保持 Access Control 唯一 canonical current Membership 事实；
- 以显式单调 revision 关闭 B1 版本载体；
- 用同一 identity 的 status／tombstone／provenance 与同事务 transition evidence 支撑 B2；
- 不创建永久第二 current 事实源；
- 让 Membership、Binding、Scope 三类 revision 保持独立；
- 以分阶段 Expand／Writer／backfill／Reader／Enforce 降低迁移和回退风险。

A-literal 只可作为被明确标记的 interim 切片；不能宣称生命周期已关闭。方案 B 只在 ADR-first 的
canonical replacement 下可重新考虑；方案 C 已淘汰。

推荐理由是它与 PR #857 的结论、现有 Binding FK 和既有 `tenant_members` identity 一致，并且相较
方案 B 避免双 current 事实源和更大关系迁移。该推荐仍未被用户选择或接受。

## 10. 是否需要 Schema／Migration

```text
membership_revision_schema_required=true
membership_revision_migration_required=true
```

所有可用方向都需要 Schema 与 Migration；当前字段组合不存在纯 Runtime 修复。新的 Migration 方向
应是 A-full 的“同表 canonical current envelope＋经接受的 immutable transition evidence 资产”分阶段
Expand，而不是永久 current sidecar 或用 `updated_at` 兼容。transition evidence 的精确持久化 shape
可能需要独立表和额外 Migration；只增加同表字段不得宣称完整生命周期已经关闭。精确字段、约束、
证据资产、回填、SQL、journal、编号、Lease 和执行仍须后续独立任务批准。

## 11. 对 BASE-B1～B6 的影响

| 阶段 | 本决策包后的状态 | 继续条件 |
|---|---|---|
| B1 Owner／Port／revision | 架构推荐已形成，Runtime 仍阻断 | 用户接受 A-full；Schema／Migration 预检、实施和显式 revision 可用 |
| B2 Membership／Binding 生命周期 | 未启动 | status／tombstone／CAS／provenance 与 Membership／Binding 原子联动获接受并实施 |
| B3 Session／上下文刷新 | 未启动 | 正式 Session 每次通过 Owner Port 重读 Membership／Binding／Scope revision；不信任 claim |
| B4 Guard／绕过闭环 | 未启动 | Guard 绑定三类独立 revision；Owner Adapter 唯一；旧入口委托或保持关闭 |
| B5 historical orphan 处置 | 未启动 | 独立权威依据、数据授权和恢复点；本决策不处理 orphan |
| B6 完成证明 | 不具备 | B1～B5 具证、两个 orphan 为 0、direct writer／deleter 为 0；仍不在此阶段 `VALIDATE` 或放行 Reader |

因此“BASE-B1 是否可继续”的精确答案是：当前 Decision Pack 只能进入**独立审查**；独立审查与
handoff 通过后才可申请架构决策接受，但仍不能进入 Schema／Migration 预检或 Runtime。推荐未接受前
`base_b1_runtime` 继续阻断。

## 12. Reader 影响

1. Auth／Security current 兼容 Reader 必须退出 `membershipUpdatedAt → membershipRevisionAt` 映射。
2. Access Control Owner Adapter 是 authoritative Membership／Binding Reader 的唯一生产者；普通
   Repository、fake Reader 或跨域直读不能签发 genuine evidence。
3. 正式 Session 只携带 selector／provenance；每个请求重读 current Membership、Binding、Scope。
4. 缺失、重复、revoked、deleted、过期、非法 revision、stale evidence 或 Provider 不可用全部
   fail-closed。
5. 业务 Reader 仍等待 BASE-02、Writer、Audit／模板、MIG-01B、MIG-01C 和独立放行，不因本决策
   合并而启动。

## 13. Writer 影响

未来所有授权相关命令必须由 Access Control 唯一 Writer 承担。至少需要封堵或迁移：

- `src/modules/open-platform/server/tenant-plan-binding-repository.ts` 的 onboarding INSERT；
- `src/modules/open-platform/server/trial-data-reset-service.ts` 的 DELETE；
- `src/server/db/seed-demo-data.ts` 的 demo delete／insert；
- `scripts/demo/seed-v06-low-sensitive-demo.ts` 的低敏 raw insert／delete。

配额和账号管理等 current Reader 也必须识别 lifecycle 状态，不能把任意存在行当作 active。真实 Seed、
Writer 双写、数据修复或业务入口开放均不属于本任务。

## 14. 回滚与 forward-fix 总则

- 文档未合并：删除任务分支即可；已合并文档用独立 revert PR。
- 未执行 Schema／Migration：普通 PR revert，不占编号或 Lease。
- 已执行 Expand：保持向后兼容，不破坏性 DROP；Runtime 未切换时继续 capability-off。
- 已切换 Writer：旧 Writer 不得恢复；入口关闭后通过独立 forward-fix。
- 已消费 Migration：SQL／journal 不可改写；只可按恢复点或新 Migration forward-fix。
- 任一阶段无法证明行数守恒、冲突清零、CAS 或 ABA 安全时，不进入下一阶段。

## 15. 停止条件

出现以下任一情况必须停止：

- 用户尚未明确接受 A-full，却要求直接进入 Schema／Migration 或 Runtime；
- 需要永久第二套 Membership current 事实源；
- 无法冻结唯一 Access Control Owner 或出现循环依赖；
- 需要用 `updated_at`、Binding version、Session claim、hash 或随机 token 冒充 revision；
- 无法证明 expected-absence、strict `+1`、affected rows=`1`、并发一胜一败或 ABA 拒绝；
- 需要本任务修改 Schema、Migration、journal、snapshot、数据库、Runtime、脚本、测试、CI、package
  或 lock；
- 需要处理 historical orphan、执行外键 `VALIDATE`、放行 Reader、启动 Writer、Audit／模板、
  MIG-01B／C 或 BASE-B2～B6；
- current、Owner 边界、PR #857 事实或 Required Check 发生无法解释的漂移。

## 16. 下一任务

唯一下一任务建议冻结为：

```text
BASE-02 Membership Revision 架构决策接受
```

该任务只允许用户接受、拒绝或要求调整 A-full 推荐，并把明确选择写入独立 accepted 记录／handoff；
不修改 Schema、Migration、Runtime 或数据库。只有推荐被明确接受后，后续 handoff 才能将唯一下一
任务切换为 `BASE-02 Membership Revision Schema／Migration 前置预检`。

## 17. 证据路径

- `docs/decisions/base02-membership-revision-lifecycle-decision-pack-20260801.md`
- `docs/decisions/mig01-a2-provisioning-accepted-decisions.md`
- `docs/handoff/NEXT_TASK.md`
- `src/server/db/schema.ts`
- `drizzle/0000_silky_speedball.sql`
- `drizzle/0020_tenant_formal_accounts.sql`
- `drizzle/0037_v08_05b_b3a_real_task_readiness_foundation.sql`
- `src/modules/auth/domain/auth-account.ts`
- `src/modules/auth/server/auth-account-repository.ts`
- `src/modules/security/server/institution-membership-provider.ts`
- `src/modules/security/server/institution-scope-guard.ts`
- `src/modules/auth/server/formal-server-session-provenance-owner.ts`
- `src/modules/open-platform/server/tenant-plan-binding-repository.ts`
- `src/modules/open-platform/server/trial-data-reset-service.ts`
- `src/server/db/seed-demo-data.ts`
- `scripts/demo/seed-v06-low-sensitive-demo.ts`

## 18. 最终冻结状态

```text
membership_revision_current=insufficient
membership_revision_option_c=eliminated
membership_revision_recommendation=A-full_same_table_lifecycle
membership_revision_recommendation_status=proposed
membership_revision_decision_accepted=false
membership_revision_schema_required=true
membership_revision_migration_required=true
base_b1_runtime=blocked
eligible_for_membership_revision_independent_review=true
eligible_for_membership_revision_acceptance=false
eligible_for_schema_migration_preflight=false
eligible_for_base_b1_runtime=false
base_b2_started=false
base02_complete=false
historical_orphan_modified=false
a2_p2_scope_fk_validated=false
writer_started=false
reader_started=false
```
