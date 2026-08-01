# BASE-02 Membership revision 与生命周期 Migration 决策包

> 任务：BASE-B1 静态硬停止后的独立 Migration 决策包
>
> 状态：`proposed decision pack`
>
> 审计基线：`190cdfffcc05f46b37bf734229928dc17fd910ed`
>
> 审计日期：2026-08-01
>
> 本文不是 ADR，不是 `accepted decision`，不是 Schema／Migration／Runtime 实施授权，也不是 BASE-B1～B5 完成证明。

## 1. 文档定位与硬停止结论

PR #854～#856 已将 BASE-02 准入方案、独立审查和 handoff 合并到 `main`。本轮随后按用户授权对
BASE-B1～B4 的 Runtime 前置条件进行仓库静态复核，确认当前字段不能正确表达稳定、单调、可
CAS 且可抵抗删除重建 ABA 的 Membership revision，也不能区分 Membership
create／refresh／revoke／delete 的完整生命周期。

因此触发当前任务的明确硬停止条件：

```text
base_b1_runtime=blocked
membership_revision_current=insufficient
membership_lifecycle_schema_decision_required=true
base_b2_started=false
base_b3_started=false
base_b4_started=false
base_b5_started=false
base02_complete=false
```

本决策包只冻结事实、可接受方案、推荐方向、待用户决定项和后续切片边界。推荐不等于已接受；
用户选择栏留空时，BASE-B1 Runtime 以及后续 BASE-B2～B5 继续阻断。

## 2. 已接受且不得重开的架构边界

以下边界来自已接受决策和本轮用户指令的明确新决定，本决策包不得重新分配。特别是第 5、7 项
由本轮用户指令直接冻结，权威高于此前已合并 handoff 中保留的 proposed／待决状态：

1. Identity 拥有用户、账号和正式 Session；正式 Session 只是 selector／provenance，不能单独授权。
2. Access Control 是 Membership、Binding 生命周期、Fresh Membership、Authorization
   Provenance、短生命周期 Anchor evidence、机构／对象 Guard 与 Action Policy 的目标 Owner。
3. Tenancy 是 Institution Scope、Scope revision 和 Operating Context 原始事实的唯一 Owner；
   Access Control 只能通过版本化 Port／Reader 消费，不复制第二套 Scope 事实。
4. Security 只拥有密钥、codec、低敏输出和通用安全能力，不拥有 Membership、Binding 或 Scope。
5. Operating Context Head／Version 不进入本轮 BASE-02 授权组合。授权组合固定为：

   ```text
   Formal Session
   → Fresh Membership
   → active Binding／binding revision
   → active Scope／scope revision
   ```

6. 多 Membership 必须显式选择 tenant，否则 fail-closed；禁止无排序 `.limit(1)` 或隐式第一条。
7. Binding rebind 必须在同一事务内撤销旧 active Binding 并创建新 Binding，保留历史和 provenance；
   禁止原地改写旧行的 institution。
8. 一个 account＋tenant 最多一个 active Binding。
9. historical orphan 不在本决策包处理；不得创建 Scope、修改 Binding、执行外键 `VALIDATE` 或
   放行 Reader。

## 3. current 事实

### 3.1 Membership 只能表达存在关系和角色

`src/server/db/schema.ts` 中的 `tenant_members` 当前只有：

- `id`；
- `tenant_id`；
- `user_id`；
- `role`；
- `display_name`；
- 通用 `created_at`／`updated_at`。

它具有 `(tenant_id, user_id)` 唯一索引，但没有显式 lifecycle status、version／revision、
`expires_at`、`revoked_at`、删除 tombstone、source、actor 或 reason。`timestamps.updatedAt` 只有
`defaultNow()`；仓库 Migration 中没有证明它在每次授权相关变化时由唯一 Owner 单调推进的 trigger。

`src/modules/auth/domain/auth-account.ts` 的 `AuthTenantMembershipRecord` 也只暴露上述存在关系、角色和
时间戳，没有可用于 CAS 的显式 revision。

### 3.2 current 把普通时间戳投影成 Membership revision

`src/modules/auth/server/auth-account-repository.ts` 的
`findCurrentInstitutionMembershipFacts` 将 `tenant_members.updated_at` 读为
`membershipUpdatedAt`。`src/modules/security/server/institution-membership-provider.ts` 随后：

- 把该值规范化为 `membershipRevisionAt`；
- 将 `membershipId + membershipRevisionAt + role` 编入受控引用；
- 与 Binding revision 一起签发 Fresh Membership evidence。

HMAC／WeakSet／exact-shape 校验可以拒绝任意 DTO、克隆或格式伪造，但不会把一个普通墙钟时间戳
升级为 Owner 控制的单调 revision，也不能证明 refresh、revoke、delete 或重建一定改变 revision。
同一时刻的连续更新、时钟回拨、非授权字段更新和删除后重建均缺少可证明的 CAS／ABA 语义。

### 3.3 Binding 与 Scope 的字段能力不同

`auth_account_institution_bindings` 已有：

- `active／revoked` status；
- source、assigned actor／time、expiry、revoked time；
- 正整数 `version`；
- account＋tenant active 部分唯一索引；
- Membership 与 Scope 关系、shape／expiry／source／version 检查。

这些字段可以承载 Binding revision 和有效性，但当前仓库没有 Access Control 唯一生命周期
Writer／CAS；`revoked_by`／reason／rebind provenance 是否必须持久化仍待决定。Binding version 不能
借给 Membership 作为 revision。tenant-account FK 指向
`tenant_members(tenant_id, user_id)`；Scope FK 已存在但保持 `convalidated=false`，环境中仍有
Scope 关系 orphan=`1`。因此 Schema 声明会约束未来新写入，但不能证明历史数据已经一致。

`institution_scopes` 已有 active／suspended status、复合标识和正整数 revision，字段层面可由
Tenancy versioned Reader 提供 active Scope／revision。Access Control 不得直接复制该事实。

### 3.4 current 生命周期入口与选择缺口

- `findPrimaryTenantMembershipByUserId` 只按 `userId` 查询并无排序 `.limit(1)`，多 Membership 下会
  非确定选择；
- 当前 Auth Repository 混合读取 account、Membership 与 Binding，没有 Membership／Binding command；
- open-platform onboarding、trial reset、demo seed 和低敏 seed 存在直接 INSERT／DELETE
  `tenant_members` 的路径，尚未委托 Access Control Owner；
- Membership 物理删除会与保留历史 Binding 的外键边界冲突，且无法区分 revoke 与 delete；
- 当前机构业务 Reader／Capability 继续关闭，这些缺口不能通过开放 Reader 绕过。

### 3.5 本轮没有发生的操作

本轮没有连接数据库，没有读取凭证或环境变量，没有修改 Runtime、Schema、Migration、journal、
snapshot、scripts、tests、CI、package 或 lock，也没有执行 DDL、DML、Seed、`db:generate`、
Migration、外键 `VALIDATE`、orphan 修复或 Reader 放行。

### 3.6 authoritative 来源真实性仍未闭环

current 的 Auth Repository 同时读取 Identity account、Membership 与 Binding；Security 下的
Repository 直接读取 Tenancy Scope；Auth request owner 反向组合 Membership Provider；institution
composition root 仍构造跨域具体 Repository。导出的 Membership reader factory 可接受普通
Repository，Anchor Provider 也可接受结构化 Reader。现有 HMAC／WeakSet 能证明对象经过受控工厂，
却不能单独证明事实必然来自 Access Control 或 Tenancy 的唯一 Owner Adapter。

后续 B1 必须把 authoritative reader／provider 的创建权收敛到唯一 Owner Adapter 和 composition
root，并以 import／factory 负测阻止普通 Repository、fake Reader 或跨域直读签发 genuine evidence。
该缺口不能通过扩大 Security Guard 所有权解决。

## 4. 稳定 Membership revision 的最低不变量

所有可接受方案共同的最低门是：

1. **Owner 唯一**：只有 Access Control lifecycle Writer 能推进 Membership revision。
2. **显式单调**：授权相关成功变更必须使 revision 严格递增；禁止用墙钟、hash 或 Binding version
   代替。
3. **CAS**：create 使用 expected-absence／唯一插入；其他授权相关 command 携带
   `expectedRevision`。旧 revision、affected rows 非 1、重复 active 或并发冲突全部 fail-closed，
   且不得自动重试。
4. **授权相关变更集合明确**：至少覆盖角色、有效状态、revoke、delete 和重新激活政策；
   Membership 是否支持 expiry、displayName 是否推进 revision 必须明确决定。
5. **ABA 可证明拒绝**：删除／重建不能让旧 evidence 再次匹配；Membership ID 重用和 revision
   重置政策必须明确。
6. **Binding／Scope 独立 revision**：Membership、Binding、Scope 三类 revision 分别由其 Owner
   推进，Guard 必须同时绑定并重读，任何一个漂移都拒绝旧 evidence。
7. **Owner 来源真实性**：只有 Access Control 唯一 Owner Adapter／composition root 能创建
   authoritative Membership／Binding Reader 与 Provider；普通 Repository、fake Reader、跨域直读或
   同进程持有 codec 的调用方不得把自造 row 升格为 genuine evidence。

若选择完整 lifecycle 方案，还必须额外满足：create、refresh、revoke、delete 状态可区分；每次
转换的 source、actor、time、reason 和前后 revision 有不可变 evidence；current canonical state 与
transition evidence 职责分开，但后者不得成为第二套 current Membership 事实源。

## 5. 方案比较

### 5.1 方案 A：只给 `tenant_members` 增加显式 revision

**状态**：`target-compatible／interim only`，但只关闭 BASE-B1 的 revision 载体，不是完整生命周期
的最终可接受方案，不能完成 BASE-B2。

方向：在现表增加显式正整数 revision；授权相关更新使用 expected revision CAS 并递增。

优点：

- 最小 Schema 变化；
- 可让 Fresh Membership evidence 不再依赖 `updated_at`；
- 有利于先拆分 B1 Port／Provider。

不足与风险：

- 没有 status、revoke／delete tombstone 和 provenance；若用户选择 Membership expiry，当前也没有
  对应字段；
- revoke 仍只能被错误折叠为物理 delete；
- 不能独立满足用户要求的 B2 create／refresh／revoke／delete 生命周期；
- 会产生第二次必需 Migration，延长双口径窗口。

### 5.2 方案 B：在 `tenant_members` 内建立显式 revision 与完整生命周期

**状态**：`target-compatible`，**推荐方向**，但字段、状态机、回填和约束仍须用户逐项接受。

方向：保留 `tenant_members` 作为 Access Control 的唯一 Membership current 持久化事实，在同一
关系中增加：

- 显式单调 revision；
- lifecycle status；
- 可选 expiry 以及 revoke／delete 的时间与 tombstone 语义；
- current 行所需的 source、actor、reason 等 provenance；
- 与 create／refresh／revoke／delete 对应的 CAS／shape 约束。

完整 lifecycle 必须在同一事务中追加由 Access Control 所有的 immutable lifecycle transition
evidence，保存 before／after revision 与命令 provenance。它只证明状态转换，不承担 current
Membership 查询，不能成为第二事实源；具体持久化 shape 属于 M06 的待决项，不能在本决策包中
直接接受。只保存 current latest provenance 或依赖后续跨域 Audit 均不能满足 M01-B。

优点：

- 不新增第二套 Membership 事实源；
- B1 revision 与 B2 lifecycle 可以使用同一 Owner、同一 CAS 语义；
- 现有 Binding FK 使用 `(tenant_id, account_id) -> (tenant_id, user_id)` 自然键；能否复活同一
  Membership incarnation、是否允许新 incarnation 以及如何解释旧 revoked Binding 必须由 M11
  冻结，不能只凭现有 FK 推断；
- 可让现有行在一次明确的 Expand／backfill／Writer／Enforce 链中迁移。

风险与成本：

- 状态枚举、删除保留期、ID 重用、provenance 字段和现有行回填都需要 accepted decision；
- 旧 onboarding／reset／seed 路径必须迁移到 Owner 或保持禁用；
- 在全部 Writer 迁移前不能启用严格 Enforce；
- future Migration 可能包含确定性 backfill DML，必须单独授权和验证，不属于本任务。

### 5.3 方案 C：独立 canonical Membership lifecycle／head 表

**状态**：`conditional／ADR first`。只有先通过独立 ADR，使新表成为 Access Control 唯一
canonical Owner、`tenant_members` 明确退为只读兼容投影并有可验证退出计划后，才可成为普通
选项；ADR 合并前不是本决策包可直接接受的用户选择。永久 sidecar 是第二事实源，属于
`target-incompatible／排除`。

优点是状态机和 revision 可以从旧表解耦；缺点是双读／双写、关系迁移、Binding 外键和退出计划
复杂度最高。若用户要求采用，必须先冻结唯一 canonical 表、旧表退役、原子同步、失败恢复和最终
删除兼容投影的完整 ADR；不能把 sidecar revision 表作为永久补丁。

### 5.4 明确排除的伪方案

以下做法不能作为普通选项：

- 继续用 `updated_at`；
- 借用 `auth_account_institution_bindings.version`；
- 用 HMAC／hash／随机 token 代替 Owner revision；
- 只在 Audit 写 revision 而 Membership current 不持有；
- 用 Session claim、客户端 tenant／institution、缓存 Anchor 或 Demo Context 作为 revision；
- 为绕过 Schema 缺口开放业务 Reader／Capability。

## 6. 用户决策总表

所有“用户选择”当前均留空。只有用户对对应编号明确选择后，后续独立 handoff 才能记录为
accepted；本决策包合并本身不接受任何选项。

选项合法性规则：`target-compatible` 的完整方案可以在后续接受；`interim only` 只能作为明确的
中间切片，不能关闭完整 lifecycle；`ADR first` 必须先合并独立 ADR；标为不足或排除的反例不得
写入 accepted handoff。

| 编号 | 决策主题 | 可选项 | 推荐 | 未决定时阻断 | 用户选择 |
|---|---|---|---|---|---|
| M01 | 持久化模型 | A 仅 revision（interim only）；B 同表完整生命周期；C 独立 canonical 表（ADR first） | B；当前唯一可直接接受的完整闭环候选 | B1～B4 | |
| M02 | revision 类型与初值 | A `integer` 初值 1、严格 +1、临近上限即阻断；B `bigint` 初值 1、边界使用字符串 | A 与现有 Binding／Scope 一致；如预计高频长期推进则 B | B1～B4 | |
| M03 | 推进集合 | A 仅授权相关 role／status／revoke／delete／可选 expiry；B 所有写入含 displayName | A；displayName 不推进授权 revision | B1～B4 | |
| M04 | 生命周期状态机 | A `active → revoked → deleted`，refresh 为 active 内 CAS，仅 revoked 可按 M11 复活，deleted 为终态；B 只 active／revoked 且 delete 物理删除 | A；B 无 tombstone／ABA 证据 | B2～B4 | |
| M05 | delete 与 ABA | A deleted tombstone 在存在任何 Binding／引用时永久保留，ID／revision 永不重用；未来只有零引用＋独立保留政策＋ABA 证明才可申请物理清理；B 物理删除后允许重建 | A；B 与历史 Binding FK／ABA 证据冲突并排除 | B2～B4 | |
| M06 | Membership provenance | A current state＋同事务 Access Control immutable transition evidence；B current latest only；C 跨域 Audit only | A；B/C 不满足完整 lifecycle | B2～B4 | |
| M07 | 现有行迁移 | A 原始 lifecycle source／actor／reason／event time 保持 `legacy_unknown`，Migration 只另记 `backfilledAt／observedAt` 与 baseline-import evidence；B 等待权威历史来源后再迁移 | A 仅在用户接受低敏 legacy 语义后；Migration 时间不得解释为历史 create／refresh／revoke／delete 时间 | Schema/Migration | |
| M08 | Writer 切换与 Enforce | A Expand → Owner Writer 双写或旧 Writer 封堵 → backfill／高水位追赶 → 冲突清零／行数守恒 → Reader／Guard 切换 → Enforce；B 一次切换 | A；B 排除 | B2～B4 | |
| M09 | Binding revoke／rebind provenance | A current Binding＋同事务 Access Control transition evidence；B 再增加 canonical revokedBy／reason／reboundFrom 字段 | B；A 只有经独立审查证明 current 查询不需要这些字段时可接受 | B2～B4 | |
| M10 | 方案 C 合法性 | 独立 ADR 后 canonical 替换；永久 sidecar 仅作排除反例 | ADR 合并前 C 不可选择；永久 sidecar 排除 | B1～B4 | |
| M11 | Membership identity／incarnation | A 仅 revoked 可在同一行逻辑复活、revision 永不重置且必须新建 Binding，deleted 终态不可复活；B 新 incarnation 并扩展 Binding 关系以引用 membershipId／incarnation | A 与现有自然键 FK 相容；B 需额外 Schema／历史关系迁移 | B1～B4 | |
| M12 | Membership／Binding 原子联动 | A revoke／delete Membership 时同事务 CAS revoke active Binding，复活后必须新建 Binding；B 先独立完成 Binding command 再允许 Membership command；C 保留 active Binding | A；C 排除 | B2～B4 | |

## 7. 推荐方案与绑定决策

推荐选择 **M01-B**，并在未来用户接受时将 M02～M08、M11 与 M12 作为一个不可拆开的决策组
处理：只增加 revision 但不决定状态、撤销、删除和 provenance，会让 B1 获得一个技术 token，
却仍无法诚实完成 B2 生命周期，且可能产生两次 Migration 和中间双口径。

M09 可以与 Membership 决策并行审计，但若 Binding current 字段不足以证明 revoke／rebind 的
actor、reason 和 lineage，不得只用后续跨域 Audit 旁证静默替代 canonical provenance 或
Access Control transition evidence。它可以触发同一决策包的补充接受或另一个极小 Schema 决策，
不能夹带到 Runtime PR。

## 8. future Schema／Migration 切片边界

用户接受决策后，仍须先建立独立预检和 Migration Lease。候选实施顺序为：

```text
accepted decision handoff
→ Schema/Migration preflight
→ 实时编号与唯一 Migration Lease
→ Expand（nullable／无伪造 provenance 默认值）
→ Access Control Owner Writer 双写或先封堵旧 Writer
→ 确定性 backfill＋高水位追赶
→ 冲突清零、行数守恒与 planned=created+reused 证明
→ Reader 切换到显式 revision
→ Guard／Session 消费显式 revision
→ 独立 Enforce 决策与实施
```

候选最小 Schema／Migration 文件集合为：

1. `drizzle/<实时 Lease 编号>_<预检冻结的 SQL stem>.sql`；
2. `drizzle/meta/_journal.json`；
3. `src/server/db/schema.ts`；
4. `src/server/db/tests/Schema.test.ts`。

这只是候选 allowlist，不是授权，也不承诺一次 Migration 足以完成全部阶段。实际选择完整生命周期
后，如四文件或单个切片不能诚实承载状态枚举、transition evidence、回填或约束，必须先在预检中
重新冻结，不能自行扩大。本候选切片继续禁止 snapshot 与 `db:generate`；未来独立 metadata 治理
不由本文否定。Migration 编号、SQL stem 和切片数均不得预先批准、预留或占用。

Runtime 必须另立 PR，不能和 Schema／Migration 混合。未来候选边界包括：

下列只是基于当前证据的 proposed 候选，不是未来 PR 的精确 allowlist：

- 新 Owner：`src/modules/access-control/domain/institution-membership.ts`、
  `src/modules/access-control/server/institution-membership-repository.ts`、
  `src/modules/access-control/server/institution-membership-service.ts`、
  `src/modules/access-control/domain/institution-scope-reader-port.ts`。最后一项只能是消费端 Port，禁止
  直接查询 `institution_scopes`；
- Tenancy authoritative Adapter／Reader：候选位于 `src/modules/tenancy/**`，由 composition root
  注入上述消费端 Port；精确路径必须在 future preflight 冻结，Access Control 不得实现第二个 Scope
  Repository；
- Identity／Auth 兼容消费者：`src/modules/auth/domain/auth-account.ts`、
  `src/modules/auth/server/auth-account-repository.ts`、
  `src/modules/auth/server/auth-account-service.ts`、`src/app/api/auth/login/route.ts`、
  `src/app/api/auth/session/route.ts`；Identity 的未来物理边界如需进入 `src/modules/identity/**`，必须
  另行冻结，不能创建空模块；
- Guard 与 Scope 兼容退出点：`src/modules/security/server/institution-membership-provider.ts`、
  `src/modules/security/server/institution-anchor-repository.ts`、
  `src/modules/security/server/institution-anchor-provider.ts`、
  `src/modules/institution/server/institution-server-runtime.ts`。Security target 只保留通用 key／codec；
  现有业务 Guard 必须迁出或委托 Access Control，不得新增 Security 业务所有权；
- bypass／current consumers：`src/modules/open-platform/server/tenant-plan-binding-service.ts`、
  `src/modules/open-platform/server/tenant-plan-binding-repository.ts`、
  `src/modules/open-platform/server/trial-data-reset-service.ts`、
  `src/server/db/seed-demo-data.ts`、`scripts/demo/seed-v06-low-sensitive-demo.ts`、
  `src/modules/institution/server/tenant-quota-enforcement.ts`、
  `src/modules/open-platform/server/tenant-account-management-repository.ts`。

正式 allowlist 必须在 Schema 决策和新 `main` 上重新静态冻结；目录通配不能作为实施授权。

## 9. 必测矩阵

未来获授权实现至少必须覆盖：

- create／refresh／revoke／delete 的分立状态转换；
- expected revision CAS、stale revision、affected rows 为 0 或大于 1；
- 并发命令只有一个成功，revision 每次只递增一次；
- 同时间戳连续变化、时钟回拨、删除重建、ID 重用和 ABA；
- 多 Membership 显式 tenant 选择，缺选择或歧义时 fail-closed；
- Binding create、duplicate active、rebind 原子 revoke-old＋create-new、revoke、expire 和 CAS；该
  rebind 模式由本轮用户指令明确接受，不是从旧 handoff 推断；
- 跨 tenant、缺／停用 Scope、placeholder、重复候选、未来时间与 Provider 不可用；
- Membership／Binding／Scope 任一 revision 变化后旧 evidence 必须失效；
- 旧 onboarding／reset／seed／fixture／import 不得直接写 canonical Membership；
- login Route 与 Service 只能消费同一个 resolved Membership snapshot，禁止双读竞态；
- soft-revoked Membership 不得被 quota seat count／tenant account management 当作 active；
- trial reset 不得在保留 Binding 历史时先删 Membership，seed／onboarding 必须委托或 fail-closed；
- Binding CAS 每次 version 精确 `+1`、affected rows=`1`、并发一胜一败且不得自动 retry；
- Membership revoke／delete 与 active Binding 撤销按 M12 原子执行；部分失败整批回滚，复活后的
  Membership 不得让旧 Binding 自动恢复授权；
- Scope FK 虽为 `NOT VALID`，仍须对未来新 Binding 写入 fail-closed；historical orphan 不得静默修复；
- 普通 Repository／fake Reader／跨域直接读取不能签发 genuine evidence；只有唯一 Owner Adapter 和
  composition root 可以创建 authoritative Reader／Provider；
- capability-off Route 保持零业务 Repository、零 Writer、零 Reader 放行。

## 10. 风险、回退与 forward-fix

- **双事实源**：方案 C 或长期 sidecar 会使 Membership current 分裂；没有完整替换计划即排除。
- **旧入口绕过**：只增加字段但不迁移 Writer 会产生不推进 revision 的静默写入；Enforce 前必须证明
  所有入口已委托或禁用。
- **历史丢失**：物理 delete 会破坏 provenance 和 Binding 历史；当前安全默认是保留 tombstone，只有零引用后的未来清理／保留政策仍需独立决定。
- **Migration 回退**：未执行的变更可通过分支／PR 回退；共享环境已执行 Migration 不得修改已消费
  SQL／journal或破坏性回滚，只能按恢复点或独立 forward-fix 处理。
- **orphan 越界**：现有 historical orphan 与 Scope 关系 orphan 均不由本决策或 future schema slice
  自动修复；计数清零前 BASE-02 不完成、FK 不 `VALIDATE`、Reader 不放行。

## 11. 后续启动与停止条件

只有以下条件全部满足，才可申请 Schema／Migration 预检；仍不等于实施授权：

1. M01～M12 的必要项已由用户明确选择并经独立 handoff 记录；
2. Access Control 唯一 Owner、Tenancy versioned Scope Reader 和依赖方向无冲突；
3. 现有行回填、状态转换、provenance、delete／ABA 和旧入口迁移方案可确定；
4. journal、snapshot、实时编号、Migration Lease、环境和恢复点在未来任务中重新冻结；
5. 文件 allowlist、测试、停止和 forward-fix 得到当次明确授权。

出现以下任一情况必须继续阻断：

- 试图用 `updated_at`、Binding version、hash、Audit 或 Session claim 代替 Membership revision；
- 需要第二套长期 Membership 事实源；
- 生命周期状态、provenance、回填或 ABA 语义仍无法唯一冻结；
- 需要在 docs-only 决策中修改 Schema、Migration、Runtime、环境或数据；
- 需要处理 historical orphan、执行外键 `VALIDATE`、开放 Writer／Reader 或启动 BASE-B2～B5。

## 12. 结论

当前可以冻结 Identity／Access Control／Tenancy／Security 的目标边界，也可以确认 Binding 和 Scope
分别具有独立 revision 载体；但 Membership 只有普通 `updated_at`，不满足稳定 revision 与完整
lifecycle 的硬门。推荐以 `tenant_members` 为 Access Control 唯一 canonical Membership 事实，在
同一关系中建立显式单调 revision、生命周期、tombstone 与 provenance；该推荐仍为 proposed。

在用户完成 M01～M12 的必要选择并另行授权 Schema／Migration 前：

```text
base_b1_runtime=blocked
base_b2_lifecycle=blocked
base_b3_session_refresh=blocked
base_b4_guard_closure=blocked
base_b5_remediation=not_started
historical_orphan_modified=false
fk_validated=false
writer_started=false
reader_started=false
```
