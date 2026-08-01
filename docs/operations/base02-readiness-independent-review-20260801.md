# BASE-02 准入方案独立审查

> 状态：`independent review evidence`
>
> 审查日期：2026-08-01（Asia/Shanghai）
>
> 审查对象：PR #854
>
> 冻结方案 Head：`c0265653d84fdde53d8d1bed8ce14a25620c1172`
>
> 方案 Merge Commit：`b87fad849770b83276d0572f73c7c507825c3bca`
>
> 方案基线：`443033b7f06ba9d5a08b37ddeddf112162cea4b8`
>
> 方案文件：[`base02-readiness-plan-20260801.md`](./base02-readiness-plan-20260801.md)

## 1. 审查定位

本审查独立核对 BASE-02 准入方案的事实归因、Owner、historical orphan、A2-P2、Migration、
Membership／Binding、Guard、Writer／Audit／MIG-01B／C 与 Reader 边界。

审查执行者只读取冻结方案 Head、当前仓库与既有低敏证据，没有修改方案文件、数据库、Runtime、
Schema、Migration、测试、脚本、CI、package 或 lock。本文件只证明方案可进入 handoff，不授权
BASE-02 实施、数据修复、外键验证或 Reader 放行。

## 2. 冻结对象与质量证据

| 项目 | 结果 |
|---|---|
| PR #854 状态 | 已合并（Merged） |
| Head | `c0265653d84fdde53d8d1bed8ce14a25620c1172` |
| Base | `443033b7f06ba9d5a08b37ddeddf112162cea4b8` |
| Merge Commit | `b87fad849770b83276d0572f73c7c507825c3bca` |
| 提交／文件 | `1／1` |
| 唯一文件 | `docs/operations/base02-readiness-plan-20260801.md` |
| Required Check | Run `30685590234`／Job `91330576040`，`success` |
| 质量步骤 | 环境、依赖、架构自测、增量检查、lint、typecheck、完整测试、build 全部实际成功 |
| build | 未跳过 |
| `continue-on-error` | 未使用 |
| Runtime／Schema／Migration 等范围外修改 | `0` |

本独立审查首次冻结时 PR #854 为草稿；经本任务用户明确授权，PR #854 已使用 Merge Commit
合并。Required Check 与方案合并仍不等于 BASE-02 实施、数据修复、外键验证、Reader 放行或发布授权。

## 3. 独立审查方法

审查分为三条只读线：

1. **架构边界线**：核对 accepted decisions、最新 handoff、A2-P2 收口、BASE-02 与 Writer／
   Audit／MIG-01B／C／Reader 的串行边界；
2. **Binding 生命周期线**：核对 `0037 → 0038 → 0039`、Schema、Auth Repository／Domain、
   Membership／Binding current 行为、orphan 两类计数和候选处置；
3. **探针归因线**：核对独立临时只读探针与现有 ReadOnly Adapter 的职责分离、事务只读性、
   时点限定和低敏输出。

审查不重新连接数据库、不重新执行探针，也不把环境时点证据写成永久事实。

## 4. 发现项与关闭结果

### F01：撤销 active Binding 不等于关系 orphan 清零

- **初始风险**：只把 status 改为 `revoked` 会令 active historical orphan 归零，但
  `binding_scope_orphan_count` 仍为 `1`，未来 FK `VALIDATE` 仍失败；
- **方案修正**：已分别冻结 active historical orphan 与全部 Scope 关系 orphan；明确
  revoked-only 只能消除授权风险，不能满足 BASE-B5／B6；
- **结果**：`closed`。

### F02：Operating Context 被误升为已接受硬门

- **初始风险**：Context Head／Version 是否参与授权组合仍为 `proposed／待确认`；
- **方案修正**：已接受硬门只包含正式 Session、Fresh Membership、Binding、active Scope 与
  Scope revision；Operating Context 交由 BASE-B1 决定；
- **结果**：`closed`。

### F03：当前 Guard 能力被夸大

- **初始风险**：当前 Scope Guard 明确不授予 page、object、action 或 capability，Request
  Authorization 只公开 section／navigation；
- **方案修正**：current 已收窄为 provenance、Membership、Anchor、Scope 与 section／navigation
  地基；对象 Guard、Action Policy 和机构 API 普遍接线列为 target 缺口；
- **结果**：`closed`。

### F04：静态影响面不完整

- **初始风险**：只列核心 Repository／Provider 会漏掉请求 provenance、evidence/reference、
  runtime config、Pages、Workbench、旧 `canAccessResource` 和生命周期候选入口；
- **方案修正**：已冻结 `24` 个正式链／直接消费者生产路径、`26` 个核心直接测试、Binding
  符号 `7` 个生产／`11` 个测试路径、旧 helper `15` 个机构／Workspace 生产消费者、`5` 个
  Membership 维护候选，以及正式根当前 `4` 个公开消费者和 `0` 个机构 API 直接接入；
- **结果**：`closed`。

### F05：Membership 生命周期与多 Membership 缺口

- **初始风险**：`tenant_members` 没有 status／version，Fresh Membership 依赖 `updatedAt`；
  `findPrimaryTenantMembershipByUserId` 无排序 `.limit(1)`，多 Membership 选择不确定；
- **方案修正**：BASE-B1 必须冻结 Membership 撤销／刷新／稳定 revision；需要 Schema 时拆出独立
  Migration；多 Membership 必须显式选择或 fail-closed；
- **结果**：`closed`。

### F06：Binding 基数、状态与 rebind 语义未冻结

- **初始风险**：当前数据库最多一个 active Binding，领域授权又要求候选精确为一个；持久化
  状态只有 `active／revoked`，过期是派生状态；
- **方案修正**：BASE-B2 已冻结 current 基数和状态，并要求在 revoke-old + create-new 与同一行
  CAS/version 之间明确选择；如要允许多个 active Binding，必须另立 ADR 与 Schema／Migration；
- **结果**：`closed`。

### F07：Membership Writer／Deleter 可能绕过唯一 Owner

- **初始风险**：若 B2 只实现 Binding 命令、B4 只审计入口，BASE-B6 可能在 Membership 生命周期
  未落位时被误报完成；
- **方案修正**：B2 必须实现或显式拥有 Access Control Membership 命令；B4 要求现有入口逐一
  委托或禁用；B6 要求直接跨域 Writer／Deleter=`0`；
- **结果**：`closed`。

### F08：Tenancy Provisioning 与固定计数冲突

- **初始风险**：合法的经批准 Scope Provisioning 会改变 A2-P1 计数，不能同时要求旧
  `1／1／1` 永远不变；
- **方案修正**：BASE-02 不创建 Scope；如确需 Provisioning，先退出并完成独立 Tenancy 任务，
  再重新冻结 A2-P1 计数和 Scope revision后返回只读复核；
- **结果**：`closed`。

## 5. Owner 与 orphan 审查结论

### 5.1 Owner

- historical orphan 的语义 Owner：**Access Control／Binding 生命周期**；
- Tenancy：只拥有 Scope／Context 原始事实，不得从 Binding 反向猜测或自动补建 Scope；
- Identity：继续拥有用户、账号和正式 Session；当前 Auth 物理路径不改变 target Owner；
- 独立数据修复专项：只能执行已批准动作，不成为事实 Owner；
- A2-P2、MIG-01B、MIG-01C：不得静默接管该 orphan。

该 Owner 结论与最新 accepted decisions 和 handoff 一致。较早把 orphan 笼统指向 MIG-01B 的记录
已被后续权威收口纠正，方案保留了漂移说明，没有静默改写历史。

### 5.2 计数与处置边界

- 当前 active historical orphan=`1`；
- 当前全部 Scope 关系 orphan=`1`；
- revoked-only 不满足关系清零；
- 重绑、经批准 Tenancy Provisioning、受控删除／归档或继续阻断都需要独立证据与授权；
- 当前仓库与低敏证据不能唯一决定具体动作，因此
  `orphan_remediation_action=blocked_pending_authoritative_decision` 正确。

本审查没有选择处置分支，也没有授权 DML。

## 6. BASE-02 范围审查

### 6.1 进入范围

- Identity 正式 Session 的授权消费边界；
- Access Control 的 Membership／Binding 生命周期、Fresh Membership 与 Authorization Provenance；
- Tenancy active Scope／Scope revision 的版本化读取；
- request-bound evidence、Scope／Section／Navigation Guard；
- 对象 Guard 与 Action Policy 的 Owner 契约，但对象事实仍由业务 Owner 经 Port 提供；
- 生命周期入口委托／禁用与 historical orphan 独立处置门禁。

### 6.2 不进入范围

- A2-P2 FK `VALIDATE`、NOT NULL、新 Schema／Migration；
- 全业务 Writer 双写；
- Audit attribution／模板；
- MIG-01B／MIG-01C；
- Reader／Capability／Route 正式放行；
- MIG-02～MIG-06。

方案采用最新 handoff 的窄义 BASE-02，保持 `BASE-02 → Writer → Audit／模板 → MIG-01B →
MIG-01C → Reader`，没有改变既定 Migration 顺序。

## 7. 实施切片可执行性审查

| 切片 | 审查结论 | 仍需未来授权冻结 |
|---|---|---|
| BASE-B1 Owner／Port／revision | 方案边界可执行 | Operating Context 是否组合、Membership revision 载体、物理模块与精确文件 |
| BASE-B2 Membership／Binding 生命周期 | 方案边界可执行 | rebind 模式、Membership 命令、是否触发独立 Schema／Migration |
| BASE-B3 Session／上下文刷新 | 方案边界可执行 | 多 Membership 选择、TTL/revision、具体 Route／组合根文件 |
| BASE-B4 Guard／绕过闭环 | 方案边界可执行 | 对象事实 Port、Action Policy、逐入口子切片 |
| BASE-B5 orphan 独立处置 | 继续阻断具体执行 | 权威处置依据、DML、目标环境、恢复点和 affected rows |
| BASE-B6 完成审计 | 只有前五项通过后可申请 | 两类 orphan=0、唯一 Owner、跨域 Writer／Deleter=0、Reader 保持关闭 |

“方案边界可执行”只表示可据此提出下一任务，不是文件、Runtime、数据库或合并授权。

## 8. 安全与数据边界审查

- 本轮探针使用独立临时只读探针，不冒充 `ProvisioningReadonlyPostgresAdapter` 能力；
- 环境 journal、A2-P1、A2-P2 Catalog 和 orphan 计数都限定为探针时点；
- 没有连接参数、原始行、双键、角色引用、digest、凭证或 PII 进入文档；
- DDL、DML、Migration、Seed、Runner、Lease、FK `VALIDATE` 与数据库写入均为 `0`；
- 方案不授权从 Binding 创建 Scope，也不把短生命周期 Anchor evidence 持久化成第二事实源；
- Runtime、Schema、Migration、journal、snapshot、scripts、tests、CI、package、lock 修改均为 `0`。

## 9. 剩余阻断与用户决策

以下是未来实施阻断，不是本方案审查缺陷：

1. BASE-B1 的精确文件、物理模块、Operating Context 选择和 Membership revision 载体未获授权；
2. Binding rebind 模式未选择；
3. historical orphan 的业务处置动作与数据库 DML 未决定、未授权；
4. BASE-B1～B6 的 Runtime／数据／环境风险尚未逐切片授权；
5. Ready／Merge、FK `VALIDATE`、Writer、Audit／模板、MIG-01B／C 和 Reader 均未授权。

## 10. 审查结论

方案准确区分 current／target／proposed，完整记录了数据问题、Owner、实施阶段、文件类型、数据与
Migration 边界、Writer／Audit 边界、Reader 门禁、回滚／forward-fix 和停止条件。所有独立审查
发现项均已在冻结 Head 中关闭。

```text
base02_readiness_review=passed
eligible_for_base02_implementation_handoff=true
eligible_for_base02_implementation=false
orphan_remediation_authorized=false
eligible_for_fk_validation=false
eligible_for_reader=false
```

结论仅允许创建 docs-only handoff，将“BASE-02 实施”冻结为尚未授权的唯一下一任务。不得据此
启动 Runtime、数据修复、FK 验证、Writer、Audit、MIG-01B／C 或 Reader。
