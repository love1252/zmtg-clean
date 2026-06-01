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
- Phase 9：平台端租户管理基础版，包括租户套餐 / 配额数据底座、平台端租户只读 API、租户管理 UI 和 smoke / 文档收尾
- Phase 10：平台套餐配额 enforcement 轻量版，包括配额 helper、客户 / 预约创建 API 阻断、前端稳定错误态和 smoke / 文档收尾
- Phase 11：平台商业化健康只读运营辅助，包括商业化健康派生逻辑、平台端摘要 UI、配额快照风险 / 配置缺失 / quota denied 信号展示和 smoke / 文档收尾
- Phase 12：治疗记录结构化摘要 v1，包括治疗摘要数据底座、客户详情 timeline API 接入、客户详情抽屉展示和 smoke / 文档收尾
- Phase 13：治疗摘要人工录入 v1，包括 payload parser、repository create、`POST /api/institution/customers/[customerId]/treatment-summaries`、客户详情抽屉结构化录入 UI、timeline 刷新和 smoke / 文档收尾
- Phase 14：治疗摘要管理能力 v1，包括 `GET /api/institution/treatment-summaries`、query parser、repository list、DTO 白名单、机构端治疗摘要管理 UI、筛选、加载更多、安全详情和 smoke / 文档收尾
- Phase 15：治疗后护理 / 随访联动 v1，包括确定性护理 / 随访建议规则、`follow_up_tasks` 来源关联、幂等 / 去重、人工确认 API、治疗摘要管理 UI 联动和 smoke / 文档收尾
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

Phase 9 已完成：

- 新增租户套餐、租户套餐分配和租户配额快照最小数据底座
- demo seed 已写入套餐、分配和配额快照演示数据
- open-platform tenant-management repository / domain 已提供安全 DTO，只返回租户运营元数据
- `GET /api/open-platform/tenants` 已提供平台端租户只读 API，`platform_admin` 可访问，`platform_operator` 按当前 RBAC 保守返回 403
- 平台端「租户管理」已接入真实 API，展示租户列表、状态、套餐、配额上限、当前用量和快照时间
- UI 与 smoke 覆盖 loading、empty、403、503、成功态、只读请求和敏感字段不展示
- Phase 9 不包含租户创建、编辑、删除、冻结 / 恢复、套餐 enforcement、计费、支付、合同、发票或客户 / 预约 / 随访业务明细下钻

Phase 10 已完成：

- 新增内部套餐配额 enforcement helper，读取当前租户 active plan / quota limit
- 新增客户数和预约数按 `tenantId` 实时 live count，不把 `tenant_quota_snapshots.current*` 作为强一致判断
- `POST /api/institution/customers` 已接入客户数量配额 enforcement
- `POST /api/institution/appointments` 已接入预约数量配额 enforcement
- 超额、无 active plan、无 quota limit 时 fail closed，返回稳定中文 `409` 错误并写 denied 审计
- 客户更新、预约更新、随访状态流转、审计写入和只读 API 不受数量配额阻断
- 客户中心和预约中心已展示稳定套餐配额错误态，失败后保留表单输入，前端不发送 `tenantId`
- smoke / 单元测试覆盖配额允许、拒绝、无套餐、无 limit、无 snapshot、租户隔离、PII / SQL / stack / token / secret 不泄露
- Phase 10 不包含套餐购买、套餐变更、续费、支付、合同、发票、租户冻结 / 恢复、完整套餐商业化后台、治疗记录、AI / RAG / Agent、企微、OAuth 或 Webhook

Phase 11 已完成：

- 平台商业化健康 view model / client 派生逻辑已完成，复用现有 `GET /api/open-platform/tenants` 和 `GET /api/open-platform/audit-events`
- 平台端「租户管理」已展示商业化健康摘要、套餐覆盖率、配额风险、配置缺失租户和近期 quota denied 审计信号
- 配额风险基于 `tenant_quota_snapshots.current*` 做“配额快照 / 运营参考”展示，不作为计费、创建拦截或 Phase 10 enforcement 的强一致依据
- smoke / 单元测试覆盖平台入口展示、套餐覆盖、配额风险、缺失配置、quota denied 聚合、只读请求和敏感字段不展示
- Phase 11 不包含套餐购买、套餐变更、续费、支付、合同、发票、租户冻结 / 恢复、自动升级套餐、自动触达客户或租户、治疗记录、AI / RAG / Agent、企微、OAuth 或 Webhook

Phase 12 已完成：

- 新增最小 `treatment_summaries` 治疗结构化摘要数据底座、Drizzle migration、demo seed、repository 和 DTO 白名单
- `GET /api/institution/customers/[customerId]/timeline` 已返回 `treatmentSummaries`，并在 `timeline` 中增加 `type: "treatment_summary"` 节点
- 客户详情抽屉已展示治疗时间、项目、类别、阶段、恢复阶段、风险等级、负责人、摘要、下一步护理建议和标签
- workspace / customer detail smoke 覆盖客户中心进入详情、治疗摘要展示、治疗节点展示、无治疗摘要空态和敏感字段不展示
- Phase 12 不包含完整治疗记录正文、完整病历正文、咨询对话全文、治疗写入 UI、AI provider、AI 生成治疗建议、Agent、RAG、企微、HIS / CRM / OTA、OAuth、Webhook、支付或外部系统同步

Phase 13 已完成：

- 新增治疗摘要写入 payload parser，限制结构化字段白名单并拒绝完整正文、PII、图片 / 文件原文、AI 生成内容、外部系统原文和敏感错误细节
- 新增治疗摘要 repository create 和安全 DTO，写入使用服务端确认的 `tenantId` / `customerId`
- 新增 `treatment_summary` access resource，`tenant_admin` 具备必要 create / read 权限，不扩大 update / delete
- 新增 `POST /api/institution/customers/[customerId]/treatment-summaries`，从 access context 推导 tenant，不接受前端 `tenantId`，并校验 customer / appointment 同租户和同客户
- 客户详情抽屉新增“添加治疗摘要”结构化录入表单，成功后刷新 timeline，新摘要进入治疗摘要区域和 `treatment_summary` 时间线节点
- workspace / customer detail smoke 覆盖打开客户详情、打开结构化表单、提交成功刷新 timeline、提交失败保留输入、请求 body 不含 `tenantId` / 未知字段 / PII / 完整正文，以及 SQL / stack / token / secret / `DATABASE_URL` / 连接串不展示
- Phase 13 不包含完整治疗记录正文、完整病历正文、咨询对话全文、图片 / 文件上传、AI 生成、Agent、RAG、企微、HIS / CRM / OTA、OAuth、Webhook、支付、外部系统同步或治疗摘要管理 / 编辑

Phase 14 已完成：

- 新增 `GET /api/institution/treatment-summaries`，服务端从 access context 推导 `tenantId`，不接受前端 `tenantId` 切换租户
- 新增治疗摘要列表 query parser、repository `listTreatmentSummariesByTenant`、cursor / limit 校验和安全 DTO 白名单 mapper
- 机构端新增「治疗摘要管理」入口，展示治疗摘要只读列表、基础筛选、加载更多和安全详情查看
- UI 与 smoke 覆盖 loading、empty、403、503、筛选白名单、分页 / 加载更多、安全详情、只读请求和敏感字段不展示
- Phase 14 不新增 schema / migration，不改权限、认证或租户隔离，不做治疗摘要新增 / 编辑 / 删除
- Phase 14 不包含完整治疗记录正文、完整病历正文、诊疗原文、咨询对话全文、图片 / 文件上传、AI provider、Agent、RAG、企微、HIS / CRM / OTA、OAuth、Webhook、支付、合同、发票或外部系统同步

Phase 15 已完成：

- 新增确定性护理 / 随访建议 domain、parser / mapper 和稳定 `suggestionKey`，只基于 `riskLevel`、`recoveryStage`、`treatmentStage`、`nextCareAction`、`treatmentCategory`、`treatmentProject`、`treatmentDate`、`tags` 等结构化字段
- `follow_up_tasks` 已增加 `source_treatment_summary_id` 和 `source_suggestion_key` 来源关联字段，并完成 Drizzle migration / meta、repository create 地基和同租户来源幂等 / 去重测试
- 新增 `GET /api/institution/treatment-summaries/[summaryId]/follow-up-suggestions`，服务端从 access context 推导 `tenantId`，返回确定性建议，不写数据库、不创建随访任务
- 新增 `POST /api/institution/treatment-summaries/[summaryId]/follow-up-tasks`，机构人员人工确认后创建结构化随访任务，服务端重新校验 summary / suggestionKey / tenant，并写稳定审计
- 治疗摘要管理 UI 已支持查看随访建议、展示“人工确认”边界、人工确认创建内部随访任务、成功提示和重复确认冲突提示
- workspace smoke / API / UI / repository 测试覆盖建议展示、人工确认创建、重复冲突、来源关联、租户隔离、敏感字段不展示和不自动触达边界
- Phase 15 不包含 AI provider、AI 生成护理建议、Agent、RAG、企微、短信、电话外呼、自动触达客户、HIS / CRM / OTA、OAuth、Webhook、支付、完整治疗记录正文、完整病历正文、咨询对话全文、图片 / 文件原文或外部系统同步

后续阶段会依次加入：

- Phase 16 Plan Mode：建议重新评估治疗摘要编辑能力 v1、治疗摘要作废能力 v1、follow-up 配额 enforcement、知识库 / RAG 安全基础准备、平台商业化增强、平台租户状态管理和审计高级治理
- 客服会话、治疗摘要编辑 / 作废和完整治疗记录能力需单独规划
- 平台租户状态管理、更多资源配额 enforcement、完整套餐商业化后台与计费能力
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
