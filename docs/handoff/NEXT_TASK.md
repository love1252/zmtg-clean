# 下一任务

## 当前交接状态

`V2-ARCH-DOCS-03` 已通过 PR #787 合并，六类架构视图已经完成 `6/6`，根 `README.md` 已成为项目入口。

本文件只把后续唯一任务切换为 MIG-01 完整关闭链的静态审计与预检，并冻结其允许范围、证据要求和停止条件。它不启动 `V2-02B`、MIG-01、`V2-02C` 或任何机构端旧开发任务。

当前固定事实和门禁保持不变：

- MIG-01 当前只有 A1 Expand 已存在；
- A2、`BASE-02B／BASE-02`、全部 Writer 双写与 Guard、MIG-01B 和 MIG-01C 尚未形成完整关闭证据；
- Customers／Institution System Reader 等待 MIG-01C 和当前成员服务端 `tenantId + institutionId` 双键上下文；
- Care 等待 MIG-02；
- Knowledge 等待 MIG-03；
- Conversations 等待 MIG-04；
- Analytics Facts 等待 MIG-05；
- Analytics Snapshot／五页等待 MIG-06 + AN-03C；
- Workbench 最后接线，只消费正式 Provider；
- 平台正式服务端授权仍是独立缺口；
- 七线正式发布仍为 `0/7`。

## 唯一下一任务

```text
V2-02B-MIG01-CLOSURE-PREFLIGHT
MIG-01 完整关闭链审计与实施切片冻结
```

`V2-02B-MIG01-CLOSURE-PREFLIGHT` 是唯一下一任务，但尚未启动。必须由用户在后续任务中明确授权后，才可开展本文定义的 docs-only 静态预检。

预检完成也不等于 MIG-01 已启动、正在实施或已经关闭，不等于真实机构级 Reader 已解锁，不构成任何 Schema、Migration、数据操作、Capability 或发布授权。

## 一、未来任务的精确文件范围

未来 `V2-02B` 只允许创建：

```text
docs/architecture/v2-02b-mig01-closure-preflight.md
```

不得修改或创建其他文件。若该路径已经存在，必须先停止并报告，不得覆盖、复用同名历史内容或创建同义文档。

未来预检文档是同一套架构 V2 的静态证据视图，不是第二套数据库、Migration、模块所有权、实施计划或运行事实源。

## 二、任务定位与事实边界

未来 `V2-02B` 只允许读取仓库内可验证的静态证据，用于回答：

1. MIG-01 从 A1 到 C 的每个关闭单元目前具备哪些证据；
2. 哪些表、Writer、Reader、Route、Repository 和测试受影响；
3. 哪些单元已具备、部分具备、缺失、阻断或待确认；
4. 后续独立实施 PR 应如何切分；
5. 每个实施切片在什么条件下必须停止、回退或采用前向修复。

当前 `main` 的代码、测试、Schema、Migration、配置和 package 命令决定 `current` 事实；`architecture-v2.md` 和已接受 ADR 决定最高级 `target` 约束；数据架构、模块映射、证据审计、七线基线和 handoff 只负责展开、核验和记录状态。发现冲突时必须同时记录实现事实与目标约束，不得静默覆盖任一事实层。

仓库外数据库状态、实际执行 journal、行数、数据冲突、备份、恢复点、环境配置和发布状态均不能由本地仓库推断，事实统一标记为“待核验”；若缺少该事实会阻止关闭单元判定，该单元状态标记为“待确认”。

## 三、MIG-01 固定关闭链

未来预检必须按以下顺序审计，不得跳步、并行改写或因 A1 已存在而宣称 MIG-01 已关闭：

```text
MIG-01A1 Expand
→ MIG-01A2 锚点 provisioning
→ BASE-02B／BASE-02 双键上下文、scope revision、Guard 与全部 Writer 双写
→ 审计 institution attribution 与模板 fail-closed
→ MIG-01B 确定性回填、高水位追赶、冲突识别与清零
→ MIG-01C 非空、外键、attribution 与 shape enforce
→ 真实机构级 Reader 重新核验与后续独立放行
```

只有 MIG-01C 完成，且 `BASE-02` 当前成员服务端 `tenantId + institutionId` 双键上下文可用，MIG-01 才能标记关闭并启动真实机构级 Reader。预检文档不得提前改变这一门禁。

## 四、必须审计的十类内容

### 4.1 MIG-01A1 当前证据

至少核对：

- `drizzle/0038_mig_01a1_institution_isolation_expand.sql`；
- Schema、Migration journal、相关测试和架构文档中的对应证据；
- A1 只属于 Expand 的边界；
- A1 是否只增加兼容结构，而未替代 A2、Writer 双写、回填或 Enforce；
- 不得把新增列、索引或约束候选写成已经完成数据归属、回填或强约束。

### 4.2 MIG-01A2 锚点 provisioning

至少审计：

- 租户、机构和成员锚点的来源及事实所有者；
- provisioning 的候选入口、幂等要求和顺序；
- 锚点缺失、冲突、停用或归属不明时的 fail-closed 条件；
- 是否需要 revision 或上下文版本；
- 哪些内容属于当前仓库证据，哪些仍是 `target`、`proposed` 或“待确认”。

不得填写真实机构值、真实租户值、PII、凭证或环境数据。

### 4.3 BASE-02B／BASE-02

至少审计：

- 当前成员服务端 `tenantId + institutionId` 双键上下文；
- membership、anchor 和 provenance 的当前证据；
- scope revision 或等价上下文版本；
- 入口 Guard 和业务 Guard 的职责；
- fail-closed、跨机构拒绝和陈旧上下文处理；
- 全部 Writer 双写清单及每个 Writer 的所有者、入口和测试证据；
- 旧 Writer、Seed、脚本、导入、维护任务或测试夹具是否会绕过双写。

任何“部分存在”的组件都必须逐入口核验，不能据此宣称 `BASE-02B／BASE-02` 已完成。

### 4.4 审计与模板保护

至少审计：

- 审计记录的 tenant attribution 与 institution attribution；
- 平台／租户控制面 Audit 与机构业务数据面的 scope 边界；
- 缺少机构归属时是否 fail-closed；
- 模板、默认数据和共享配置是否可能被错误归属到业务机构；
- 兼容写入是否保留可追溯 Source、Version、Evidence 和 Audit；
- 当前统一 runtime 尚未被仓库证明的部分必须标记为“待确认”。

### 4.5 MIG-01B

至少冻结以下预检要求：

- 确定性回填规则和稳定排序；
- 每类存量数据的归属来源与不可判定处理；
- 初始高水位、增量追赶和最终收敛窗口；
- 双写期间新增或更新数据的追赶方式；
- 冲突分类、重复归属、缺失锚点和跨机构污染识别；
- 冲突清零、行数守恒和证据留存门槛；
- 停止条件、回退条件和前向修复要求。

不得执行回填、统计真实数据库数据或把仓库外结果写成当前事实。

### 4.6 MIG-01C

至少冻结以下 Enforce 预检：

- `NOT NULL`／非空约束；
- 外键及其删除、更新语义；
- tenant 与 institution attribution 一致性；
- shape enforce 或等价数据形态约束；
- 约束增加前的零冲突与完整性证据；
- 升级顺序、兼容窗口、停止条件；
- 回退不可行时的前向修复策略；
- Reader 重新核验所需的服务端授权和双键上下文证据。

不得把目标约束、字段、索引或 Migration 编号写成已经存在。

### 4.7 全部静态影响面

预检必须形成可追溯清单，至少覆盖：

- 所有受影响表；
- 所有 Writer；
- 所有 Reader；
- 所有 Route；
- 所有 Repository；
- 所有相关测试；
- 所有 Schema、Migration、脚本、导入、Seed、维护入口和 fixture 候选；
- 每项的当前路径、事实所有者、证据位置、依赖和状态。

共享 Migration 不等于共享 Repository，也不改变领域事实所有权。

### 4.8 Migration 元数据与历史漂移

必须核对并区分：

- 仓库内 Migration journal 已到 `0038`；
- 仓库内 snapshot 已到 `0026`；
- 旧运维文档、旧测试或历史计划可能仍引用较早基线；
- 上述 journal／snapshot 差异和历史漂移是否构成后续实施阻断；
- 各环境数据库实际 Migration 执行状态／journal 只能标记为“待核验”。

不得运行 `db:generate` 修正漂移，不得创建 `0039`，不得把仓库内 journal 等同于任何环境的实际执行状态。

### 4.9 单元状态

每个关闭单元必须且只能从以下状态中选择，并附路径和理由：

- `已具备`：当前仓库有完整、相互一致且可追溯的静态证据；
- `部分具备`：已有部分实现或证据，但尚不足以关闭；
- `缺失`：当前仓库未找到要求的实现或证据；
- `阻断`：存在必须先解决的冲突、门禁或安全问题；
- `待确认`：仅凭仓库无法确定，或需要后续获批环境核验。

测试通过、Build 通过、代码存在、Mock、Demo、Seed 或 Capability 均不能单独把单元标记为 `已具备`。

### 4.10 后续独立实施 PR 冻结

未来预检文档必须给出后续独立实施 PR 的精确队列，至少依次拆分：

1. MIG-01A2 锚点 provisioning；
2. `BASE-02B／BASE-02` 双键上下文、scope revision 与 Guard；
3. 全部 Writer 双写与旧 Writer 封堵；
4. 审计 attribution 和模板 fail-closed；
5. MIG-01B 确定性回填与追赶；
6. MIG-01C Enforce；
7. 真实机构级 Reader 重新核验与独立放行。

对每个候选实施 PR，必须冻结：

- 任务目标和依赖；
- 允许的文件类型与禁止范围；
- Schema、Migration、runtime、测试和文档是否涉及；
- 静态验证与未来环境验证要求；
- 开始条件和完成证据；
- 立即停止条件；
- 可回退步骤或只能前向修复时的要求；
- 是否需要用户、数据、环境、安全或发布的独立授权。

这份队列只是未来切片建议，不构成任何实施授权。

## 五、未来预检的停止条件

遇到以下任一情况，未来 `V2-02B` 必须停止并报告，不得扩大文件范围或转入实现：

- 基线、任务编号、唯一允许路径或 working tree 不符合授权；
- 目标文档已存在；
- 当前实现与已接受架构存在未能解释的冲突；
- MIG-01A1、journal、snapshot、Schema 或测试证据相互矛盾；
- 无法确定表、Writer、Reader、Route、Repository 或测试的完整影响面；
- 需要读取凭证、连接数据库或核验真实环境才能继续；
- 预检结论依赖创建 Schema、Migration、代码、测试、脚本或配置；
- 需要启动 `V2-02C`、平台授权、真实 Reader、Capability 或旧机构任务；
- 出现任何未获授权的文件改动或并发写入。

## 六、未来预检的禁止范围

未来 `V2-02B` 不得：

- 修改 Schema 或 Migration；
- 创建 `0039`；
- 运行 `db:generate`、Migration、Seed、回填、对账或数据库命令；
- 连接数据库、HIS、企业微信、AI 厂商、对象存储、CI、监控、测试服务器或生产环境；
- 读取 `.env.local`、`DATABASE_URL`、Secret、Token、私钥、业务凭证、环境变量值、真实 manifest 值或 PII；
- 修改 `src/**`、`drizzle/**`、`scripts/**`、`tests/**`、package、lock、配置或现有架构正文；
- 创建真实 Reader、Writer、Guard、Route、Repository、API、UI、Provider、Adapter 或占位实现；
- 开启 Capability；
- 改变 MIG-01～MIG-06 的相对顺序；
- 改变 Customers、Care、Knowledge、Conversations、Analytics 或 Workbench 的既定门禁；
- 启动 `V2-02C`；
- 恢复或启动任何机构端旧开发任务；
- 自动进入正式审查（Ready）或自动合并（Merge）；
- 因预检完成自动启动任何后续实施 PR。

## 七、未来预检的验证与交付

未来任务至少必须确认：

1. `git diff --check` 通过；
2. 修改文件精确为新建的 `docs/architecture/v2-02b-mig01-closure-preflight.md`；
3. 文档完整覆盖本文件规定的十类审计内容；
4. 所有单元使用 `已具备`、`部分具备`、`缺失`、`阻断` 或 `待确认`；
5. 当前事实、目标约束、建议切片和仓库外待核验状态严格分离；
6. 当前路径真实存在，目标路径和候选文件类型明确标记；
7. journal `0038`、snapshot `0026` 和历史漂移已被审计；
8. 未建立第二套数据库、Migration、Repository、模块所有权或运行事实源；
9. runtime、Schema、Migration 修改均为 `0`；
10. 未运行测试、Build、Migration、Seed、部署、`db:generate` 或数据库命令；
11. 未读取凭证或环境变量值，未连接任何外部系统；
12. 工作树在提交后干净，最终只有一个同主题提交；
13. 只创建草稿 PR，不自动进入正式审查，不自动合并；
14. 未启动 MIG-01、`V2-02C` 或任何机构端旧任务。

未来预检的完成定义仅是：MIG-01 完整关闭条件、静态证据状态、影响面和后续实施切片被文档化并冻结。它不代表 MIG-01 已启动、实施或关闭。
