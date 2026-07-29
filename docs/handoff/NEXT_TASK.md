# 下一任务

## 当前交接状态

`V2-MIG01-A2-DECISION-PACK-01` 已通过 PR #799 完成并合并：

- PR Head：`79016701b0e20b86a575c7206dacb5ed4d6f95a0`
- Merge Commit：`1438894dd07a68cf767b49207795388b0bc814a6`
- proposed 决策包：`docs/decisions/mig01-a2-provisioning-decision-pack.md`
- 冻结 Head 的 Actions Run `30458524990`／Job `90598262749` 已完成环境核对、依赖安装、架构自测、增量检查、lint、typecheck、完整测试和 build，结论为 `success`
- Runtime、Schema、Migration 修改均为 `0`

用户于 2026-07-29 明确接受：

```text
D01-A
D02-A
D03-A
D04-A
D05-A
D06-B
D07-B
D08-C
D09-A
D10-B
D11-B
D12-A（只接受方向）
```

接受结果记录在 `docs/decisions/mig01-a2-provisioning-accepted-decisions.md`。该文件只记录治理选择，不表示仓库硬门、Runner、Lease、真实 Manifest、数据库、A2-P1 或 A2-P2 已经配置、实现、核验或执行。

## 唯一下一任务

```text
V2-MIG01-A2-GOVERNANCE-FOUNDATION-01
MIG-01A2 仓库硬门与受控 Runner 治理基础
```

这是一个 Ultra 大目标，内部包含两个必须串行的原子阶段：

1. 阶段 A：仓库硬门配置与验证；
2. 阶段 B：受控 Runner 治理、Runbook 与实现。

本 handoff 只冻结下一大目标，不启动阶段 A 或阶段 B。两阶段属于不同变更域，必须分别获得明确授权、分别冻结基线和范围、分别保留验证与回退证据，禁止混成一个 PR。

## 一、事实源与 accepted 边界

下一大目标必须以各阶段启动时最新 `main` 和 GitHub 只读状态为 `current` 事实：

- 当前 `main` 的代码、测试、Schema、Migration、配置和已合并记录决定仓库事实；
- `docs/architecture/architecture-v2.md` 与已接受 ADR 决定最高级 `target`；
- `docs/decisions/mig01-a2-provisioning-accepted-decisions.md` 在既有 `target` 内记录 D01～D12 的用户选择；
- proposed decision pack、架构视图、模块映射、索引和 handoff 负责解释、展开、核验与记录状态，不得独立改写最高级约束。

以下接受结果不得在阶段 A／B 中静默重开：

- Tenancy 是 Scope／Context／Manifest／Scope Revision／Provisioning Provenance 原始事实唯一语义 Owner；
- Access Control 通过版本化 Port／Reader 和低敏投影单向消费；
- 严格版本化低敏 Manifest、固定位置数组 canonicalization + SHA-256、Context 全字段显式；
- 仓库外真实 Manifest + 唯一一次性受控 Runner + Runner 文件集；
- 分阶段 Metadata 治理与任务级排他 Lease；
- `main` 保护和 Required Check 是 P1／P2 启动硬门；
- D12 只接受最小 Anchor Bridge 方向，精确实施细节后置。

如需要改变上述 accepted 选择、`architecture-v2.md` 或既有 ADR，必须停止当前大目标并创建独立决策／ADR 任务。

## 二、阶段 A：仓库硬门配置与验证

### 2.1 阶段定位

阶段 A 是 GitHub 外部状态修改，不是仓库业务代码 PR。它必须在阶段 B 正式交付前完成并形成可复核证据。

阶段 A 不修改业务代码、Schema、Migration、Runner、package、lock、数据库或环境。

### 2.2 必须配置的硬门

未来阶段 A 经独立授权后，必须配置并验证：

- `main` 只能通过 PR 更新；
- “最小架构与质量门禁”作为 Required Check；
- Required Check 必须对应冻结 Head 的真实成功结果；
- 分支必须基于最新 `main`；
- 禁止直接 push；
- 禁止 force push；
- 禁止删除受保护分支；
- 管理员不得绕过，不允许 `--admin`；
- A2 数据／Migration PR 使用 Merge Commit；
- 不启用线性历史；
- 当前不强制外部 Reviewer，避免单维护者仓库无法收口。

不得把“Workflow 已存在”误写成“服务端硬门已经启用”。Required Check 的精确 Context、app/source、触发事件和 GitHub 返回状态必须在执行时只读核对后再配置。

### 2.3 验证证据

阶段 A 至少必须证明：

- branch protection／ruleset 的实际 API 状态与 accepted 目标一致；
- Required Check 的 Context 精确匹配当前 Workflow Job；
- 无害验证 PR 在检查 pending／failure 时不能合并；
- 同一验证 PR 在冻结 Head 的检查 success 且分支基于最新 `main` 后可按 Merge Commit 流程收口；
- 管理员路径不存在 bypass；
- direct push、force push 和分支删除被服务端拒绝；
- 不需要外部 Reviewer 也能完成正常单维护者流程；
- 回退方法、回退权限、停止条件和回退后的只读复核均已记录。

无害验证 PR 不得修改业务代码、Schema、Migration、配置、package、lock 或真实环境资产。

### 2.4 停止与回退

出现以下任一情况，阶段 A 必须停止：

- Required Check 名称、source 或触发事件无法唯一确认；
- 配置会造成无可恢复的单维护者锁死；
- 管理员仍可绕过；
- 需要修改 Workflow、业务代码或数据库才能证明硬门；
- 最新 `main`、仓库设置或验证 PR Head 发生漂移；
- 无法证明回退权限和回退后状态。

阶段 A 的回退只能恢复本阶段明确变更的 GitHub 设置，不得删除 Workflow、重写 Git 历史或使用管理员绕过完成业务合并。

## 三、阶段 B：受控 Runner 治理、Runbook 与实现

### 3.1 启动前提

阶段 B 只有在阶段 A 已完成、硬门真实生效且证据可复核后，才能通过独立授权启动正式交付。

阶段 B 是仓库代码修改，必须使用独立分支、独立精确文件 allowlist 和独立 PR。阶段 A 的外部设置变化不得混入阶段 B 的代码 PR。

### 3.2 必备治理与实现内容

阶段 B 至少必须设计、实现并验证：

- 版本化低敏 Manifest 契约；
- exact-shape Parser；
- 固定位置 JSON 数组 canonicalization；
- SHA-256 digest；
- 低敏字段白名单；
- `approved` 状态校验；
- 审批人与执行者分离的输入证据；
- Manifest 内重复 `tenantId + institutionId` 封堵；
- dry-run；
- `inserted／reused／conflict／unexpected` 分类和计数守恒；
- 单事务边界；
- 低敏、fail-closed 错误；
- 唯一一次性受控 Runner；
- 定向正／负测试和幂等矩阵；
- Runbook；
- 执行 Lease 契约；
- Operator／Reviewer 与权限授予、撤销规则；
- journal／snapshot 不变边界；
- 完整“最小架构与质量门禁”。

### 3.3 必须重新冻结的精确细节

阶段 B 启动任务必须在最新 `main` 上重新审计并冻结：

- Runner、Parser、内部类型、测试和 Runbook 的精确路径；
- 是否新增稳定 package 命令；
- Manifest version、完整低敏白名单、审批引用及撤销／替换协议；
- canonicalization preimage、位置表、日期／时间／数字格式与测试向量；
- 获批 IANA 时区和 ISO 4217 集合的校验资产；
- 当前直接读共享表的退出条件；
- 输入注入、权限、撤权、保留期和低敏日志规则；
- dry-run 与真实执行的代码边界；
- transaction、计数、冲突、回滚和 forward-fix 合同；
- 执行 Lease 的 Holder／Operator、作用域、有效期、失效和交接。

不得从 proposed decision pack 的推荐细节直接推断这些内容已经 accepted。

### 3.4 Metadata 与文件边界

阶段 B 必须保持：

- 不修改 `drizzle/**`；
- 不修改 `drizzle/meta/_journal.json`；
- 不修改 snapshot；
- 不修改 `src/server/db/schema.ts`；
- 不修改业务 API／UI；
- 不修改 CI 规则；
- 不创建 P2 Migration；
- 不占用 Migration 编号；
- 继续禁止 `db:generate` 和 snapshot-diff Migration。

Runner P1 未来执行时仍需独立执行 Lease，但阶段 B 只实现治理基础，不签发 Lease、不连接目标数据库、不执行 P1。

### 3.5 测试与回退证据

阶段 B 至少需要：

- Parser、白名单、版本、审批状态、Unicode、日期／时间／数字格式的正负测试；
- canonicalization 与 digest 固定测试向量；
- 空输入、重复双键、未知版本、未批准和字段越界测试；
- dry-run 分类与计数守恒测试；
- 全缺、全一致、部分存在和字段冲突的模拟边界测试；
- 事务失败、低敏错误和权限撤销测试；
- Runner 不读取 argv／环境变量正文、不记录真实 Manifest 的防泄漏测试；
- 架构自测、增量架构检查、lint、typecheck、完整测试和 build。

阶段 B 的回退仅允许回退尚未用于真实环境执行的 Runner 治理代码和文档。若任何资产已经接触真实 Manifest、环境或数据库，必须停止普通回退并转入独立事件／forward-fix 流程；本阶段禁止产生这种状态。

## 四、两阶段隔离门禁

| 项目 | 阶段 A | 阶段 B |
|---|---|---|
| 变更域 | GitHub 仓库外部设置 | 仓库代码、测试与 Runbook |
| 启动条件 | 独立用户授权和最新 GitHub 状态冻结 | 阶段 A 完成并验证 + 独立用户授权 |
| PR 边界 | 无害验证 PR，不修改业务代码 | Runner 治理基础代码 PR，不修改仓库设置 |
| 验证 | Branch API／ruleset、Required Check、服务端拒绝与 Merge Commit 流程 | 定向测试 + 完整架构与质量门禁 |
| 回退 | 恢复本阶段明确设置并重新只读核验 | 回退未接触真实环境的治理代码；否则停止并 forward-fix |
| 禁止 | 不修改业务代码、数据库或 Runner | 不修改 GitHub 设置，不连接真实数据库，不执行 P1 |

阶段 A 未完成并验证前，不得启动阶段 B 的正式交付。两阶段不得共享一个提交、一个混合 PR 或一份无法区分责任的验证记录。

## 五、项目级后续顺序

```text
V2-MIG01-A2-GOVERNANCE-FOUNDATION-01
→ 阶段 A：仓库硬门配置与验证
→ 阶段 B：受控 Runner 治理、Runbook 与实现
→ 独立 handoff
→ 真实 Manifest／环境／数据库 Shape 只读预检
→ A2-P1 受控执行
→ 独立 handoff
→ A2-P2
→ BASE-02
→ Writer
→ Audit／模板
→ MIG-01B
→ MIG-01C
→ Reader
```

该顺序不改变 MIG-01～MIG-06 的相对顺序。治理基础完成不自动授权真实 Manifest／环境／数据库 Shape 预检，预检完成也不自动授权 P1。

## 六、下一大目标的硬停止条件

出现以下任一情况必须停止相应阶段或整个大目标：

- 最新 `main`、GitHub 设置、Required Check Context 或 accepted 决策发生漂移；
- 阶段 A／B 需要混入同一 PR 或同一不可分验证记录；
- 阶段 A 需要修改仓库业务文件；
- 阶段 B 需要修改 GitHub 设置、Schema、Migration、journal、snapshot、业务 API／UI 或 CI；
- 需要读取真实 Manifest、`.env.local`、`DATABASE_URL`、凭证、PII 或环境变量值；
- 需要连接数据库、测试服务器、生产环境或业务外部系统；
- 需要签发 Lease、分配 Migration 编号、执行 P1 或创建 P2 Migration；
- 需要启动 BASE-02、Writer、Audit／模板、MIG-01B、MIG-01C、Reader、平台切片或机构端旧任务；
- 出现并发写入、未知外部状态或无法安全回退。

## 七、当前严格禁止

本 handoff 不授权：

- 启动阶段 A 或修改 GitHub 仓库设置；
- 启动阶段 B 或创建 Runner、Parser、测试、Runbook、命令或低敏投影；
- 读取真实 Manifest、凭证或环境变量值；
- 连接数据库或外部环境；
- 签发执行 Lease／Migration Lease；
- 创建 `0039` 或任何 Migration；
- 运行 `db:generate`、Migration、Seed、部署或数据库命令；
- 启动 A2-P1、A2-P2 或任何下游任务；
- 自动进入正式审查或自动合并未来任务。

## 八、完成定义与独立 handoff

`V2-MIG01-A2-GOVERNANCE-FOUNDATION-01` 只有同时满足以下条件才能收口：

1. 阶段 A 以独立授权完成仓库硬门配置、无害验证 PR、服务端拒绝验证和可恢复回退证据；
2. 阶段 B 在阶段 A 证据成立后，以独立授权和独立 PR 完成 Runner 治理、Runbook、实现与完整质量验证；
3. 两阶段未读取真实 Manifest、未连接数据库、未执行 P1、未创建 P2 Migration；
4. 独立 handoff 回填两个阶段的 Base、Head、PR、Merge Commit、Actions、设置快照、文件范围、验证、风险和回退状态；
5. handoff 重新冻结唯一下一任务，不自动启动真实 Manifest／环境／数据库 Shape 预检或 A2-P1。
