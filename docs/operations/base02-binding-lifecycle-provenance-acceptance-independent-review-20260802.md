# BASE-02 Binding 生命周期 provenance 与 evidence 接受独立审查

> 审查状态：`passed`
>
> 审查日期：2026-08-02
>
> 审查基线：`edc0bd8b5dacce08612b65f2dd2618fea176de58`
>
> 被审查 PR：#914
>
> 被审查 Head：`599b38526232c9005a867a43820087f646b75e7f`
>
> 被审查 Merge Commit：`edc0bd8b5dacce08612b65f2dd2618fea176de58`
>
> 成功 Required Check：Run `30745547158`／Job `91490427015`
>
> 本文只审查 M09-A accepted decision，不是 Schema、Migration、数据库或 BASE-B2 Runtime 实施授权。

## 1. 审查定位

本审查由独立只读 Agent 针对 PR #914 的冻结 Head 完成，核对：

- M09-A 是否与既有 Owner、A-full 和三个版本域一致；
- M09-B current 冗余字段是否确实不是授权正确性的最小硬门；
- canonical Binding current 与 append-only transition evidence 是否保持单一事实源；
- create／rebind／revoke／expire、command replay、legacy calibration 与同事务边界是否完整；
- accepted decision 是否提前授权 Schema、Migration、数据库或 BASE-B3；
- 首轮与第二轮发现是否在最终 Head 全部关闭。

审查只使用已合并仓库文件、Git 与 GitHub 低敏交付证据。没有连接数据库、读取环境变量、修改仓库
设置或改动共享工作树。

## 2. 交付身份与范围

| 核对项 | 结果 | 证据 |
|---|---|---|
| PR 状态 | 通过 | PR #914 已使用 Merge Commit 合并 |
| Head 冻结 | 通过 | `599b38526232c9005a867a43820087f646b75e7f` |
| Merge Commit | 通过 | `edc0bd8b5dacce08612b65f2dd2618fea176de58` |
| 提交数 | 通过 | 1 个同主题提交 |
| 文件范围 | 通过 | 只新增 `docs/decisions/base02-binding-lifecycle-provenance-accepted-decision.md` |
| Merge 结构 | 通过 | 两个父提交分别为前一 main 与冻结 Head，Merge tree 等于 Head tree |
| Required Check | 通过 | Run `30745547158`／Job `91490427015` 全部成功，完整测试与 build 实际执行 |
| Runtime／Schema／Migration | 通过 | 修改均为 0 |
| 数据库／仓库设置 | 通过 | 未连接、未执行、未修改 |

## 3. M09-A 方向审查

### 3.1 canonical current

**通过。** `auth_account_institution_bindings` 继续是唯一 canonical Binding current 与每个 identity 的
权威 lifecycle 状态行。revoked 行保留历史，rebind 使用 revoke-old + create-new，不允许原地改写
institution、复活 revoked row 或删除历史。

transition evidence 被明确限制为 append-only 历史证据，不能回答 current。B3 Reader 不得查询
transition 还原授权，Session claim、日志、Audit 或缓存也不能成为第二套 current。

### 3.2 M09-B 不是最小硬门

**通过。** 当前权威 Reader 的授权判定只消费 Binding identity、状态、assignment source、version、
assigned／expiry／revocation 时间及 Scope 组合，不查询撤销 actor、reason 或 rebind lineage。

因此，M09-A 用同事务 transition evidence 保存 actor、reason 和 lineage 足以保证历史可解释性；把
`revokedBy／reason／reboundFrom` 冗余到 current 只可能是未来查询优化，不是 BASE-B2 授权正确性的
必要条件。该结论没有弱化 assignment provenance 或 immutable evidence。

### 3.3 版本域与 Owner

**通过。** accepted 记录保持：

- Access Control 唯一拥有 Membership 与 Binding 生命周期；
- Identity 继续拥有账号与正式 Session；
- Tenancy 继续拥有 Scope、Context 与 Scope revision；
- Security 只消费 Owner Port；
- Membership revision、Binding version、Scope revision 独立；
- rebind 只改变 Binding version，不推进 Membership revision；
- evidence 中的 Membership／Scope revision 只是历史 observation，不能替代 current。

没有建立永久 sidecar、第二 Membership／Binding current 或跨域 Audit 替代物。

## 4. 首轮 F01～F05 关闭审查

### F01：source 命名域

**已关闭。** 最终记录明确分离：

- evidence `provenanceSource`：
  `formal_onboarding／access_control_command／legacy_calibration`；
- canonical current `assignmentSource`：
  `manual_admin／migration_placeholder／system`。

新 Runtime 只能写 `manual_admin／system`；`migration_placeholder` 仅能作为既有 baseline 被观察。current
`source／assignedBy／assignedAt` 分别与 evidence `assignmentSource／actorId／occurredAt` 对齐，不再
要求两个枚举域字面相等。

### F02：expire trusted time

**已关闭。** expire 资格使用调用方不可注入的服务端 `serverObservedAt`，只有
`expiresAt <= serverObservedAt` 才能执行。evidence 固定 `revokedAt／occurredAt=expiresAt`，
`recordedAt` 为实际持久化时间且不得早于可信观察时间或 occurred time。该规则不会因
`occurredAt=expiresAt` 形成循环自证。

### F03：canonical tuple 物理不可变

**已关闭。** M09-A 允许 account／tenant／institution 从 canonical row 导出，因此最终记录把以下
保护纳入物理下限：

- Runtime UPDATE 只允许 lifecycle 字段；
- identity／tuple／assignment 列由 column immutability trigger 或等价约束保护；
- DELETE／TRUNCATE 由权限与 trigger 拒绝；
- rebind 只能撤销旧 row 并插入新 identity。

Repository 约定、TypeScript 或测试不能替代数据库级保护。

### F04：legacy calibration Shape

**已关闭。** 最终记录明确：

- from status／version 与 replacement identity 为 NULL；
- to status／version 记录未修改的 observed current；
- Membership revision 只记录可验证 current；Scope revision 固定 NULL；
- assignment source 只观察既有 current；
- provenance source 为 `legacy_calibration`，actor／occurredAt 为 NULL，reason 为 `legacy_unknown`；
- recordedAt 只表示 baseline 记录时刻；command／evidence identity 确定性派生；
- Binding current 与 historical orphan 均不修改。

该 evidence 只证明 cutover baseline，不伪造 pre-cutover 历史。

### F05：command uniqueness 与 B3 完整门禁

**已关闭。** command replay 固定为租户域 UNIQUE `(tenant_id,command_id)`；standalone `bcmd1_` 与父
Membership `mcmd1_` 均受相同规则保护。任何 mutation 前先查 replay，并由 UNIQUE 兜住并发漏检；
重复命令 fail-closed，不比较 payload、不返回历史成功、不自动 retry。

BASE-B2 关闭清单已经补齐：

- Membership lifecycle `all_exact`；
- reactivate 不恢复旧 Binding；
- rebind 保留历史与 provenance；
- active max-one；
- 缺失／非 active Scope fail-closed 且 Binding 不创建 Scope；
- 多 Membership 显式选择或 fail-closed；
- 旧 Auth writer 委托或禁用；
- 第二事实源为 0；
- AQ008 扩展与验证均为 true。

因此，不存在只完成 transition evidence 就提前将 B3 标记为 eligible 的路径。

## 5. 生命周期与同事务边界

| 生命周期 | 审查结论 |
|---|---|
| create | active Membership、expected revision、无 active Binding、active Scope 与 Scope revision 同事务核验；new identity v1 与 evidence 原子 |
| rebind | old active/n CAS→revoked/n+1，new identity active/v1，单条 old→replacement evidence；Membership revision 不变 |
| revoke | explicit identity/version CAS，与 actor/reason/command evidence 同事务 |
| expire | persisted status 仍为 active/revoked，按 trusted server time 显式物化；Reader 在此之前仍按 expiresAt fail-closed |
| Membership revoke/delete side effect | Membership current/evidence 与 Binding current/evidence 使用同一父 command、同一事务 |
| Membership reactivate | 遇任何 persisted active Binding 在 Membership CAS 前 fail-closed；PR #913 已建立安全前置 |

固定 UoW、锁序、affected rows=`1`、无 nested transaction、无自动 retry 和失败整批回滚均未缺失。

## 6. 物理模型与实施边界

accepted decision 只冻结必须承载的事实与物理保护下限，没有提前决定：

- 最终表、enum、列、索引、FK、CHECK、trigger 与函数名称；
- exact SQL 类型与 Migration 切片；
- Migration 编号、Lease、journal entry、恢复点或执行窗口；
- local_acceptance 执行或数据库角色权限；
- Runtime 文件 allowlist 与具体 Port／Repository 方法。

后续仍须独立完成 Schema／Migration 前置预检。只有预检、物理模型接受、DDL 实施与执行、Runtime、
legacy calibration、AQ008、独立审查和 handoff 全部完成，才可把 BASE-B2 标记为完成。

## 7. 持续阻断

| 范围 | 状态 | 结论 |
|---|---|---|
| Schema／Migration | 未授权 | 编号、Lease、SQL 与数据库执行均未启动 |
| BASE-B2 Runtime | 未完成 | standalone lifecycle、evidence Writer、calibration 与 AQ008 尚未实施 |
| BASE-B3 | 阻断 | 只有 BASE-B2 handoff 后才可解锁 |
| historical orphan | 未修改 | 继续保留既有业务语义硬门 |
| A2-P2 Scope FK | 未验证 | 继续 `NOT VALID` |
| 项目级 Writer／Audit／MIG-01B／C／业务 Reader | 未启动 | 不属于本次接受范围 |

## 8. 独立审查结论

PR #914 的最终 Head 完整、无歧义地记录 M09-A：canonical Binding current 保持唯一，Access Control
transition evidence 只保存同事务 append-only 历史；M09-B current 冗余列不是授权正确性的最小硬门。
三轮审查发现的 F01～F05 已全部关闭，没有新增 accepted 冲突、第二事实源或范围越权。

因此，本次接受独立审查通过，可进入 handoff，把唯一下一任务冻结为 Binding transition evidence
Schema／Migration 前置预检；该结论不授权直接实施或数据库执行。

```text
base02_binding_provenance_acceptance_review=passed
reviewed_pr=914
reviewed_head=599b38526232c9005a867a43820087f646b75e7f
reviewed_merge_commit=edc0bd8b5dacce08612b65f2dd2618fea176de58
F01_source_namespace=closed
F02_expire_trusted_time=closed
F03_binding_current_physical_immutability=closed
F04_legacy_calibration_shape=closed
F05_command_uniqueness=closed
F05_base_b3_complete_gate=closed
binding_m09_a_accepted=true
binding_m09_b_required_for_current=false
accepted_conflict_count=0
scope_overreach_count=0
eligible_for_schema_migration_preflight_handoff=true
eligible_for_schema_migration_implementation=false
eligible_for_base_b2_runtime=false
eligible_for_base_b3=false
```
