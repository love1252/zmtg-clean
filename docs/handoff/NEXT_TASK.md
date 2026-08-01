# 智美天工唯一下一任务

## 当前交接状态

BASE-02 Membership Revision 的 proposed 证据链、A-full accepted decision 与接受独立审查已经依次
进入 `main`：

- PR #857：Membership revision 硬停止证据；
- PR #858：Membership Revision Architecture Decision Pack；
- PR #859：proposed 决策独立审查；
- PR #860：决策阶段 handoff；
- PR #861：A-full Accepted Decision，Head `ac22a0bd8e5197c5641c3d0ddd8e1abd8649e841`，
  Merge Commit `b74cad648a46421b0a04f5f6b868f2f7a2240319`，Run `30691379044`／Job
  `91346604424` 成功；
- PR #862：接受独立审查，Head `46ec582001989416dd6cd8a7c333f13d68de3499`，Merge Commit
  `1478c2693d6a21216169babad5ff9d4147e3afb0`，Run `30691699252`／Job
  `91347460065` 成功；
- 独立审查结论：`membership_revision_acceptance_review=passed`；
- 接受方向：`A-full_same_table_lifecycle`；
- `membership_revision_decision_accepted=true`。

上述合并只关闭 Membership revision 架构选择，不表示 Schema、Migration、Runtime 或数据库已经
实施，也不构成下一任务的自动启动授权。

## 唯一下一任务

```text
BASE-02 Membership Revision Schema／Migration 前置预检
```

仓库当前没有该任务的正式 `V2-*` 编号，本 handoff 不自行创造编号。

当前状态：**尚未启动、尚未授权**。

未来任务必须先由用户明确授权，并保持 docs-only 前置预检；它不能直接创建或修改 Schema、Migration、
journal、snapshot、Runtime 或数据库。

## 一、不得重开的 accepted 约束

未来前置预检必须以以下 accepted 架构语义为输入，不得重新选择方向：

1. `tenant_members` 继续作为 Access Control 唯一 canonical Membership current；
2. Identity 继续拥有用户、账号和正式 Session；
3. Access Control 唯一拥有 Membership 与 Binding 生命周期；
4. Tenancy 继续拥有 Scope、Context 与 Scope revision 原始事实；
5. Security 继续只提供通用安全能力；
6. Membership revision、Binding version 与 Scope revision 是三个独立版本域；
7. Membership revision 必须显式、稳定、严格单调，并使用 `expectedRevision` CAS；
8. create、授权相关 refresh、revoke、delete、tombstone、incarnation identity 与 ABA 防护构成完整
   生命周期；
9. current provenance 与 immutable transition evidence 必须同事务原子形成；
10. transition evidence 不得成为第二套 current；
11. Membership 只能通过 Access Control 唯一命令／Writer 边界修改；
12. Operating Context Head／Version 不进入本轮 BASE-02 授权组合。

A-literal 仍只可能是明确标记的 interim carrier，不能关闭完整生命周期；永久 sidecar current 继续
排除；canonical replacement 只有未来独立 ADR 才可重开；方案 C 继续淘汰。

## 二、前置预检必须重新冻结的事项

### 1. 精确字段与约束

- revision 的字段名、SQL 类型、初值、正值／单调约束、上限和溢出策略；
- lifecycle current 的字段集合、状态机、nullability、default 与约束；
- tombstone、incarnation identity 与 current provenance 的物理表达；
- deleted 默认不可复活及 identity／revision 不复用的数据库证明；
- 不得用隐式 default 掩盖旧 Writer。

### 2. transition evidence 载体

- immutable evidence 的物理载体、唯一键、引用关系、排序与 append-only 约束；
- canonical current 与 evidence 的同事务边界、固定锁序与失败原子性；
- 如何证明 evidence 只记录历史，不成为第二 current；
- actor、reason、command identity 与低敏 provenance 的候选契约。

### 3. 生命周期状态机

- create 的 expected-absence 与初始状态；
- 授权相关 refresh 与纯观察 refresh 的边界；
- revoke、delete、tombstone 与可能的新 incarnation；
- Membership 与 active Binding 的一致性边界；
- Binding rebind 只推进 Binding identity／version、不伪推进 Membership revision；
- stale、future、非法 revision、CAS 冲突与并发一胜一败的停止语义。

### 4. 当前数据与校准方案

- 当前 `tenant_members` Shape、数据分布和 direct writer／deleter 影响面；
- legacy current 如何获得 deterministic 初始 revision 与 provenance；
- backfill、高水位追赶、行数守恒、冲突分类与冲突清零；
- 不得把 Migration 时间伪装为历史生命周期事件时间；
- active historical orphan／Scope relation orphan `1／1` 必须保持独立，不得夹带修复。

未来若需要数据库探针，必须由用户对固定环境、只读范围与低敏输出另行授权；本 handoff 没有提供
数据库连接授权。

### 5. Writer 与 Reader 影响面

- 枚举全部 Membership direct writer、deleter、seed、reset、脚本与维护入口；
- 冻结 Access Control 唯一 command／Writer 的 Port、事务与 CAS 责任；
- 旧 Writer 的迁移、封堵和失败回退条件；
- current 兼容 Reader 从 `updated_at` 迁移到显式 revision 的阶段边界；
- authoritative Reader、Fresh Membership、Guard 与业务 Reader 的后续准入条件；
- 本前置预检不得实现 Writer、Reader、Port、Repository 或 Runtime。

### 6. Migration 边界与实施切片

- Expand、Owner Writer／旧 Writer 封堵、数据校准、Reader 切换、Enforce 的精确串行关系；
- 每个切片的候选文件类型、测试、停止条件、恢复点、回滚与 forward-fix；
- Migration 编号只能在未来独立 Migration Lease 下实时分配，不得在预检中预留或占用；
- journal／snapshot、`db:generate`、SQL、锁序、isolation、timeout 与共享环境消费后的不可改写边界；
- 任何具体 DDL、DML、回填或数据库执行都必须等待后续独立授权。

## 三、持续阻断

- BASE-B1 Runtime：继续 `blocked`；
- BASE-B2～B4：lifecycle Runtime、Session／上下文刷新、Guard 与绕过闭环未启动；
- BASE-B5：active historical orphan 与 Scope relation orphan 仍为 `1／1`，修复未授权；
- BASE-B6：完成证明不具备；
- A2-P2 Scope FK：继续 `NOT VALID`／`convalidated=false`，不得执行 `VALIDATE`；
- Membership lifecycle Writer 与项目级 Writer：未启动；
- Audit／模板、MIG-01B、MIG-01C、Reader：继续阻断；
- 正式平台服务端授权根仍为独立缺口，七线正式发布仍为 `0/7`。

环境计数是既有审计窗口的低敏证据，不是永久状态；任何未来数据库任务都必须重新冻结环境。

## 四、未来前置预检允许范围

只有用户另行授权后，未来任务可：

- 读取当前 `main` 的代码、测试、Schema、Migration、journal、snapshot 与已合并架构证据；
- 静态枚举字段、约束、Writer、Reader、Route、Repository、脚本和测试影响面；
- 比较物理载体方案，但不得重开 A-full 架构方向或 Owner；
- 形成 docs-only 前置预检与独立审查材料；
- 冻结后续独立实施切片、文件类型、测试、停止和恢复要求。

## 五、当前禁止范围

当前不授权：

- 修改 `src/**`、`drizzle/**`、scripts、tests、CI、package 或 lock；
- 创建或修改 Schema、Migration、journal、snapshot 或 Migration Lease；
- 数据库连接、DDL、DML、Migration、Seed、回填、校准或环境操作；
- BASE-B1～B6 Runtime；
- orphan UPDATE、DELETE、INSERT、重绑、撤销或补 Scope；
- FK `VALIDATE`、`SET NOT NULL`；
- Writer、Audit／模板、MIG-01B、MIG-01C 或 Reader；
- 自动开始本文冻结的前置预检。

## 六、未来前置预检停止条件

出现以下任一情况必须停止：

- 需要重开 A-full、Owner 或三个独立版本域；
- 只设计 revision 字段，却遗漏 lifecycle、ABA、provenance 或 transition evidence；
- 无法证明 canonical current 与 transition evidence 同事务原子形成；
- 需要永久第二套 Membership current；
- 无法枚举 direct writer／deleter 或 Reader 影响面；
- 必须读取环境、凭证、真实数据或扩大 docs-only 范围才能继续；
- 需要在预检中创建 Migration、分配 Lease、连接数据库或实施 Runtime；
- 需要夹带 orphan 修复、FK `VALIDATE`、Writer／Reader 放行或 BASE-B1～B6 实施；
- current、accepted target、Owner、基线或工作树出现无法解释的漂移。

## 七、交付判定

```text
next_task=BASE-02 Membership Revision Schema／Migration 前置预检
next_task_started=false
next_task_authorized=false
membership_revision_direction=A-full_same_table_lifecycle
membership_revision_decision_accepted=true
membership_revision_acceptance_review=passed
eligible_for_schema_migration_preflight=true
schema_migration_preflight_started=false
schema_migration_preflight_authorized=false
eligible_for_schema_migration_implementation=false
eligible_for_base_b1_runtime=false
base_b1_runtime=blocked
orphan_remediation_authorized=false
a2_p2_scope_fk_validated=false
writer_started=false
reader_started=false
eligible_for_reader=false
```
