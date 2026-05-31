# 智美天工 Clean

智美天工 Clean 是一套重新搭建的 AI 驱动医美智能运营中台。它以旧项目为功能参考，但不直接继承旧项目的临时代码、mock 降级逻辑、巨型页面和混乱数据源。

## 当前范围

当前已经完成：

- 官网首页
- 机构登录页与本地演示登录
- 平台登录页与本地演示登录
- 机构工作台首屏
- 平台管理后台首屏
- 租户隔离与 RBAC 权限底座
- 客户、预约、随访和审计领域模型
- PostgreSQL + Drizzle 真实落库基础
- 客户、预约、随访只读和受控写入 API
- 机构端客户中心、预约中心、智能随访接入真实 API
- Phase 6：机构工作台首页真实 API 摘要、共享页面状态组件、机构端导航边界和 workspace smoke 测试
- Phase 7：客户详情时间线 v1，包括 audit `resource_id` enrich、timeline 后端 API、客户中心详情抽屉和 smoke 覆盖
- Phase 8：审计日志只读查询基础版，包括底层查询能力、机构端审计 API/UI、平台端审计 API/UI 和 smoke / 文档收尾
- 开放平台基础治理基线

Phase 6 已完成：

- 机构工作台首页复用现有真实 API 派生运营摘要
- workspace 与三大业务页加载态、错误态、空态和占位态统一
- 机构端导航明确标注已接入页面与后续占位页面
- workspace entry smoke 覆盖首页、三大业务页和占位入口切换

Phase 7 已完成：

- audit events 已补充最小 `resource_id`，支持客户、预约、随访相关审计事件关联目标记录
- `GET /api/institution/customers/[customerId]/timeline` 已提供客户详情时间线只读 API
- 客户中心已增加“查看详情”入口和右侧客户详情时间线抽屉
- 客户详情 v1 展示客户脱敏摘要、预约摘要、随访摘要、结构化时间线和安全审计摘要
- workspace / customer detail smoke 覆盖客户中心打开详情、关闭后列表保留、敏感信息不展示

Phase 8 已完成：

- 审计查询底层能力已完成：查询条件类型、白名单 parser、repository 查询方法、分页 DTO 和安全 DTO mapper
- `GET /api/institution/audit-events` 已提供机构端本租户审计事件只读查询，不接受前端 `tenantId` 切换租户
- 机构端「审计日志」入口已接入基础列表、筛选、分页、loading、empty、error、403 和 503
- `GET /api/open-platform/audit-events` 已提供平台端受控审计事件只读查询，支持平台端 `tenantId` 筛选
- 平台端「权限与审计」已接入审计日志只读 UI，平台端可展示 `tenantId` 作为审计归属字段
- workspace smoke 覆盖机构端和平台端审计入口、筛选请求、可见范围和敏感字段不展示

后续阶段会依次加入：

- 治疗记录与客服会话
- 平台租户管理与套餐权益
- AI 与知识库
- 企业微信、开放平台凭证和计费

路线图参考：

```text
docs/roadmap/2026-05-30-clean-roadmap-from-rebuild-plan.md
```

## 开发

```bash
pnpm install
pnpm dev
```

打开地址：

```text
http://localhost:5010
```

本地演示账号：

```text
机构端：admin / admin123
平台端：platform / admin123
```

演示认证默认只在非生产环境启用。生产环境如需临时演示，必须显式设置：

```text
ZMTG_ENABLE_DEMO_AUTH=true
```

## 验证

```bash
pnpm typecheck
pnpm test
pnpm build
```

## 架构

参见：

```text
docs/architecture/zmtg-new-project-architecture-design.md
```

## 自主执行工作流

Codex 按仓库内的自主执行规则推进分支、测试、PR、开发日志和风险升级：

```text
docs/operations/codex-autonomous-workflow.md
```

开发日志记录在：

```text
docs/devlog/
```

## 工程规则

- 不要信任浏览器 localStorage 或任意请求头中的租户编号。
- 不要添加生产备用账号。
- 不要把业务数据存入 localStorage。
- 不要隐藏 TypeScript 构建错误。
- mock provider 仅限 development 和 test 环境使用。
