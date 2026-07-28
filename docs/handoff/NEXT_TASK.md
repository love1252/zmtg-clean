# 下一任务

## 当前状态

架构 V2 第一阶段、代码证据审计和首批架构视图已经完成：

- PR #782：完成架构代码证据审计与文档顺序校准；
- PR #783：完成 `V2-ARCH-DOCS-01`，新增架构索引、业务架构和应用架构；
- PR #783 merge commit：`47136da59c5d4cfe7a8727f4f8c2c1d12a547213`；
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
docs/decisions/architecture-v2-decisions.md
```

## 唯一下一任务

```text
V2-ARCH-DOCS-02
数据架构、软件架构与部署架构建设
```

`V2-ARCH-DOCS-02` 是唯一下一任务。它只补齐同一套架构 V2 的数据、软件和部署视图，不建立第二套事实源，不实施 runtime。当前交接收口任务未创建三份架构正文；后续执行仍以用户对该任务的明确授权为准。

## 一、精确文件范围

未来任务只允许创建以下三个 Markdown：

```text
docs/architecture/data-architecture.md
docs/architecture/software-architecture.md
docs/architecture/deployment-architecture.md
```

如任一文件已存在，必须先审计其内容和权威关系，不得创建同义重复文件。不得提前创建 `development-architecture.md`，不得创建任何目录、源码、配置或占位模块。

## 二、同一架构与事实源

三份文档必须继续属于同一套 V2 架构，并遵守以下权威顺序：

1. 当前 `main` 的代码、Schema、Migration、测试和配置是第一事实源；
2. `docs/architecture/architecture-v2.md` 是总体目标架构和最高级架构文档入口；
3. 已接受 ADR 是已确认架构决策的约束来源；
4. `docs/architecture/architecture-v2-evidence-audit-20260728.md` 记录当前代码证据、缺口和置信边界；
5. `docs/architecture/business-architecture.md` 与 `docs/architecture/application-architecture.md` 是同一架构的业务视图和应用视图；
6. `docs/architecture/README.md` 只承担统一导航和权威关系说明；
7. 模块映射、七线重启基线、技术计划、已合并 PR 和历史记录作为补充证据，不得覆盖当前代码事实或已接受决策。

发生冲突时必须列出冲突、证据和待确认决策，不得静默改写 `architecture-v2.md`、ADR、业务架构或应用架构。

## 三、统一文档模板

三份文档均必须包含以下面向人读的章节：

```text
文档定位
事实依据
当前实际状态
建议目标状态
当前与目标差距
代码／Schema／Migration／测试／文档证据
风险与影响
需要的改造
实施顺序
已确认决策
待确认决策
禁止范围
```

统一要求：

- 使用 `current`、`target`、`proposed`、`planned`、`historical` 等明确状态；
- 当前事实、目标建议和未核验信息必须分开书写；
- 每个重要结论必须可追溯到仓库内证据或已合并架构文档；
- 不大段复制 `architecture-v2.md`，不建立平行所有权或第二套术语；
- Mermaid 图必须与正文、当前路径和状态标记一致；
- 不为凑齐模板写空洞章节，不把目标结构描述为当前已经实施。

## 四、数据架构要求

`docs/architecture/data-architecture.md` 至少覆盖：

1. 当前数据库资产仍位于 `drizzle/`、`src/server/db/` 和 `scripts/db/`；
2. 不创建第二套 `database/`，不复制 Schema、Migration 或数据库脚本事实源；
3. `tenantId + institutionId` 的双键归属、访问上下文、隔离边界和过渡状态；
4. Identity、Tenancy、Customers、Care、Conversations、Knowledge、Analytics、System、Messaging、Audit 的事实所有权与跨域引用边界；
5. Source、Version、Evidence、Audit 和数据来源的语义、可追溯性与生命周期；
6. Migration 主序列：`MIG-01A1 → MIG-01A2 → Writer 双写／Guard → MIG-01B → MIG-01C → MIG-02～MIG-06`；
7. 共享 Migration 不等于共享 Repository，不得因 MIG-02 等共享迁移重写领域事实所有权；
8. AI 只能读取受控事实、授权摘要和可追溯证据，不能成为客户、治疗、消息、审计或分析事实源；
9. 当前实体关系 Mermaid 图和建议目标实体关系 Mermaid 图，并明确两者状态；
10. 当前与目标的实体、键、来源、审计、迁移和读写差距；
11. 不把目标表、字段、索引、约束或 Repository 写成当前已存在。

数据架构只能形成文档建议，不得创建或修改 Schema、Migration、Seed、Repository、Reader、Writer 或数据库目录。

## 五、软件架构要求

`docs/architecture/software-architecture.md` 至少覆盖：

1. 模块化单体和四层结构；
2. SaaS 控制平面、七条机构业务线和公共基础设施的职责关系；
3. `Page／Route → Application Service → Port／Provider → Repository／Adapter` 的依赖方向；
4. `institution-contracts`、`access-control`、`security`、`messaging`、`audit` 的边界、依赖和事实所有者；
5. `institution` 与 `open-platform` 旧聚合模块的冻结政策；
6. HIS、企业微信、AI、Excel、Webhook 等 Integration 的 Port-first 原则；
7. 旧 Route 只允许薄兼容，业务逻辑必须只有一个所有者；
8. 当前软件结构 Mermaid 图和建议目标结构 Mermaid 图，并标明未落位部分；
9. Architecture Test、依赖方向检查和模块门禁的当前证据与缺口；
10. 不创建空目录、空模块、占位 Port、占位 Provider 或平行 Application Service。

软件架构不得把目标目录当成已实施结构，也不得借文档任务移动文件或创建代码壳。

## 六、部署架构要求

`docs/architecture/deployment-architecture.md` 至少覆盖：

1. 当前部署只能依据仓库内可验证证据描述；
2. 无法从仓库证明的生产拓扑、仓库外 CI、监控、告警、备份和运维流程必须标为 `待核验`；
3. Local、Test、Staging、Production 的建议目标职责和隔离边界；
4. Web、PostgreSQL、Storage、Jobs、Secrets 与外部 Adapter 的目标关系；
5. Migration 发布、备份、恢复、回滚、Secret 管理和安全开关；
6. 日志、指标、告警、审计、健康检查和故障定位责任；
7. 当前部署 Mermaid 图和建议目标部署 Mermaid 图，并明确哪些节点只有目标状态；
8. 发布顺序、停止条件、回滚条件和需要后续核验的仓库外依赖。

部署架构只形成文档，不执行部署，不读取凭证，不连接任何环境，也不把未经证实的生产组件写成当前事实。

## 七、交叉一致性与验证要求

未来任务必须验证并报告：

1. `git diff --check` 通过；
2. changed files 精确为三份架构 Markdown；
3. 三份文档均使用统一模板并区分当前、目标、建议和待核验状态；
4. 当前路径均可在仓库验证，目标路径和目标组件均被明确标记；
5. 数据、软件、部署 Mermaid 图与正文和状态标记一致；
6. 模块所有权、MIG-01～MIG-06 顺序、平台授权缺口和 `0/7` 发布门禁与既有架构一致；
7. 未建立第二套数据库、模块所有权、应用服务或部署事实源；
8. `src`、`drizzle`、`scripts`、API、UI、配置、package 和 lock 修改均为 0；
9. 根 `README.md`、handoff 文档、`architecture-v2.md` 和 ADR 修改均为 0；
10. 未创建目录、代码、Schema、Migration、Seed、空模块或占位实现；
11. 未运行测试、Build、Migration、Seed 或部署；
12. 未读取环境变量或凭证，未连接数据库或外部系统；
13. working tree 在提交后干净，最终只保留一个同主题提交。

本任务为 docs-only，不因纯文档任务运行全量测试或 Build。

## 八、执行 V2-ARCH-DOCS-02 时的禁止范围

- 不修改根 `README.md`；
- 不修改 `docs/handoff/CURRENT_STATUS.md`、`docs/handoff/NEXT_TASK.md` 或 `docs/handoff/RELEASE_HISTORY.md`；
- 不修改 `docs/architecture/architecture-v2.md`、模块映射、代码证据审计或已合并架构正文；
- 不修改任何 ADR；
- 不修改 `src/**`、`drizzle/**`、`scripts/**`、测试、配置、package 或 lockfile；
- 不修改 runtime、Schema、Migration、Seed、API 或 UI；
- 不创建目录、代码、空模块、Repository、Provider、Adapter、Runner、Scheduler、Worker、Queue 或 Cron；
- 不执行测试、Build、Migration、Seed 或部署；
- 不读取 `.env.local`、`DATABASE_URL`、Secret 或其他凭证；
- 不连接数据库、HIS、企业微信、AI 厂商、对象存储、CI、监控或生产环境；
- 不启动 `V2-ARCH-DOCS-03`；
- 不启动 MIG-01 或任何 runtime 实施；
- 不自动转 Ready；
- 不自动合并。

## 九、后续固定顺序

```text
V2-ARCH-DOCS-02
→ V2-ARCH-DOCS-03
→ V2-02B-MIG01-CLOSURE-PREFLIGHT
→ V2-02C-PLATFORM-AUTH-ROUTE-PREFLIGHT
```

`V2-ARCH-DOCS-02` 只完成数据、软件和部署架构文档。后续阶段不得因文档中的建议而自动启动。

## 十、交付要求

1. 从最新 `main` 创建独立 docs 分支和回退分支；
2. 最终只保留一个同主题提交；
3. 推送工作分支并创建 Draft PR；
4. PR 描述必须说明三文件范围、事实源关系、当前与目标状态、主要差距、待确认决策和禁止范围；
5. PR 描述必须说明 runtime、Schema、Migration 修改为 0，且未读取凭证或连接环境；
6. 不自动 Ready，不自动合并；
7. 最终报告分支、commit、Draft PR、changed files、验证结果、三份文档主要结论、待确认决策和后续顺序。
