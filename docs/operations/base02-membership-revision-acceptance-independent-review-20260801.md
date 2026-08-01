# BASE-02 Membership Revision A-full 接受独立审查

> 审查状态：`passed`
>
> 审查日期：2026-08-01
>
> 审查基线：`b74cad648a46421b0a04f5f6b868f2f7a2240319`
>
> 被审查 PR：#861
>
> 被审查 Head：`ac22a0bd8e5197c5641c3d0ddd8e1abd8649e841`
>
> 被审查 Merge Commit：`b74cad648a46421b0a04f5f6b868f2f7a2240319`
>
> 成功 Required Check：Run `30691379044`／Job `91346604424`
>
> 本文只审查 accepted architecture decision，不是 Schema、Migration、Runtime、数据库或 BASE-B1 实施授权。

## 1. 审查定位

本审查独立核对 PR #861 是否完整、准确地记录用户接受的 A-full 架构组合，并确认其没有：

- 只接受 revision 字段而遗漏生命周期语义；
- 建立第二套 Membership current；
- 重开 Identity／Access Control／Tenancy／Security Owner；
- 提前冻结具体 Schema、Migration、字段、编号、SQL、回填或环境；
- 授权 BASE-B1 Runtime、orphan 修复、FK `VALIDATE`、Writer 或 Reader。

审查只使用已合并仓库内容与 GitHub 交付证据，没有连接数据库、读取环境变量或修改仓库设置。

## 2. 交付身份与文件范围

| 核对项 | 结果 | 证据 |
|---|---|---|
| PR 状态 | 通过 | PR #861 已使用 Merge Commit 合并 |
| Head 冻结 | 通过 | Head 为 `ac22a0bd8e5197c5641c3d0ddd8e1abd8649e841` |
| Merge Commit | 通过 | `b74cad648a46421b0a04f5f6b868f2f7a2240319` |
| 提交数 | 通过 | 1 个同主题提交 |
| 文件范围 | 通过 | 只新增 `docs/decisions/base02-membership-revision-accepted-decision.md` |
| Merge 结构 | 通过 | 两个父提交分别为前一 main 与冻结 Head；Merge tree 等于 Head tree |
| Required Check | 通过 | Run `30691379044`／Job `91346604424` 全部成功，完整测试与 build 实际执行 |
| proposed 历史 | 通过 | 两份 proposed Decision Pack 未被改写或回填 |

## 3. A-full 完整性审查

### 3.1 canonical current

**通过。** PR #861 明确 `tenant_members` 继续作为 Access Control 唯一 canonical Membership current。
immutable transition evidence 只能记录 append-only 历史，不能回答 current，也没有被写成永久 sidecar
current。

### 3.2 revision 与 CAS

**通过。** accepted 记录完整要求：

- 显式、持久、稳定且严格单调的 Membership revision；
- `expectedRevision` CAS；
- 同一旧 revision 的并发命令最多一个成功；
- stale、future、非法 revision 与 CAS 不命中 fail-closed；
- revision 不复用、不重置、不倒退；
- CAS 冲突不自动重试为未经调用方重新确认的新命令。

该组合不是 A-literal。记录没有把 SQL 类型、列名、初值、上限或溢出策略提前写成 accepted。

### 3.3 生命周期

**通过。** create、授权相关 refresh、revoke 与 delete 均有明确语义：

- create 建立新 identity、初始 revision、current provenance 与 transition evidence；
- 纯观察 refresh 不写 current；授权事实变化的 refresh 使用 CAS 推进；
- revoke 保留可识别的非 active current 并使旧 evidence 失效；
- delete 保留 tombstone，deleted 默认不得复活。

精确状态枚举、授权字段 allowlist、revoke 后状态机与 tombstone 保留期继续后置，没有被本次审查
误认为已决定。

### 3.4 tombstone、incarnation 与 ABA

**通过。** Membership identity 和 revision 均不得复用或重置；旧 evidence 永久失效。未来如果允许新
incarnation，必须使用新 identity，并由独立前置预检冻结物理模型。该规则足以阻断“删除后按相同
identity／初值复活”的 ABA 路径，但没有提前接受具体键形。

### 3.5 provenance 与同事务 evidence

**通过。** canonical current 的成功变化必须在同一事务内原子形成 current provenance 与 immutable
transition evidence。PR #861 没有把 transition evidence 的表、字段、索引、外键或物理表数量写成
已决定，也没有让该 evidence 成为第二 current。

### 3.6 唯一 Writer

**通过。** Membership 只能由 Access Control 唯一命令／Writer 边界修改；历史 direct writer 未来
必须迁移或保持禁用。该边界目前仅为 accepted target，未被写成 Runtime 已实现或 Writer 已完成。

## 4. Owner 与版本域审查

| 边界 | 结果 | 审查结论 |
|---|---|---|
| Identity | 通过 | 继续拥有用户、账号与正式 Session；Session 不是单独授权源 |
| Access Control | 通过 | 唯一拥有 Membership 与 Binding 生命周期及相应授权边界 |
| Tenancy | 通过 | 继续拥有 Scope、Context 与 Scope revision 原始事实 |
| Security | 通过 | 只提供通用安全能力，不拥有 Membership、Binding 或 Scope |
| Membership revision | 通过 | 独立版本域，只由 Membership 生命周期变化推进 |
| Binding version | 通过 | 独立版本域；rebind 不得伪推进 Membership revision |
| Scope revision | 通过 | 独立版本域，不得替代 Membership revision |
| Operating Context | 通过 | Head／Version 未进入本轮 BASE-02 授权组合 |

Owner 边界没有被重开；Repository、数据库、Migration、Session claim、HMAC 与缓存均未被提升为第二
事实源。

## 5. 方案裁定审查

| 方案 | 审查结果 | 结论 |
|---|---|---|
| A-full | 通过 | 作为完整、不可拆分的架构组合被接受 |
| A-literal | 通过 | 仍仅为 `interim only`，不能关闭完整生命周期 |
| 永久 sidecar current | 通过 | 继续排除，避免第二套 current |
| canonical replacement | 通过 | 只有未来独立 ADR 才可重开 |
| 方案 C | 通过 | `updated_at`、Binding version、hash／HMAC 与现有字段组合继续淘汰 |

未发现把被排除方案重新包装为 fallback、兼容实现或短期例外的情况。

## 6. 未提前决定的物理事项

审查确认 PR #861 没有接受以下内容：

- revision、lifecycle、tombstone、provenance 与 transition evidence 的字段名、SQL 类型、枚举、
  默认值、约束或物理表；
- 初始 revision、授权字段 allowlist、新 incarnation 键形与 tombstone 物理清理政策；
- 数据校准、backfill、高水位、冲突清零、Reader 切换或 Writer 文件 allowlist；
- Migration 编号、Lease、journal、snapshot、SQL、锁序、超时、恢复点、环境或部署窗口；
- DDL、DML、数据库连接、Migration、Seed 或任何执行命令。

因此，本次接受关闭的是架构方向，不是 Schema／Migration 设计或实施。

## 7. 持续阻断审查

| 范围 | 复审状态 | 结论 |
|---|---|---|
| BASE-B1 Runtime | `blocked` | 架构选择已关闭，但前置预检、Schema／Migration 与显式 revision 尚未完成 |
| BASE-B2～B4 | 未启动 | 生命周期 Runtime、Session 刷新、Guard 与绕过闭环均未实施 |
| BASE-B5 | 未启动 | historical orphan 修复仍需独立数据授权 |
| BASE-B6 | 不具备 | 完成证明尚未形成 |
| historical orphan | 未修改 | active historical orphan／Scope relation orphan 的既有低敏审计值保持 `1／1` |
| A2-P2 Scope FK | 未验证 | 继续 `NOT VALID`／`convalidated=false`；未执行 `VALIDATE` |
| Writer | 未启动 | Membership lifecycle Writer 与项目级 Writer 均未实施 |
| Reader | 继续阻断 | 未获得业务 Reader 放行资格 |

Schema、Migration、Runtime、数据库、scripts、tests、CI、package 与 lock 的本次修改数均为 0。

## 8. 风险与后续门禁

独立审查未发现阻断 A-full 接受记录进入 handoff 的问题。后续 handoff 只能把唯一下一任务冻结为：

```text
BASE-02 Membership Revision Schema／Migration 前置预检
```

该预检仍须重新冻结字段、状态机、transition evidence 载体、数据校准、Writer 影响面、Migration
边界与回滚方案。本审查不授权自动启动该预检，更不授权 Schema／Migration 实施或 BASE-B1 Runtime。

## 9. 独立审查结论

PR #861 完整记录了用户接受的 A-full 同表 canonical current 生命周期架构；CAS、ABA、provenance、
同事务 immutable transition evidence 与唯一 Writer 均未缺失。Owner 边界、三个版本域与被排除方案
保持一致，且没有夹带具体物理设计或实施授权。

因此，本次独立审查通过，可进入独立 handoff。

```text
membership_revision_acceptance_review=passed
membership_revision_decision_accepted=true
membership_revision_direction=A-full_same_table_lifecycle
proposed_decision_packs_unchanged=true
eligible_for_schema_migration_preflight_handoff=true
eligible_for_schema_migration_preflight=false
eligible_for_schema_migration_implementation=false
eligible_for_base_b1_runtime=false
base_b1_runtime=blocked
historical_orphan_modified=false
orphan_remediation_authorized=false
a2_p2_scope_fk_validated=false
fk_validation_authorized=false
writer_started=false
reader_started=false
```
