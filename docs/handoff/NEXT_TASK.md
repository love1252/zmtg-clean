# 智美天工唯一下一任务

## 当前交接状态

BASE-02 前置规划、准入审计、风险收口与独立审查已完成并进入 `main`：

- 方案 PR #854：Head `c0265653d84fdde53d8d1bed8ce14a25620c1172`，Merge Commit
  `b87fad849770b83276d0572f73c7c507825c3bca`，Run `30685590234`／Job
  `91330576040` 成功；
- 独立审查 PR #855：重放后 Head `33030add36f7e6d3b87784368054e24e157537bd`，Merge Commit
  `8e3b9de6d472be9fc586b14a2eba24e51e928dfb`，Run `30687136765`／Job
  `91335093086` 成功；
- 独立审查结论：`base02_readiness_review=passed`、
  `eligible_for_base02_implementation_handoff=true`、
  `eligible_for_base02_implementation=false`。

PR #854、#855 已依次使用 Merge Commit 合并。本 handoff 由 PR #856 收口；方案、审查或 handoff
进入 `main` 均不构成 BASE-02 Runtime、数据修复或数据库执行授权。

## 唯一下一任务

```text
BASE-02 实施
```

仓库当前没有该任务的正式 `V2-*` 编号，本 handoff 不自行创造编号。

当前状态：**尚未启动、尚未授权**。

只有本 handoff 获得独立 Ready／Merge 授权并进入 `main`，且用户再对 BASE-02 当次任务、文件、
Runtime、数据、环境和风险明确授权后，才能启动。第一候选切片是 `BASE-B1 Owner、Port 与
revision 契约`，不是自动开始的开发任务。

## 一、冻结 current 证据

- 仓库与固定 localhost-only 本地验收环境 journal 均为 `40` 项，最新为
  `0039_mig_01a2_anchor_bridge`；snapshot 仍为 `0026_snapshot.json`；
- A2-P1 Scope／Context Version／Context Head 为 `1／1／1`；
- A2-P2 索引 `auth_account_institution_bindings_scope_idx` 和外键
  `auth_account_institution_bindings_scope_fk` 定义精确存在；外键保持
  `convalidated=false`；
- Binding 总数／NULL／重复／active historical orphan／Scope 关系 orphan 为
  `1／0／0／1／1`；
- tenant 父关系缺失与 Membership 父关系缺失均为 `0`；孤儿 Binding 先于 A2-P1 Scope，
  当前为 active、未过期的历史记录；
- 当前仓库没有 Binding 生命周期 writer；现有正式授权链具备 Provenance、Fresh
  Membership／Binding、Anchor 与 fail-closed Guard 基础，但只直接接入有限入口；机构 API
  尚未直接接入正式授权根；
- Operating Context Head／Version 仍是 proposed 设计，不得作为已接受 current 门禁；
- 本次只读探针采用显式 `REPEATABLE READ READ ONLY` 与固定 SELECT-only 白名单；数据库写入、
  DDL、DML、Migration、Seed、Lease、Runner 和外键 `VALIDATE` 均为 `0`。

环境计数是本次审计窗口的低敏证据，不是永久状态。未来获授权任务仍须在写入前重新冻结。

## 二、orphan 责任边界

- 语义 Owner：Access Control 的 Binding 生命周期；
- 独立数据修复专项：只可作为经授权的执行载体，不成为第二事实源；
- Tenancy：不得从 Binding 反推或自动创建 Scope；
- A2-P2 与 MIG-01B：不得静默处理该行；
- 具体修复动作、权威目标 Scope、影响行数、只读预检、冲突处理、回退与 forward-fix 尚未
  冻结，因此继续阻断实施；
- 仅将 Binding 变为 revoked 只能降低 active 授权风险，不能清除 Scope 关系 orphan，不能
  独立支持 BASE-02 完成、外键 `VALIDATE` 或 Reader 放行。

BASE-02 不是简单清理 orphan。它必须同时关闭双键上下文、Membership／Binding 生命周期、
Session 刷新、Guard、独立数据修复与完成证明。

## 三、实施阶段冻结

### BASE-B1：Owner、Port 与 revision 契约

- 冻结 Access Control／Identity／Tenancy／Security 的唯一边界；
- 决定 Membership、Binding、Scope、Anchor、Authorization Provenance 与对象事实各自 Port；
- 决定 Scope Revision、Fresh Membership 和 Operating Context Head／Version 的版本比较；
- 任何 Owner、循环依赖或第二事实源冲突均停止。

### BASE-B2：Membership／Binding 生命周期

- 实现创建、选择、刷新、撤销、过期与重新绑定边界；
- 明确多 Membership 下的显式选择或 fail-closed，不得沿用无稳定排序的隐式第一条；
- 若需要 Schema／Migration，必须拆成独立授权任务；不得夹带 orphan 数据修复；
- Access Control 不得把 Tenancy Scope 复制成第二事实源。

### BASE-B3：Session／双键上下文刷新

- 由正式 Identity Session 消费 Access Control 授权证据；
- 冻结 `tenantId + institutionId`、revision、刷新、撤销与陈旧上下文拒绝；
- 不得依赖 Demo、Mock、角色常量或客户端参数证明授权。

### BASE-B4：入口与业务 Guard

- 页面、Route、Application Service 和对象级 Guard 逐层 fail-closed；
- 旧入口必须逐入口委托到单一正式授权根或保持关闭；
- 对象事实只能通过其业务 Owner Port 核验；不得由 Guard 复制业务事实；
- 本阶段不启动 Writer、Audit／模板或 Reader。

### BASE-B5：独立 historical orphan 修复

- 必须是单独授权的数据修复任务，先冻结 authoritative decision、预期影响行数和恢复点；
- 禁止从 Binding 反推创建 Scope，禁止自动删除、自动重绑或静默撤销；
- 若合法路径需要 Tenancy provisioning，必须退出本切片并重新基线；
- 执行后必须同时证明 active historical orphan 与 Scope 关系 orphan 为 `0`。

### BASE-B6：完成证明

- 证明 Membership、Binding、Anchor、Session、Guard 的唯一 Owner 与依赖方向；
- 证明 direct cross-domain writer／deleter 为 `0`；
- 证明 active historical orphan 与 Scope 关系 orphan 均为 `0`；
- 保持 A2-P2 外键 `NOT VALID`；BASE-B6 不执行 `VALIDATE`；
- Reader 继续关闭，等待 Writer、Audit／模板、MIG-01B、MIG-01C 与独立放行。

## 四、未来文件与测试边界

未来实施必须按 BASE-B1～B6 拆分小 PR，并在每个任务中单独冻结精确文件 allowlist。候选文件
类型包括：

- `src/modules/access-control/**` 的 Domain、Application Service、Port、Repository／Adapter、
  Guard 与测试；
- 必要的 `src/modules/identity/**` Session 消费边界；
- 必要的现有页面／Route／Workbench 入口接线与测试；
- 若确需 Schema／Migration 或数据修复资产，必须另立独立任务并取得明确授权。

每个切片至少验证正常、跨租户、跨机构、缺 Membership、缺 Binding、撤销、过期、冲突
Provenance、缺 Anchor、陈旧上下文、多 Membership 与对象越权矩阵，并通过架构自测、增量检查、
lint、typecheck、完整测试、build 和真实 Required Check。

## 五、实施启动硬门

启动 BASE-B1 前必须重新确认：

1. PR #854～#856 已合并，`main` 与 `origin/main` 一致且工作树干净；
2. 用户已明确授权当前切片及其文件、Runtime、数据、环境和风险；
3. Owner、Port、revision 与 Operating Context 决策范围没有漂移；
4. A2-P1／A2-P2 current、journal、snapshot、索引、`NOT VALID` 外键和两个 orphan 计数已重新冻结；
5. 没有并发 Agent、数据库 Writer 或未完成 Git／Migration 操作；
6. 任何 Schema、Migration、数据修复、Lease、数据库连接或外部环境操作均有独立授权。

## 六、停止、回退与 forward-fix

- Owner 无法唯一冻结、出现循环依赖或第二事实源时，停止 Runtime 实施；
- 需要超出当次 allowlist 的 Schema、Migration、数据修复、Writer、Audit、Reader 时停止；
- current、accepted target、Catalog、journal、Shape 或 orphan 数量出现无法解释漂移时停止；
- 未提交 Runtime 改动通过 Git 分支回退；已合并 Runtime 通过独立 revert／forward-fix PR；
- 已执行的数据修复不得用破坏性 Git 操作回退，只能按批准的恢复点或 forward-fix 方案处理；
- 不得使用自动重试掩盖授权、计数、事务或恢复点不确定性。

## 七、当前禁止范围

当前不授权：

- BASE-B1～B6 的任何 Runtime 实施；
- UPDATE、DELETE、INSERT、重绑、撤销、补 Scope 或其他 orphan 修复；
- 外键 `VALIDATE`、`SET NOT NULL`、Schema、Migration、Seed、DDL、DML；
- Writer、Audit／模板、MIG-01B、MIG-01C 或 Reader；
- 读取凭证、真实 Session、业务数据或连接非本地环境；
- 自动进入 Ready、合并或启动后续任务。

## 八、项目级顺序

```text
BASE-02 前置规划／准入与独立审查（PR #854、#855 已完成）
→ BASE-02 实施（唯一下一任务，未启动、未授权）
  → BASE-B1 Owner、Port 与 revision 契约
  → BASE-B2 Membership／Binding 生命周期
  → BASE-B3 Session／双键上下文刷新
  → BASE-B4 入口与业务 Guard
  → BASE-B5 独立 historical orphan 修复
  → BASE-B6 完成证明
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

该顺序不改变 MIG-01～MIG-06 的相对顺序。BASE-02 完成、两个 orphan 计数清零及后续既定
门禁满足前，外键 `VALIDATE` 与 Reader 均不得放行。
