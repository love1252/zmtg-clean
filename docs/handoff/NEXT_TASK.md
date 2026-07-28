# 下一任务

## 当前状态

架构 V2 前两批架构视图已经完成：

- PR #783：完成 `V2-ARCH-DOCS-01`，新增架构索引、业务架构和应用架构；
- PR #784：收口 `V2-ARCH-DOCS-01` 并将唯一下一任务切换到 `V2-ARCH-DOCS-02`；
- PR #785：完成 `V2-ARCH-DOCS-02`，新增数据架构、软件架构和部署架构；
- PR #785 merge commit：`1159be40e25e4a36639731c81fedf826bc26e479`；
- 六类架构视图目前完成 5 类，开发架构尚未完成；
- MIG-01、平台正式服务端授权和七线正式发布 `0/7` 等既有门禁保持不变。

当前架构入口为：

```text
docs/architecture/README.md
docs/architecture/architecture-v2.md
docs/architecture/architecture-v2-evidence-audit-20260728.md
docs/architecture/architecture-v2-module-map.md
docs/architecture/institution-seven-stream-restart-baseline.md
docs/architecture/business-architecture.md
docs/architecture/application-architecture.md
docs/architecture/data-architecture.md
docs/architecture/software-architecture.md
docs/architecture/deployment-architecture.md
docs/decisions/architecture-v2-decisions.md
```

## 唯一下一任务

```text
V2-ARCH-DOCS-03
开发架构、项目入口与状态同步
```

`V2-ARCH-DOCS-03` 是唯一下一任务。它仍需用户独立授权后才能启动；本次交接只冻结未来范围，不创建开发架构正文、不重写根 README，也不实际执行 DOCS-03。

## 一、精确文件范围

未来任务只允许：

1. 创建 `docs/architecture/development-architecture.md`；
2. 修改根 `README.md`；
3. 修改 `docs/handoff/CURRENT_STATUS.md`。

最终修改文件（changed files）必须精确为以上 3 个 Markdown。若 `development-architecture.md` 已存在，必须先审计并停止报告，不得覆盖或创建同义文件。

不得在 DOCS-03 中修改本文件、`docs/handoff/RELEASE_HISTORY.md`、`docs/architecture/README.md`、其他架构正文或 ADR。

## 二、开发架构文档要求

### 2.1 文档定位和状态

`development-architecture.md` 必须是同一套架构 V2 的开发视图，不建立第二套开发流程或架构事实源，并且：

- 以当前 `main` 的代码、测试、Schema、Migration、配置和 package 命令作为当前（`current`）证据；
- 以 `architecture-v2.md`、模块映射和已接受 ADR 作为已确认的目标（`target`）约束；
- 将建议流程标记为建议（`proposed`），将仓库外流程和环境状态标记为“待核验”；
- 明确区分当前（`current`）、目标（`target`）、建议（`proposed`）和“待核验”，不得把建议流程写成已经执行。

### 2.2 分支、提交和 PR 生命周期

至少覆盖以下受控流程：

```text
确认任务编号、基线和文件范围
→ 创建本地 backup/* 回退分支
→ 创建单任务工作分支
→ 完成范围内改动和验证
→ 保留一个同主题提交
→ 推送工作分支
→ 创建草稿 PR（Draft PR）
→ 完成审查（Review）并关闭阻断项
→ 经明确授权进入正式审查（Ready）
→ 经明确授权合并（Merge）
→ 同步本地 main 与 origin/main
→ 验证后清理已合并工作分支
```

必须说明：

- backup/* 只用于回退，不自动删除；
- 草稿（Draft）、正式审查（Ready）、合并（Merge）是不同授权门禁；
- 未经用户明确授权不得自动进入正式审查（Ready）、合并（Merge）或启动下一任务；
- 合并后先验证 PR 和 main，再删除本地及远端工作分支；
- 不使用 force push、admin 绕过或其他破坏性手段，除非任务单独、精确授权。

### 2.3 已确认的长期协作模式

#### Codex 主开发模式

- Codex 是默认主开发和仓库执行者；
- 覆盖 Domain、Contract、Application Service、Repository、API、UI、必要测试、文档和 Git／PR 流程；
- 每次仍受当前任务编号、基线、允许文件、禁止范围、验证要求和停止条件限制；
- 进入正式审查（Ready）、合并（Merge）、Migration、真实外部连接和正式发布必须获得用户对当前任务的明确授权；
- “默认主开发”只表示默认执行者，不是对所有 Runtime、数据库、外部系统、backlog 或后续阶段的长期授权。

#### ChatGPT 网页版

- 负责任务目标设计、范围拆分和架构讨论；
- 审查 Codex 回报和 PR 证据；
- 协助用户判断进入正式审查（Ready）、合并（Merge）和后续任务；
- 不根据计划、backlog 或模型建议自动授权 Codex 开发。

#### Claude Code

- 默认不参与；
- 只有用户在当前任务中明确点名时，才作为临时独立复核工具或备用执行者；
- 启用后必须服从 `AGENTS.md` 和统一治理规则；
- 不得与 Codex 并发写入同一分支、文件或 Git 索引；
- 单次启用不改变 Codex 的长期默认主开发地位。

Git 仓库、已合并文档、代码、测试、Schema 和 Migration 才是事实源，模型输出不是事实源。架构决策、任务授权、高风险操作和正式发布仍由用户决定；任一工具都不得根据 backlog、计划或“下一步”描述自动启动未授权任务。

### 2.4 开发顺序与依赖方向

文档必须说明 Domain、Contract、Repository、API、UI 和 Migration 的开发顺序，并保持目标依赖方向：

```text
Domain 不变量
→ 版本化 Contract
→ Application Service／Port
→ Repository／Adapter
→ API
→ UI
→ 分层验证和发布门禁
```

涉及数据结构变化时，Migration 不得作为上述链路的附带步骤，必须单独设计、授权和验证：

```text
Migration 需求与所有权
→ 独立设计和影响审计
→ 明确授权
→ Expand／兼容 Writer／回填／Enforce
→ 升级验证
→ 回退或前向修复验证
→ Reader／API／UI 放行
```

不得改变 `MIG-01～MIG-06` 的既定顺序，也不得让共享 Migration 变成共享 Repository 或跨域事实所有权。

### 2.5 测试分层与 Architecture CI

至少覆盖：

- Domain 单元测试；
- Contract 兼容测试；
- Repository／Adapter 集成测试；
- API 授权、解析和错误语义测试；
- UI 状态、权限和交互测试；
- typecheck、静态检查、Build 和发布前验证的职责边界；
- 当前只有局部架构边界测试、仓库内没有完整 Architecture CI 的当前（`current`）缺口；
- 目标 Architecture CI 的依赖方向、冻结目录、Route 兼容白名单和失败策略；
- 测试通过、Build 通过或 CI 通过均不能单独证明正式发布。

DOCS-03 只记录当前证据和目标门禁，不创建 CI Workflow、测试、脚本或配置。

### 2.6 Migration、Secret 和外部连接

开发架构必须明确：

- 每个 Migration 独立设计、独立授权、独立提交，并包含升级、备份、恢复、停止和回退条件；
- Schema、Migration、Writer、Reader 和发布顺序必须可审计，不得在 docs-only 任务中实施；
- `.env.local`、`DATABASE_URL`、Secret、Token、私钥和业务凭证不得读取或写入文档；
- 外部 HIS、企业微信、AI 厂商、对象存储、CI、监控、测试服务器和生产环境只能通过获批 Port／Adapter 与独立环境任务接入；
- 无法由仓库证明的环境、部署和运行状态统一标记为“待核验”。

### 2.7 完成定义（Definition of Done）与正式发布尺度

文档必须区分：

- 代码存在；
- Domain／Contract／Repository／API／UI 完成；
- 测试或 Build 通过；
- Capability、Mock、Demo 或 Seed 可用；
- 已合并；
- 已部署；
- 已完成权限、持久化、数据、监控、回滚和业务验收；
- 正式发布。

完成定义（Definition of Done）至少包含范围、所有权、依赖方向、测试证据、权限、数据迁移、审计、发布证据和回滚条件。当前七线正式发布仍为 `0/7`，不得因文档、Capability、Mock、Demo、Seed、测试或代码存在而改写。

## 三、根 README 重写要求

根 `README.md` 只作为项目入口，至少包含：

- 项目定位；
- 当前模块化单体和七线状态摘要；
- 本地启动前提与现有 package 命令；
- 架构、开发、运维和交接文档导航；
- 当前状态和唯一下一任务链接；
- 当前事实、目标状态和待核验边界；
- 不承载长篇 Phase 历史，历史统一链接到 `docs/handoff/RELEASE_HISTORY.md`；
- 不把 `0/7`、Demo、Mock、Capability、测试通过或代码存在写成正式上线。

不得在 README 中复制完整架构正文、发明新的启动命令、写入凭证示例值或把仓库外环境描述成当前事实。

### 中文优先要求

1. `development-architecture.md` 的标题、正文、状态说明和流程描述默认使用中文。
2. 根 `README.md` 的面向人内容默认使用中文。
3. Git、GitHub、API、代码、路径、字段、环境变量和技术栈名称可以保留英文原文。
4. `current`、`target`、`proposed`、`planned`、`historical` 等架构状态标识可以保留，但必须在首次使用或上下文中附带中文解释。
5. GitHub 状态在正文中优先写为“草稿（Draft）”“已进入正式审查（Ready）”“已合并（Merged）”。
6. 历史文件进入 DOCS-03 允许范围并被修改时，普通英文标题、说明和状态应在不改变事实的前提下尽量中文化。
7. 不得为了翻译历史文件修改 `docs/handoff/NEXT_TASK.md`、`docs/handoff/RELEASE_HISTORY.md`、其他架构正文或治理规则，也不得新增第 4 个修改文件。
8. 不能安全翻译的英文应保留原文并补充中文说明；直接引语、日志、代码、命令、测试锁定字符串和兼容契约不得机械翻译。
9. DOCS-03 验证必须检查新增或修改内容不存在无必要的整段英文模板残留。

## 四、CURRENT_STATUS 同步要求

DOCS-03 完成时只同步 `docs/handoff/CURRENT_STATUS.md` 的架构 V2 状态块，明确：

- 六类架构文档全部完成；
- `docs/architecture/development-architecture.md` 已创建；
- 根 `README.md` 已重写为项目入口；
- 候选后续阶段为 `V2-02B-MIG01-CLOSURE-PREFLIGHT`；
- `V2-02B` 仍需后续独立 handoff 和用户明确授权，才能成为正式启动任务；
- MIG-01、平台正式服务端授权、Knowledge、Analytics 和七线 `0/7` 等既有门禁保持不变。

不得修改该状态块外的历史阶段记录。

## 五、固定门禁和后续顺序

- MIG-01 仅 A1 expand 已存在，A2、Writer／Guard、回填和 Enforce 尚未关闭；
- Customers／System Reader 等待 MIG-01C；
- Care 等待 MIG-02；
- Knowledge 等待 MIG-03；
- Conversations 等待 MIG-04；
- Analytics Facts 等待 MIG-05；
- Analytics Snapshot／五页等待 MIG-06 + AN-03C；
- Workbench 最后接线；
- 平台正式服务端授权仍是独立缺口；
- 七线正式发布仍为 `0/7`。

后续候选顺序保持：

```text
V2-ARCH-DOCS-03
→ V2-02B-MIG01-CLOSURE-PREFLIGHT
→ V2-02C-PLATFORM-AUTH-ROUTE-PREFLIGHT
→ 后续既定顺序
```

完成 DOCS-03 后只允许把 `V2-02B` 记录为候选后续阶段，不得在同一任务中启动；必须另建 handoff 任务完成正式切换。

## 六、验证要求

未来任务必须验证：

1. `git diff --check` 通过；
2. 修改文件（changed files）精确为 `development-architecture.md`、根 `README.md` 和 `CURRENT_STATUS.md`；
3. 开发架构覆盖分支、提交、PR、协作职责、开发顺序、测试、Migration、Secret、Definition of Done 和发布尺度；
4. 根 README 只承担项目入口职责，链接与现有 package 命令可在仓库验证；
5. CURRENT_STATUS 明确六类架构文档完成，并只把 `V2-02B` 记录为候选；
6. 当前（`current`）、目标（`target`）、建议（`proposed`）和“待核验”分离；
7. `development-architecture.md` 准确引用 Codex 默认主开发治理；
8. 不得继续把 Claude Code 写成默认主开发；
9. 明确区分默认执行者、单任务授权和 Migration／外部连接／进入正式审查（Ready）／合并（Merge）／正式发布等高风险人工门禁；
10. DOCS-03 不得再次修改 `AGENTS.md`、`CLAUDE.md`、`docs/ai-agent-governance.md`、`docs/agent-guardrails/**` 或 `.claude/skills/**`；
11. 其他架构正文、handoff、ADR、源码、Schema、Migration、API、UI、配置、package 和 lock 修改均为 0；
12. 未创建代码、目录、测试、CI Workflow、Schema、Migration、Seed 或占位实现；
13. 未运行 Migration、Seed 或部署，未读取凭证，未连接数据库或外部环境；
14. 提交后工作树干净（working tree clean），最终只保留一个同主题提交；
15. 面向人内容以中文为主，允许保留的技术原文符合中文优先规则的白名单；
16. 不存在固定英文状态模板或无必要的整段英文说明；
17. 历史内容中文化未改变事实、技术契约、测试锁定字符串或兼容语义；
18. 未因中文化扩大修改文件（changed files）范围；
19. `current`、`target`、`proposed`、`planned`、`historical` 等技术状态具有中文解释或明确中文上下文。

本任务为 docs-only，不因文档任务运行全量测试或 Build。

## 七、禁止范围

未来 DOCS-03 禁止：

- 修改 `docs/handoff/NEXT_TASK.md` 或 `docs/handoff/RELEASE_HISTORY.md`；
- 修改 `docs/architecture/README.md`、其他架构正文或 ADR；
- 再次修改 `AGENTS.md`、`CLAUDE.md`、`docs/ai-agent-governance.md`、`docs/agent-guardrails/**` 或 `.claude/skills/**`；
- 修改 `src/**`、`drizzle/**`、`scripts/**`、`tests/**`；
- 修改源码、Schema、Migration、API、UI、配置、package 或 lock；
- 创建代码目录、空模块、占位 Port／Provider、Adapter、Repository、Runner、Scheduler、Worker、Queue 或 Cron；
- 运行 Migration、Seed 或部署；
- 读取环境变量值、Secret、Token、私钥或业务凭证；
- 连接数据库、HIS、企业微信、AI 厂商、对象存储、CI、监控、测试服务器或生产环境；
- 启动 `V2-02B`、`V2-02C` 或任何 Runtime；
- 自动进入正式审查（Ready）或自动合并（Merge）。

## 八、交付要求

1. 从最新 `main` 创建独立 docs 分支和本地 backup/* 回退分支；
2. 最终只保留一个同主题提交；
3. 推送工作分支并创建草稿 PR（Draft PR）；
4. PR 描述必须说明三文件范围、当前事实、目标流程、待核验事项和既有门禁；
5. PR 描述必须说明 runtime、Schema、Migration 修改为 0，且未读取凭证或连接环境；
6. 不自动进入正式审查（Ready），不自动合并；
7. 不启动 `V2-02B`、`V2-02C` 或任何 Runtime；
8. 最终报告分支、提交、草稿 PR（Draft PR）、修改文件（changed files）、验证结果、主要结论和仍需用户确认的后续交接（handoff）。
