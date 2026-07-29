# 下一任务

## 当前交接状态

`V2-MIG01-A2-PROVISIONING-PREFLIGHT-01` 已通过 PR #797 完成并合并：

- PR Head：`cf87ac63474436d404a8e15675db083b5654e78d`
- Merge Commit：`d9a47773cb4914b0f0534093f5c8f47f6516b9d6`
- 完成文档：`docs/architecture/v2-mig01-a2-provisioning-preflight.md`
- 成功 Actions：Run `30417750587`／Job `90467828716`
- 环境核对、安装依赖、架构检查器自测、增量架构检查、lint、typecheck、完整测试和 build 全部通过
- A1 仅具备仓库静态 Expand 证据
- A2 Provisioning 实现缺失且启动受阻
- Owner 候选可以枚举，但具体实现 Owner 尚未唯一冻结
- journal 到 `0038`
- snapshot 到 `0026`，且不覆盖 A1
- `db:generate` 与 snapshot-diff Migration 继续阻断
- PR #797 及本次 docs-only handoff 的 Runtime、Schema、Migration 修改均为 `0`

当前尚未关闭的关键问题包括 Owner、Manifest 正式契约、P1 输入承载方式、metadata 策略、P2 exact constraint allowlist、唯一 Migration lease、`main` 保护与 Required Check，以及环境证据。真实 Actions 通过只证明当前质量门禁执行成功，不表示上述决策已关闭、A2 已实施、MIG-01 已关闭或任何业务已正式发布。

## 唯一下一任务

```text
V2-MIG01-A2-DECISION-PACK-01
MIG-01A2 Owner、Manifest、输入承载、Metadata 与硬门决策包
```

该任务是唯一下一任务，但尚未启动。它只负责制作供用户决策的 docs-only 决策包，不实施任何决策或推荐方案，不修改仓库设置，也不授权或启动 A2-P1、A2-P2 及任何下游任务。

## 一、唯一允许文件

未来任务只允许创建：

```text
docs/decisions/mig01-a2-provisioning-decision-pack.md
```

不得修改或创建其他文件。若目标文件已经存在、需要第二个文件，或需要同步架构正文、既有 ADR、handoff、代码、测试、Schema、Migration、脚本、配置或 GitHub 设置，必须停止并重新申请授权。

## 二、任务定位与事实边界

未来决策包必须以执行时最新 `main` 为基线，只读取仓库内可验证的代码、测试、Schema、Migration、配置、已接受 ADR、架构文档和已合并记录。

结论必须区分：

- `current`：当前 `main` 可验证的事实；
- `target`：`docs/architecture/architecture-v2.md` 与已接受 ADR 确定的最高级目标约束；
- `proposed`：尚需用户决定或独立授权的候选方案；
- `阻断`：未关闭前不得启动 A2-P1 或 A2-P2 的事项；
- `待授权核验`：需要环境、数据库、真实 manifest、备份、恢复点或凭证边界才能确认的事项。

`docs/architecture/v2-mig01-a2-provisioning-preflight.md` 是当前专项静态证据和决策阻断入口，不是 A2 实施授权。模块映射、六类架构视图、代码证据审计、架构索引和 handoff 只负责展开、导航、核验与记录状态，不得独立改写目标约束。

文件名、类型定义、Demo、Mock、Seed、Capability、测试或 CI 通过均不能单独证明 provisioning、归属、回填、约束、仓库硬门或正式发布已经完成。推荐方案在用户明确授权前不得标记为 `accepted`、`已确认` 或 `已批准`。

## 三、决策包十二项必备内容

### 3.1 Scope、Context Version、Context Head 与 manifest 原始事实的 Owner 选项

本项必须先区分已经接受的 `target` 与仍未关闭的 Owner 决策。

以下所有权已经接受，本决策包不得重新决定：

- Identity：用户、账号和正式 Session；
- Access Control：Membership、Authorization Provenance、Fresh Membership、Anchor 授权证据、机构／对象 Guard 和 Action Policy；
- Security：密钥、低敏输出、安全开关和通用安全能力。

本决策包只允许比较：

- Institution Scope 原始事实的持久化 Owner；
- Context Version 原始事实的持久化 Owner；
- Context Head 原始事实的持久化 Owner；
- Manifest 的 Owner、审批治理和 Provisioning 生产者；
- Scope Revision／Provisioning Provenance 的写入与消费边界。

必须：

- 枚举可由仓库证据支持的上述未关闭 Owner 候选；
- 分别说明原始事实的生产者、持久化者、校验者和只读消费者；
- 对比候选方案的单一事实源、依赖方向、循环依赖和冲突风险；
- 区分持久化 Scope／Context 原始事实与 Access Control 消费后签发的短生命周期 Anchor 授权证据，不得把二者写成同一事实源；
- 明确无法唯一冻结时的阻断结果。

不得凭偏好选定 Owner，不得重新打开 Identity、Access Control 或 Security 的已接受所有权，也不得让 Access Control 或业务模块形成第二套 Scope／Context 原始事实源。

### 3.2 Tenancy 与 Access Control 边界

必须在保持已接受所有权不变的前提下比较并建议：

- 比较 Scope、Context Version、Context Head、Manifest、Scope Revision 与 Provisioning Provenance 原始事实的持久化 Owner；同时保持已接受 `target`：Membership 与 Authorization Provenance 由 Access Control 所有，正式账号和 Session 由 Identity 所有；
- A2 只处理 Scope／Context／Manifest Provisioning；
- Access Control 只消费低敏、已验证的原始事实投影，并据此签发或校验短生命周期 Anchor 授权证据；
- Membership／Binding 生命周期、Fresh Membership、Guard 和 Action Policy 留给 BASE-02；
- provisioning、原始事实 Owner、Access Control 与业务模块之间的依赖方向；
- 缺失、冲突、停用、陈旧 revision 或归属不明时的 fail-closed 规则；
- A2 与 BASE-02 的责任分界。

决策包不得推荐 Tenancy 建立第二套 Membership 或 Authorization Provenance 事实源，也不得提前实现 BASE-02。Owner 候选可枚举但无法唯一冻结时仍是阻断结论，但不终止决策包其余静态内容的编制。

### 3.3 Manifest version、审批协议与低敏字段白名单

必须覆盖：

- manifest version 与兼容政策；
- 来源、Owner、审批人、审批状态和批准时间的协议；
- 生效、撤销、替换和重放语义；
- 可进入仓库或执行资产的低敏字段白名单；
- 仓库记录、低敏投影与真实 manifest 的边界；
- 未批准、未知版本、字段越界或完整性失败时的停止规则。

不得读取或复制真实 manifest 值、凭证或 PII。

### 3.4 Canonicalization 与 digest 算法候选

必须比较：

- 字段选择、稳定排序、空值、大小写、Unicode、日期时间和数字的规范化规则；
- 序列化格式与编码；
- digest 算法、算法版本和输出表示；
- 重复执行、跨运行器一致性、版本升级和冲突处理；
- digest 的生成者、验证者、持久化位置和审计证据。

决策包只能给出候选与推荐，不得在未获用户决定时把任一算法写成已接受事实。

### 3.5 Context source、timezone、currency 与 effective date 政策

必须逐项比较并记录：

- `tenantId`、`institutionId`、`status`、`revision`、timezone、currency 和 effective date 的来源；
- 格式、唯一性、默认值政策、可变性和时间语义；
- Context source 与 manifest、Tenancy、Access Control 的关系；
- 缺失、冲突、过期或归属不明时的阻断和审计要求。

不得在没有证据时发明当前字段、默认值、约束或索引。

### 3.6 A2-P1 输入承载方式比较

必须至少比较：

1. 获批低敏投影进入手写 data Migration；
2. 受控 runner 接收仓库外 manifest。

每个方案必须说明敏感信息边界、可重复性、审批链、审计性、幂等、回滚或前向修复、环境依赖、失败模式、测试方式和长期维护成本。不得因比较方案而创建投影、runner、Migration 或真实 manifest。

### 3.7 A2-P1 执行资产类型

必须比较 A2-P1 使用以下哪类受控资产：

- 手写 Migration；
- 独立脚本或 runner；
- 其他可审计、可授权、可重复的受控执行资产。

必须说明每个选项的精确职责、允许文件类型、生命周期、环境授权、质量门禁、失败处理和与 A2-P2 的边界。决策包不得直接创建执行资产。

### 3.8 Journal `0038`／Snapshot `0026` 的 metadata 处理方案

必须记录：

- journal 当前到 `0038`；
- snapshot 当前到 `0026`，且不覆盖 A1；
- 漂移对手写 Migration、`db:generate`、snapshot diff 和验证方式的影响；
- metadata 修复、保持现状或其他候选方案的风险；
- 哪些证据可由仓库确认，哪些环境 journal 只能标记为 `待授权核验`；
- 未决定时对 A2-P1、A2-P2 的阻断结果。

不得运行 `db:generate`，不得创建 snapshot-diff Migration。

### 3.9 下一编号与唯一 Migration lease 机制

必须比较并记录：

- 下一 Migration 编号的确定方式；
- 是否允许手写下一 Migration；
- 唯一 Migration lease 的授予者、持有者、作用域、起止、续期、失效和交接；
- 并发 Schema／Migration 任务的互斥与冲突处理；
- lease 缺失、编号冲突或基线漂移时的停止条件。

决策包不得取得实施 lease，也不得把 `0039` 或其他编号写成已批准编号。

### 3.10 `main` 保护与 Required Check 建议配置

必须基于执行时只读核对结果，提出并比较：

- 是否在 A2 实施前启用 `main` 分支保护；
- 是否将“最小架构与质量门禁”设为 Required Check；
- 建议的触发范围、管理员适用范围、合并策略和失败行为；
- 配置权限、验证方式、回退条件及缺失时是否阻断 A2-P1／A2-P2。

建议配置不是启用事实。未来任务不得修改 GitHub 仓库设置。

### 3.11 A2-P1 候选文件类型与启动硬门

必须冻结候选边界：

- 允许的精确文件类型；
- Owner、Manifest、输入承载、metadata、编号、Migration lease 和仓库硬门中哪些必须先获用户决定；
- 环境 journal、备份／恢复点、真实 manifest 和目标数据库所需的独立授权；
- 定向测试、幂等矩阵、计数守恒、质量门禁、停止条件和前向修复要求；
- 完成定义与独立 handoff。

决策包不得据此自动启动 A2-P1。

### 3.12 A2-P2 Exact Constraint Allowlist 的决策边界

必须逐项决定候选 allowlist 的边界，而不是直接创建约束：

- 复合键；
- 唯一索引或普通索引；
- `NOT VALID` 外键或其他关系；
- tenant／institution attribution 与 shape 一致性；
- 验证、升级、冲突清零和 Reader 重新核验条件；
- 哪些约束明确不属于 A2-P2。

A2-P2 必须等待 A2-P1、独立 handoff、所需决策和环境授权完成后才能另行申请启动。

## 四、每项决策的统一记录模板

上述十二项中的每项决策必须记录：

1. 当前事实；
2. `target` 约束；
3. 可选方案；
4. 推荐方案；
5. 风险与代价；
6. 对 A2-P1／A2-P2 的影响；
7. 需要用户决定的内容；
8. 未决定时的阻断结果。

推荐方案不等于已接受方案。只有用户对具体选项作出明确决定，后续独立 handoff 才能记录相应决策状态；未来决策包本身不得替用户批准任何选择。

## 五、项目级候选顺序

当前项目级候选顺序为：

```text
V2-MIG01-A2-DECISION-PACK-01
→ 用户决策／独立 handoff
→ 仓库硬门配置任务（仅在决策批准时）
→ A2-P1 manifest 驱动 provisioning
→ 独立 handoff
→ A2-P2
→ BASE-02
→ Writer
→ Audit／模板
→ MIG-01B
→ MIG-01C
→ Reader
```

插入决策包不改变 MIG-01～MIG-06 的相对顺序。决策包完成不自动授权 A2-P1；仓库硬门是否启用以及准确配置只能由后续明确决策决定。每个实施或配置任务都必须重新冻结基线、文件范围、环境范围、风险、停止条件和授权。

## 六、未来决策包的停止条件

遇到以下任一情况必须停止：

- 最新 `main` 与交接事实不一致；
- A1／A2、Schema、Migration、journal、snapshot、测试、ADR 或架构证据矛盾且无法解释；
- 无法枚举 Owner、Manifest、输入承载、metadata、lease 或硬门的候选方案，或无法定位其仓库证据；
- 只有读取真实 manifest、环境变量、凭证、数据库或外部环境才能继续；
- 需要创建唯一允许文件以外的内容；
- 需要修改 `architecture-v2.md`、既有 ADR、handoff、代码、测试、Schema、Migration、脚本、配置或 GitHub 设置；
- 需要把尚未获得用户决定的方案标记为 `accepted`、`已确认` 或 `已批准`；
- 出现并发写入、基线漂移或 Migration lease 冲突；
- 需要启动 A2-P1、A2-P2、BASE-02、Writer、Reader、平台切片或机构端旧任务。

Owner 候选可以枚举但无法唯一冻结时，应在决策包中记录选项、推荐和阻断结果，并继续完成其他静态决策材料；不得凭偏好选定 Owner。只有无法枚举候选、无法定位证据或需要越过上述边界时，才停止整个任务。

## 七、严格禁止

未来决策包不得：

- 修改 `docs/architecture/architecture-v2.md` 或既有 ADR；
- 修改 GitHub 分支保护、Required Check 或其他仓库设置；
- 创建任何 manifest、低敏投影或 fixture；
- 创建或修改 Migration、Schema、Runtime、脚本或测试；
- 创建 `0039` 或其他 Migration，或取得 Migration lease；
- 运行 `db:generate`、Migration、Seed、部署或数据库命令；
- 连接数据库、测试服务器、生产环境或业务外部系统；
- 读取 `.env.local`、`DATABASE_URL`、真实 manifest、Token、Secret、私钥、凭证或 PII；
- 修改 `.github/**`、`package.json` 或 `pnpm-lock.yaml`；
- 自动进入正式审查（Ready）或自动合并；
- 启动 A2-P1、A2-P2 或任何下游任务。

## 八、未来决策包的验证与交付

未来任务至少必须确认：

1. 只新增 `docs/decisions/mig01-a2-provisioning-decision-pack.md`；
2. `git diff --check` 通过；
3. 十二项决策和统一记录模板完整；
4. current、target、proposed、阻断与待授权核验边界清楚；
5. 没有把推荐方案写成已接受决定；
6. Runtime、Schema、Migration、脚本、测试、CI、package 和 lock 修改均为 `0`；
7. 未运行 `db:generate`、Migration、Seed、部署或数据库命令；
8. 未读取凭证、真实 manifest 或连接环境；
9. 工作树提交后干净，最终只有一个同主题提交；
10. 只创建草稿 PR，并等待真实“最小架构与质量门禁”全部实际执行并通过；
11. 不自动进入 Ready、不自动合并、不启动任何配置或实施任务。

未来 `V2-MIG01-A2-DECISION-PACK-01` 的完成定义仅是：十二项关键决策的当前事实、目标约束、选项、推荐、风险、P1／P2 影响、用户决策点和未决定时阻断已经形成可审查材料。它不表示任何方案已被接受，也不表示仓库硬门、A2-P1、A2-P2、BASE-02、Writer、Audit／模板、MIG-01B、MIG-01C 或 Reader 已配置、实施或获授权。
