# 智美天工架构 V2 代码证据审计

- 日期：`2026-07-28 CST +0800`
- 审计基线：`9fa85dd1d85ddd3cc81292f8f9d29bde176b1e15`
- 对应基线 PR：`#781`
- 任务：`V2-ARCH-DOCS-00`
- 状态：`proposed_for_review`
- 执行性质：`docs-only`
- runtime、Schema、Migration、Seed、package、lock 修改：`0`

## 1. 本文定位与权威关系

本文是 `docs/architecture/architecture-v2.md` 的**代码证据伴随审计**，不建立第二套竞争性架构源。

事实依据顺序固定为：

1. 当前 `main` 的代码、测试、Schema、Migration 和配置；
2. `docs/architecture/architecture-v2.md`、已接受 ADR 和模块映射；
3. 本文对前两者的一致性核验、缺口记录和修订建议；
4. 七线技术计划、已合并 PR 和历史 Codex 开发记录；
5. 更早的草案和旧系统参考。

`docs/architecture/architecture-v2.md` 继续作为项目内**总体目标架构和最高级架构文档入口**，但其事实仍从属于当前 `main`。本文和后续六类架构视图只能解释、展开和校验同一套 V2 架构，不得重新发明模块所有权、Migration 顺序或发布门禁。

本文中的结论分为：

- **已确认**：有当前代码、Schema、测试或已合并文档证据；
- **建议决策**：适合作为目标架构，但尚未形成已接受 ADR；
- **待核验**：仓库内证据不足，不能写成已实施事实。

## 2. 审计方法与边界

本次实际核对范围包括：

- 应用入口：`src/app/**`；
- 机构正式授权链：`src/modules/auth/**`、`src/modules/security/**`；
- 七线公共契约：`src/modules/institution-contracts/v1/**`；
- 七条新业务线及旧 `src/modules/institution/**` 聚合模块；
- 平台控制台、`src/modules/open-platform/**` 和 `src/modules/workspace/**`；
- `src/server/db/schema.ts` 与 `drizzle/**`；
- HIS、企业微信、AI、知识库、消息和审计现有实现；
- `package.json`、`scripts/**`、生产 Migration runbook；
- PR `#732`—`#742` 的认证和授权底座记录；
- PR `#743`—`#780` 的目录、API、模块和安全治理记录；
- PR `#781` 的架构 V2、模块映射和 20 条 ADR。

本次没有：

- 连接数据库、HIS、企业微信、模型厂商、测试服务器或生产环境；
- 读取 `.env.local`、`DATABASE_URL` 或凭证；
- 执行测试、Build、Migration、Seed 或部署；
- 修改 runtime、Schema、Migration、API、UI 或配置。

## 3. 当前真正采用的架构

### 3.1 架构风格

**已确认：**智美天工当前是基于 Next.js App Router、React、TypeScript、PostgreSQL 和 Drizzle 的模块化单体，处于“新领域边界与旧聚合实现并存”的过渡期。

当前应用表面主要包括：

1. 官网与认证入口；
2. 机构端 `/hospital/**`；
3. 平台端 `/open-platform`；
4. 版本化与非版本化并存的 API。

当前内部代码主要分为：

1. 已形成较清晰边界的认证、Security、Audit 和 Contracts；
2. 七条新业务线的领域模型、投影、测试和 capability-off 壳；
3. 仍承载大量真实业务、API、Repository 和外部接入的旧 `institution`／`open-platform` 聚合模块；
4. 尚未物理落位的 `src/integrations/*` 目标边界。

因此当前状态是：

```text
安全与契约底座较成熟
+ 七线领域骨架已建立
+ 旧聚合 runtime 仍占主体
+ 数据迁移与正式发布尚未完成
```

### 3.2 机构端授权状态

**已确认：**机构端已经存在正式服务端会话、provenance、当前成员资格、机构 Scope、栏目导航和 fail-closed 组合根。

但这些能力当前仍分布在：

```text
src/modules/auth
src/modules/security
src/modules/institution/server
src/modules/institution-contracts
```

目标物理边界尚未完整落位到 `identity + access-control`，后续只能按职责垂直迁移，不能整体重命名或批量搬运。

### 3.3 平台端授权状态

**已确认缺口：**`/open-platform` 当前仍通过客户端 `DemoSessionGate` 检查 Session 和 `platform_admin` 角色，没有与机构端同等级的正式平台服务端授权根。

因此在正式平台授权完成前：

- 平台控制台只能视为 Demo／受控预览；
- 不能把客户端可见性检查解释为正式平台权限；
- `platform_operator` 和 `security_auditor` 的页面与 Action Policy 仍需独立设计。

### 3.4 七线发布状态

**已确认：**七条新业务线都有不同程度的领域、契约、测试或页面壳，但正式发布仍为 `0/7`。

多数 canonical 页面仍是 capability-off；“代码存在”“测试通过”或“旧 API 可用”都不能等同于新线正式发布。

## 4. 建议目标架构

继续采用模块化单体，不拆微服务。目标架构定义为：

```text
两平面
+ 四层
+ 七条机构业务线
+ 一个串行数据库治理序列
```

### 4.1 两个平面

#### SaaS 控制平面

负责：

- Identity；
- Tenancy；
- 机构开通与成员治理；
- Entitlements、套餐和配额；
- Platform System；
- Branding；
- AI／连接器配置；
- 平台安全、审计和商业化治理。

#### 机构业务数据平面

负责：

- Workbench；
- Customers；
- Conversations；
- Care；
- Knowledge；
- Analytics；
- Institution System。

“两平面”是同一个模块化单体中的职责划分，不代表拆成两个服务、两个仓库或两套数据库。

### 4.2 四层

1. **应用入口层**：Marketing、Auth、机构 Route Group、平台 Route Group、API v1、Webhook；
2. **业务模块层**：控制平面模块和七条机构业务线；
3. **公共基础设施层**：DB、Jobs、Storage、Audit、Security、Messaging、Observability；
4. **外部适配器层**：HIS、WeCom、AI、Excel、Webhook Adapter。

### 4.3 数据库治理序列

```text
MIG-01 完整关闭
→ MIG-02 Customers + Care
→ MIG-03 Knowledge
→ MIG-04 Conversations
→ MIG-05 Analytics Facts
→ MIG-06 Analytics Snapshot／Reports + Institution System Channel Safety
```

共享 Migration 只表示 Schema 变更需要统一编排，不表示共享 Repository、共享 DTO 或跨域直接读取内部表。

## 5. 核心业务闭环

目标业务闭环固定为：

```text
平台创建租户／机构并配置权益
→ 机构成员通过正式会话进入当前机构
→ HIS／机构数据形成受控客户事实
→ 客户、治疗、消费和预约事实归一
→ Care 生成并管理人工任务／路径
→ Conversations 处理会话、分配、身份复核和处置
→ AI 基于受控事实／摘要生成建议或草稿
→ 人工确认客户可见内容和业务动作
→ Messaging 经渠道 Adapter 执行
→ 结果、证据、审计和时间线回流
→ Analytics 生成统一 Snapshot 和报告
→ Workbench 聚合正式 Provider
```

事实源、AI 建议、人工审批和渠道执行必须分层，不能由一个页面、一个 Route 或一个巨型 Service 同时拥有。

## 6. PR #781 独立核验

### 6.1 已确认一致

以下 PR #781 结论与当前代码、Schema、测试和历史 PR 一致：

1. 继续采用模块化单体；
2. 禁止一次性大搬迁；
3. `institution` 和 `open-platform` 停止继续聚合新业务；
4. Security 与 Access Control 按职责拆分；
5. Route Group 迁移不得改变公开 URL；
6. 新机构 API 默认 v1，旧路径逐路由治理；
7. MIG-01 必须完整完成 A1、A2、Writer 双写、B 和 C；
8. MIG-02 是 Customers／Care 共享 Migration；
9. MIG-02 不构成 Customers／Care 共享 Repository；
10. Knowledge 正式 Reader 等待 MIG-03；
11. MIG-04 属于 Conversations；
12. MIG-05 只交付 Analytics 事实、有效链和确定性聚合；
13. MIG-06／AN-03C 后才开放 Analytics Snapshot、API、Provider、五页和报告；
14. MIG-06 同时承载 Institution System 持久化渠道安全状态；
15. Workbench 最后接线，只消费已发布 Provider；
16. 外部 Adapter 最终进入 `src/integrations/*`；
17. capability 状态不能替代服务端授权。

### 6.2 不完整但不构成推翻

PR #781 仍需后续补充：

1. 平台正式服务端认证／授权应列为独立硬门禁；
2. SaaS 控制平面与机构业务数据平面需要详细展开；
3. 共享 Migration 与各域 Repository 所有权需要逐表落地；
4. API 兼容政策需要当前调用方的逐路由清单；
5. `InstitutionSourceEnvelopeV1` 缺统一 Parser 和交叉不变量；
6. AI 的场景、Provider、Metering、Evidence 和人工确认职责需要显式拆分；
7. Integration 的 port-first 顺序需要具体化；
8. CI、Architecture Test、Observability 和正式部署授权尚未成为明确门禁；
9. 目录治理完成度与目标架构物理落位完成度需要分开记录。

### 6.3 核验结论

本次没有发现应当推翻模块化单体、七线业务边界或 MIG 主序列的证据。

修订应通过后续架构视图、ADR 或预检文档完成，不应在未经确认时重写 PR #781 已接受的核心所有权和顺序。

## 7. 当前关键架构缺口

| 缺口 | 当前状态 | 影响 | 优先级 |
|---|---|---|---:|
| MIG-01 未完整关闭 | A1 已存在，其余链路未完整闭环 | 真实机构 Reader 可能读取 tenant-only、默认机构或未回填事实 | 最高 |
| 平台正式授权 | 客户端 Demo Gate | 平台控制平面缺正式服务端授权根 | 高 |
| 七线垂直闭环 | 正式发布 0/7 | 领域骨架可能被误解为上线能力 | 高 |
| Integration 边界 | `src/integrations` 尚未落位 | 外部协议、凭证和业务规则继续混合 | 高 |
| API 双路径 | v1 与非版本化并存 | 容易形成两套长期业务逻辑 | 中高 |
| AI 巨型 Service | 配置、解密、RAG、Prompt、Provider、Metering 混合 | 权限、凭证、知识和计量高耦合 | 高 |
| Architecture CI | 仓库内未发现可审计 Workflow 证据 | 写入冻结和依赖规则依赖人工检查 | 中高 |
| Observability | 缺统一目标和发布门禁 | 正式运行状态难以证明 | 中高 |

“仓库内未发现 CI Workflow”只表示当前仓库内缺可审计证据，不排除仓库外 CI；该项保持待核验。

## 8. 数据、AI 与外部接入边界

### 8.1 数据事实所有权

- 用户和正式会话：`identity`；
- 租户、机构和成员关系：`tenancy + access-control`；
- 客户稳定引用和客户主档：`customers`；
- 预约、随访任务、路径和结果：`care`；
- 会话、消息、分配和身份复核：`conversations`；
- Knowledge Item、Version、Publication 和 Job：`knowledge`；
- 消费事实、有效链和聚合：`analytics`（MIG-05）；
- Snapshot 和报告版本：`analytics`（MIG-06）；
- 渠道安全状态：`institution-system`（MIG-06）；
- 投递和渠道结果：`messaging`；
- 审计事件：`audit`。

### 8.2 AI 边界

AI 默认只允许读取：

- 已授权机构范围内的结构化事实；
- 字段白名单后的治疗、消费、预约和随访摘要；
- Knowledge 正式 Publication／Current Reader 返回的受控片段；
- Source、Version 和 Evidence Reference；
- 低敏聚合指标和冻结的 Analytics Snapshot。

AI 不得直接成为客户、治疗、消费、权限、任务终态或投递结果的事实来源。

以下结果必须人工确认：

- AI 推断标签；
- 客户可见消息；
- 随访／营销路径创建或变更；
- 客户身份匹配；
- 责任归属变更；
- 渠道真实发送；
- AI 建议归档为正式报告；
- 影响客户权益、医疗决策或外部系统状态的动作。

### 8.3 Integration 迁移原则

统一采用：

```text
业务事实 Owner
→ Application Port
→ Connector Orchestration
→ Provider Adapter
→ 外部系统
```

必须先定义 Port 和业务边界，再迁移 Adapter；不得把旧巨型 Service 原样移动到 `src/integrations/*`。

## 9. 目录重构评价

结论是：

> **治理方式符合目标架构，物理落位尚未完成。**

已完成：

- 文件清单、依赖图和风险分级；
- 写入冻结规则；
- 小步、可回退迁移；
- 稳定脚本和 API 兼容入口；
- 3 个低风险正式源码移动试点。

尚未完成：

- 旧 `institution` 聚合模块仍占主体；
- 旧 `open-platform` 聚合模块仍占主体；
- 七线多数仍是领域／契约／测试骨架；
- `src/integrations` 目标边界尚未落位；
- `workspace` 仍承载平台控制台；
- `auth/security` 尚未物理落位到 `identity/access-control`；
- API 版本化仍处于单试点和治理阶段。

后续目录迁移必须绑定真实垂直切片，并同时具备：

1. 唯一目标所有者；
2. 调用方和测试白名单；
3. 行为不变证明或明确契约版本；
4. 数据、权限和外部调用不扩张；
5. 单独回退；
6. 旧路径可观测退出条件。

## 10. 目标架构文档建设计划

### 10.1 文档体系原则

当前适合把业务架构、应用架构、数据架构、软件架构、部署架构和开发架构正式纳入项目，但必须遵守：

- `docs/architecture/architecture-v2.md` 继续是总体目标架构和最高级架构入口；
- 六类架构文档是同一 V2 架构的六个视图，不建立第二套事实源；
- `docs/architecture/README.md` 作为架构导航索引；
- 不为了凑分类创建空洞文档；
- 不大段复制 `architecture-v2.md`；
- 未经确认的建议必须标记为建议或待决策；
- 每份文档都必须基于当前代码、Schema、测试和已接受 ADR；
- 文档建设本身不授权 runtime、Schema、Migration、API、UI 或目录迁移。

### 10.2 六类架构视图

每份架构文档至少包含：

```text
当前实际状态
目标状态
差距
代码／Schema／文档证据
风险与影响
需要的代码、数据或目录改造
实施顺序
已确认决策
待确认决策
禁止范围
```

六类视图分别回答：

| 视图 | 核心问题 |
|---|---|
| 业务架构 | 服务对象、价值流、角色、七线闭环、人工确认和正式发布尺度 |
| 应用架构 | 官网、认证、机构端、平台端、API、Webhook 和 capability 如何协作 |
| 数据架构 | 实体关系、事实所有权、来源、版本、证据、审计和 MIG 序列 |
| 软件架构 | 模块分层、依赖方向、Port／Adapter、Repository 和兼容层 |
| 部署架构 | 环境、Web、DB、Storage、Jobs、Secrets、发布、回滚和监控 |
| 开发架构 | 分支、PR、测试、CI、Migration 开发、工具分工和完成定义 |

### 10.3 三个 docs-only 阶段

#### `V2-ARCH-DOCS-01`

业务架构、应用架构与架构索引：

```text
docs/architecture/README.md
docs/architecture/business-architecture.md
docs/architecture/application-architecture.md
```

#### `V2-ARCH-DOCS-02`

数据架构、软件架构与部署架构：

```text
docs/architecture/data-architecture.md
docs/architecture/software-architecture.md
docs/architecture/deployment-architecture.md
```

#### `V2-ARCH-DOCS-03`

开发架构、项目入口与状态同步：

```text
docs/architecture/development-architecture.md
README.md
docs/handoff/CURRENT_STATUS.md
```

### 10.4 README 与历史文档

根 `README.md` 只能在六类架构方案基本稳定后，于 `V2-ARCH-DOCS-03` 重写。

README 的目标是项目入口，不再承担长篇 Phase 历史账本。历史完成记录继续由 `docs/handoff/RELEASE_HISTORY.md`、`docs/devlog/**` 和产品文档承载。

`docs/architecture/zmtg-new-project-architecture-design.md` 保留为历史参考，不再作为根 README 的唯一架构入口，也不得覆盖 V2 当前结论。

## 11. 更新后的实施顺序

正确顺序冻结为：

```text
PR #782 架构代码证据审计
→ V2-ARCH-DOCS-01
→ V2-ARCH-DOCS-02
→ V2-ARCH-DOCS-03
→ V2-02B-MIG01-CLOSURE-PREFLIGHT
→ V2-02C-PLATFORM-AUTH-ROUTE-PREFLIGHT
→ 最小 Architecture／Quality CI 门禁
→ MIG-01A2／Writer 双写／MIG-01B／MIG-01C 独立数据 PR
→ Customers 真实只读垂直切片
→ MIG-02 + Care
→ MIG-03 + Knowledge
→ MIG-04 + Conversations
→ MIG-05／MIG-06 + Analytics／System
→ Workbench
→ 外部接入正式发布和旧实现退出
```

架构文档建设阶段优先于 MIG-01 预检，目的是先统一业务、应用、数据、软件、部署和开发视图，避免后续高风险数据变更继续依赖分散文档。

三个架构文档阶段仍是 docs-only，不会推迟已经确认的安全修复；如出现紧急生产缺陷，应通过独立修复 PR 处理，不得混入架构文档 PR。

## 12. 下一阶段

本 PR 合并后的下一任务改为：

```text
V2-ARCH-DOCS-01
业务架构、应用架构与架构索引建设
```

该阶段只允许创建：

```text
docs/architecture/README.md
docs/architecture/business-architecture.md
docs/architecture/application-architecture.md
```

不得：

- 修改根 `README.md`；
- 启动 `V2-ARCH-DOCS-02` 或 `V2-ARCH-DOCS-03`；
- 启动 MIG-01；
- 修改 `architecture-v2.md` 的核心所有权和 MIG 顺序；
- 修改 runtime、Schema、Migration、API 或 UI。

## 13. 尚待用户决策

| 决策 | 当前建议 | 影响 |
|---|---|---|
| 平台正式认证是否作为所有平台 runtime 的硬门禁 | 是 | 完成前平台只保留 Demo／受控预览 |
| `/open-platform` 是否保留公开 URL | 保留，内部改 Route Group | 降低客户端和回退成本 |
| Evidence 是否立即建独立模块 | 否，先用 Contracts + Audit 引用 | 避免空模块和第二事实库 |
| 新机构 API 是否强制 v1 | 是，旧端点逐路由薄兼容 | 避免继续扩大双路径 |
| MIG-01 前是否引入仓库内 CI | 是，至少引入 Architecture／Quality 门禁 | 降低高风险数据变更失控概率 |
| MIG-01 前是否允许七线继续做纯领域／契约 | 允许，但禁止真实 Reader 和 capability-on | 保持并行但不虚报完成度 |

这些建议在用户确认并形成 ADR 或实施任务前，不构成 runtime、Schema、Migration 或发布授权。

## 14. 本轮边界与验证

本轮只允许修改：

```text
docs/architecture/architecture-v2-evidence-audit-20260728.md
docs/handoff/NEXT_TASK.md
```

本轮明确：

- 未修改 `src/**`；
- 未修改 `drizzle/**`；
- 未修改 `scripts/**`；
- 未修改根 `README.md`；
- 未修改 `CURRENT_STATUS.md`、`RELEASE_HISTORY.md`；
- 未修改 `architecture-v2.md` 或 ADR；
- 未修改 API、UI、Schema、Migration、Seed；
- 未修改 `package.json`、lock 或构建配置；
- 未执行数据库、测试、Build、部署或外部调用；
- 未读取环境变量或凭证；
- 不自动 Ready；
- 不自动合并。

本文结论来自静态代码、Schema、测试、文档和 Git／PR 历史证据；远端测试服、生产环境、仓库外 CI 和实际监控状态仍需单独授权核验。
