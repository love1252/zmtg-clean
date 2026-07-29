# 下一任务

## 当前交接状态

`V2-QUALITY-CI-01-MINIMUM-ARCHITECTURE-QUALITY-GATE` 已通过 PR #794 完成并合并：

- PR Head：`836465f169104e6f5943ca076d0b98b1bfde2b94`
- Merge Commit：`f9f948d00687fa4311e625cd51c9453d87ad0820`
- 前置测试基线修复：PR #793，Merge Commit `d451486804e9405659424006ca5f1bc58c43b42a`
- 前置可移植性基线修复：PR #795，Merge Commit `6bf4ed5b414984ad22eb3af1eb6e0c6c32770afa`
- 成功 Actions：Run `30386375532`／Job `90366597304`
- 架构检查器自测：67/67 通过
- 完整测试：408 个测试文件、5679 个测试全部通过
- build：101/101 静态页面生成完成
- `AQ001`～`AQ007` 七条规则已经进入 `main`
- PR #794 新增或修改五个质量基础设施文件，业务源码、API、UI、Schema、Migration 修改为 `0`
- 本次 docs-only handoff 的 Runtime、Schema、Migration 修改为 `0`

GitHub 只读核对结果为 `main.protected=false`，branch API 当前无可验证的 Required Check 强制。最小架构与质量 CI 已建立，但还不是 GitHub 服务端合并硬门。CI 和测试通过不表示 MIG-01 已关闭，也不表示七线已经正式发布。

## 唯一下一任务

```text
V2-MIG01-A2-PROVISIONING-PREFLIGHT-01
MIG-01A2 锚点 Provisioning 实施前置审计与切片冻结
```

该任务是唯一下一任务，但尚未启动。它只能进行仓库内 docs-only 静态预检，负责冻结 A2 锚点 provisioning 的事实边界、待确认决策、候选实施切片、停止条件和前向修复要求；不得直接实施 A2-P1、A2-P2 或任何后续数据切片。

## 一、唯一允许文件

未来任务只允许创建：

```text
docs/architecture/v2-mig01-a2-provisioning-preflight.md
```

不得修改其他文件。若目标文件已经存在、需要第二个文件或需要同步 handoff、ADR、代码、测试、Schema、Migration、脚本或配置，必须停止并重新申请授权。

## 二、任务定位与事实边界

未来预检必须以执行时最新 `main` 为基线，只读取仓库内可验证的代码、测试、Schema、Migration、配置、已接受 ADR、架构文档和已合并记录。

结论必须区分：

- `current`：当前 `main` 可验证的事实；
- `target`：`docs/architecture/architecture-v2.md` 与已接受 ADR 确定的目标约束；
- `proposed`：尚需独立授权或决策的候选方案；
- `待授权核验`：需要环境、数据库、真实 manifest、备份或凭证边界才能确认的事项。

文件名、类型、测试通过、Demo、Mock、Seed、Capability 或历史计划均不能单独证明 provisioning、归属、回填、约束或发布已经完成。

## 三、未来预检的十三项必审内容

### 3.1 最新 main 上的 A1／A2 静态证据

必须重新核对：

- `drizzle/0038_mig_01a1_institution_isolation_expand.sql`；
- `drizzle/meta/_journal.json`；
- `drizzle/meta/0026_snapshot.json`；
- `src/server/db/schema.ts`；
- 与 tenant、institution、member、membership、anchor、scope 和 provisioning 有关的代码与测试；
- 已合并 MIG-01 预检、数据架构、软件架构、模块映射和 ADR。

必须明确 A1 只具备静态 Expand 证据，不得把可空结构写成 A2 provisioning、双键上下文、回填或 Enforce 已完成。

### 3.2 Scope、Context Version 与 Context Head 的唯一 Owner

必须找出并比较当前候选所有者，冻结以下对象的唯一事实所有者与消费方向：

- tenant／institution scope；
- context version；
- context head；
- anchor 与 membership provenance；
- scope revision。

如果仓库内存在多源、循环依赖、无唯一 Owner 或 current／target 冲突，必须记录为阻断，不得在预检中凭偏好选定实现。

Owner 候选可以从仓库证据中枚举，但无法唯一冻结时，该结果本身属于本预检必须交付的阻断结论，不导致整个 docs-only 预检停止。预检应继续完成其余审计，但不得凭偏好选定 Owner，也不得据此授权 A2-P1 或 A2-P2。

### 3.3 Tenancy 持久化与 Access Control 消费边界

必须说明：

- Tenancy 持久化负责哪些事实；
- Access Control 只能消费哪些低敏、已验证上下文；
- provisioning、membership、Guard 和业务模块之间的依赖方向；
- 缺失、冲突、停用、陈旧 revision 或归属不明时如何 fail-closed；
- 哪些边界属于 A2，哪些必须留给 BASE-02。

不得让 Access Control 成为第二套 Tenancy 事实源，也不得提前实现 BASE-02。

### 3.4 Manifest 契约

必须冻结或明确列为待确认：

- manifest version；
- 来源与唯一所有者；
- 审批人与审批状态；
- digest／完整性校验；
- 低敏字段白名单；
- 生效、撤销和替换语义；
- 仓库记录与真实 manifest 的边界。

不得读取真实 manifest 值，也不得把示例或测试 fixture 写成生产事实。

### 3.5 锚点字段规则

至少逐项审计：

- `tenantId`；
- `institutionId`；
- `status`；
- `revision`；
- `timezone`；
- `currency`；
- effective date。

每个字段必须说明来源、格式、唯一性、默认值政策、可变性、冲突处理、审计要求和缺失时的停止条件。不得在没有证据时发明当前字段、默认值、约束或索引。

### 3.6 A2-P1 与 A2-P2 的严格拆分

未来预检必须保持：

```text
A2-P1 manifest 驱动 provisioning
→ 独立 handoff
→ A2-P2 复合键／索引／NOT VALID 关系
```

- A2-P1 只负责 manifest 契约、确定性锚点 provisioning、幂等与冲突封堵；
- A2-P2 才能候选处理复合键、索引和 `NOT VALID` 关系；
- A2-P1 不得夹带 A2-P2 约束；
- A2-P2 不得在 A2-P1、独立 handoff 和所需授权完成前启动。

### 3.7 Migration 元数据处理决策

必须记录：

- journal 当前到 `0038`；
- snapshot 当前到 `0026`；
- 该漂移对手写 Migration、`db:generate`、snapshot diff 和验证方式的影响；
- 哪些事项是仓库静态事实，哪些只能通过环境 journal 核验；
- 在形成明确决策前是否构成 A2-P1 或 A2-P2 的阻断。

不得运行 `db:generate`，不得创建 snapshot-diff Migration。

### 3.8 下一 Migration、候选编号与唯一 lease

必须作为待确认决策逐项回答：

- 是否允许手写下一 Migration；
- 候选编号如何确定；
- 谁持有唯一 Migration lease；
- lease 的起止、冲突、失效和交接条件；
- 与并发 Schema／Migration 任务的互斥方式。

预检只能记录决策证据和候选方案，不得创建 Migration 或取得实施 lease。

### 3.9 幂等、冲突、回滚和计数

必须为未来 A2-P1／A2-P2 分别冻结：

- 空库；
- 已有一致行；
- 重复执行；
- 部分存在；
- 内容冲突；
- 事务失败与回滚；
- 行数、插入数、复用数、冲突数和零意外变更证明；
- 失败后的停止、回退或前向修复要求。

不得把破坏性回滚作为默认方案；已经进入共享环境的 Migration 必须优先定义前向修复边界。

### 3.10 仓库外事项统一标记为待授权核验

以下事项不得在静态预检中写成已确认：

- 各环境真实 journal；
- 备份和恢复点；
- 真实 manifest；
- 目标数据库及其数据状态；
- 环境配置、凭证和部署状态。

任何核验都必须等待后续独立任务对环境、目标、命令和风险的明确授权。

### 3.11 分支保护与 Required Check 是否成为硬门

当前只读事实为 `main.protected=false`。未来预检必须提出并记录：分支保护和“最小架构与质量门禁” Required Check 是否应在 A2 实施前成为硬门、由谁授权、如何验证以及缺失时是否阻断 A2-P1／A2-P2。

未来预检不得修改 GitHub 仓库设置，也不得把建议写成已启用事实。

### 3.12 A2-P1／A2-P2 实施切片冻结

必须分别列出：

- 依赖与启动条件；
- 允许的精确文件类型；
- Schema／Migration／脚本／测试各自是否需要及其边界；
- 定向测试、迁移验证、质量门禁和环境证据；
- 停止条件；
- 回退或前向修复；
- 所需用户授权、Migration lease 和环境授权；
- 完成定义与独立 handoff 要求。

预检只冻结候选切片，不创建这些文件，也不运行实施命令。

### 3.13 不得直接启动下游

未来预检不得直接启动：

- BASE-02；
- Writer 双写或旧 Writer 封堵；
- Audit／模板保护；
- MIG-01B；
- MIG-01C；
- Reader 放行；
- 平台候选切片；
- 机构端旧任务。

## 四、项目级候选顺序

当前项目级顺序冻结为：

```text
V2-MIG01-A2-PROVISIONING-PREFLIGHT-01
→ 独立 handoff
→ A2-P1 manifest 驱动 provisioning
→ 独立 handoff
→ A2-P2 复合键／索引／NOT VALID 关系
→ BASE-02
→ Writer
→ Audit／模板
→ MIG-01B
→ MIG-01C
→ Reader
```

该顺序不构成任何实施授权，不改变 MIG-01～MIG-06 的相对顺序。每个实施切片都必须在其前置条件满足后，由独立任务重新冻结基线、文件范围、环境范围、停止条件和授权。

## 五、未来预检的停止条件

遇到以下任一情况必须停止：

- 最新 `main` 与交接事实不一致；
- A1／A2、Schema、Migration、journal、snapshot、测试或架构证据矛盾且无法解释；
- 无法枚举 Scope、Context Version 或 Context Head 的 Owner 候选，无法定位其代码、Schema、Migration、ADR 或架构证据，或者只有读取环境、真实 manifest、凭证或扩大文件范围才能继续判断；
- 需要读取环境变量、凭证、真实 manifest 或连接数据库才能继续；
- 需要创建唯一允许文件以外的内容；
- 需要提前决定或实施 Schema、Migration、Runtime、脚本或测试；
- 需要修改 CI、分支保护、Required Check 或仓库设置；
- 出现并发写入或 Migration lease 冲突；
- 需要启动 A2、BASE-02、Writer、Reader、平台切片或机构端旧任务。

## 六、严格禁止

未来预检不得：

- 创建或修改 Migration、Schema、Runtime、脚本或测试；
- 创建 `0039` 或其他 Migration；
- 运行 `db:generate`、Migration、Seed、部署或数据库命令；
- 连接数据库、测试服务器、生产环境或业务外部系统；
- 读取 `.env.local`、`DATABASE_URL`、Token、Secret、私钥或凭证；
- 读取真实 manifest 值或 PII；
- 修改 `.github/**`、`package.json`、`pnpm-lock.yaml`；
- 修改分支保护或 Required Check；
- 自动进入正式审查（Ready）；
- 自动合并；
- 启动任何候选实施切片。

## 七、未来预检的验证与交付

未来任务至少必须确认：

1. 只新增 `docs/architecture/v2-mig01-a2-provisioning-preflight.md`；
2. `git diff --check` 通过；
3. A1／A2 事实、Owner、manifest、字段、P1／P2、元数据漂移和实施切片均有真实仓库证据；
4. 所有仓库外事项均标记为 `待授权核验`；
5. Runtime、Schema、Migration、脚本、测试、CI、package 和 lock 修改均为 `0`；
6. 未运行 `db:generate`、Migration、Seed、部署或数据库命令；
7. 未读取凭证、真实 manifest 或连接环境；
8. 工作树提交后干净，最终只有一个同主题提交；
9. 只创建草稿 PR，并等待真实“最小架构与质量门禁”执行；
10. 不自动进入 Ready、不自动合并、不启动任何后续切片。

未来 `V2-MIG01-A2-PROVISIONING-PREFLIGHT-01` 的完成定义仅是：A2 锚点 provisioning 的 current 证据、target 边界、待确认决策、A2-P1／A2-P2 候选实施切片及其停止／修复条件已经冻结。它不表示 A2、BASE-02、Writer、Audit／模板、MIG-01B、MIG-01C 或 Reader 已经实施或获授权。
