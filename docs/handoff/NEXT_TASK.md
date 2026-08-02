# 智美天工唯一下一任务

## 当前交接状态

BASE-02 Membership Revision M0～M7 与 BASE-B1 已完成并收口：

- M7 handoff PR #909 已合并；环境 journal 保持 `44／0043`，snapshot 保持 `0026`；
- BASE-B1 关闭证据 PR #910 已合并，结论为 `base_b1_owner_port_revision_contract=all_exact`；
- BASE-B1 独立审查 PR #911 已合并，结论为 `base_b1_independent_review=passed`；
- Access Control、Identity、Tenancy 与 Security 的 Owner／Port 边界保持单一；Membership revision、
  Binding version 与 Scope revision 保持三个独立版本域；
- Owner 外 direct Membership Writer／Deleter、授权 `tenant_members.updated_at` 读取和时间戳兼容映射
  均为 `0／0`；
- Operating Context 未进入正式授权组合，第二授权事实源为 `0`；多 Membership 必须显式选择或
  失败关闭；
- BASE-B1 无需 Runtime 改动；本次 handoff 仅修改四个 Markdown。

active historical orphan／Scope relation orphan 继续为 `1／1`，A2-P2 Scope FK 继续
`NOT VALID`／`convalidated=false`。BASE-B1 完成不等于 BASE-B2～B6、orphan 修复、FK `VALIDATE`、
项目级 Writer、Audit／模板、MIG-01B／C 或业务 Reader 已完成。

## 唯一下一任务

```text
BASE-B2 Membership／Binding 生命周期
```

仓库当前没有该任务的正式 `V2-*` 编号，本 handoff 不自行创建编号。

当前状态：**本 handoff 合并前尚未启动；合并后按当前 ULTRA 用户授权继续。**

## 一、不得重开的 accepted 边界

1. Access Control 唯一拥有 Membership 与 Binding 生命周期；`tenant_members` 与
   `auth_account_institution_bindings` 分别是唯一 canonical current。
2. Membership revision 与 Binding version 是独立版本域；rebind 不得推进 Membership revision。
3. Identity 继续拥有用户、账号与正式 Session；Tenancy 继续拥有 Scope、Context 与 Scope revision；
   Security 只消费 Owner Port。
4. 不得创建第二套 Membership／Binding current、永久 sidecar、调用方可伪造事实或 Owner 外直接写入。
5. M0～M7 已消费的 Schema／Migration 不得改写；A2-P2 FK 继续 `NOT VALID`。

## 二、BASE-B2 实施范围

1. 补齐 standalone Binding create／rebind／revoke／expire 的 domain decision 与 application command；
2. 复用 Access Control 当前 transaction-bound UoW／transaction Port，不新增调用方直连 Repository；
3. Binding 持久化 status 继续只有 `active／revoked`；expire 由 `expiresAt` 派生，未获 Schema／Migration
   授权时不得发明 `expired` 枚举；
4. 每个 `account + tenant` 最多一个 active Binding，重复 active 必须 fail-closed；
5. Membership revoke 必须在同一事务撤销 active Binding；
6. Membership reactivate 不得自动恢复旧 Binding；
7. Binding rebind 只推进 Binding version：旧 active Binding 先撤销，新 Binding identity 从版本 `1`
   开始，Membership revision 保持不变；
8. rebind 必须保留旧 Binding 历史与 provenance；不得覆盖旧事实或借 Membership revision 掩盖；
9. 多 Membership 场景必须显式指定 tenant／institution；缺失、歧义或陈旧 selector 必须 fail-closed；
10. affected rows 不为 `1`、旧 revision／version、重复 active、跨 tenant、缺失 Membership 或缺失 Scope
    均必须 fail-closed；Binding 不得据此创建 Scope；
11. 旧 Auth 写入口只能委托 Access Control Owner，或保持只读／禁用；不得保留第二写入边界；
12. create、rebind、revoke、expire 的 replay／CAS、顺序、冲突和同事务回滚必须由定向测试锁定；
13. 现有 Membership create／refresh／revoke／reactivate／delete 语义不得回退。

## 三、候选文件边界

启动后必须先在最新 `main` 重新冻结影响面。当前候选为：

- Access Control Binding lifecycle domain；
- Access Control Binding command application service；
- 两个对应测试文件；
- 如确有必要，仅在现有 Membership command service 中复用或导出 Binding version 上界契约。

不得修改 Schema、Migration、journal、snapshot、数据库、Identity／Tenancy／Security Owner、路由、
业务模块、package、lock 或 CI。若完成完整生命周期必须新增持久化事实、枚举、索引或 Migration，
该需求属于新的物理模型决策，不得在 BASE-B2 Runtime PR 中静默实施。

## 四、完成条件

```text
base_b2_membership_lifecycle=all_exact
base_b2_standalone_binding_lifecycle=implemented
membership_revoke_revokes_active_binding_same_transaction=true
membership_reactivate_restores_binding=false
binding_rebind_advances_membership_revision=false
binding_rebind_advances_binding_version=true
binding_persisted_statuses=active_or_revoked
binding_expiry_derived_from_expires_at=true
active_binding_per_account_tenant=max_one
binding_rebind_preserves_history_and_provenance=true
binding_may_create_scope=false
legacy_auth_binding_writers=delegated_or_disabled
multiple_membership_selection=explicit_or_fail_closed
second_membership_binding_fact_source_count=0
eligible_for_base_b2_independent_review=true
eligible_for_base_b3=false
```

Runtime 实施后必须创建独立审查，再以四文件 handoff 收口。只有 handoff 合并后才能把 BASE-B3
冻结为唯一下一任务。

## 五、硬停止与持续阻断

出现以下任一情况必须停止当前 Runtime 实施并如实交付阻断：

- 需要新的 Schema、Migration、journal、snapshot、数据库写入或第二事实源；
- standalone Binding 命令无法复用 Access Control 唯一事务边界；
- revoke／reactivate／rebind 语义不能同时满足或无法证明原子回滚；
- Binding version 与 Membership revision 被混用；
- 多 Membership 被隐式选择；
- 需要处理 historical orphan、创建 Scope、执行 FK `VALIDATE`、启动项目级 Writer、Audit／模板、
  MIG-01B／C 或业务 Reader。

```text
next_task=BASE-B2 Membership／Binding 生命周期
next_task_started=false
next_task_authorized_under_ultra=true
m7_complete=true
base_b1_complete=true
base_b1_handoff_complete=true
eligible_for_base_b2_after_handoff=true
base_b2_started=false
base_b3_started=false
project_writer_started=false
business_reader_started=false
```
