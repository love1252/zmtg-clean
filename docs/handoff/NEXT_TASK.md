# 智美天工唯一下一任务

## 当前交接状态

BASE-02 Membership Revision M0～M7 与 BASE-B1 已完成并收口，BASE-B2 已启动但尚未完成：

- BASE-B1 关闭证据／独立审查 PR #910／#911 已合并，结论为
  `base_b1_owner_port_revision_contract=all_exact`／`base_b1_independent_review=passed`；
- PR #913 已完成 Membership reactivate 的 active Binding 冲突保护：事务内锁定 current Membership
  与 active Binding，存在 active Binding 时以 `binding_active_conflict` 失败关闭且全部写入为 `0`；
- PR #914 已接受 M09-A：`auth_account_institution_bindings` 继续作为 Access Control 唯一 canonical
  Binding current／lifecycle history；另设同 Owner、同事务、append-only 的 Binding transition evidence，
  但它不得回答 current，也不得成为第二套事实源；
- PR #915 独立审查确认 F01～F05 全部关闭，结论为
  `base02_binding_provenance_acceptance_review=passed`；
- PR #914／#915 未修改 Schema、Migration、journal、snapshot、数据库、Runtime、scripts、tests、CI、
  package 或 lock；本次 handoff 只修改四个 Markdown。

环境 journal 保持 `44／0043`，snapshot 保持 `0026`。active historical orphan／Scope relation orphan
继续为 `1／1`，A2-P2 Scope FK 继续 `NOT VALID`／`convalidated=false`。BASE-B2 尚缺 Binding transition
evidence 的物理模型、Migration、Writer、legacy calibration、AQ008 扩展、独立审查与 handoff；BASE-B3～B6、
orphan 修复、FK `VALIDATE`、项目级 Writer、Audit／模板、MIG-01B／C 与业务 Reader 均未启动。

## 唯一下一任务

```text
BASE-B2 Binding transition evidence Schema／Migration 前置预检
```

仓库当前没有该任务的正式 `V2-*` 编号，本 handoff 不自行创建编号。

当前状态：**本 handoff 合并前尚未启动；合并后按当前 ULTRA 用户授权继续。**

## 一、不得重开的 accepted 边界

1. Access Control 唯一拥有 Membership current／transition 与 Binding current／transition；Identity、Tenancy、
   Security、Audit 与共享数据库资产均不得成为第二 Owner。
2. `tenant_members` 与 `auth_account_institution_bindings` 分别是唯一 Membership／Binding canonical current；
   Binding transition evidence 只保存不可变历史，不能回答 current。
3. Membership revision、Binding version 与 Scope revision 是三个独立版本域；rebind 只推进 Binding version，
   不得推进 Membership revision。
4. Binding current 不以新增 `revokedBy／reason／reboundFrom` 冗余列作为 BASE-B2 最小硬门；若未来需要，
   必须独立决策。
5. Binding 持久化 status 继续只有 `active／revoked`；expire 资格由 `expiresAt` 派生，expire command 只有在
   受信任服务端时间证明到期后才可 CAS revoke。
6. create、revoke、expire、rebind 与 Membership revoke／delete 联动都必须在 Access Control 唯一 UoW 内
   原子形成 canonical current 和 transition evidence；任一步失败整批回滚且不自动重试。
7. current identity、assignment tuple 与初始 assignment provenance 不可变；DELETE／TRUNCATE 和绕过
   Owner 的直接写入必须由数据库与 AQ008 共同阻断。
8. provenanceSource 与 assignmentSource 是两个不同命名空间；新 Runtime 不得继续写入
   `migration_placeholder`，legacy calibration 不得伪造历史 actor／reason／lineage。
9. M0～M7 已消费的 Schema／Migration 不得改写；A2-P2 FK 继续 `NOT VALID`，historical orphan 不在本任务处理。

## 二、前置预检范围

本任务只做仓库静态证据与固定 localhost-only `local_acceptance` 的显式 `READ ONLY` 低敏审计，并只新增：

```text
docs/operations/base02-binding-transition-evidence-schema-migration-preflight-20260802.md
```

预检必须冻结：

1. Binding transition evidence 表、枚举、列名、类型、nullability、默认值与 Owner；
2. accepted evidence 必承载 immutable evidence identity、command identity、transition 类型、原 Binding
   identity、rebind replacement identity、from／to status、from／to Binding version、当次 Membership revision、
   create／rebind 当次 Scope revision、规范化 source／actor／reason、occurred／recorded time，以及 legacy
   calibration 的明确 null 语义；account／tenant／institution 允许从不可删除且 identity tuple 不可变的
   canonical Binding row 可靠派生，若物理模型重复这些字段则必须以 FK／CHECK 保证一致且不得形成可独立
   改写的副本；
3. `provenanceSource=formal_onboarding／access_control_command／legacy_calibration` 与
   `assignmentSource=manual_admin／migration_placeholder／system` 的独立约束；
4. evidence identity 主键、`UNIQUE (tenant_id, command_id)`、同一 Binding／目标 version 唯一性、原／replacement
   Binding FK、正 version、严格 `+1`、transition／time／provenance Shape、replacement≠original、
   `ON UPDATE／DELETE NO ACTION`、Runtime evidence 仅 `SELECT／INSERT`，以及数据库拒绝 evidence
   `UPDATE／DELETE／TRUNCATE` 的完整物理保护；
5. current identity／assignment tuple／初始 assignment provenance 的数据库不可变保护；
6. create／revoke／expire／rebind／Membership revoke-delete 联动的同事务写入顺序、affected rows 与回滚边界；
7. legacy calibration 的确定性 Shape、零伪造规则、高水位／追赶、计数守恒与冲突清零；
8. AQ008 对 Binding current 与 transition evidence 的 Owner 写入 allowlist 扩展；
9. Schema、Migration、Repository、Writer、Reader、Route、脚本、fixture、测试与文档的完整静态影响面；
10. journal `44／0043`、snapshot `0026` 与候选 Migration 切片；编号只能在未来唯一 Migration Lease 下实时分配；
11. 未来串行顺序：前置预检 → physical model accepted decision（仅在仍有未冻结选项时）→ Expand DDL
    → Owner evidence Writer → legacy calibration → 高水位追赶与冲突清零 → AQ008／独立审查
    → BASE-B2 handoff；
12. 每个未来切片的精确文件 allowlist、定向测试、完整质量门、恢复点、Lease、停止条件与 forward-fix。

只读数据库审计只允许输出固定状态码、布尔值和低敏计数，不得输出连接参数、角色、原始行、双键、PII
或私有引用。无法证明固定 localhost-only、`READ ONLY`、无并发 Writer 或 current／journal／Shape 无漂移时，
立即停止数据库探针并以仓库静态证据继续能安全完成的部分；不得据此写入数据库。

## 三、预检完成门

```text
binding_transition_evidence_preflight=passed_or_blocked_with_exact_reason
binding_transition_evidence_current_owner=Access_Control
binding_transition_evidence_is_second_current=false
binding_current_extra_revocation_columns_required=false
binding_physical_model_decision_required=determined
binding_schema_migration_number_allocated=false
binding_migration_lease_created=false
eligible_for_binding_schema_migration_implementation=false
binding_schema_migration_implementation_authorized_by_this_handoff=false
binding_schema_migration_implementation_started=false
binding_database_write_started=false
base_b2_complete=false
eligible_for_base_b3=false
```

预检完成后必须创建独立审查与四文件 handoff。只有后续用户授权范围或当前 ULTRA 授权经过对应动态硬门后，
才能进入具体 Schema／Migration 实施；不得从预检直接跳到 BASE-B3。

## 四、禁止范围与硬停止

本任务不得：

- 修改 Schema、Migration、journal、snapshot、Runtime、scripts、tests、CI、package 或 lock；
- 创建 Migration Lease、预留编号、运行 `db:generate`、Migration、Seed、DDL、DML 或数据库写入；
- 修改既有 accepted decision、创建第二 Binding current、把 Audit 当作 canonical provenance；
- 启动 BASE-B3～B6、historical orphan 修复、Scope 创建、FK `VALIDATE`、项目级 Writer、Audit／模板、
  MIG-01B／C 或业务 Reader。

以下情况是真正硬停止：需要重开 M09-A；无法维持 Access Control 唯一 Owner；必须创建永久第二 current；
无法枚举物理候选或完整影响面；需要非 localhost 环境、真实凭证或敏感数据；出现无法解释的 Schema、journal、
数据 Shape 或并发 Writer 漂移。

```text
next_task=BASE-B2 Binding transition evidence Schema／Migration 前置预检
next_task_started=false
next_task_authorized_under_ultra=true
m7_complete=true
base_b1_complete=true
base_b2_started=true
base_b2_reactivate_guard_complete=true
binding_provenance_decision=M09-A_accepted
binding_provenance_acceptance_review=passed
binding_transition_evidence_required=true
binding_transition_evidence_schema_migration_required=true
binding_schema_migration_preflight_started=false
base_b2_complete=false
base_b3_started=false
project_writer_started=false
business_reader_started=false
```
