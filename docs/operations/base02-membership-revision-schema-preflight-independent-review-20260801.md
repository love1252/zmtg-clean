# BASE-02 Membership Revision Schema／Migration 前置预检独立审查

> 状态：`current evidence`
>
> 审查日期：2026-08-01
>
> 审查基线：`59e5ef94fe9a462b29e0792f2b661a84e3d10de2`
>
> 冻结交付：PR #864
>
> 冻结 Head：`3e9f2f8992e9923dc5261be8f40c8e8f9f9b18a0`
>
> Merge Commit：`59e5ef94fe9a462b29e0792f2b661a84e3d10de2`

## 1. 审查定位

本审查只核对 PR #864 已合并的 current evidence 与 proposed physical model 是否完整、可追溯且没有
越过用户授权。它不接受 P01～P12，不授权 Schema、Migration、Migration Lease、数据库、Runtime 或
BASE-B1，也不修改被审查材料。

审查对象及冻结 blob：

| 文件 | blob |
|---|---|
| `docs/operations/base02-membership-revision-schema-migration-preflight-20260801.md` | `d93bf7d49a7ed40da827e397933c640b7d7baea8` |
| `docs/decisions/base02-membership-revision-physical-model-decision-pack-20260801.md` | `20a2fc86a77c2b1269988c6342d43282324a5267` |

PR #864 的真实质量证据为 Actions Run `30696216677`／Job `91359466603`，Head 精确匹配上述冻结
Head；环境、依赖、架构检查器自测、增量检查、lint、typecheck、完整测试与 build 均实际执行并成功。

## 2. 文件范围与状态审查

| 检查 | 结果 | 证据／说明 |
|---|---|---|
| PR #864 提交数 | 通过 | 1 个提交 |
| PR #864 文件数 | 通过 | 2 个新 Markdown |
| Runtime／Schema／Migration／journal／snapshot | 通过 | 修改均为 0 |
| scripts／tests／CI／package／lock | 通过 | 修改均为 0 |
| proposed 状态 | 通过 | 文档明确 `proposed physical model`／`not accepted` |
| 实施授权 | 通过 | `schema_migration_implementation_authorized=false` |
| 数据库／Lease／DDL／DML | 通过 | 均未发生 |

## 3. A-full 与 Owner 不漂移审查

### 3.1 已接受语义完整保留

PR #864 没有重开或缩减以下 accepted 组合：

- `tenant_members` 是 Access Control 唯一 canonical Membership current；
- 显式、严格单调 revision 与 `expectedRevision` CAS；
- create／授权 refresh／revoke／delete tombstone、identity／ABA、current provenance；
- canonical current 与 immutable transition evidence 同事务原子形成；
- Access Control 唯一 Writer；
- `updated_at`、Binding version、hash／HMAC 与永久 sidecar current 继续排除。

精确物理字段、表、枚举、状态机与 Migration 切片仍明确是 proposed，没有被反向写入 accepted
decision。

### 3.2 Owner 与三个版本域

- Identity 仍拥有用户、账号与正式 Session；
- Access Control 仍唯一拥有 Membership 与 Binding 生命周期；
- Tenancy 仍唯一拥有 Scope／Context／Scope revision 原始事实；
- Security 仍只提供受控 evidence、Guard 与通用安全能力；
- Membership revision、Binding version 与 Scope revision 分别推进，未被合并或相互替代。

结论：A-full、Owner 与三个独立 revision 域均未漂移。

## 4. current Schema 与 metadata 归因审查

审查确认 current `tenant_members` 仍只有 7 列、2 个索引、2 个 FK，没有 lifecycle、revision、
provenance、tombstone、业务 CHECK、RLS 或业务 trigger。`updated_at` 只有 insert default，不能证明单调
revision。

metadata 归因正确：

- journal 40 项，SQL 40 个，current 末项由仓库实时核验为 0039；
- snapshot 15 个，末项为 0026；
- user FK 的仓库 SQL 以 `NOT VALID` 创建，仓库无后续 `VALIDATE`；未连接数据库时没有推断环境
  `convalidated`；
- 没有预留或批准下一 Migration 编号；
- `db:generate` 与 snapshot-diff Migration 继续禁止。

## 5. proposed 字段与状态机审查

### 5.1 canonical current

推荐候选完整冻结了：

- `revision integer`、初值 1、正值、上限与溢出 fail-closed；
- `active／revoked／deleted` lifecycle；
- current provenance source／actor／reason／command／occurred／recorded；
- revoked／deleted 时间 Shape；
- M1 nullable／无 default 与 M7 Enforce；
- all-null legacy／all-complete new row 二选一 Shape，禁止 partial envelope；
- `id／tenant_id／user_id／created_at／display_name` 初版不可变；
- role 是初版唯一可变授权字段，变化必须推进 revision。

未发现用 default 伪造 legacy provenance、用 Migration 时间伪造历史事件，或把 `updated_at` 留作
fallback。

### 5.2 lifecycle、incarnation 与 ABA

- create／role refresh／纯观察 refresh／revoke／reactivate／delete／legacy calibration 语义完整；
- deleted 是终态，不复活、不复用 identity 或 revision；
- 现有 `(tenant_id,user_id)` 唯一键与 Binding 自然键 FK 下，初版明确拒绝同 tenant/user 新
  incarnation；未来需要时必须独立 ADR；
- Binding rebind 只推进 Binding version，不伪推进 Membership revision。

该推荐满足 current 自然键事实，没有偷偷重构 Binding 引用。

## 6. immutable transition evidence 审查

推荐表 `tenant_membership_transitions` 包含：

- 独立 PK、tenant＋Membership 复合 FK；
- 唯一 command identity 与 `(membership_id,to_revision)`；
- from／to revision、lifecycle 与 role；
- transition type、source、actor、reason、occurred／recorded；
- 按 `(tenant_id,membership_id,to_revision)` 的确定性排序；
- Runtime `SELECT／INSERT` allowlist 与 UPDATE／DELETE／TRUNCATE 拒绝 trigger。

command replay 规则是任何重复 `command_id` 均 fail-closed，不承诺无法物理证明的“同 payload 幂等
成功”。Runtime／legacy command 和 evidence identity 使用不同固定命名域；legacy 输入编码、NUL 分隔、
SHA-256 与 lowercase hex 输出已经精确冻结。

`audit_events` 没有被复用为 immutable evidence，也没有形成第二套 current。

## 7. CAS、事务与 Binding 联动审查

- CAS 条件包含 identity、expectedRevision 与 expected status；affected rows 必须精确为 1；
- stale、future、非法、溢出或冲突均 fail-closed；同一旧 revision 并发命令最多一个成功；
- current mutation 与 evidence INSERT 同一短事务，不自动重试；
- 固定锁序为 Membership current → 相关 active Binding → transition append；
- create 不猜 institution；onboarding 如同时建 Binding，必须由同一 transaction-bound UoW 编排；
- revoke／delete 在同一外层事务处理 active Binding，两个版本域分别推进；
- reactivate 不复活旧 Binding；Binding rebind 不改变 Membership revision。

未发现 current 成功而 evidence 缺失、反向循环 Owner、或 Membership／Binding 共用 revision 的设计。

## 8. Writer 影响面审查

静态计数与仓库证据一致：

| 分类 | 数量 | 审查结论 |
|---|---:|---|
| current `authoritative_writer_candidate` | 0 | Access Control authoritative Writer 尚不存在 |
| 直接 mutation | 4 文件／6 符号 | 路径已逐项列出 |
| `direct_writer_to_migrate` | 1 | onboarding INSERT，必须保留跨域单事务并委托 Owner |
| `direct_writer_to_disable` | 5 | reset、主 seed 与低敏 seed 的 INSERT／UPSERT／DELETE |
| 写入口 | 2 HTTP POST／2 CLI | Route／CLI guard 只属于 protected boundary |
| 相关测试 | 9 文件／2 fixture producer | M2／M3 必须补 CAS、回滚和旧 Writer=0 规则 |

trial reset 没有被机械改成 revoke，seed 默认 dry-run 没有被误报为安全 Writer；M3 完成门明确为 Owner
外 direct mutation=0。

## 9. Reader、Session 与 Guard 影响面审查

6 个核心 compatibility Reader 符号、15 个正式 Guard 核心链测试及 2 个次级 lifecycle Reader 测试均
已列出。调用链正确描述了：

```text
Formal Session selector／provenance
→ 每请求 Fresh Membership＋Binding 重读
→ Tenancy Fresh Scope revision
→ scope／section／action Guard
```

唯一 current 兼容缺口是 `tenant_members.updated_at → membershipRevisionAt`。M6 明确由 Access Control
Owner Port 提供显式整数 revision 与 lifecycle，并禁止时间戳 fallback；Formal Session 不固化授权
revision，Security 不成为 Membership Owner。

## 10. M0～M7 可执行性审查

| 切片 | 审查结论 |
|---|---|
| M0 | 实时校准 journal／SQL／snapshot，不取编号、不创建 Lease |
| M1 | 仅 Expand current envelope、transition assets、Shape 与 append-only 保护，不做 legacy DML |
| M2 | 建立 transaction-bound Access Control Writer／CAS；legacy all-null row 继续 fail-closed |
| M3 | onboarding 委托；reset／seed／CLI 写模式封堵；旧 Writer=0 |
| M4 | 独立手写 deterministic legacy calibration Migration，不伪造历史 |
| M5 | 独立手写高水位追赶 Migration，null／duplicate／conflict／unexpected 清零 |
| M6 | Reader 从时间戳切到显式 revision，保留 selector-only Session 与三版本重读 |
| M7 | 数据与切换完成后再 Enforce，禁止夹带 BASE-B1、orphan 或 FK `VALIDATE` |

每个 DDL／data Migration 都要求实时编号、独立 Lease、恢复点、timeout、独立审查和 handoff；共享环境
消费后只能 forward-fix。Runtime 切片没有错误要求 Migration Lease，其失败回退也没有重新开放旧 Writer
或时间戳授权 fallback。

## 11. 排除范围审查

以下内容继续保持独立且未启动：

- active historical orphan／Scope relation orphan `1／1`；
- A2-P2 Scope FK `VALIDATE`；
- BASE-B1～B6 Runtime；
- 项目级 Writer、Reader、Audit／模板、MIG-01B／C；
- Schema、Migration、journal、snapshot、数据库、Lease、DDL、DML、Seed 与回填。

## 12. 审查结论

PR #864 的影响面、精确 proposed 物理模型和 M0～M7 串行候选足以进入“物理模型与 Migration 切片
接受”handoff。它只提供接受输入，不构成接受或实施准入。

```text
membership_revision_schema_preflight_review=passed
membership_revision_decision_accepted=true
membership_revision_physical_model_accepted=false
membership_revision_schema_preflight_scope=complete
membership_revision_writer_inventory=complete
membership_revision_reader_inventory=complete
membership_revision_migration_sequence=M0_to_M7_proposed
eligible_for_physical_model_acceptance_handoff=true
eligible_for_schema_migration_implementation=false
eligible_for_base_b1_runtime=false
schema_migration_implementation_authorized=false
base_b1_runtime=blocked
historical_orphan_modified=false
a2_p2_scope_fk_validated=false
writer_started=false
reader_started=false
```

## 13. 后续停止条件

后续 handoff 或接受任务出现以下任一情况必须停止：

- 把 proposed 物理模型或 P01～P12 写成 accepted，但没有用户明确接受；
- 重开 A-full、Owner 或三个独立 revision 域；
- 只增加 revision 而遗漏 lifecycle、CAS、ABA、provenance 或同事务 evidence；
- 建立第二 current、允许 deleted tombstone 复活或复用 identity／revision；
- 在 M1 夹带 backfill，或在 M6 前开放 Reader／BASE-B1；
- 预先分配 Migration 编号、创建 Lease、运行 `db:generate` 或修改 snapshot；
- 夹带 orphan 修复、FK `VALIDATE`、Writer／Reader 放行或 BASE-B1～B6 Runtime；
- 需要数据库、凭证、环境或本 docs-only 文件范围外改动。
