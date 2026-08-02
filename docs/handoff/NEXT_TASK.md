# 智美天工唯一下一任务

## 当前交接状态

BASE-02 Membership Revision M7 Enforce 与旧路径退出已经完成实施、固定本地验收执行、证据归因纠错、
独立审查与合并：

- M7 前置 handoff 修正 PR #901 已合并；
- M7 写入契约实施／独立审查 PR #902／#903 已合并；
- M7 `0043` Schema／Migration 实施／独立审查 PR #904／#905 已合并；
- M7 执行低敏证据 PR #906、证据归因纠错 PR #907、执行独立审查 PR #908 已合并；
- `0043` 已通过一次且仅一次 guarded `pnpm db:migrate` 执行，自动重试与第二次调用为 `0`；
- `planned／created／reused／conflict／unexpected=7／7／0／0／0`；
- 环境 journal 为 `44／0043`，snapshot 保持 `0026`；
- 六个无条件 current envelope 列为 `NOT NULL`；Membership complete／transition／exact current-head
  为 `1／1／1`；
- 全部 `public` 表数据和序列无变化，业务 DML 为 `0`；
- active historical orphan／Scope relation orphan 保持 `1／1`，A2-P2 Scope FK 继续
  `NOT VALID`／`convalidated=false`；
- Execution Lease 已释放，活动 Lease、client、进程、run lock、Helper 和隔离数据库残留为 `0`；
- 恢复证明只覆盖同集群空隔离数据库的选定 schema／data 恢复，不代表 ACL、全局角色、异集群或完整
  灾备验证；
- PR #907 已关闭 Git 归因 F01；PR #908 结论为
  `base02_membership_revision_m7_execution_review=passed`。

M7 完成不等于 BASE-B1～B6、orphan 修复、Scope FK `VALIDATE`、项目级 Writer、Audit／模板、
MIG-01B／C 或业务 Reader 已完成。

## 唯一下一任务

```text
BASE-B1 Owner／Port／revision 契约闭环
```

仓库当前没有该任务的正式 `V2-*` 编号，本 handoff 不自行创建编号。

当前状态：**本 handoff 合并前尚未启动；合并后按当前 ULTRA 用户授权继续。**

BASE-B1 只负责关闭 Access Control／Identity／Tenancy／Security 的 Owner、Port 与三个独立 revision
域契约，不实施 BASE-B2 Binding 独立生命周期，不处理 orphan，不修改数据库，不执行 FK
`VALIDATE`，不放行业务 Reader。

## 一、不得重开的 accepted 边界

1. Access Control 唯一拥有 Membership 与 Binding 生命周期；`tenant_members` 是唯一 canonical
   Membership current，transition 只保存 immutable evidence。
2. Identity 唯一拥有用户、账号与正式 Session；正式 Session 不成为授权事实源。
3. Tenancy 唯一拥有 Institution Scope、Context 与 Scope revision 原始事实。
4. Security 只消费 Owner Port 并形成 request-bound 低敏引用，不直接拥有 Membership、Binding 或
   Scope current。
5. Membership revision、Binding version 与 Scope revision 是三个独立版本域，互不替代。
6. Operating Context 不进入本轮授权组合；不得把 Context Head／Version 静默加入授权判定。
7. `updated_at`、时间戳组合、Binding version 或 hash 不得替代 Membership revision。
8. 不得形成第二套 Membership、Binding、Scope 或 Authorization current 事实源。

## 二、BASE-B1 最新 main 静态复核范围

1. Access Control Membership Owner command UoW、service 与唯一 Repository；
2. authoritative Membership／Binding Reader Port 与 application boundary；
3. Tenancy authoritative Scope Reader Port 与 application boundary；
4. Identity 正式账号 Reader 和 Formal Session 组合根；
5. `Identity I1 → Membership／Binding M1 → Scope S1 → M2 → S2 → Identity I2` 的重读顺序；
6. Security Fresh Membership、Anchor、Scope Guard 与 request-bound evidence；
7. Owner 外 direct Membership Writer／Deleter、授权时间戳 fallback 与兼容映射是否继续为 `0`；
8. 多 Membership 是否必须显式选择 tenant／institution 或 fail-closed；
9. 是否存在跨 Owner 反向依赖、循环依赖、第二事实源或调用方可伪造授权事实。

## 三、当前静态预判与交付方式

M2／M3／M6／M7 当前证据指向 BASE-B1 契约已经 `all_exact`，但本 handoff 不提前把 BASE-B1 写成
通过。启动后必须在最新 main 上重新核验：

1. 若仍为 `all_exact`，不得创建无意义 Runtime 改动；只创建单文件 closure evidence；
2. 再创建单文件独立审查，冻结 evidence Head、文件范围、符号和测试证据；
3. 审查通过后创建四文件 handoff，唯一下一任务切换为 BASE-B2；
4. 每个 PR 在当前 Head 的真实 Required Check 全部成功后，按 ULTRA 授权 Ready、Merge Commit、
   同步 main并清理工作分支；全部 `backup/*` 保留。

建议 BASE-B1 关闭字段：

```text
base_b1_owner_port_revision_contract=all_exact
base_b1_runtime_change_required=false
operating_context_in_authorization_combination=false
second_authorization_fact_source_count=0
eligible_for_base_b1_handoff=true
eligible_for_base_b2=false
```

`eligible_for_base_b2` 只在 BASE-B1 handoff 合并后切换为 `true`。

## 四、与 BASE-B2～B6 的边界

BASE-B1 不实施：

- standalone Binding create／rebind／revoke／expire；
- historical orphan 语义判断或数据处置；
- A2-P2 Scope FK `VALIDATE`；
- 对象 Guard、Action Policy 或业务 Owner Adapter；
- 项目级 Writer／Audit／MIG-01B／C；
- 任何业务 Reader／Capability 开放。

## 五、停止条件

出现以下任一情况时，不得把 BASE-B1 写成 `all_exact`：

- Access Control／Identity／Tenancy／Security Owner 边界冲突或形成循环依赖；
- Membership／Binding／Scope 三版本域互相替代；
- 正式授权路径恢复 `updated_at` 或其他时间戳 fallback；
- 多 Membership 被隐式选择；
- Owner 外 Writer／Deleter 不为 `0／0`；
- 调用方可以提供 role、revision、Scope 或授权 evidence 直接绕过 Owner Reader；
- 需要 Schema、Migration、数据库、BASE-B2 生命周期实现、orphan 修复、FK `VALIDATE` 或业务
  Reader 才能继续。

需要 BASE-B2 能力不是 BASE-B1 文档任务失败；应如实维持边界并只关闭已满足的 B1 契约。

```text
next_task=BASE-B1 Owner／Port／revision 契约闭环
next_task_started=false
next_task_authorized_under_ultra=true
m7_complete=true
m7_handoff_complete=true
eligible_for_base_b1_after_handoff=true
base_b1_started=false
base_b2_started=false
project_writer_started=false
business_reader_started=false
```
