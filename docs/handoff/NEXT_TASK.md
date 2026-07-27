# 下一任务

## 当前状态

架构 V2 第一阶段和代码证据审计已完成，当前权威入口为：

```text
docs/architecture/architecture-v2.md
docs/architecture/architecture-v2-evidence-audit-20260728.md
docs/architecture/architecture-v2-module-map.md
docs/architecture/institution-seven-stream-restart-baseline.md
docs/decisions/architecture-v2-decisions.md
```

事实依据顺序保持：

1. 当前 `main` 的代码、测试、Schema、Migration 和配置；
2. `architecture-v2.md` 与已接受 ADR；
3. 代码证据审计和六类架构视图；
4. 七线技术计划、已合并 PR 和历史记录。

当前主要结论：

- 项目继续采用模块化单体；
- SaaS 控制平面与机构业务数据平面是同一单体内的职责划分；
- 目录治理已经闭环，但目标架构物理落位尚未完成；
- MIG-01 尚未完整关闭；
- 平台正式服务端授权仍是独立缺口；
- 七线正式发布仍为 `0/7`；
- 本轮架构文档建设必须先于 MIG-01 完整关闭预检。

## 下一任务

```text
V2-ARCH-DOCS-01
业务架构、应用架构与架构索引建设
```

本任务为 docs-only，只建立同一套 V2 架构的业务视图、应用视图和导航入口，不修改 runtime、Schema、Migration、API 或 UI。

## 一、精确文件范围

只允许创建以下三个 Markdown：

```text
docs/architecture/README.md
docs/architecture/business-architecture.md
docs/architecture/application-architecture.md
```

如任一文件已存在，必须先审计内容并报告，不得创建同义重复文件。

本阶段不得修改：

```text
README.md
docs/architecture/architecture-v2.md
docs/architecture/architecture-v2-module-map.md
docs/architecture/institution-seven-stream-restart-baseline.md
docs/architecture/architecture-v2-evidence-audit-20260728.md
docs/decisions/architecture-v2-decisions.md
docs/handoff/CURRENT_STATUS.md
docs/handoff/RELEASE_HISTORY.md
```

## 二、架构索引要求

`docs/architecture/README.md` 必须成为架构文档导航入口，并明确：

- 当前代码、Schema 和测试是第一事实源；
- `architecture-v2.md` 是总体目标架构和最高级架构文档入口；
- 六类架构文档是同一架构的不同视图，不建立第二套事实源；
- 已接受 ADR 的约束级别；
- 代码证据审计的定位；
- 历史架构草案和目录重构文档只作为来源证据；
- 文档状态使用 `current`、`target`、`proposed`、`historical` 等明确标记；
- README、CURRENT_STATUS、NEXT_TASK 和 RELEASE_HISTORY 的职责边界。

必须为以下后续文档预留导航，但不得在本阶段创建：

```text
data-architecture.md
software-architecture.md
deployment-architecture.md
development-architecture.md
```

## 三、业务架构要求

`docs/architecture/business-architecture.md` 至少回答：

1. 智美天工服务哪些角色；
2. SaaS 控制平面和机构业务数据平面如何分工；
3. 平台端、机构端和公共能力分别创造什么价值；
4. 七条机构业务线如何组成完整业务闭环；
5. 客户、治疗、消费、预约、随访、会话、知识、分析之间的业务关系；
6. AI 可以提供什么建议，不能成为哪些业务事实；
7. 哪些动作必须人工确认；
8. 什么条件才算一条业务线正式发布；
9. 当前 `0/7` 与目标状态的差距；
10. 业务能力分期、依赖和停止条件。

必须保留以下已确认门禁：

- Customers／System 真实 Reader 等待 MIG-01C 和当前成员双键上下文；
- Care 等待 MIG-02；
- Knowledge 正式 Reader 等待 MIG-03；
- Conversations 等待 MIG-04；
- Analytics 事实等待 MIG-05；
- Analytics Snapshot／API／Provider／五页等待 MIG-06 + AN-03C；
- Workbench 最后接线，只消费已发布 Provider；
- capability、代码存在和测试通过都不等于正式发布。

## 四、应用架构要求

`docs/architecture/application-architecture.md` 至少回答：

1. 官网、认证、机构端、平台端、API 和 Webhook 的应用边界；
2. `/hospital` 与 `/open-platform` 的公开 URL 和 Route Group 目标；
3. 机构正式服务端授权链的当前状态；
4. 平台端 `DemoSessionGate` 与正式平台授权缺口；
5. 页面、Route Handler、Application Service、Repository 和 Provider 的依赖方向；
6. canonical 路由、栏目、页面和 Action Capability 的关系；
7. capability、授权、Entitlement 和页面可见性的区别；
8. 新机构 API 默认使用 `src/app/api/v1/institution/**`；
9. 旧非版本化 API 的逐路由薄兼容原则；
10. 外部 Adapter 不能由页面或业务 Route 直接拥有；
11. 当前应用结构和目标结构的 Mermaid 图；
12. 后续 Route Group、平台正式授权和 API 白名单的独立实施顺序。

不得把平台客户端 Gate 写成正式服务端授权已经完成。

## 五、统一文档模板

业务架构和应用架构都必须包含：

```text
文档定位
事实依据
当前实际状态
建议目标状态
当前与目标差距
代码／Schema／测试／文档证据
风险与影响
需要的代码、数据或目录改造
实施顺序
已确认决策
待确认决策
禁止范围
```

要求：

- 不大段复制 `architecture-v2.md`；
- 不把建议写成已实施事实；
- 不为凑齐分类写空洞章节；
- Mermaid 图必须与正文和现有路径一致；
- 每个重要结论必须能追溯到当前代码或已合并文档；
- 与 PR #781 冲突时必须报告，不得静默覆盖。

## 六、本阶段禁止自动执行

- 不修改 `src/**`；
- 不修改 `drizzle/**`；
- 不修改 `scripts/**`；
- 不修改根 `README.md`；
- 不修改 `architecture-v2.md` 的核心所有权和 MIG 顺序；
- 不修改 ADR；
- 不修改 CURRENT_STATUS 或 RELEASE_HISTORY；
- 不修改 API 或 UI；
- 不创建 Schema、Migration 或 Seed；
- 不执行 Migration、Seed、测试、Build 或部署；
- 不连接数据库、HIS、企业微信、AI 厂商或生产环境；
- 不读取 `.env.local`、`DATABASE_URL` 或凭证；
- 不创建 Runtime、Repository、Provider 或 Adapter；
- 不启动 `V2-ARCH-DOCS-02`；
- 不启动 `V2-ARCH-DOCS-03`；
- 不启动 MIG-01；
- 不自动转 Ready；
- 不自动合并。

## 七、验证要求

必须验证并报告：

1. `git diff --check`；
2. changed files 精确为三个 Markdown；
3. `src`、`drizzle`、`scripts`、package、lock 修改为 0；
4. 根 `README.md` 未修改；
5. `architecture-v2.md` 和 ADR 未修改；
6. 三个文件中的路径全部存在或明确标记为后续目标；
7. 业务角色和七线名称与 Contracts 一致；
8. MIG-01～MIG-06 顺序和门禁一致；
9. `/hospital`、`/open-platform` 和 API 路径一致；
10. 业务架构和应用架构没有建立第二套模块所有权；
11. 未把 Demo、Mock、capability-off 或测试通过写成正式发布；
12. 未提前编写数据、软件、部署或开发架构正文。

本阶段是 docs-only，不因纯文档任务重复运行全量测试和 Build。

## 八、后续固定顺序

```text
V2-ARCH-DOCS-01
→ V2-ARCH-DOCS-02
→ V2-ARCH-DOCS-03
→ V2-02B-MIG01-CLOSURE-PREFLIGHT
→ V2-02C-PLATFORM-AUTH-ROUTE-PREFLIGHT
```

### `V2-ARCH-DOCS-02`

后续仅处理：

```text
docs/architecture/data-architecture.md
docs/architecture/software-architecture.md
docs/architecture/deployment-architecture.md
```

### `V2-ARCH-DOCS-03`

后续仅处理：

```text
docs/architecture/development-architecture.md
README.md
docs/handoff/CURRENT_STATUS.md
```

根 README 只能在六类架构方案基本稳定后，于 `V2-ARCH-DOCS-03` 重写。

### `V2-02B`

三个架构文档阶段完成并合并后，再启动 MIG-01 完整关闭与真实 Reader 解锁前预检。

### `V2-02C`

MIG-01 预检之后，再独立处理平台正式服务端授权、Route Group、API 路由族兼容白名单和 Access Control 物理拆分候选。

## 九、交付要求

1. 创建独立 docs 分支和回退分支；
2. 最终只保留一个同主题提交；
3. 创建 Draft PR；
4. PR 描述必须说明事实源、三文件范围、业务架构结论、应用架构结论、与 PR #781 的一致性、未决问题和后续顺序；
5. 不自动 Ready；
6. 不自动合并。

最终必须报告：

- 启动 main SHA；
- 工作分支和回退分支；
- 提交 SHA；
- Draft PR；
- changed files；
- 业务架构主要结论；
- 应用架构主要结论；
- 与 PR #781 一致和不一致的部分；
- 待用户决策；
- runtime、Schema、Migration 修改数量；
- 是否读取环境变量或连接外部系统。
