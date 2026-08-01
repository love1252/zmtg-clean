# BASE-02 Membership Revision Schema／Migration 前置预检

> 状态：`current evidence`
>
> 审计基线：`e4f6a822fc52dd46d52c7d6accb0bae5c2a428a5`
>
> 审计日期：2026-08-01
>
> 物理模型状态：`proposed physical model`／`not accepted`
>
> `schema_migration_implementation_authorized=false`

## 1. 文档定位

本文只用仓库静态证据回答 A-full 在进入物理模型接受前的 Schema、Migration、Writer、Reader、
Session 与 Guard 影响面。本文不重开已经接受的 A-full、Owner 或 Membership／Binding／Scope 三个独立
revision 域，也不构成 Schema、Migration、Migration Lease、数据库或 BASE-B1 Runtime 授权。

本轮没有连接数据库，没有读取环境变量或凭证，没有修改 `src/**`、`drizzle/**`、scripts、tests、CI、
package 或 lock，没有执行 DDL、DML、Migration、Seed、回填、orphan 修复或 FK `VALIDATE`。

## 2. 已冻结且不得重开的 target

`docs/decisions/base02-membership-revision-accepted-decision.md` 已接受以下不可拆分语义：

- `tenant_members` 是 Access Control 唯一 canonical Membership current；
- Membership revision 显式、稳定、严格单调，命令使用 `expectedRevision` CAS；
- create、授权事实 refresh、revoke、delete tombstone、incarnation／ABA、current provenance 与 immutable
  transition evidence 属于同一完整生命周期；
- canonical current 与 transition evidence 必须在同一事务原子形成；
- Access Control 是唯一 Membership／Binding Writer；Identity、Tenancy 与 Security 的既有 Owner 不变；
- Membership revision、Binding version 与 Scope revision 相互独立，不能替代；
- `updated_at`、Binding version、hash／HMAC、Session claim 和现有字段组合均已淘汰；
- immutable evidence 不能成为第二套 current；永久 sidecar current 继续排除。

本预检只冻结一个待用户接受的精确物理候选和实施序列，详见
`docs/decisions/base02-membership-revision-physical-model-decision-pack-20260801.md`。

## 3. 仓库 metadata current

本节值由当前仓库实时读取，不是未来编号承诺：

| 资产 | current evidence | 结论 |
|---|---|---|
| `drizzle/meta/_journal.json` | 40 项，`idx=0..39`，末项 tag 为 `0039_mig_01a2_anchor_bridge` | journal 与 SQL 集合当前对齐 |
| `drizzle/*.sql` | 40 个，当前末项为 `0039_mig_01a2_anchor_bridge.sql` | 不据此预留下一编号 |
| `drizzle/meta/*_snapshot.json` | 15 个，当前末项为 `0026_snapshot.json` | journal 与 snapshot 允许阶段性不同步 |
| 生成策略 | `db:generate` 与 snapshot-diff Migration 继续禁止 | 后续只能手写、审查并在实时 Lease 下分配编号 |

未来任一 Migration 开始前都必须重新读取 journal、SQL 集合和 snapshot；这里的 current 数字不得作为
编号审批或 Migration Lease。

## 4. `tenant_members` current Shape

证据：`src/server/db/schema.ts`、`drizzle/0000_silky_speedball.sql`、
`drizzle/0020_tenant_formal_accounts.sql`、`drizzle/0037_v08_05b_b3a_real_task_readiness_foundation.sql`、
`drizzle/0039_mig_01a2_anchor_bridge.sql` 与 `drizzle/meta/0026_snapshot.json`。

| 列 | SQL 类型 | nullable | default | current 语义 |
|---|---|---:|---|---|
| `id` | `varchar(64)` | 否 | 无 | 主键；当前唯一可用的稳定 Membership identity |
| `tenant_id` | `varchar(64)` | 否 | 无 | FK → `tenants.id` |
| `user_id` | `varchar(96)` | 否 | 无 | FK → `auth_users.id` |
| `role` | `auth_role` | 否 | 无 | 角色，但没有 lifecycle 约束 |
| `display_name` | `varchar(120)` | 否 | 无 | 展示字段 |
| `created_at` | `timestamptz` | 否 | `now()` | 创建时间 |
| `updated_at` | `timestamptz` | 否 | `now()` | 普通时间戳；没有自动更新、单调或 CAS 保证 |

现有关系与索引：

- 主键：`tenant_members_pkey(id)`；
- 唯一 btree：`tenant_members_tenant_user_unique_idx(tenant_id, user_id)`；
- 普通 btree：`tenant_members_tenant_role_idx(tenant_id, role)`；
- FK：`tenant_id → tenants.id`、`user_id → auth_users.id`，均为 `NO ACTION`；后者由 0020 SQL 以
  `NOT VALID` 创建，仓库没有后续 `VALIDATE`，未连接数据库时不得推断环境 `convalidated` 状态；
- Binding FK：`auth_account_institution_bindings(tenant_id, account_id) →
  tenant_members(tenant_id, user_id)`；
- lifecycle、revision、provenance、tombstone 列均为 0；业务 CHECK、RLS／policy、业务 trigger／rule 均为 0。

因此 current 只能证明“有一行”，不能证明 active／revoked／deleted、严格单调 revision、CAS、ABA、
current provenance 或 immutable transition evidence。现有自然键唯一约束与 Binding 自然键 FK 只天然
支持“同一行推进 lifecycle，deleted tombstone 终态”；它们不能同时容纳同一 tenant/user 的旧 tombstone
与新 incarnation。

## 5. 直接 Membership Writer 全量审计

### 5.1 分类口径与数量

| 分类 | current 数量 | 结论 |
|---|---:|---|
| `authoritative_writer_candidate` | 0 | `src/modules/access-control/**` 当前不存在；尚无 authoritative Writer |
| `direct_writer_to_migrate` | 1 个符号 | 正式 onboarding INSERT 必须委托未来 Access Control command |
| `direct_writer_to_disable` | 5 个符号 | reset、两类 seed 的 INSERT／UPSERT／DELETE 必须封堵 |
| 直接 mutation 资产 | 4 个文件／6 个符号 | INSERT 3、UPDATE 语义 1、DELETE 3；UPSERT 同时计 INSERT／UPDATE 语义 |
| 可执行入口 | 2 个 HTTP POST／2 个 CLI | 不能因路由 Guard、默认 dry-run 或 seed guard 而视为 Owner Writer |
| `test_or_fixture` | 9 个相关测试文件／2 组 fixture producer | current 测试没有锁定唯一 Writer／CAS／evidence |

### 5.2 `direct_writer_to_migrate`

| 路径／符号 | current 事务 | 分类与后续边界 |
|---|---|---|
| `src/modules/open-platform/server/tenant-plan-binding-repository.ts` `createTenantWithPlanAuthorization` | 一个外层数据库事务内依次写 tenant、account、`tenant_members`、联系人、计划、快照、审计与商业记录 | 唯一正式迁移候选。必须由同一 transaction-bound Access Control command 写 Membership current＋evidence；调用方不得再构造 raw Membership row |

调用链是：

```text
POST /api/v1/open-platform/tenants
→ createTenantWithPlanService
→ createTenantWithPlanAuthorization
→ tx.insert(tenantMembers)
```

精确路径分别为 `src/app/api/v1/open-platform/tenants/route.ts`、
`src/modules/open-platform/server/tenant-plan-binding-service.ts` 与上述 Repository。Route／Service／现有
跨域 transaction 均属于 `protected_boundary`，只有 Repository 的直接 INSERT 属于
`direct_writer_to_migrate`。

未来迁移不能让 Owner command 另开事务，否则 Membership／evidence 与租户开通的其他写入会失去原子性。

### 5.3 `direct_writer_to_disable`

| 文件／符号 | current 行为 | 必须封堵的原因 |
|---|---|---|
| `src/modules/open-platform/server/trial-data-reset-service.ts` `resetTrialData` | 事务内物理 DELETE Membership | 破坏 tombstone／ABA；Binding FK 仍保留时也可能失败。不能机械改写为 revoke |
| `src/server/db/seed-demo-data.ts` `cleanupLegacyDemoSeedRecords` | DELETE Membership | 无 Owner／CAS／evidence；与生命周期目标冲突 |
| `src/server/db/seed-demo-data.ts` `seedDemoData` | INSERT＋`onConflictDoUpdate` Membership | 可静默改 tenant/user/role/displayName/updatedAt；无原子 lifecycle 协议 |
| `scripts/demo/seed-v06-low-sensitive-demo.ts` `applyDemoSeed` | raw INSERT Membership | 默认 dry-run 不是写入安全证明；无 Owner／CAS／evidence |
| 同文件 `cleanupDemoSeed` | raw DELETE Membership | 破坏 tombstone／ABA；无事务化 Owner 边界 |

可执行入口为 `POST /api/v1/open-platform/trial-data-reset`、`POST /api/v1/open-platform/tenants`、
`pnpm db:seed` 和低敏 demo seed CLI。仓库未发现额外 import、maintenance、worker 或 scheduler 直接
Membership Writer。

对应实现路径为 `src/app/api/v1/open-platform/trial-data-reset/route.ts`、
`src/app/api/v1/open-platform/tenants/route.ts`、`src/server/db/seed-demo-data.ts#runSeed` 与
`scripts/demo/seed-v06-low-sensitive-demo.ts#runCli`。两个 Route、两个 CLI guard 只属于
`protected_boundary`，不能把其下游 raw DML 升格为 authoritative Writer。

### 5.4 Writer 测试与 fixture

直接相关测试共 9 个：

- `src/modules/open-platform/tests/TenantPlanBindingRepository.test.ts`；
- `src/modules/open-platform/tests/TenantPlanBindingService.test.ts`；
- `src/modules/open-platform/tests/TenantPlanBindingApiRoute.test.ts`；
- `src/modules/open-platform/tests/OpenPlatformTenantManagementPanel.test.tsx`；
- `src/modules/open-platform/tests/TrialDataResetService.test.ts`；
- `src/server/db/tests/Schema.test.ts`；
- `src/server/db/tests/SeedGuard.test.ts`；
- `src/server/db/tests/ProductionReadinessDocs.test.ts`；
- `scripts/demo/seed-v06-low-sensitive-demo.test.ts`。

两组 fixture producer 是 `src/server/db/seed-demo-data.ts` 的 Membership records 与
`scripts/demo/seed-v06-low-sensitive-demo.ts` 的 `buildDemoSeedRecords`。当前架构检查器对
`tenant_members` direct DML 的 Owner allowlist／禁止规则数量为 0。

## 6. Reader、Formal Session、Fresh Membership 与 Guard

### 6.1 current 调用链

```text
/hospital／Institution Workbench
→ resolveInstitutionServerAuthorizationV1
→ Formal Session cookie 验证
→ createFormalServerSessionRequestOwnerV1
→ Formal Provenance Resolver
→ Fresh Membership Provider
→ Auth Repository JOIN account + tenant_members + active Binding
→ tenant_members.updated_at 被投影为 membershipRevisionAt
→ Membership／Binding 低敏 revision reference
→ Tenancy Scope Reader 读取 institution_scopes.revision
→ Institution Scope Guard
→ Section／Navigation Guard
→ capability-off 页面
```

Formal Session 只保存 `accountId + tenantId + institutionId` selector／provenance，不保存 Membership
revision 或 role 作为授权事实。每次正式 Guard 请求都会重新读取 Membership、Binding 与 Scope；这一
selector-only 和逐请求重读边界必须保留。

### 6.2 `compatibility_reader`

核心兼容符号共 6 个：

1. `auth-account-repository.ts#findPrimaryTenantMembershipByUserId`：只按 `userId` 取一行，没有 tenant、
   lifecycle、revision 或稳定排序；
2. `auth-account-repository.ts#findCurrentInstitutionMembershipFacts`：仓库唯一直接选择
   `tenantMembers.updatedAt` 的数据库查询；
3. `auth-account-repository.ts#findCurrentFormalSessionUser`：登录与 `/api/auth/session` 的 Membership／
   Binding current 复核；
4. `institution-membership-provider.ts#resolveCurrentRow`：把 `membershipUpdatedAt` 转为
   `membershipRevisionAt`；
5. `institution-membership-provider.ts#createAuthoritativeInstitutionMembershipFactReaderV1`：名称为
   authoritative，但 current 仍是兼容 Reader，不能成为最终 Access Control Owner；
6. `institution-membership-provider.ts#createRequestBoundFreshActiveMembershipProviderV1`：把
   `membershipId + membershipRevisionAt + role` 编入短生命周期 reference。

`institution-server-runtime.ts` 还存在一个 Auth Repository → Membership Reader 的兼容接线点，未来应
委托 Access Control Owner Port，不应在首个 Schema／Migration PR 直接重写。

次级生命周期 Reader：

- `tenant-quota-enforcement.ts#countActiveStaffSeatsByTenant` 目前把任何存在的 `tenant_admin` 行计为 active；
- `tenant-account-management-repository.ts#findInitialAdminAccountByTenantId` 只判断 Membership 行存在。

次级 Reader 的直接回归还包括 `TenantQuotaEnforcement.test.ts` 与
`TenantAccountManagementRepository.test.ts`；它们不计入下述正式 Guard 核心链 15 文件，但必须进入
M6 lifecycle-aware Reader 测试集合。

### 6.3 `protected_boundary`

必须保持的核心边界包括：

- `formal-server-session-provenance-owner.ts` 的 session 签发、claims 验证与 request owner；
- `institution-scope-guard.ts#authorizeCurrentRequest`；
- `institution-request-authorization.ts#createInstitutionRequestAuthorizationV1`；
- `institution-anchor-repository.ts` 的 Scope revision Reader；
- `institution-anchor-provider.ts` 的逐请求 Scope 重读与 `anchorRevision`；
- `institution-server-runtime.ts` 的服务端唯一组合根；
- onboarding 的外层事务、tenant/account/plan/audit 边界；
- reset／seed／CLI 的 fail-closed 边界。

Formal Session 继续只是 selector／provenance；Security 继续提供受控 evidence／Guard 能力，但不能成为
Membership 数据 Owner。Guard 固定保持：

```text
Formal Provenance
→ Access Control Fresh Membership + Binding
→ Tenancy Fresh Scope
→ scope／section／action authorization
```

### 6.4 Reader 测试影响面

当前调用链直接相关测试为 15 个文件，核心矩阵包括：

- Auth：`AuthAccountRepository.test.ts`、`AuthAccountService.test.ts`、`FormalAuthRoutes.test.ts`、
  `FormalServerSessionProvenanceOwner.test.ts`；
- Security：`InstitutionMembershipProvider.test.ts`、`InstitutionGuardEvidence.test.ts`、
  `InstitutionGuardEvidenceBoundary.test.ts`、`InstitutionScopeGuard.test.ts`、
  `InstitutionSectionGuard.test.ts`、`InstitutionRequestAuthorization.test.ts`、
  `InstitutionAnchorProvider.test.ts`；
- Institution：`InstitutionServerRuntime.test.ts`、`HospitalWorkbenchEntry.test.tsx`、
  `InstitutionWorkbenchRuntime.test.ts`、`InstitutionRouteShell.test.tsx` 及其 capability-off Route 边界。

生产代码中 `tenantMembers.updatedAt` 精确出现 1 处／1 个文件；`membershipUpdatedAt` 出现 8 处／2 个
文件，测试出现 14 处／8 个文件；`membershipRevisionAt` 出现 11 处／1 个生产文件。直接涉及
Membership／Binding／Scope revision 标识的生产文件为 7 个，其中 1 个 WeCom 同名异域属于
`out_of_scope`，BASE-02 实际相关为 6 个。

## 7. 其他分类与独立边界

### 7.1 `test_or_fixture`

除第 5、6 节测试外，`src/server/db/tests/Schema.test.ts` 目前只锁定表存在、现有两个索引、user FK 与
seed insert 次数；没有锁定 revision、lifecycle、provenance、transition evidence、CAS、ABA、legacy
calibration 或 lifecycle-aware Reader／Writer。

### 7.2 `out_of_scope`

- WeCom 收件人 `bindingVersion`；
- A2 Manifest／Provisioning 的 `scopeRevision`；
- Institution Operating Context `updatedAt`；
- Demo Session、平台正式授权、业务对象 Reader 与 capability 放行；
- active historical orphan／Scope relation orphan `1／1`；
- A2-P2 Scope FK `VALIDATE`；
- BASE-B1～B6、项目级 Writer、Audit／模板、MIG-01B／C 和 Reader 放行。

historical orphan `1／1` 必须继续由 Access Control Binding 生命周期和独立数据修复授权处理，不能被
Membership revision Migration 吸收、删除、补 Scope 或解释为已清零。

## 8. Dependency 与自然键风险

`auth_account_institution_bindings` 通过 `(tenant_id, account_id)` 引用
`tenant_members(tenant_id, user_id)`。因此 recommended 初版必须：

- 让 revoked／reactivated／deleted 在同一 `tenant_members.id` 上推进 revision；
- 保留 `(tenant_id,user_id)` 唯一键；
- deleted tombstone 终态，不支持同一 tenant/user 的新行 incarnation；
- 若未来必须创建新 incarnation，先独立 ADR 重构 Binding 引用和自然键；本预检不偷偷修改关系。

`audit_events` 不能作为 immutable Membership transition evidence：trial reset 和 demo seed 当前存在
删除 audit rows 的路径，且其通用 shape 不能静态强制 Membership from／to revision 与 lifecycle。

## 9. 串行 Migration／切换切片

| 切片 | 候选文件类型 | 数据／Runtime 影响 | Lease／事务／恢复 | 测试与停止条件 |
|---|---|---|---|---|
| M0 metadata 校准 | docs-only 校准报告；必要时独立 metadata 修复任务 | 只读核对 journal、SQL、snapshot、Catalog | 不取得编号；不创建 Lease；无数据库写入 | journal／SQL 不一致、snapshot 策略不清或需要 `db:generate` 时停止 |
| M1 Expand | 手写 `drizzle/<实时编号>_*.sql`、`_journal.json`、`schema.ts`、`Schema.test.ts` | 增加 nullable／无默认 current envelope、transition evidence、all-null／all-complete Shape 与 append-only 保护；禁止业务 DML | 未来唯一 Migration Lease；固定锁序；`lock_timeout=1s`、`statement_timeout=5s`；执行前恢复点 | Schema／SQL／journal 一致；snapshot 不变；部分对象、同名异定义、需要 DML 时停止 |
| M2 Owner Writer／CAS | 新 Access Control domain／application／port／repository／tests | 建立 create／refresh／revoke／reactivate／delete command；current＋evidence 同事务；all-null legacy row 的变更继续 fail-closed | 不取得 Migration Lease；行锁 `tenant_members → active Binding → transition evidence`；事务级 `lock_timeout=1s`、`statement_timeout=5s`；affected rows=1；不自动重试 | expectedRevision、并发一胜一败、非法状态、回滚原子性；无法提供 transaction-bound UoW 时停止；失败关闭新入口并独立 forward-fix，禁止重开旧 Writer |
| M3 旧 Writer 委托／封堵 | onboarding route／service／repository；reset／seed／CLI；架构规则与测试 | onboarding 委托 Owner 且只能创建 complete envelope；reset 和两类 seed 写模式 fail-closed；Owner 外 direct writer=0 | 不取得 Migration Lease；onboarding 保持现有外层单事务和 M2 timeout；无需数据恢复点 | 调用方仍能造 revision／evidence、reset/seed 仍直写、架构 allowlist 不唯一时停止；回滚只关闭入口并 forward-fix |
| M4 deterministic legacy calibration | 独立手写数据 Migration、journal、SQL tests／低敏证据 | 为 legacy row 写初始 current envelope 与一条 baseline transition；不改业务归属 | 新实时编号＋独立 Lease＋恢复点；稳定排序；`lock_timeout=1s`、`statement_timeout=30s`；按冻结批次事务化 | 行数守恒、每 member 一条 baseline、冲突=0；Migration 时间不得冒充历史事件时间；已消费后只 forward-fix |
| M5 高水位追赶／冲突清零 | 独立手写追赶数据 Migration、journal、SQL tests／低敏证据 | 在旧 Writer 封堵后处理 M4 高水位外残余；禁止业务语义回填；不使用 one-shot Runner 替代 | 独立 Lease／恢复点；高水位候选 `(created_at,id)`；`lock_timeout=1s`、`statement_timeout=30s`；不自动重试 | null envelope=0、重复 command/revision=0、unexpected=0；未知归属或证据矛盾时停止；已消费后只 forward-fix |
| M6 Reader 切换 | Auth、Access Control Adapter／Port、Security 兼容桥、Institution composition root、15 个核心链测试及 2 个次级 Reader 测试 | 从 `updated_at` 切到显式整数 revision，识别 lifecycle；Formal Session 仍不承载授权事实 | 无 Migration Lease、无 DDL 恢复点；每请求重读 Membership／Binding／Scope；Reader query 使用当前连接 timeout | 禁止时间戳 fallback；失效、stale／future revision 与三版本域串线必须 fail-closed；失败关闭新 Reader 并 forward-fix，不恢复旧授权 fallback |
| M7 Enforce／旧路径退出 | 独立手写 Enforce Migration、journal、Schema／tests；架构规则 | `NOT NULL`／完整 Shape、旧 Writer=0、旧 Reader fallback=0；不删除通用 `updated_at` | 新实时编号＋独立 Lease＋恢复点；`lock_timeout=1s`、`statement_timeout=5s`；共享环境执行后只 forward-fix | calibration／追赶未清零、Writer/Reader 未切换、需 orphan/FK VALIDATE/BASE-B1 时停止 |

每个切片都必须有独立任务授权、PR、独立审查、handoff 与成功 Required Check。M1、M4、M5、M7
分别在执行时实时分配编号和 Migration Lease，不能共用长期 Lease。共享环境已消费的 SQL／journal 不得
回写；失败后只能按冻结状态选择事务回滚或独立 forward-fix。

M1 到 M4 之间存在明确兼容窗口：M1 的 current envelope CHECK 只允许“全部新列为 NULL 的 legacy row”
或“全部必需列完整且状态 Shape 合法的新 row”，禁止 partial envelope；M2／M3 只允许 authoritative
Writer 创建 complete row，对 all-null legacy row 的 refresh／revoke／reactivate／delete 一律
`legacy_membership_not_calibrated` fail-closed。M4／M5 清零 all-null row 后，M6 才能切换 Reader。

## 10. 事务、锁序与原子性门禁

推荐的固定逻辑锁序为：

```text
tenant_members canonical row
→ account+tenant active Binding（仅命令确实改变 Binding 时）
→ tenant_membership_transitions append
```

- create 使用 tenant/user 业务键的 transaction-scoped advisory lock 或等价唯一串行化，再创建 row 与
  revision 1 evidence；
- update 使用 `WHERE id=? AND revision=? AND lifecycle_status=?` CAS，affected rows 必须精确为 1；
- evidence INSERT 与 current mutation 在同一短事务；任一步失败整批回滚；
- stale、future、非正、溢出、非法 transition、command identity 冲突均 fail-closed；
- 同一旧 revision 并发命令最多一个成功；失败方不自动重试；
- Binding rebind 只推进 Binding version；Membership 事实未变化时不得推进 Membership revision。

## 11. 回滚、forward-fix 与恢复点

- 未被共享环境消费的分支可以撤销代码；已消费 Migration 不得修改历史 SQL／journal；
- 每个数据库切片都必须先形成当前恢复点并完成独立可恢复性验证；
- Expand 失败依赖事务回滚；Expand 成功后的问题通过新 forward-fix 修正，禁止破坏性 DROP／CASCADE；
- Runtime 切片回滚只能关闭新入口并 forward-fix，不能重新开放旧 direct Writer；
- M4／M5 必须记录 planned／created／reused／conflict／unexpected 与行数守恒，无法证明时停止；
- 本预检没有创建恢复点、Lease、SQL 或执行环境。

## 12. 准入结论

静态证据足以形成一个精确 proposed 物理模型和 M0～M7 串行候选，但不足以直接实施：精确物理模型、
legacy calibration 语义、transition append-only 机制及每个未来文件 allowlist 仍须用户在独立任务中接受。

```text
membership_revision_decision_accepted=true
membership_revision_physical_model_status=proposed_not_accepted
membership_revision_static_impact_inventory=complete
authoritative_writer_candidate_count=0
direct_writer_to_migrate_count=1
direct_writer_to_disable_count=5
compatibility_reader_core_count=6
migration_cutover_sequence=M0_to_M7_proposed
schema_migration_implementation_authorized=false
eligible_for_physical_model_acceptance_handoff=pending_independent_review
eligible_for_schema_migration_implementation=false
eligible_for_base_b1_runtime=false
base_b1_runtime=blocked
historical_orphan_modified=false
a2_p2_scope_fk_validated=false
writer_started=false
reader_started=false
```

## 13. 硬停止条件

后续发现以下任一情况必须停止：

- 需要重开 A-full、Owner 或三个独立 revision 域；
- proposed 被写成 accepted，或未接受物理模型即实施；
- 需要第二套 Membership current、复用 identity／revision 或让 deleted tombstone 默认复活；
- 无法保证 canonical current 与 immutable evidence 同事务；
- direct Writer／compatibility Reader 影响面不能完整解释；
- journal、SQL、snapshot、Catalog、数据 Shape 或历史 accepted decision 漂移；
- 需要 `db:generate`、snapshot、未授权编号、DML、orphan 修复、FK `VALIDATE` 或 BASE-B1 Runtime；
- 需要连接数据库、读取凭证或扩大当前 docs-only 文件范围。
