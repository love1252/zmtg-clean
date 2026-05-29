# 智美天工新项目架构设计文档

> 版本：v0.1  
> 日期：2026-05-29  
> 状态：方案草案，待用户确认后进入实施计划  
> 适用范围：新建一套更干净、更可维护的「智美天工」项目。旧项目仅作为功能参考、需求来源和原型资产，不作为继续叠加修改的基础。

## 1. 背景与目标

当前项目已经经历多轮 AI 编程工具协作，功能覆盖面较广，但代码边界、数据来源、租户隔离、mock 逻辑、平台端与机构端职责已经出现明显交叉。继续在旧项目上修补，会增加后期商业化交付、运维接手和专职开发维护的风险。

新项目的目标不是完整复制旧代码，而是重新建立一套清晰的商业化基础架构：

- 保留现有项目已经验证过的核心业务方向和关键体验。
- 删除或重设重复、临时、演示性质强、维护价值低的功能。
- 建立明确的模块边界、数据边界、权限边界和开发规范。
- 让后续开发人员能按模块理解、测试、扩展和上线。
- 先完成可商业化交付的最小闭环，再逐步扩展 AI、知识库、开放平台和计费能力。

## 2. 产品定位

智美天工定位为：

**AI 驱动的医美智能运营中台 / 企业 AI 业务开放平台。**

新项目不应只是随访工具、客服工具或数据看板，而应围绕医美机构的客户经营闭环展开：

```text
获客线索 -> 咨询沟通 -> 预约到院 -> 治疗记录 -> 术后关怀 -> 复诊复购 -> 流失挽回 -> 数据分析
```

第一阶段优先验证并交付：

```text
平台开通机构 -> 机构登录 -> 客户档案 -> 预约/治疗 -> 自动随访任务 -> 客服记录 -> 运营看板 -> 审计追踪
```

## 3. 旧项目功能评估

### 3.1 建议保留的功能方向

| 业务域 | 保留结论 | 说明 |
| --- | --- | --- |
| 官网首页 | 保留，但重做结构 | 保留品牌展示、套餐、案例、登录入口。首页编辑能力并入平台端品牌管理，不再独立散落。 |
| 机构登录 | 保留 | 需要服务端 session、真实用户、真实租户，不再依赖前端 tenant header。 |
| 平台登录 | 保留 | 平台管理员与机构用户权限边界必须分离。 |
| 平台总后台 | 保留核心，重拆模块 | 保留租户、套餐、用量、审计、AI 配置、连接器监控。当前巨型页面不直接复用。 |
| 机构工作台 | 保留 | 作为机构每日运营入口，展示待办、风险、增长机会和关键指标。 |
| 客户中心 | 保留 | 商业价值高，是后续 AI、随访、标签、画像的基础。 |
| 客户详情时间线 | 保留并强化 | 统一承载咨询、预约、治疗、随访、客服、消费、标签变更。 |
| 预约中心 | 保留 | 咨询到到院闭环的关键节点。 |
| 治疗记录 | 保留 | 治疗后运营闭环的触发点。 |
| 智能随访 | 保留，但重建执行模型 | 旧项目里随访任务、旅程、事件、调度存在重复表达，新项目统一为事件驱动旅程。 |
| 客服工作台 | 保留一期基础版 | 先支持会话、消息、人工记录、AI 建议，复杂排队和质检后置。 |
| 知识库 / RAG | 保留二期 | 一期只设计接口和数据边界，避免过早拖重核心闭环。 |
| AI 智能体 | 保留二期增强 | 一期保留 AI 建议能力，Agent 编排和工具权限后置。 |
| 企业微信 | 保留二期接入 | 一期可做连接器框架和模拟发送，真实回调验签、同步、发送放到稳定阶段。 |
| 开放平台 API | 保留三期 | API Key、OAuth、Webhook 属高风险能力，必须在权限和审计稳定后做。 |
| 计费与套餐 | 保留平台侧基础版 | 一期先有套餐与权益限制，支付、发票、合同后置。 |
| 审计日志 | 必须保留 | 平台端、机构端关键操作都要有审计。 |

### 3.2 建议合并或重新设计的功能

| 旧功能/实现 | 新设计 |
| --- | --- |
| `/homepage-editor` 独立页面 | 并入平台端「官网与品牌」模块。 |
| `/api/wecom/*` 与 `/api/v1/wecom/*` 双路径 | 统一为 `/api/v1/connectors/wecom/*` 和 `/api/webhooks/wecom/*`。 |
| 随访任务、旅程、触发规则多套概念并存 | 统一为「事件 -> 规则匹配 -> 旅程执行 -> 任务/消息」。 |
| 本地 `data/*.json` 保存平台状态 | 仅允许开发 seed，不作为正式业务持久化。 |
| localStorage tenant fallback | 删除。租户上下文必须来自服务端 session 或平台授权上下文。 |
| mock AI / mock 企微混入生产路径 | 拆成 demo provider，只能在 development/test 或 demo seed 中启用。 |
| 巨型 `OpenPlatform.tsx` | 拆成平台布局、路由页面、业务模块、服务层。 |
| `src/lib/api/client.ts` 聚合所有 API | 按模块拆分 typed client，或优先使用服务端数据获取。 |
| 平台安全审计与平台业务审计分开存文件 | 合并为数据库审计表，按 actor、tenant、target、action 查询。 |

### 3.3 不建议迁移的历史包袱

- 开发账号硬编码登录，例如 `admin/admin123`、`platform/admin123` 直接存在生产路径。
- 依赖 `X-Tenant-ID` 让前端决定租户的数据访问方式。
- 页面组件里直接写大量 fetch、业务判断、mock fallback、静态指标。
- 使用 localStorage 持久化客户、旅程、租户等业务数据。
- 用单个 JSONB 文件长期保存平台工作流、订单、审计、租户状态。
- 默认忽略 TypeScript build error。
- 乱码注释、大量 `any`、重复 API response 结构。

## 4. 新项目总体架构

### 4.1 架构风格

建议采用 **模块化单体架构**。

理由：

- 当前阶段需要快速形成可交付产品，不适合过早拆微服务。
- 多租户、权限、审计、客户数据、旅程执行强依赖统一事务和统一上下文。
- 模块化单体可以先建立清楚的业务边界，未来再将 AI 调度、消息触达、知识库训练拆为独立服务。

### 4.2 技术栈建议

| 层级 | 建议 |
| --- | --- |
| Web 框架 | Next.js App Router |
| 前端 | React + TypeScript strict |
| 样式 | Tailwind CSS + shadcn/ui，保留少量品牌级自定义组件 |
| 数据库 | PostgreSQL |
| ORM | Drizzle ORM |
| 校验 | Zod |
| 认证 | 服务端 httpOnly cookie session + 数据库 session 记录 |
| 权限 | RBAC + 套餐权益 + 服务端策略检查 |
| 文件存储 | S3 兼容对象存储，用于知识库文件、Logo、附件 |
| AI 接入 | Provider adapter + 租户级加密凭据 |
| 异步任务 | 一期用数据库任务表 + cron endpoint，二期可迁移队列 |
| 测试 | Vitest + Testing Library，关键流程后续补 Playwright |
| 监控 | 结构化日志 + Sentry 或同类错误监控 |
| 部署 | Node runtime，PostgreSQL，S3，后续接入 CI/CD |

### 4.3 不建议一开始引入的复杂度

- 不建议一开始拆成微服务。
- 不建议一开始做完整低代码工作流平台。
- 不建议一期实现完整 OAuth 授权服务。
- 不建议一期做多通道消息中心全部能力。
- 不建议一期做复杂 BI 报表系统。
- 不建议在核心业务未稳定前做过多首页可视化编辑能力。

## 5. 目录结构方案

建议新项目采用以下结构：

```text
src/
  app/
    (marketing)/
      page.tsx
      pricing/page.tsx
      cases/page.tsx
    (auth)/
      login/page.tsx
      platform-login/page.tsx
    (tenant)/
      hospital/
        layout.tsx
        page.tsx
        customers/page.tsx
        customers/[id]/page.tsx
        appointments/page.tsx
        treatments/page.tsx
        followups/page.tsx
        conversations/page.tsx
        analytics/page.tsx
        settings/page.tsx
    (platform)/
      platform/
        layout.tsx
        page.tsx
        tenants/page.tsx
        plans/page.tsx
        usage/page.tsx
        audit/page.tsx
        branding/page.tsx
        connectors/page.tsx
        ai/page.tsx
    api/
      v1/
        platform/
        tenant/
        public/
      webhooks/

  modules/
    auth/
    tenants/
    users/
    rbac/
    customers/
    appointments/
    treatments/
    followups/
    journeys/
    conversations/
    agents/
    knowledge/
    connectors/
    ai/
    billing/
    audit/
    branding/
    analytics/

  shared/
    ui/
    layout/
    config/
    errors/
    http/
    validation/
    utils/

  server/
    db/
    auth/
    context/
    logger/
    jobs/
    storage/

docs/
  architecture/
  deployment/
  api/
  operations/

scripts/
  seed/
  migrate/
  verify/
```

每个业务模块内部建议统一结构：

```text
modules/customers/
  domain.ts          # 领域类型、枚举、纯函数
  schema.ts          # Zod 请求/响应校验
  repository.ts      # 数据库访问
  service.ts         # 业务用例
  permissions.ts     # 模块权限策略
  api.ts             # route handler 可复用方法
  components/        # 仅该模块使用的 UI
  tests/
```

## 6. 核心模块设计

### 6.1 认证与会话

新项目应统一认证入口，但区分账号类型：

- 平台管理员：进入平台端。
- 机构管理员：进入机构端，拥有机构管理权限。
- 机构员工：进入机构端，按角色访问模块。

关键规则：

- session 使用 httpOnly cookie，不暴露 token 到 localStorage。
- session 中可包含 `userId`、`activeTenantId`、`userType`、`roleKeys`。
- 机构端请求的 `tenantId` 必须由服务端 session 解析，不允许前端传入后直接信任。
- 平台管理员默认不能直接查看机构客户隐私数据。如需运维模式，必须显式启用并写审计。

### 6.2 租户与套餐

租户是所有机构业务数据的隔离边界。

基础能力：

- 平台创建、启用、冻结、恢复租户。
- 租户绑定套餐。
- 套餐控制客户数、员工数、旅程数、Agent 数、AI 调用量、知识库容量、开放 API 权限。
- 机构端所有写操作必须检查租户状态和套餐权益。

建议把套餐权益作为数据库配置，同时保留 seed 默认值，避免代码和后台展示不一致。

### 6.3 RBAC 权限

机构端角色建议先保留以下基础角色：

- 机构管理员
- 运营
- 咨询师
- 客服
- 医生/治疗师
- 前台
- 财务
- 只读成员

平台端角色建议先保留：

- 超级管理员
- 平台运营
- 技术运维
- 财务运营

权限检查应在服务端执行，前端只负责隐藏不可用入口，不作为安全边界。

### 6.4 客户与时间线

客户模块是新项目的第一业务核心。

一期保留：

- 客户 CRUD。
- 标签、来源、生命周期阶段。
- 消费统计字段。
- 预约、治疗、随访、会话、备注统一进入客户时间线。

新项目应避免把客户资料、企微资料、消费资料、治疗资料散落在多个页面独立维护。客户详情页应成为机构端核心工作台之一。

### 6.5 预约与治疗

预约和治疗是医美业务闭环的关键事件来源。

一期保留：

- 创建预约。
- 预约确认、取消、改期。
- 创建治疗记录。
- 治疗完成触发事件。
- 治疗后创建随访任务。

### 6.6 事件中心与智能随访

新项目中，随访不再作为孤立任务系统，而是由统一事件中心驱动。

标准流程：

```text
业务动作 -> 写入 domain_event -> 匹配 trigger_rule -> 创建 journey_execution -> 创建 followup_task/message_task -> 执行触达 -> 写回结果 -> 更新客户时间线
```

一期可以先支持固定规则：

- 治疗完成后 D1、D7、D30 随访。
- 预约创建后到院提醒。
- 高意向客户待跟进提醒。

二期再支持可视化旅程画布和复杂节点编排。

### 6.7 客服工作台

一期客服工作台不追求复杂全渠道，只做核心闭环：

- 会话列表。
- 客户上下文。
- 消息记录。
- 人工备注。
- AI 回复建议。
- 标记跟进、预约、风险、关闭会话。

真实企微、微信、短信通道应通过 connectors 模块接入，不直接写死在客服组件里。

### 6.8 AI 与 Agent

AI 模块分三层：

1. Provider 层：豆包、通义、DeepSeek、OpenAI-compatible 等。
2. Capability 层：对话、总结、标签建议、回复建议、知识检索、embedding。
3. Agent 层：咨询助手、术后关怀助手、流失挽回助手、客服质检助手。

一期只需要完成：

- 租户级 AI key 保存和加密。
- AI 连通性测试。
- 客服回复建议。
- 客户标签建议。

Agent 调度、工具调用权限、复杂多 Agent 编排放到二期。

### 6.9 知识库 / RAG

知识库是 AI 能力的增强模块，不应阻塞一期核心闭环。

一期设计好数据结构和边界：

- 平台级知识库：通用行业规范、话术模板、合规模板。
- 租户级知识库：机构项目、价格、医生、术后护理、FAQ。
- 检索必须按租户隔离，平台知识可按授权共享。

二期实现：

- 文件上传。
- 文档解析。
- chunking。
- embedding。
- 检索引用。
- 训练任务状态。

### 6.10 连接器

连接器统一管理外部系统：

- 企业微信。
- HIS。
- 短信。
- 支付。
- 对象存储。

每个连接器至少包含：

- 租户配置。
- 健康状态。
- 最近同步记录。
- 错误日志。
- 是否启用。

回调入口统一放在 `/api/webhooks/*`，并且必须验签、去重、写入 webhook event 表。

### 6.11 平台端商业化能力

一期平台端保留：

- 平台总览。
- 租户管理。
- 套餐权益。
- AI 用量。
- 审计日志。
- 品牌与官网配置。

二期再补：

- 订单。
- 支付。
- 合同。
- 发票。
- 用量账单。
- SLA 和告警。

## 7. 数据模型建议

### 7.1 基础身份与租户

| 表 | 用途 |
| --- | --- |
| `tenants` | 机构租户主表 |
| `users` | 用户主表 |
| `tenant_memberships` | 用户与租户关系、角色 |
| `roles` | 角色 |
| `permissions` | 权限定义 |
| `role_permissions` | 角色权限关系 |
| `sessions` | 服务端 session |

### 7.2 医美业务

| 表 | 用途 |
| --- | --- |
| `customers` | 客户主档 |
| `customer_tags` | 标签定义 |
| `customer_tag_links` | 客户标签关系 |
| `customer_timeline_events` | 客户时间线 |
| `appointments` | 预约 |
| `treatments` | 治疗记录 |
| `customer_orders` | 消费订单 |

### 7.3 事件、随访、会话

| 表 | 用途 |
| --- | --- |
| `domain_events` | 统一业务事件 |
| `trigger_rules` | 触发规则 |
| `journeys` | 旅程定义 |
| `journey_versions` | 旅程版本 |
| `journey_executions` | 旅程执行实例 |
| `followup_tasks` | 随访任务 |
| `message_tasks` | 触达任务 |
| `conversations` | 客服会话 |
| `messages` | 消息记录 |

### 7.4 AI 与知识库

| 表 | 用途 |
| --- | --- |
| `tenant_ai_credentials` | 租户级 AI 凭据，必须加密 |
| `ai_providers` | 平台支持的 AI 厂商 |
| `ai_call_logs` | AI 调用日志与计费 |
| `agents` | 智能体定义 |
| `agent_runs` | 智能体执行记录 |
| `knowledge_sources` | 知识库文件或资料源 |
| `knowledge_chunks` | 切片内容 |
| `knowledge_import_jobs` | 导入和训练任务 |

### 7.5 平台商业化

| 表 | 用途 |
| --- | --- |
| `platform_plans` | 套餐定义 |
| `tenant_subscriptions` | 租户订阅 |
| `platform_orders` | 订单 |
| `payment_events` | 支付事件 |
| `usage_records` | 用量明细 |
| `audit_events` | 统一审计 |
| `webhook_events` | 外部回调事件 |
| `branding_settings` | 平台品牌与官网配置 |

## 8. API 设计原则

### 8.1 路由分区

```text
/api/v1/platform/*     平台管理员使用
/api/v1/tenant/*       机构端使用
/api/v1/public/*       官网、公开展示
/api/webhooks/*        外部系统回调
```

### 8.2 响应格式

统一响应：

```ts
type ApiSuccess<T> = {
  code: 0;
  data: T;
  requestId: string;
};

type ApiFailure = {
  code: number;
  message: string;
  requestId: string;
  details?: unknown;
};
```

### 8.3 route handler 责任

route handler 只负责：

- 解析请求。
- 读取 session/context。
- 调用 service。
- 返回标准响应。

业务逻辑不应直接堆在 route handler 中。

## 9. 前端设计原则

### 9.1 布局分层

- Marketing layout：官网首页、价格、案例、试用入口。
- Auth layout：机构登录、平台登录。
- Tenant console layout：机构端侧边栏、顶部状态、内容区。
- Platform console layout：平台端侧边栏、顶部账号、内容区。

### 9.2 组件分层

- `shared/ui`：基础 UI 组件。
- `shared/layout`：通用布局组件。
- `modules/*/components`：业务模块组件。
- 页面文件只负责组合模块，不承载大量业务逻辑。

### 9.3 数据获取

- 服务端优先获取首屏关键数据。
- 客户端交互使用 typed API client。
- 不再用 localStorage 保存业务数据。
- localStorage 仅可保存 UI 偏好，例如侧边栏折叠状态。

## 10. 安全与合规

新项目必须把安全边界作为基础设施，而不是后补功能。

要求：

- 生产环境必须配置强 session secret。
- AI key、企微 secret、Webhook secret 必须加密保存。
- 所有租户数据查询必须带服务端 tenant scope。
- 平台管理员跨租户访问必须记录审计。
- Webhook 必须验签、去重、防重放。
- API Key 只显示一次，数据库只存 hash 或加密密文。
- 敏感操作包括登录失败、冻结租户、修改套餐、修改 AI key、导出客户、Webhook 配置变更，必须写审计。
- 生产环境不允许隐式 mock provider。

## 11. 测试策略

### 11.1 一期必须覆盖

- session 创建和校验。
- 租户上下文解析。
- 机构用户不能访问其他租户数据。
- 平台用户不能默认读取机构客户隐私。
- 客户 CRUD。
- 预约和治疗触发事件。
- 随访任务创建。
- 套餐权益限制。
- 审计日志写入。

### 11.2 测试类型

| 类型 | 范围 |
| --- | --- |
| 单元测试 | 纯函数、权限策略、数据转换 |
| 服务测试 | service + repository，覆盖租户隔离 |
| API 测试 | route handler 响应与错误码 |
| 组件测试 | 表单、关键状态、权限隐藏 |
| E2E 测试 | 登录、客户创建、治疗后随访闭环 |

## 12. 环境与部署

### 12.1 环境变量原则

- `.env.example` 必须完整。
- `.env` 不提交。
- 生产必须显式配置数据库、session、对象存储、AI、Webhook secret。
- mock 开关必须只在 development/test 可用。

### 12.2 启动脚本

建议保留：

```text
pnpm dev
pnpm build
pnpm start
pnpm test
pnpm test:e2e
pnpm db:generate
pnpm db:migrate
pnpm db:seed:demo
pnpm preflight
```

### 12.3 上线前检查

上线前必须检查：

- TypeScript 无错误。
- build 通过。
- 数据库 migration 可重复执行。
- 生产 env 完整。
- mock provider 禁止启用。
- 默认账号不存在。
- 审计日志可查询。
- 关键业务 E2E 通过。

## 13. 迁移策略

### 阶段 0：冻结旧项目参考状态

目标：

- 确认旧项目主线、当前未提交改动、另一台电脑本地差异。
- 把有价值的 UI 截图、品牌素材、产品文档、流程说明整理为参考资料。
- 不把旧项目作为直接迁移目标。

产物：

- 旧项目功能矩阵。
- 旧项目可复用资产清单。
- 新项目初始化计划。

### 阶段 1：新项目基础骨架

目标：

- 初始化新项目。
- 建立目录结构、代码规范、TypeScript strict、测试框架。
- 建立数据库连接、migration、seed。
- 建立 session、租户上下文、统一 API 响应。

验收：

- 能启动首页、机构登录、平台登录。
- 能通过测试和 build。
- 无 mock 生产路径。

### 阶段 2：租户、用户、RBAC

目标：

- 平台创建租户。
- 创建机构管理员。
- 机构用户登录。
- 服务端 tenant scope 生效。
- 权限策略生效。

验收：

- A 租户用户不能读取 B 租户数据。
- 平台冻结租户后，机构端写操作被禁止。

### 阶段 3：医美运营核心闭环

目标：

- 客户档案。
- 预约。
- 治疗记录。
- 治疗完成事件。
- 随访任务。
- 客服记录。
- 基础看板。

验收：

```text
创建客户 -> 创建预约 -> 标记治疗完成 -> 自动生成随访任务 -> 客服记录跟进 -> 客户时间线可见 -> 看板统计更新
```

### 阶段 4：AI 与知识库

目标：

- 租户 AI key。
- AI 回复建议。
- 标签建议。
- 知识库上传和检索。

验收：

- AI 调用按租户凭据执行。
- 知识检索不越租户。
- AI 调用写入 usage log。

### 阶段 5：平台商业化能力

目标：

- 套餐权益。
- 用量统计。
- 计费订单。
- 审计查询。
- 企业微信连接器。
- 开放平台 API Key / Webhook。

验收：

- 套餐限制影响机构端功能。
- 用量可追溯。
- API Key 和 Webhook 有权限、签名、审计。

## 14. 旧代码复用策略

### 14.1 可复用

- `docs/product-baseline.md` 中的产品定位和两端边界。
- 现有数据库 schema 中的业务实体命名和字段经验。
- `permissions.ts` 里的角色权限含义。
- AI provider adapter 的分层思路。
- 知识库 chunking、retrieval、document parser 的纯逻辑思路。
- 旅程节点类型、随访触发、事件分发的产品概念。
- 当前 UI 的视觉方向、品牌资产和页面截图。
- 已有测试中反映的业务预期。

### 14.2 谨慎复用

- Drizzle schema 可以参考，但需要重新分组、补外键、统一命名。
- OpenPlatform 的业务功能可以拆模块复刻，但不直接复制巨型组件。
- 客户中心、工作台、知识库等页面可以参考交互，不直接搬逻辑。
- 企微和 AI 代码可参考 provider 接口，不直接迁移 fallback 逻辑。

### 14.3 不建议复用

- localStorage 业务持久化。
- 前端注入 `X-Tenant-ID` 的租户隔离方式。
- 本地 JSON 文件作为平台状态持久化。
- 开发账号 fallback。
- 乱码注释和大量 `any` 的 API client。
- 生产路径里的 mock 自动降级。
- 超大页面组件和超厚 route handler。

## 15. 风险与决策点

### 15.1 主要风险

| 风险 | 影响 | 建议 |
| --- | --- | --- |
| 旧项目功能太多，重建时想一次搬完 | 新项目再次变乱 | 严格按阶段迁移，先做核心闭环。 |
| 租户隔离设计不严 | 商业化高风险 | 阶段 2 必须优先完成服务端 tenant scope。 |
| AI/RAG 过早进入一期 | 拖慢基础交付 | 一期只保留 AI 建议接口，RAG 放二期。 |
| 继续依赖 mock | 演示正常但上线不可用 | mock 仅在 demo seed 和测试中存在。 |
| 平台端功能过重 | 巨型页面重现 | 平台端按模块路由拆分。 |
| 未提交旧改动丢失 | 品牌/UI 资产损失 | 新建项目前先备份旧项目当前状态。 |

### 15.2 需要用户确认的决策

1. 新项目是否继续使用 Next.js + PostgreSQL + Drizzle 作为主技术路线。
2. 新项目是否新建 GitHub 仓库，而不是覆盖旧仓库。
3. 一期是否以「治疗后运营闭环」作为唯一主线。
4. 一期是否暂缓完整开放平台 API Key / OAuth / Webhook。
5. 一期是否暂缓真实支付、合同、发票，只保留套餐权益。

## 16. 一期验收标准

新项目一期完成时，应达到以下标准：

- 开发者能按 README 在新机器上启动项目。
- 数据库 migration 和 demo seed 可稳定执行。
- 首页、机构登录、平台登录可访问。
- 平台可创建、冻结、恢复租户。
- 机构管理员可登录并只访问本机构数据。
- 客户、预约、治疗、随访、客服记录形成闭环。
- 服务端权限和租户隔离有测试覆盖。
- 没有生产路径默认账号。
- 没有业务数据 localStorage fallback。
- TypeScript build 不忽略错误。
- preflight 能检查生产关键配置。

## 17. 建议下一步

确认本设计后，再进入实施计划阶段。实施计划应拆为多个小计划，而不是一个超大迁移计划：

1. 新项目初始化计划。
2. 认证、租户、RBAC 计划。
3. 医美核心闭环计划。
4. 平台端基础能力计划。
5. AI 与知识库计划。
6. 开放平台与商业化计划。

每个计划都应独立可验收、可测试、可回滚。
