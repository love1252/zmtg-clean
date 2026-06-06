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
- Phase 16：随访任务来源治理增强 v1，包括 follow-up 来源筛选、安全来源 DTO、智能随访来源标签 / 来源筛选、治疗摘要管理页重复任务提示和 smoke / 文档收尾
- Phase 17：HIS 接入标准模型 / 标准治疗事件 v1，包括 spec / plan 文档、domain-only 标准治疗事件类型、`sourceSystem` 稳定集合、mapper 输入 / 输出契约、字段白名单、禁止字段边界和 institution 测试
- Phase 18：治疗摘要编辑能力 v1，包括 spec / plan 文档、编辑 payload parser、`treatment_summary:update` 最小权限、repository update、`PATCH /api/institution/treatment-summaries/[summaryId]`、机构端受控编辑 UI、入口 smoke 和文档收尾
- Phase 19：治疗摘要作废能力 v1，包括作废字段、软作废 API、作废后随访建议 / 来源任务阻断、机构端状态展示和 smoke / 文档收尾
- Phase 20：治疗项目路径模板 v1，包括 domain-only catalog、确定性随访建议接入、机构端模板建议轻量展示和 smoke / 文档收尾
- Phase 21：随访路径运营分析 v1 最小闭环已完成，包括 spec / plan、domain-only 口径、审计关联口径补强、只读分析 API、机构端轻量指标展示和 smoke / 文档收尾
- Phase 22 Plan Mode：HIS 标准治疗事件 mapper v1 spec / plan 已完成，明确只规划未来 HIS / 机构系统治疗事件到内部标准治疗事件结构的 mapper，不接真实 HIS、不保存 raw payload、不做患者身份匹配、自动摘要、自动任务、AI 解析或自动触达
- 真实 HIS adapter 前置评估 Plan Mode 已完成，规划未来接入真实 HIS / 机构系统前必须先评估租户绑定、连接配置、凭证安全、Webhook / 同步 / 手动导入、幂等、重试、错误降级、审计、raw payload 默认不保存、字段白名单、患者身份匹配、人工复核、自动摘要 / 自动任务禁止和自动触达禁止边界；本阶段不接真实 HIS、不新增 API、不改 schema / 权限
- 连接配置与凭证边界 Plan Mode 已完成，规划未来真实 HIS / 机构系统接入前的连接配置字段、凭证类型、凭证明文展示禁止、生命周期、权限可见性、审计事件、错误降级和后续 PR A-G 拆分；本阶段不实现连接配置 / 凭证存储 / 测试连接，不接真实 HIS，不保存真实凭证
- 连接配置 schema / API Plan Mode 已完成，规划未来 HIS / 机构系统连接配置实体字段、API 边界、权限与租户隔离、审计事件、DTO、稳定错误态、凭证引用和后续 PR A-H 拆分；本阶段不实现 schema / migration / API / 凭证存储 / 测试连接，不接真实 HIS，不保存 raw payload 或真实凭证
- 连接配置 schema / migration 最小实现已完成，新增 `his_connections` 安全元数据表、状态 / 健康状态枚举、租户外键、租户内索引、软删除连接名唯一约束和 schema / migration 测试；本阶段不新增 API / repository / UI / 凭证存储 / 测试连接，不接真实 HIS，不保存 raw payload 或真实凭证，不修改 demo seed
- 连接配置只读 repository 最小实现已完成，新增按可信 `tenantId` 列表 / 按 `tenantId + connectionId` 详情读取能力和 repository 测试；本阶段不新增 API / 写入 repository / UI / 权限改动 / 凭证存储 / 测试连接，不接真实 HIS，不保存 raw payload 或真实凭证，不修改 demo seed
- 连接配置 list / detail 只读 API 最小实现已完成，新增机构端 `GET /api/institution/his-connections` 与 `GET /api/institution/his-connections/[connectionId]`，复用 `open_connection:read_own_tenant` 既有权限边界并返回安全 DTO；本阶段不做写入 API / 写入 repository / UI / 权限模型改动 / 凭证存储 / 测试连接，不接真实 HIS，不返回 raw payload、`credentialRef` 或真实凭证，不修改 demo seed
- 连接配置只读 UI / workspace 入口轻量实现已完成，机构端新增「HIS 连接配置」入口和 `HisConnectionReadOnlyPanel`，只调用现有 list / detail GET API，展示安全摘要、中文状态文案、空态 / 错误态和只读边界，并补充组件测试与 workspace smoke；本阶段不做写入 API / 凭证管理 / 测试连接 / 真实 HIS adapter，不展示 `tenantId`、`deletedAt`、`credentialRef`、凭证明文、raw payload 或外部错误全文
- 连接配置只读 UI smoke / 文档收尾已完成，确认 schema -> repository -> list / detail API -> workspace「HIS 连接配置」入口 -> `HisConnectionReadOnlyPanel` -> 组件测试 / workspace smoke 闭环；现有 smoke 已覆盖入口、只读面板、列表 / 详情安全摘要、状态 / 健康 / 凭证中文文案、空态、错误态、敏感字段不展示、无写入按钮、不调用外部系统和不修改 demo seed；后续 create / update / pause / resume / revoke API、凭证管理、测试连接和真实 HIS adapter 必须单独进入 Plan Mode / 独立 PR
- Phase 23 Plan Mode：HIS 连接配置写入 API 与状态流转边界已完成，规划未来 create / update / pause / resume / revoke / delete API、写入 repository、权限、审计、状态流转、错误态和数据最小化边界；本阶段不写代码、不新增 API、不做写入 repository、不改 schema / migration、不改权限、认证或租户隔离，不处理凭证明文、不返回 `credentialRef`、不做测试连接、不接真实 HIS
- Phase 23 Plan Mode：HIS 连接配置写入 repository 边界已完成，规划未来 create / update / pause / resume / revoke / softDelete repository 方法、输入模型、状态流转、租户边界、审计衔接、稳定结果和数据最小化；本阶段不写代码、不新增 repository 方法、不新增 API、不改 schema / migration、不改权限、认证或租户隔离，不处理凭证、不做测试连接、不接真实 HIS
- Phase 23 PR B：HIS 连接配置 create / update repository 最小实现已完成，新增 `createHisConnectionForTenant` / `updateHisConnectionForTenant`，只写安全元数据，默认 `draft` / `unknown`，绑定可信 `tenantId` 与 `tenantId + connectionId`，返回稳定 `ok` / `not_found` / `conflict` / `validation_failed` 结果并复用安全 read model；本阶段不新增 API、不做状态流转 repository、不改 schema / migration、不改权限、认证或租户隔离，不处理凭证、不接真实 HIS、不修改 demo seed
- Phase 23 PR C：HIS 连接配置状态流转 repository 最小实现已完成，新增 `pauseHisConnectionForTenant` / `resumeHisConnectionForTenant` / `revokeHisConnectionForTenant` / `softDeleteHisConnectionForTenant`，绑定 `tenantId + connectionId + deletedAt is null`，返回稳定 `ok` / `not_found` / `conflict` / `invalid_state_transition` / `validation_failed` 结果；本阶段不新增 API、不写审计、不改 schema / migration、不改权限、认证或租户隔离，不处理凭证、不做测试连接、不接真实 HIS、不修改 demo seed
- Phase 23 PR D：HIS 连接配置 repository 写入闭环收尾已完成，确认 create / update / pause / resume / revoke / softDelete repository 方法、测试覆盖、数据最小化和状态边界已闭环；本阶段 docs-only，不新增 API、不新增 repository 方法、不改生产 repository、不改 schema / migration、不改权限、认证或租户隔离，不写审计、不处理凭证、不做测试连接、不接真实 HIS、不修改 demo seed
- Phase 23 Plan Mode：HIS 连接配置 create / update API v1 已完成规划，明确未来 HTTP 载荷解析器、权限判断、服务层事务、审计写入、DTO 数据最小化、API 错误映射和 create / update API 测试；当前 PR 仅文档，不新增 API、不改 route / service / repository / schema / migration / 权限 / 认证 / 租户隔离，不处理凭证、不做测试连接、不接真实 HIS、不返回 `credentialRef`、raw payload 或真实凭证
- Phase 23 PR E：HIS 连接配置写入 payload parser / DTO helper 已完成，新增 `parseCreateHisConnectionInput`、`parseUpdateHisConnectionInput` 和最小 DTO helper；create / update 只接受 `connectionName`、`sourceSystem`、`vendorType`、`systemType`，拒绝 `tenantId`、状态、凭证、raw payload、SQL、stack 和 `DATABASE_URL`；本阶段不新增 API、不改 route / service / repository / schema / migration / 权限 / 认证 / 租户隔离，不写审计、不处理凭证、不做测试连接、不接真实 HIS
- Phase 23 Plan Mode：HIS 连接配置写入权限 v1 已完成规划，明确当前 `tenant_admin` 只有 `open_connection:read_own_tenant`，不得复用只读权限放行 create / update，后续应单独评审 `open_connection:create` 和 `open_connection:update`；当前 PR 仅文档，不修改权限实现、不新增 API、不改 parser / repository / schema / migration，不写审计、不处理凭证、不做测试连接、不接真实 HIS
- Phase 23 PR F：HIS 连接配置写入权限模型最小实现已完成，`tenant_admin` 已具备 `open_connection:create` / `open_connection:update`，并保留 `open_connection:read_own_tenant`；其他机构普通角色、平台角色和审计角色仍默认拒绝写入，缺失 tenantId 与跨租户 targetTenantId 继续拒绝；本阶段不新增 API、不改 route / service / repository / parser / schema / migration，不写审计、不处理凭证、不做测试连接、不接真实 HIS
- Phase 23 Plan Mode：HIS 连接配置写入 service v1 已完成规划，明确后续 create / update service 的可信输入、事务边界、repository 结果映射、审计写入边界、DTO 最小化和 API 错误响应；当前 PR 仅文档，不写 service 代码、不新增 API route、不改 parser / repository / 权限 / schema / migration，不写审计实现、不处理凭证、不做测试连接、不接真实 HIS
- Phase 23 PR G：HIS 连接配置写入 service 最小实现已完成，新增 `createHisConnectionForTenantService` / `updateHisConnectionForTenantService`，在事务内编排 repository 写入和成功 allowed audit，返回 `{ ok: true }` 最小 DTO；本阶段不新增 API route、不改 parser / repository / 权限 / schema / migration，不实现 denied audit、不处理凭证、不做测试连接、不接真实 HIS
- Phase 23 Plan Mode：HIS 连接配置审计 reason 补强已进入规划，评估 `invalid_his_connection_payload`、`his_connection_name_conflict`、`invalid_his_connection_repository_result` 与 `not_found_or_not_owned` 复用边界；当前 PR 仅文档，不修改 `src/**`，不修改 audit domain / reason，不实现 denied audit，不新增 API route，不改 service
- Phase 23 PR H：HIS 连接配置写入 service denied audit 最小接入已完成，service 已在 repository `validation_failed`、`conflict` 和 update `not_found` 失败路径写安全 denied audit，并继续保持成功 `{ ok: true }` 与 allowed audit；本阶段不新增 API route、不改 parser / repository / 权限 / audit domain / schema / migration，不处理凭证、不做测试连接、不接真实 HIS
- Phase 23 Plan Mode：HIS 连接配置创建更新 API route 已完成规划，明确后续 `POST /api/institution/his-connections` 与 `PATCH /api/institution/his-connections/[connectionId]` 的 access context、权限、parser、service 映射、route denied audit、DTO 和测试边界；当前 PR 仅文档，不新增 API、不修改 `src/**`、不处理凭证、不做测试连接、不接真实 HIS
- Phase 23 Plan Mode：HIS 连接配置状态 API 已完成规划，明确后续 pause / resume / revoke / delete 的路径、可信输入、权限边界、状态流转、service 边界、审计边界、DTO 最小化和测试拆分；当前 PR 仅文档，不新增 API、不修改 `src/**`、不处理凭证、不做测试连接、不接真实 HIS
- Phase 23 Plan Mode：HIS 连接配置状态权限已完成规划，明确 v1 推荐 pause / resume / revoke 使用 `open_connection:manage_status`、delete / softDelete 使用 `open_connection:delete`，默认仅 `tenant_admin` 可写，其他机构角色、平台角色和审计角色默认拒绝；当前 PR 仅文档，不新增 API、不修改 `src/**`、不修改权限实现、不处理凭证、不做测试连接、不接真实 HIS
- Phase 23 Plan Mode：HIS 连接配置状态 service 已完成规划，明确后续 `pauseHisConnectionForTenantService` / `resumeHisConnectionForTenantService` / `revokeHisConnectionForTenantService` / `softDeleteHisConnectionForTenantService` 的可信输入、repository 调用、事务边界、allowed / denied audit、service result、DTO 最小化和测试拆分；当前 PR 仅文档，不新增 service、不新增 API、不修改 `src/**`、不处理凭证、不做测试连接、不接真实 HIS
- Phase 23 Plan Mode：HIS 连接配置状态 service audit reason 映射已完成规划，明确 repository `not_found`、`invalid_state_transition`、`validation_failed`、`conflict` 和 thrown error 到状态 service result 与既有 denied audit reason 的映射；当前 PR 仅文档，不新增 audit reason、不修改 audit domain / query whitelist、不新增 service 或 API route、不修改 `src/**`
- Phase 23 Plan Mode：HIS 连接配置状态 API route denied audit 已完成规划，明确 pause / resume / revoke / DELETE route 层权限拒绝和 parser 失败的 denied audit 口径、action / reason 映射、resourceId 边界、audit 失败处理和禁止重复审计边界；当前 PR 仅文档，不新增 API、不修改 `src/**`、不新增 audit reason 或 action、不处理凭证、不做测试连接、不接真实 HIS
- Phase 23 HIS 连接配置状态 API 已闭环：状态权限、状态 service、pause / resume route、revoke / DELETE route、403 权限拒绝 route denied audit、parser 失败 route denied audit、route tests、status service tests 和权限 / audit domain 回归均已完成；状态 API 包含 `POST /pause`、`POST /resume`、`POST /revoke` 和 `DELETE /api/institution/his-connections/[connectionId]`，成功响应仍只返回 `{ ok: true }`，不返回凭证、状态 read model 或敏感字段；下一步进入凭证管理 Plan Mode，测试连接和真实 HIS adapter 仍未开始
- Phase 23 当前下一步进入 HIS 连接配置凭证管理 Plan Mode：本阶段只规划凭证创建、更新、轮换、删除 / 撤销、`credentialRef`、`credentialConfigured`、权限、service、repository / storage、audit、DTO 和 parser 边界；凭证管理仍未实现，测试连接和真实 HIS adapter 仍未开始
- Phase 23 HIS 连接配置凭证管理总边界 Plan Mode 已完成，下一步进入凭证 repository / storage 边界 Plan Mode；当前仍不实现凭证管理，不写 repository / storage，不做测试连接，不接真实 HIS adapter
- Phase 23 HIS 连接配置凭证 repository / storage 最小边界已完成：当前仅实现安全 `credentialRef` 写入、清空 / 撤销、轮换为新安全引用、`credentialConfigured` 安全派生和 fake in-memory storage 测试抽象；不新增 API、不修改 route / service / parser / 权限 / audit domain / schema / migration，不保存真实凭证，不接真实 secret manager，不做测试连接，不接真实 HIS
- Phase 23 HIS 连接配置凭证 parser / service / DTO Plan Mode 进入规划：凭证 repository / storage 最小边界已完成，下一步只规划凭证 payload parser、service 编排和 DTO 最小响应；当前仍未新增 API，仍未实现 parser / service / DTO，测试连接和真实 HIS adapter 仍未开始
- Phase 23 HIS 连接配置凭证 parser / service / DTO 最小实现已完成：新增凭证 create / update / rotate / clear / revoke payload parser、service 编排和 DTO helper，复用 fake in-memory storage 与 repository 安全 `credentialRef` set / rotate / clear / revoke；不新增 API route、不修改权限、不新增 audit action / reason / domain、不改 schema / migration、不处理真实凭证、不做测试连接、不接真实 HIS，下一步进入凭证 API route / permission / audit Plan Mode
- Phase 23 HIS 连接配置凭证 API route / permission / audit Plan Mode 进入规划：凭证 parser / service / DTO 最小实现已完成，下一步只规划凭证 API route、权限动作、route denied audit、allowed audit、DTO / error mapping 和测试拆分；当前仍未新增 API route、仍未修改权限、仍未接入 audit action / reason / domain，测试连接和真实 HIS adapter 仍未开始
- Phase 23 HIS 连接配置凭证 API route / permission / audit 最小实现已完成：新增 create / update / rotate / clear / revoke 凭证 API route，接入 `open_connection:manage_credentials`、route denied audit、service allowed audit、稳定 DTO / error mapping 和 route tests；不新增 schema / migration，不处理真实凭证，不保存 token / secret / API key / connection string，不做测试连接，不接真实 HIS
- Phase 23 HIS 连接配置凭证加密与真实 secret manager Plan Mode 进入规划：凭证 API route / permission / audit 最小实现已完成，下一步只规划凭证加密、provider 抽象、真实 secret manager、密钥轮换、审计和回滚边界；当前仍未接真实 secret manager，仍未保存真实凭证，测试连接和真实 HIS adapter 仍未开始
- Phase 23 HIS 连接配置凭证 provider 抽象接口最小边界已完成：在现有 fake in-memory storage 上抽象 `HisConnectionCredentialProvider`，补充 test-only health / describe 安全摘要并保持 route 兼容；不接真实 KMS / Vault / secret manager，不保存真实凭证，不做测试连接，不接真实 HIS，不新增 schema / migration
- Phase 23 HIS 连接配置凭证 provider failure / compensation / audit Plan Mode 进入规划：provider 抽象接口最小边界已完成，下一步只规划 provider 失败分类、补偿一致性、audit reason / action、audit metadata、DTO / error mapping 和测试拆分；当前仍未接真实 provider，仍未处理真实凭证，测试连接和真实 HIS adapter 仍未开始
- Phase 23 HIS 连接配置凭证 provider failure / compensation domain 最小边界已完成：新增 provider failure 白名单分类、domain-only compensation summary 和稳定 service result mapping，service 仅识别 safe provider failure 对象并映射到现有 DTO code；不新增 audit reason / action，不改 audit query whitelist / repository，不新增 schema / migration，不实现 job queue / outbox / cleanup，不接真实 provider，不处理真实凭证，不做测试连接，不接真实 HIS
- Phase 23 HIS 连接配置凭证 audit reason / query whitelist 扩展 Plan Mode 进入规划：provider failure / compensation domain 最小边界已完成，下一步只规划凭证 provider failure / compensation 相关 audit reason、action、query whitelist、metadata 和 route / service audit 边界；当前仍未新增 audit reason / action，仍未修改 audit query whitelist，仍未接真实 provider，仍未处理真实凭证，测试连接和真实 HIS adapter 仍未开始
- Phase 23 HIS 连接配置凭证 audit reason / query whitelist 最小边界已完成：新增 provider failure / compensation 稳定 audit reason，并将其纳入现有 `reason` 查询白名单；继续复用 `open_connection:manage_credentials` action 和既有 `allowed` / `denied` / `transitioned` result，不新增 audit action / result / metadata schema / audit repository，不修改 route / service / parser / DTO / provider / repository / schema / migration，不实现 provider failure audit 或 compensation audit，不处理真实凭证、不做测试连接、不接真实 HIS
- Phase 23 HIS 连接配置凭证 provider failure audit / service audit Plan Mode 进入规划：audit reason / query whitelist 最小边界已完成，下一步只规划 provider failure audit 写入职责、service audit fail closed、route audit 去重、compensation audit 后续边界和测试拆分；当前仍未实现 provider failure audit 或 compensation audit，仍未新增 metadata schema，仍未接真实 provider，仍未处理真实凭证，测试连接和真实 HIS adapter 仍未开始
- Phase 23 HIS 连接配置凭证 provider failure audit / service audit 最小边界已完成：credential service 对已知 safe provider failure 写 `open_connection` / `manage_credentials` / `denied` audit，按既有 provider failure reason 映射并在 audit 写入失败时 fail closed 为 `service_unavailable`；route denied audit 和 success allowed audit 保持不变，不实现 compensation audit、不新增 metadata schema、不改 audit repository、不新增 schema / migration、不接真实 provider、不处理真实凭证、不做测试连接、不接真实 HIS；下一步进入 compensation audit Plan Mode，或 real credential one-time material parser / service Plan Mode
- Phase 23 HIS 连接配置凭证 compensation audit Plan Mode 进入规划：provider failure audit / service audit 最小边界已完成，下一步只规划 compensation audit 状态、职责、metadata / schema、outbox / job queue、provider failure 关联、fail closed 和测试拆分；当前仍不实现 compensation audit，不新增 metadata schema / schema / migration / job queue / outbox，不接真实 provider，不处理真实凭证，测试连接和真实 HIS adapter 仍未开始
- Phase 23 HIS 连接配置凭证 compensation audit 最小实现前置评估完成，metadata / outbox Plan Mode 进入规划：当前没有 compensation state 持久化、operationId、audit metadata schema 或 outbox / job queue，不能在无 schema / 无 outbox 下安全实现 compensation audit；本阶段只规划 metadata schema、operationId、outbox / job queue、dead letter / manual review、audit repository、query parser 和测试边界，不新增 schema / migration，不实现 outbox / job queue，不接真实 provider，不处理真实凭证，不做测试连接，不接真实 HIS
- Phase 23 HIS 连接配置凭证 compensation metadata / operationId schema 最小边界已完成：新增安全 compensation operation 状态承载表、operationId 唯一约束、state / operation type / provider failure category 白名单枚举和 domain-only operation metadata helper；本阶段只提供 schema / migration / type / test 准备层，不实现 compensation audit，不实现 outbox / job queue，不修改 audit repository，不修改 route / service / parser / DTO / provider / repository，不接真实 provider，不处理真实凭证，不做测试连接，不接真实 HIS；下一步进入 outbox / job queue Plan Mode 或 compensation operation repository Plan Mode
- Phase 23 HIS 连接配置凭证 compensation operation repository Plan Mode 进入规划：compensation metadata / operationId schema 最小边界已完成，下一步只规划 compensation operation repository 的 create / get / state transition / retry / stale running / manual review / tenant isolation / safe read model 边界；当前仍未实现 repository，仍未实现 outbox / job queue，仍未实现 compensation audit，仍未接真实 provider，仍未处理真实凭证，测试连接和真实 HIS adapter 仍未开始
- Phase 23 HIS 连接配置凭证 compensation operation repository 最小边界已完成：新增 compensation operation repository factory 和 repository tests，只操作 compensation operation 表，覆盖 tenant / connection 隔离、safe operationId 校验、状态流转、retry count、stale running、manual review 和安全 read model；本阶段不接 service / route，不实现 outbox / job queue，不实现 compensation audit，不修改 audit repository，不处理真实凭证，不做测试连接，不接真实 HIS；下一步进入 outbox / job queue Plan Mode 或 compensation audit repository / service integration Plan Mode
- Phase 23 HIS 连接配置凭证 compensation outbox / job queue Plan Mode 已完成规划：只读盘点确认现有 operation 表不足以独立承担 outbox / job queue，后续需要单独 schema / migration、repository、worker claim / lock / stale recovery、compensation audit integration、service 接入和 dead letter / manual review 闭环；当前 PR 仅文档，不修改 `src/**`、不修改 `drizzle/**`、不实现 outbox / job queue、不实现 worker / claim / lock、不实现 compensation audit、不处理真实凭证、不做测试连接、不接真实 HIS
- Phase 23 HIS 连接配置凭证 compensation job queue schema / migration 最小边界已完成：新增 `his_connection_credential_compensation_jobs` 单表承载 outbox 语义和 job queue 执行语义，补齐 job state / dead letter reason 白名单枚举、operation 表 tenant / connection / operationId 复合唯一约束、job operation 复合外键、job operationId 唯一约束、调度索引、claim / lock 字段、retry / nextAttemptAt 字段和 schema / migration tests；本阶段不实现 repository、不实现 worker / claim / lock runtime、不接 service、不写 compensation audit、不处理真实凭证、不做测试连接、不接真实 HIS adapter；下一步进入 repository 最小实现或 worker claim / lock Plan Mode
- Phase 23 HIS 连接配置凭证 compensation job queue repository 最小边界已完成：新增 job queue repository factory 和 repository tests，只操作 `his_connection_credential_compensation_jobs` 表，覆盖 create / get、tenant + connection + operationId 隔离、due list、claim / lock、expired lock reclaim、claimVersion 乐观写回、running / succeeded / failed / requeue / dead letter / manual review 状态流转和安全 read model；本阶段不实现 worker runtime、不接 service、不写 compensation audit、不调用 provider、不处理真实凭证、不做测试连接、不接真实 HIS adapter；下一步进入 worker claim / lock / stale recovery Plan Mode 或 compensation audit integration Plan Mode
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

Phase 16 已完成：

- `GET /api/institution/followups` 已支持 `source=treatment_summary` 和 `sourceTreatmentSummaryId` 白名单筛选，继续从 access context 推导 `tenantId`，拒绝前端传入 `tenantId`、未知参数和未定义 `source`
- follow-up DTO 已返回安全来源字段 `source`、`sourceTreatmentSummaryId` 和 `sourceSuggestionKey`，不返回 `tenantId`、完整治疗摘要正文、完整病历正文、咨询全文、PII、SQL、stack、token、secret、`DATABASE_URL` 或连接串
- 智能随访列表已展示“来源：治疗摘要”、来源摘要 ID、建议 key，并支持“全部来源 / 治疗摘要来源”筛选
- 治疗摘要管理页已在加载建议后查询同来源活跃随访任务，展示只读重复任务提示，并在存在活跃同来源任务时禁用重复创建
- workspace smoke / institution 测试覆盖来源标签、来源筛选、重复提示、不自动创建、不自动触达和敏感字段不展示
- Phase 16 不包含治疗摘要编辑、治疗摘要作废、自动创建随访任务、自动触达客户、企业微信、短信、电话外呼、AI provider、Agent、RAG、HIS / CRM / OTA、OAuth、Webhook、支付、完整治疗记录正文、完整病历正文、咨询对话全文、图片 / 文件原文或外部系统同步

Phase 17 已完成：

- Phase 17 HIS 接入标准模型 / 标准治疗事件 v1 spec / plan 已完成，明确标准治疗事件是未来 HIS / 导入 / 外部系统进入智美天工后的内部标准化事件，不是数据库 schema
- 已新增 domain-only 标准治疗事件类型、`sourceSystem` 稳定集合、`treatmentStatus` / `riskLevel` 等稳定枚举、mapper 输入 / 输出契约、字段白名单和禁止字段边界
- mapper 明确外部 `tenantId` 不可信，`tenantId` / `eventId` / `receivedAt` 只能来自服务端可信上下文；输入不接受 raw payload、未知字段或手机号原文
- 已明确标准治疗事件不会自动生成或修改 `treatment_summaries`；`treatment_summaries` 仍是机构端可查看和运营使用的结构化摘要
- institution 测试覆盖合法输入、`sourceSystem`、`sourceEventId`、`customerMatchKey`、`maskedPhone`、治疗项目 / 分类 / 阶段、金额 / 币种、tags 标准化、字段白名单和禁止字段
- Phase 17 不包含真实 HIS 接入、Webhook、文件导入、外部系统同步、数据库 schema / migration、API route、UI、企业微信 / 个人微信、AI / RAG / Agent、业务事件埋点实现或经营智能中心实现

Phase 18 已完成：

- Phase 18 治疗摘要编辑能力 v1 spec / plan 已完成，明确只允许机构端编辑白名单结构化字段，不允许完整治疗记录正文、完整病历正文、诊疗原文、咨询对话全文、图片 / 文件原文或外部系统原文
- 已新增治疗摘要编辑 payload parser，拒绝未知字段、外部 `tenantId` / `customerId` / `id` / 时间戳字段、PII、完整正文、AI 生成内容、外部系统 payload、SQL、stack、token、secret、`DATABASE_URL` 和连接串
- 已为 `tenant_admin` 增加最小 `treatment_summary:update` 权限，未开放 `treatment_summary:delete`
- 已新增 `updateTreatmentSummaryByTenant`，按服务端确认的 `tenantId + summaryId` 更新，`appointmentId` 更新前校验同租户且属于同一 customer
- 已新增 `PATCH /api/institution/treatment-summaries/[summaryId]`，服务端从 access context 推导 `tenantId`，成功返回安全 DTO 并写 `treatment_summary/update allowed` audit
- 机构端治疗摘要管理安全详情已新增“编辑治疗摘要”入口和受控编辑表单，提交只发送白名单字段，成功后刷新列表和详情，失败后保留输入并展示稳定中文错误
- workspace smoke 覆盖治疗摘要管理页进入、安全详情打开、编辑入口、白名单 PATCH body、成功刷新、失败保留输入、不会自动修改既有随访任务、不会重新生成随访建议和敏感字段不展示
- Phase 18 不包含治疗摘要删除、治疗摘要作废、版本历史、diff 展示、完整治疗记录正文、完整病历正文、咨询对话全文、图片 / 文件上传、AI provider、Agent、RAG、企业微信、真实 HIS / CRM / OTA 接入、OAuth、Webhook、支付、合同、发票或外部系统同步

Phase 19 已完成：

- Phase 19 治疗摘要作废能力 v1 spec / plan 已完成，明确作废不是删除，作废信息必须可审计、可追溯
- `treatment_summaries` 已新增 nullable 作废字段和 Drizzle migration，历史摘要默认视为 active，不 drop 表、不删除字段、不修改已有字段类型
- 治疗摘要 domain / DTO 已派生 `status: "active" | "voided"`，repository 已新增 `voidTreatmentSummaryByTenant`，按服务端确认的 `tenantId + summaryId` 软作废
- 作废原因 parser 已覆盖稳定 reason code、短文本限制和敏感字段拒绝，不接受完整治疗记录正文、完整病历正文、诊疗原文、咨询全文、手机号原文、身份证号、病历号原文、图片 / 文件原文、AI 生成内容、外部系统原文、SQL、stack、token、secret、`DATABASE_URL` 或连接串
- 已新增 `POST /api/institution/treatment-summaries/[summaryId]/void`，服务端从 access context 推导 `tenantId`，不接受前端传入 `tenantId`，成功和拒绝路径写稳定 audit
- 已作废摘要会阻断新的随访建议和新的来源随访任务创建；已存在来源随访任务不自动取消、不自动修改状态，仍保留来源追溯
- 机构端治疗摘要列表、详情、客户 timeline 和来源任务提示已展示作废状态，作废详情显示作废时间、作废人和作废原因
- workspace smoke / institution / audit / db 测试覆盖作废字段、parser、repository、API、随访阻断、UI 展示、来源任务提示、客户 timeline、不会硬删除、不会自动取消既有任务和敏感字段不展示
- Phase 19 不包含治疗摘要硬删除、批量作废、版本历史、diff 展示、自动取消既有随访任务、自动触达客户、完整治疗记录正文、完整病历正文、咨询对话全文、图片 / 文件上传、AI provider、Agent、RAG、企业微信、HIS / CRM / OTA 真实接入、OAuth、Webhook、支付、外部系统同步

Phase 20 治疗项目路径模板 v1 已完成：

- Phase 20 治疗项目路径模板 / 随访路径模板 v1 已形成最小闭环：治疗摘要结构化字段 → domain-only 路径模板 catalog 匹配 → 模板驱动确定性随访建议 → 治疗摘要管理页轻量展示 → 人工确认创建来源任务 → 重复来源任务治理 → 作废摘要阻断
- 首批覆盖光子 / 光电治疗、水光 / 注射护理、术后修复和皮肤管理；模板节点包含恢复阶段、风险等级、建议随访节点、建议任务标题、建议处理角色、人工确认和禁止自动触达边界
- 机构端治疗摘要管理页已能轻量展示“路径模板建议”、路径类型、建议处理角色、人工确认后创建内部随访任务、禁止自动触达客户、不自动回复客户和不接 AI
- Phase 20 v1 未新增 API、未改 DTO、未改 schema / migration、未改权限、认证或租户隔离，不接 HIS / 企微 / AI，不做自动触达，也不修改 demo seed 数据
- 后续如需路径模板 schema / API、租户自定义模板、路径编辑器、平台端模板管理、HIS 输入、企微触达、AI 生成建议或路径效果分析，必须单独进入 Plan Mode

Phase 21 随访路径运营分析 v1 已完成最小闭环：

- Phase 21 已从 Plan Mode 收口到最小只读闭环：治疗摘要 / 路径模板建议 / 来源随访任务 / audit -> domain-only 分析口径 -> 只读分析 API -> 机构端轻量指标展示 -> workspace smoke / 文档收尾
- 最小指标包括模板建议数、人工确认任务数、任务完成数、任务超时数、作废摘要阻断数和重复来源任务冲突数
- `voidedSummaryBlockedCount` 已通过作废摘要阻断 audit `resourceId` 关联具体 treatment summary；`duplicateSourceTaskConflictCount` 已通过 `active_source_follow_up_exists` 的 `resourceId -> source task` 关联模板路径来源任务
- `GET /api/institution/follow-up-path-analysis` 只从 access context 推导 `tenantId`，只返回聚合指标、notes / warnings 和边界说明，不返回客户明细、任务列表、治疗正文、病历正文、咨询全文、图片 / 文件原文或 raw audit payload
- 机构端工作台仅轻量展示聚合指标、warning 和只读边界，不做图表、报表导出或经营智能中心
- Phase 21 v1 未新增数据库 schema / migration，未改权限、认证或租户隔离，未接 HIS / 企微 / AI / RAG / Agent，未做自动触达，未修改 demo seed 数据
- 后续如需图表、导出、经营归因、路径效果分析、指标落库、历史趋势、报表 API 或外部系统接入，必须单独进入 Plan Mode

Phase 22 HIS 标准治疗事件 mapper v1 当前状态：

- Phase 22 只做 spec / plan 文档，承接 Phase 17 标准治疗事件 domain-only 契约，规划未来 HIS / 机构系统治疗事件如何先转换成智美天工内部可识别的标准治疗事件结构
- 建议字段包括 `externalEventId`、`externalSource`、`tenantId`、`customerExternalId`、`appointmentExternalId`、`treatmentDate`、`treatmentProject`、`treatmentCategory`、`treatmentStage`、`recoveryStage`、`riskLevel`、`nextCareAction`、`tags`、`rawSourceType` 和 `mappingWarnings`
- Phase 22 PR 2 标准事件 mapper 契约差异评估已完成 docs-only 结论：v1 优先保留 Phase 17 `sourceSystem`、`sourceEventId`、`sourceCustomerId` 和 `appointmentRef` 内部命名，`external*` 仅作为 adapter 输入层别名或文档映射；后续优先只补 `recoveryStage`、`rawSourceType` 和 `mappingWarnings`
- Phase 22 PR 3A 标准事件缺口字段 domain-only 契约已补齐 `recoveryStage`、`rawSourceType` 和 `mappingWarnings`，继续保留 Phase 17 `sourceSystem`、`sourceEventId`、`sourceCustomerId` 和 `appointmentRef` 命名，不新增 `external*` 核心 DTO 字段
- Phase 22 PR 3B mapper 解析器与安全测试收尾已补强新增字段的空值、敏感内容、全枚举、未知告警代码、非字符串告警、外部调用和数据库写入禁止测试；解析器 / domain 无需改动
- Phase 22 PR 3C 文档 / smoke 收尾已补充 mapper domain-only 最小闭环 smoke，确认新增字段输出、`source*` 命名保留、`external*` 核心字段拒绝、context 可信边界、`mappingWarnings` 安全代码和无外部副作用边界
- 文档明确 mapper v1 与现有治疗摘要、路径模板、随访建议、来源任务和运营分析的关系，标准事件未来可作为稳定输入，但当前不写入业务表、不创建摘要或任务
- Phase 22 PR 3A 只改 domain 类型 / parser / mapper 契约、单元测试和轻量文档，不新增 API、不改现有 API、不改 schema / migration、不改权限、认证或租户隔离
- Phase 22 当前不接真实 HIS / 机构系统 / 企微 / AI / RAG / Agent，不导入真实客户数据，不保存 raw HIS payload，不保存完整治疗正文、完整病历正文、咨询全文、图片 / 文件原文，不做患者身份匹配、自动摘要、自动任务、AI 解析、自动触达、经营智能中心、图表或导出
- 真实 HIS adapter 前置评估 Plan Mode 已完成：当前只规划未来 adapter 的租户绑定、连接配置、凭证安全、输入方式、幂等、重试、错误降级、审计、raw payload 默认不保存、字段白名单、患者身份匹配、人工复核、自动摘要 / 自动任务禁止和自动触达禁止边界；仍不实现 adapter、不接真实 HIS、不处理真实客户数据
- 连接配置与凭证边界 Plan Mode 已完成：当前只规划未来连接配置字段、凭证类型、凭证明文展示禁止、创建 / 测试 / 启用 / 暂停 / 轮换 / 过期 / 撤销 / 删除生命周期、权限可见性、审计事件、错误降级和真实 adapter 前置关系；仍不实现连接配置 / 凭证存储 / 测试连接，不新增 API、不改 schema / 权限、不保存真实凭证、不接真实 HIS
- 连接配置 schema / API Plan Mode 已完成：当前只规划未来连接配置实体字段、API 边界、权限与租户隔离、审计事件、DTO、错误态、凭证引用和安全禁止项；仍不实现 schema / migration / API，不新增权限，不保存真实凭证，不做测试连接，不接真实 HIS，不保存 raw HIS payload
- 连接配置 schema / migration 最小实现已完成：当前仅新增 `his_connections` 表、状态 / 健康状态枚举、租户外键、租户内查询索引、`credentialRef` nullable 引用字段、`revokedAt` / `deletedAt` 生命周期字段、软删除连接名唯一约束和 schema / migration 测试；仍不新增 API / repository，不改权限、认证或租户隔离，不保存真实凭证，不做测试连接，不接真实 HIS，不保存 raw HIS payload，不修改 demo seed
- 连接配置只读 repository 最小实现已完成：当前仅新增 repository 层安全 read model、按可信 `tenantId` 列表读取、按 `tenantId + connectionId` 详情读取、默认过滤软删除、派生 `credentialConfigured` 和只读边界测试；仍不新增 API / 写入 repository，不改权限、认证或租户隔离，不保存真实凭证，不做测试连接，不接真实 HIS，不保存 raw HIS payload，不修改 demo seed
- 连接配置 list / detail 只读 API 最小实现已完成：当前仅新增机构端 list / detail GET route、复用既有 `open_connection:read_own_tenant` 权限、不接受 query / header tenantId 切换租户、默认过滤软删除、详情跨租户 / 不存在 / 已删除统一 `not_found`、返回不含 `tenantId`、`deletedAt`、`credentialRef`、凭证明文或 raw payload 的安全 DTO；仍不新增写入 API / 写入 repository，不改权限、认证或租户隔离，不保存真实凭证，不做测试连接，不接真实 HIS，不保存 raw HIS payload，不修改 demo seed
- 连接配置只读 UI / workspace 入口轻量实现已完成：当前机构端 workspace 已新增「HIS 连接配置」只读入口，UI 只调用现有 list / detail GET API，只展示 `connectionName`、`sourceSystem`、`vendorType`、`systemType`、`status`、`credentialConfigured`、`healthStatus`、`lastCheckedAt`、`lastErrorCode`、`createdAt`、`updatedAt`、`revokedAt` 等安全字段，覆盖空态、稳定错误态、详情 `not_found`、敏感字段不展示和无写入按钮 / API；仍不新增 API，不做写入 API / 凭证管理 / 测试连接 / 真实 HIS adapter，不展示 `tenantId`、`deletedAt`、`credentialRef`、凭证明文、raw payload、外部错误全文或客户业务明细
- 连接配置只读 UI smoke / 文档收尾已完成：当前链路已从 schema / migration、只读 repository、list / detail 只读 API 收口到机构端 workspace 只读入口和 smoke 覆盖；状态文案仅代表后端只读状态展示，不代表测试连接或真实 HIS 调用已实现；后续写入 API、凭证加密 / 凭证管理、测试连接 / 健康检查和真实 HIS adapter 仍需单独 Plan Mode / 独立 PR
- Phase 23 HIS 连接配置写入 API 与状态流转边界 Plan Mode 已完成：当前只规划未来 create / update / pause / resume / revoke / delete API、写入 repository、权限、审计、状态流转、错误态和数据最小化；create / update 只允许安全元数据，`tenantId` 只来自服务端 access context，`credentialRef` v1 不允许写入也不返回，凭证管理、测试连接和真实 HIS adapter 必须单独 Plan Mode；仍不新增 API、不做写入 repository、不改 schema / migration、不改权限、认证或租户隔离、不处理真实凭证、不接真实 HIS
- Phase 23 HIS 连接配置 create / update repository 最小实现已完成：当前仅新增 repository 层 create / update 方法和测试，create 由 repository 生成 `id` 并固定写入 `status = draft`、`healthStatus = unknown`、`createdBy` / `updatedBy`，update 只允许低风险元数据且绑定 `tenantId + connectionId + deletedAt is null`；仍不新增 API、不做 pause / resume / revoke / delete 状态 repository、不改 schema / migration、不改权限、认证或租户隔离、不处理凭证、不接真实 HIS、不修改 demo seed
- Phase 23 HIS 连接配置状态流转 repository 最小实现已完成：当前仅新增 repository 层 pause / resume / revoke / softDelete 方法和测试，状态方法先按可信 `tenantId + connectionId + deletedAt is null` 查当前行，再执行保守状态机；softDelete 设置 `status = deleted` 和 `deletedAt`，删除后 list / detail 默认不可见；仍不新增 API、不写审计、不改 schema / migration、不改权限、认证或租户隔离、不处理凭证、不接真实 HIS、不修改 demo seed
- Phase 23 HIS 连接配置 repository 写入闭环收尾已完成：当前仅同步文档，确认 PR #126 / #127 已覆盖 create / update / pause / resume / revoke / softDelete、可信 `tenantId` 绑定、软删除不可见、安全 read model、敏感字段拒绝、无外部调用、无治疗摘要 / 随访任务 / 自动触达和 demo seed 不修改；下一步 API / service 接入前必须单独处理 HTTP payload parser、权限判断、API 错误映射、审计写入、service 层事务边界和 DTO 数据最小化
- Phase 23 HIS 连接配置 create / update API v1 Plan Mode 已完成：当前仅规划后续 create / update API 接入前的 HTTP 载荷解析器、权限判断、服务层事务、审计写入、DTO 数据最小化、错误映射和测试；create / update 只处理 `connectionName`、`sourceSystem`、`vendorType`、`systemType`，`tenantId` 只来自服务端 access context，仍不新增 API、不改 route / service / repository / schema / 权限 / 审计实现、不处理凭证、不做测试连接、不接真实 HIS、不修改 demo seed
- Phase 23 HIS 连接配置写入 payload parser / DTO helper 已完成：当前仅新增 create / update HTTP payload parser、最小 DTO helper 和 parser 单元测试；create 四个安全元数据字段全部必填，update 允许四个字段非空子集，DTO helper 只返回四个安全元数据字段；仍不新增 API、不改 route / service / repository / schema / 权限 / 审计实现、不处理凭证、不做测试连接、不接真实 HIS、不修改 demo seed
- Phase 23 HIS 连接配置写入权限 v1 Plan Mode 和权限模型最小实现已完成：`tenant_admin` 已具备 `open_connection:create` 与 `open_connection:update`，并保留 `open_connection:read_own_tenant`；普通机构人员、顾问、客服、平台角色和审计角色仍默认不具备 create / update，平台代管写入不进入 v1；仍不新增 API、不改 route / service / repository / parser / schema / migration、不写审计、不接真实 HIS
- Phase 23 HIS 连接配置写入 service v1 Plan Mode 和最小实现已完成：当前 create / update service 只接收 access context、path `connectionId` 和 parser 输出，在事务内编排 repository 写入和成功 allowed audit，并返回 `{ ok: true }`；denied audit reason 补强、API route、凭证管理、测试连接和真实 HIS adapter 均需后续独立 PR
- Phase 23 HIS 连接配置审计 reason 补强 Plan Mode 已完成规划：当前仅规划后续 create / update 失败路径 reason，明确权限拒绝复用 access decision reason、目标不可见优先复用 `not_found_or_not_owned`，并评估 HIS 专用 payload / conflict / repository validation reason；仍不修改 `src/**`、不修改 audit domain / reason、不实现 denied audit、不新增 API
- Phase 23 HIS 连接配置审计 reason 与 service denied audit 最小接入已完成：新增并复用安全 reason 后，service 已覆盖 repository `validation_failed`、`conflict` 和 update `not_found` 的 denied audit，route 层仍待单独接入权限拒绝与 parser 失败 audit；仍不新增 API、不处理凭证、不做测试连接、不接真实 HIS
- Phase 23 HIS 连接配置创建更新 API route Plan Mode 已完成：当前仅规划后续 POST / PATCH route 接入顺序、`tenantId` 可信来源、权限判断、parser 边界、service result 到 HTTP 映射、route denied audit、DTO 最小化和 route 测试；仍不新增 API、不修改 `src/**`、不处理凭证、不做测试连接、不接真实 HIS
- Phase 23 HIS 连接配置状态 API Plan Mode 已完成：当前仅规划后续 pause / resume / revoke / delete API 的路径、可信输入、权限边界、状态流转、service 边界、审计边界、DTO 最小化和测试拆分；仍不新增 API、不修改 `src/**`、不处理凭证、不做测试连接、不接真实 HIS
- Phase 23 HIS 连接配置状态权限 Plan Mode 已完成：当前仅规划后续状态 API 权限，推荐 v1 使用 `open_connection:manage_status` 承载 pause / resume / revoke，使用 `open_connection:delete` 承载 delete / softDelete；`tenant_admin` 为唯一默认授权角色，普通机构角色、平台角色和审计角色默认拒绝，平台代管写入不进入 v1；仍不新增 API、不修改 `src/**`、不修改权限实现或 audit domain，不处理凭证、不做测试连接、不接真实 HIS
- Phase 23 HIS 连接配置状态 service Plan Mode 已完成：当前仅规划后续状态 service 的推荐导出函数、可信输入、repository 调用边界、事务内 repository 写入与 audit 写入、allowed / denied audit、稳定 result、DTO 最小化和测试拆分；仍不新增 service、不新增 API、不修改 `src/**`、不修改 parser / repository / 权限 / audit domain，不处理凭证、不做测试连接、不接真实 HIS
- 后续如需 adapter spec / plan、create / update API route 实现、pause / resume / revoke / delete 状态 API、凭证引用集成、凭证加密与密钥管理、连接健康检查 / 测试连接、Webhook / 同步任务、患者身份匹配、人工复核 / 标准事件预览、adapter domain-only 输入 DTO / parser 或真实外部系统接入 PoC，必须单独进入 Plan Mode 或独立 PR

后续阶段会依次加入：

- Phase 20 / Phase 21 后续扩展评估：路径模板 schema / API、租户自定义 SOP、平台端模板管理、路径效果分析、图表、导出、经营归因、外部系统输入或触达能力必须单独规划
- HIS 标准治疗事件 mapper 后续扩展、真实 HIS adapter、create / update API 实现、pause / resume / revoke / delete 状态 API、凭证引用集成、凭证加密、健康检查 / 测试连接、Webhook / 同步任务和后续拆分、业务事件埋点体系 spec、经营智能中心 v1、客服会话、版本历史 / diff 展示和完整治疗记录能力仍需单独规划
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

## 文档语言规范

后续所有面向人阅读的项目文档，原则上使用中文撰写，包括 README、roadmap、devlog、产品文档、spec 文档、plan 文档、PR 说明中的功能范围描述、团队交接说明、测试描述中面向人阅读的场景说明、页面文案和错误提示。

文档文件名和路径可以使用英文 slug，文件名建议采用 `YYYY-MM-DD-phaseXX-english-slug.md`。文件名不要求中文化；面向人阅读的标题、正文和说明内容应尽量中文化。

允许保留英文的内容：

- API 路径。
- 文件路径。
- 字段名。
- 变量名。
- 函数名。
- 类型名。
- 表名。
- 枚举值。
- 代码标识符。
- 命令。
- 技术缩写，例如 API、DTO、RBAC、PII、SQL、HIS、CRM、SCRM、AI、RAG、Webhook、OAuth。
- 与代码保持一致的 `resource` / `action` / `reason` / `status` 等值。

禁止后续文档继续出现无必要英文模板残留，例如：

- `Implementation Plan`
- `Goal:`
- `Architecture:`
- `Tech Stack:`
- `For agentic workers...`
- 其他纯英文模板说明。

历史文档处理原则：

- 已合并的历史文档文件名不主动大规模重命名。
- 历史文档中的英文模板残留，可在后续触碰时顺手中文化。
- 如果专门做历史文档清理，必须单独 docs-only PR。
- 不应把历史文档清理和功能开发混在同一个 PR 中。

日期命名规则：

- 后续新建 spec / plan 文档时，文件名前缀日期必须使用当前实际日期。
- 不得继续复用旧模板日期。
- 如需确认日期，可执行 `date +%F`。
