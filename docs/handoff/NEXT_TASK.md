# 智美天工唯一下一任务

## 当前交接状态

A2-P2 P1 核心 Schema／Migration 已完成仓库实施、实施独立审查、固定 localhost-only
`local_acceptance` 单次受控 Migration、执行低敏证据和执行独立审查：

- P1 实施 PR #849：Head `4b0a0f89f5aa36a9c2283a6a8af18a18fd12fe08`，Merge Commit
  `036c3198ee038186c36d19f8f57a7a45b965b963`，Run `30645227980`／Job
  `91204848506` 成功；
- 实施独立审查 PR #850：Head `24370a0071dd40e01b5d601013e45a28f45d285c`，Merge Commit
  `57b77a76e55846d14a28bfdf3a8794ba67241a54`，Run `30646526891`／Job
  `91209147172` 成功；
- 执行低敏证据 PR #851：Head `1a832883b20f8e37879f3f740db0cc9cb098aea8`，Merge Commit
  `e93d180fb7e34a33d2f7e2e70eb4f2eed66790cf`，Run `30648638669`／Job
  `91216191655` 成功；
- 执行独立审查 PR #852：Head `31fdec07abbccb461e7d21299fb8f7f135add7ae`，Merge Commit
  `96fe2b80f75bc3c2e1f8044b27ff84df64bba2b2`，Run `30649674973`／Job
  `91219568724` 成功；
- 独立审查结论为 `a2_p2_p1_execution_review=passed`、`a2_p2_complete=true`、
  `eligible_for_base02_handoff=true`、`eligible_for_base02_implementation=false`。

本交接只收口 A2-P2 并冻结下一次规划／准入任务，不构成 BASE-02 Runtime、数据修复、数据库
连接、Writer、Reader 或任何后续任务的授权。

## 唯一下一任务

```text
BASE-02 前置规划／准入
```

仓库当前没有该任务的正式 `V2-*` 编号，本 handoff 不自行创造编号。

当前状态：**尚未启动、尚未授权**。

未来任务必须先以静态证据审计、范围冻结和实施准入设计为目标；只有用户对未来任务、文件、
数据、环境和风险再次明确授权后，才可启动。当前 `eligible_for_base02_handoff=true` 只表示
可以申请并编制该前置任务，不等于 `eligible_for_base02_implementation=true`。

## 一、已冻结的 A2-P2 current 终态

### 1.1 仓库与 Migration

- 实时分配编号：`0039`；
- tag：`0039_mig_01a2_anchor_bridge`；
- 仓库 journal 为 `40` 项，最新为 `0039`；
- snapshot 仍为 `0026_snapshot.json`，blob 未变化；
- P1 实际文件范围精确为 Migration SQL、journal、Schema、Schema 测试四个文件；
- `db:generate` 和 snapshot-diff Migration 禁令继续有效。

### 1.2 目标对象

- 普通非唯一 btree 索引：`auth_account_institution_bindings_scope_idx`；
- 索引表和列序：`auth_account_institution_bindings(tenant_id, institution_id)`；
- 索引无 predicate、include 或 expression；
- 外键：`auth_account_institution_bindings_scope_fk`；
- 源双列指向 `institution_scopes(tenant_id, institution_id)`；
- `MATCH SIMPLE`、`ON UPDATE NO ACTION`、`ON DELETE NO ACTION`、非 deferrable；
- 外键 `convalidated=false`，继续保持 `NOT VALID`。

### 1.3 local_acceptance 执行终态

```text
migration_attempt=1
migration_retry=0
planned=2
created=2
reused=0
conflict=0
unexpected=0
```

- 环境 Applied Migration 从 `39` 到 `40`；
- 业务 DML 为 `0`，环境 Migration journal metadata 增加 `1`；
- A2-P1 Scope／Context Version／Context Head 保持 `1／1／1`；
- Binding 总数／NULL／重复／historical orphan 保持 `1／0／0／1`；
- 执行前后恢复点、archive parse、完整性和隔离恢复验证通过；
- Migration Lease 已消费并释放，不可复用；
- 没有回填、`VALIDATE`、`SET NOT NULL`、第三个人工对象或第二次 Migration。

以上是执行窗口的冻结低敏证据，不是永久环境状态。未来任务如需环境事实，必须在独立授权下
重新核验。

## 二、BASE-02 已接受边界

- Identity 继续拥有用户、账号和正式 Session；
- Access Control 继续拥有 Membership、Authorization Provenance、Fresh Membership、Anchor
  授权证据、机构／对象 Guard 和 Action Policy；
- Security 继续拥有通用安全能力；
- Tenancy／Scope 原始事实与 Access Control 消费后签发的短生命周期授权证据不得合并为第二套
  事实源；
- BASE-02 负责成员服务端 `tenantId + institutionId` 双键上下文、scope revision、入口 Guard、
  业务 Guard、陈旧上下文拒绝和 fail-closed 边界；
- Writer 双写、Audit／模板、MIG-01B、MIG-01C 和 Reader 仍是后续独立切片，不得由本次前置
  规划静默启动。

## 三、未来前置规划必须回答

1. 当前 Membership、Binding、Anchor、Authorization Provenance 的真实 Owner、路径、调用方和
   测试证据；
2. 成员服务端双键上下文的签发、消费、刷新、撤销和 fail-closed 状态；
3. Scope Revision／Context Head 与 Fresh Membership 的版本比较和陈旧上下文拒绝语义；
4. 页面、Route、Application Service、Port、Repository／Adapter 的 Guard 分层与单一业务 Owner；
5. 跨租户、跨机构、停用、缺失 Anchor、缺失 Membership 和冲突 Provenance 的拒绝矩阵；
6. Seed、fixture、导入、维护任务和旧 Route 是否绕过双键上下文或 Guard；
7. historical orphan `1` 的事实 Owner、成因、允许动作、确定性验证、停止条件、回退或
   forward-fix；
8. BASE-02 实施候选切片、精确文件类型、测试、Required Check、独立审查和 handoff 顺序；
9. 何时才允许 `eligible_for_base02_implementation=true`，以及哪些状态仍必须保持阻断；
10. BASE-02 完成后 Writer、Audit／模板、MIG-01B、MIG-01C 和 Reader 的串行门禁。

不能从文件名、类型、Mock、Demo、角色常量、测试通过或 Capability 存在推断正式上下文已上线。

## 四、historical orphan 硬门

当前 historical orphan 数量为 `1`，已解释但尚未修复／清零：

- 它不属于 A2-P2 或 MIG-01B 的静默处理范围；
- 禁止从 Binding 反推创建 Scope；
- 修复 Owner 必须由 Access Control／BASE-02 Binding 生命周期或独立专项数据修复任务明确；
- 未来方案必须定义确定性选择、受影响行数、冲突分类、只读预检、执行授权、回退或 forward-fix；
- 清零前不得把 BASE-02 标记完成；
- 清零并取得独立授权前不得执行外键 `VALIDATE`；
- 清零和 BASE-02 完成前不得放行 Reader。

本 handoff 不授权对该行执行 UPDATE、DELETE、重绑、回填或任何其他 DML。

## 五、未来任务允许范围

未来 `BASE-02 前置规划／准入` 默认只允许：

- 读取当前 main 的代码、测试、Schema、Migration、配置、accepted decisions、架构证据和 handoff；
- 用静态搜索枚举相关表、Reader、Writer、Route、Service、Port、Repository、Adapter 和测试；
- 输出 docs-only 的 current 事实、target 约束、差距、候选切片、风险、测试、停止、回退与授权清单；
- 创建独立 Draft PR并等待真实 Required Check。

具体文档路径、文件数量和任务编号必须由未来独立授权明确，本 handoff 不预建文件或编号。

## 六、当前禁止范围

当前不授权：

- 修改 `src/**`、`drizzle/**`、`scripts/**`、`tests/**`、CI、package 或 lock；
- 连接数据库、读取凭证、运行 Runner、Migration、Seed、DDL、DML 或 Restore；
- 修复 historical orphan、执行外键 `VALIDATE` 或 `SET NOT NULL`；
- 创建或消费 Execution／Migration Lease；
- 实施 BASE-02 Runtime、Membership／Binding 生命周期、Guard 或 Action Policy；
- 启动 Writer、Audit／模板、MIG-01B、MIG-01C、Reader、平台切片或机构端旧任务；
- 自动进入 Ready、合并或启动下游任务。

## 七、停止条件

未来前置规划出现以下任一情况必须停止：

- current 事实、accepted target、Migration 或 handoff 证据发生无法解释的冲突；
- 无法枚举完整 Membership／Binding／Anchor／Guard 影响面；
- 需要读取凭证、数据库、真实 Session 或外部环境才能继续；
- 需要修改未来任务授权范围外文件；
- 需要在审计阶段直接决定数据修复、执行 DML、`VALIDATE` 或 Reader 放行；
- 发现另一个 Agent 正在写入同一工作树或 Git 索引。

Owner 候选可以枚举但无法唯一冻结时，应作为阻断或待确认结论交付，并继续其他静态审计；
不得凭偏好选择 Owner。

## 八、项目级顺序

```text
A2-P2 P1 实施、执行、独立审查与 handoff（本次完成）
→ BASE-02 前置规划／准入（唯一下一任务，未启动、未授权）
→ 独立审查与 handoff
→ BASE-02 实施候选切片（仅在未来明确授权后）
→ Writer
→ Audit／模板
→ MIG-01B
→ MIG-01C
→ Reader
→ MIG-02
→ MIG-03
→ MIG-04
→ MIG-05
→ MIG-06
```

该顺序不改变 MIG-01～MIG-06 的相对顺序。未来任务不得自动启动 BASE-02、historical orphan
修复、外键 `VALIDATE`、Writer 或 Reader。
